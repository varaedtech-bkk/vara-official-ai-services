import type { NextRequest } from 'next/server';
import { searchKnowledge, type KbHit } from '@/lib/kb';
import { isInternalSentence, publicFollowUp, publicSentences, smallTalkReply } from '@/lib/chat-public';
import { handleLiveAgentRequest, hasReachableContact, isLiveAgentContactAsk, isLiveAgentRequest } from '@/lib/live-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Text chat with Sunny. Answers are short public summaries of the knowledge
 * files. Staff notes and internal wording are stripped before reply.
 */

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_HISTORY = 12;

const IDENTITY_QUERY =
  /\b(who are you|what is vara|what does vara do|tell me about (the )?company|about vara)\b|วาราคือใคร|บริษัทอะไร|วาราทำอะไร/i;

const OWNER_QUERY =
  /\b(owner|owns|founder|ceo|director|shareholder|who (runs|leads|founded))\b|ผู้ก่อตั้ง|ซีอีโอ|เจ้าของ|กรรมการ/i;

function pickHits(query: string, lang: 'en' | 'th'): KbHit[] {
  const hits = searchKnowledge(query, { limit: 8, lang }).filter(
    (h) => !isInternalSentence(h.text.slice(0, 200)),
  );
  if (!hits.length) return [];

  if (OWNER_QUERY.test(query)) {
    const owner = hits.find((h) =>
      /owns|owner|founder|ceo|ผู้ก่อตั้ง|เจ้าของ/i.test(h.heading),
    );
    if (owner) return [owner];
  }

  const identityAsked = IDENTITY_QUERY.test(query) && !OWNER_QUERY.test(query);
  if (identityAsked) {
    const identity = hits.find((h) => /what vara edtech is|วาราคือใคร/i.test(h.heading));
    if (identity) return [identity];
  }

  if (lang === 'th') {
    const thai = hits.find(
      (h) => h.lang === 'th' || /[\u0E00-\u0E7F]/.test(h.text),
    );
    if (thai) return [thai];
  }

  return [hits[0]];
}

function chatAnswer(query: string, lang: 'en' | 'th'): string {
  const hits = pickHits(query, lang);
  if (!hits.length) {
    return lang === 'th'
      ? 'ตรงนี้ผมยังไม่มีคำตอบที่ชัดเจนพอครับ ฝากชื่อกับอีเมลหรือเบอร์ไว้ได้ ทีมงานจะติดต่อภายใน 24 ชั่วโมงครับ'
      : "I don't have a clear enough answer on that one. Leave a name and email or phone and the team will follow up within 24 hours.";
  }

  const primary = publicSentences(hits[0].text, 420, 3);
  if (!primary) {
    return lang === 'th'
      ? 'ตรงนี้ผมยังไม่มีคำตอบที่ชัดเจนพอครับ ฝากชื่อกับอีเมลหรือเบอร์ไว้ได้ ทีมงานจะติดต่อภายใน 24 ชั่วโมงครับ'
      : "I don't have a clear enough answer on that one. Leave a name and email or phone and the team will follow up within 24 hours.";
  }

  return `${primary}\n\n${publicFollowUp(lang)}`;
}

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; lang?: 'en' | 'th' };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const lang: 'en' | 'th' = body.lang === 'th' ? 'th' : 'en';
  const history = Array.isArray(body.messages) ? body.messages : [];

  const messages = history
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  while (messages.length && messages[0].role !== 'user') messages.shift();

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'a user message is required' }, { status: 400 });
  }

  const question = messages[messages.length - 1].content;
  const chitChat = smallTalkReply(question, lang);
  if (chitChat) {
    return Response.json({ reply: chitChat });
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const awaitingContact = Boolean(lastAssistant && isLiveAgentContactAsk(lastAssistant.content));
  const wantsLiveAgent =
    isLiveAgentRequest(question) || (awaitingContact && hasReachableContact(question));

  if (wantsLiveAgent) {
    const historyText = messages.map((m) => m.content).join('\n');
    const reply = await handleLiveAgentRequest({
      lang,
      question,
      historyText,
      source: 'chat',
    });
    return Response.json({ reply });
  }

  return Response.json({ reply: chatAnswer(question, lang) });
}

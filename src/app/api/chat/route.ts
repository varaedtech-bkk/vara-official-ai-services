import type { NextRequest } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { searchKnowledge } from '@/lib/kb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Text fallback for the voice assistant.
 *
 * Same persona, same knowledge — useful in a noisy room, on a bad mic, or when
 * someone would simply rather read. Retrieval-augmented: we search the local
 * knowledge base for the visitor's message and hand the top passages to Claude
 * as grounding, so no tool round-trip is needed.
 *
 * If ANTHROPIC_API_KEY is absent the endpoint still answers, using the
 * knowledge base directly. Degraded, but never dead.
 */

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_HISTORY = 12;

const TEXT_MODE_NOTE = {
  en: `
---
# Text mode

You are answering in a chat box rather than out loud. Adjust:
- You may use short paragraphs and at most one short list when it genuinely helps.
- Still keep answers tight — four sentences or so, unless asked for detail.
- You may write email addresses, phone numbers and URLs normally.
- You have no tools here. Use the reference passages below. If they don't cover it, say you'd rather have a specialist confirm it, and invite them to leave their details in the form on this page.
`,
  th: `
---
# โหมดข้อความ

ตอนนี้ท่านกำลังตอบในกล่องแชท ไม่ใช่การพูด ให้ปรับดังนี้
- ใช้ย่อหน้าสั้นๆ ได้ และใช้รายการสั้นๆ ได้ไม่เกินหนึ่งชุดเมื่อจำเป็นจริงๆ
- ยังคงตอบกระชับ ประมาณสี่ประโยค เว้นแต่ถูกขอรายละเอียด
- เขียนอีเมล เบอร์โทร และลิงก์แบบปกติได้
- โหมดนี้ไม่มีเครื่องมือ ให้ใช้ข้อมูลอ้างอิงด้านล่าง หากไม่ครอบคลุม ให้บอกว่าอยากให้ผู้เชี่ยวชาญยืนยัน และเชิญให้กรอกแบบฟอร์มบนหน้านี้
`,
};

let promptCache: Record<string, string> = {};

function loadSystemPrompt(lang: 'en' | 'th'): string {
  if (promptCache[lang]) return promptCache[lang];

  const candidates = [
    join(process.cwd(), 'vapi', `system-prompt.${lang}.md`),
    join(process.cwd(), '..', 'vapi', `system-prompt.${lang}.md`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      promptCache[lang] = readFileSync(path, 'utf8').trim();
      return promptCache[lang];
    }
  }

  // Minimal safety net if the prompt files were not deployed alongside the app.
  promptCache[lang] =
    lang === 'th'
      ? 'คุณคือซาร่า ผู้ช่วย AI ของ VARA EdTech บริษัทเทคโนโลยี AI และ VR/AR ในกรุงเทพฯ ตอบสั้น สุภาพ ลงท้ายด้วยค่ะ ห้ามแต่งข้อมูล'
      : 'You are Sara, the AI assistant for VARA EdTech, an AI and VR/AR company in Bangkok. Answer briefly and warmly. Never invent facts.';
  return promptCache[lang];
}

function groundingBlock(query: string, lang: 'en' | 'th'): string {
  const hits = searchKnowledge(query, { limit: 6, lang });
  if (!hits.length) {
    return '\n\n# Reference passages\n\n(No matching passages found in the VARA knowledge base for this question.)';
  }
  const body = hits
    .map((hit) => `### ${hit.docTitle} — ${hit.heading}\n${hit.text.trim()}`)
    .join('\n\n');
  return `\n\n# Reference passages (from VARA's knowledge base — treat as authoritative)\n\n${body}`;
}

/** No API key: answer straight from the knowledge base. */
function offlineAnswer(query: string, lang: 'en' | 'th') {
  const hits = searchKnowledge(query, { limit: 3, lang });

  if (!hits.length) {
    return lang === 'th'
      ? 'ขออภัยค่ะ ตรงนี้ดิฉันยังไม่มีข้อมูลที่ชัดเจนพอ รบกวนฝากชื่อและช่องทางติดต่อไว้ในแบบฟอร์มด้านล่าง ทีมงานจะตอบให้ครบถ้วนภายใน 24 ชั่วโมงค่ะ'
      : "I don't have a clear enough answer on that one. If you leave your details in the form below, the team will come back to you properly within 24 hours.";
  }

  const intro =
    lang === 'th'
      ? 'จากข้อมูลของ VARA EdTech ค่ะ\n\n'
      : "Here's what VARA's own material says:\n\n";

  return intro + hits.map((hit) => `**${hit.heading}**\n${hit.text.trim()}`).join('\n\n');
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
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }));

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'a user message is required' }, { status: 400 });
  }

  const question = messages[messages.length - 1].content;
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    return Response.json({ reply: offlineAnswer(question, lang), degraded: true });
  }

  const system =
    loadSystemPrompt(lang) + '\n' + TEXT_MODE_NOTE[lang] + groundingBlock(question, lang);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        temperature: 0.4,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[chat] anthropic ${res.status}: ${detail.slice(0, 400)}`);
      return Response.json({ reply: offlineAnswer(question, lang), degraded: true });
    }

    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const reply = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('')
      .trim();

    if (!reply) {
      return Response.json({ reply: offlineAnswer(question, lang), degraded: true });
    }

    return Response.json({ reply });
  } catch (err) {
    console.error('[chat] request failed', err);
    return Response.json({ reply: offlineAnswer(question, lang), degraded: true });
  }
}

/**
 * Public chat voice for Sunny.
 *
 * Knowledge files mix visitor-facing facts with staff instructions.
 * Text chat has no LLM, so this layer must strip staff language before
 * anything is shown to a guest.
 *
 * In markdown, put spoken facts first. Put rules under a line that starts
 * with `Staff notes:`. Never put "do not invent" in the opening sentences.
 */

export function extractPublicBody(raw: string): string {
  const cut = raw.split(/\n(?=(?:Staff notes:|Internal:))/i)[0] ?? raw;
  const withoutInline = cut.split(/\bStaff notes:/i)[0] ?? cut;
  return withoutInline.trim();
}

export function stripMarkdown(raw: string): string {
  return raw
    .replace(/^\s*\|.*\|$/gm, '')
    .replace(/^\s*[-:| ]+$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^[>|]\s?/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const INTERNAL_SENTENCE =
  /^(do not|don't|never |staff notes|internal:|how to talk|อย่าแต่ง|ห้ามแต่ง|ไม่ควรแต่ง)/i;

const INTERNAL_ANYWHERE =
  /\b(do not|don't|never)\s+(invent|quote|promise|confuse|name|add|send|present|fold|mention|claim|treat)\b|\bwhen asked\b|\bthe person to name\b|\bpublic (owner|bio|marketing figure|leader to name)\b|\btake (their )?details\b|\blead with\b|\bpoint to\b|\bsunny represents\b|\btreat that as\b|\bon this call\b|\bfrom memory\b|\bprice ids?\b|\b(openrouter|livekit|pm2|webhook|knowledge base|retrieval)\b|\bphase 2b\b|\ba stub exists\b|\bon the next server restart\b|\bcertified dbd\b|\bshareholding split\b|\bprivate-equity\b|\bอย่าแต่ง|\bห้ามแต่ง|\bไม่ควรแต่ง/i;

const LABEL_PREFIX =
  /^(public bio|partnerships|staff notes|internal|note on team size|honest limit|how to talk about it)\s*:\s*/i;

export function isInternalSentence(sentence: string): boolean {
  const s = sentence.trim();
  if (!s) return true;
  if (INTERNAL_SENTENCE.test(s)) return true;
  if (INTERNAL_ANYWHERE.test(s)) return true;
  return false;
}

export function publicSentences(raw: string, maxChars: number, maxSentences: number): string {
  const cleaned = stripMarkdown(extractPublicBody(raw));
  if (!cleaned) return '';

  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  let out = '';
  let n = 0;

  for (const part of parts) {
    const sentence = part.replace(LABEL_PREFIX, '').trim();
    if (isInternalSentence(sentence)) continue;
    if (n >= maxSentences) break;
    if (out.length + sentence.length + 1 > maxChars) break;
    out += (out ? ' ' : '') + sentence;
    n += 1;
  }

  if (out) return out;
  const fallback = parts.map((p) => p.replace(LABEL_PREFIX, '').trim()).find((p) => !isInternalSentence(p));
  if (!fallback) return '';
  return fallback.length > maxChars ? `${fallback.slice(0, maxChars).trim()}…` : fallback;
}

export function publicFollowUp(lang: 'en' | 'th'): string {
  return lang === 'th' ? 'มีอะไรให้ช่วยต่อไหมครับ' : 'Is there anything else I can help with?';
}

const GREETING =
  /^(hi+|h[ie]llo+|hey+|yo+|hiya|howdy|hola|good\s*(morning|afternoon|evening)|what'?s\s*up|sup|สวัสดี(ครับ|ค่ะ)?|หวัดดี(ครับ|ค่ะ)?|ทักทาย|ดีครับ|ดีค่ะ|โหล|ฮัลโหล|หย[ิี])[\s!.,?]*$/i;

const THANKS =
  /^(thanks|thank you|thx|ty|cheers|ขอบคุณ(ครับ|ค่ะ)?|ขอบใจ)([\s!.,].*)?$/i;

const HOW_ARE_YOU =
  /^(how are you( doing)?|how'?s it going|how do you do|สบายดีไหม(ครับ|ค่ะ)?)[\s!.,?]*$/i;

const BYE =
  /^(bye|goodbye|good bye|see you|later|ลาก่อน|บาย|ไปแล้วนะ)[\s!.,?]*$/i;

/** Greetings and courtesy — not knowledge questions. */
export function smallTalkReply(query: string, lang: 'en' | 'th'): string | null {
  const q = query.trim();
  if (!q) return null;

  if (GREETING.test(q)) {
    return lang === 'th'
      ? 'สวัสดีครับ ผม Sunny จาก VARA EdTech ครับ อยากทราบเรื่องบริการ AI ผลงานที่ใช้งานอยู่ หรือความร่วมมือกับมหาวิทยาลัยไหมครับ'
      : "Hello — I'm Sunny from VARA EdTech. Ask about our AI services, the products already live, or how we work with universities.";
  }
  if (HOW_ARE_YOU.test(q)) {
    return lang === 'th'
      ? 'สบายดีครับ ยินดีช่วยเรื่อง VARA EdTech ครับ ท่านอยากทราบเรื่องไหนก่อนดีครับ'
      : "I'm well, thanks. I can help with VARA EdTech — services, products, or university work. What would you like to know?";
  }
  if (THANKS.test(q)) {
    return lang === 'th'
      ? 'ด้วยความยินดีครับ มีอะไรให้ช่วยต่อไหมครับ'
      : "You're welcome. Is there anything else I can help with?";
  }
  if (BYE.test(q)) {
    return lang === 'th'
      ? 'ขอบคุณที่คุยกันครับ หากต้องการให้ทีมติดต่อกลับ ฝากอีเมลหรือเบอร์ไว้ได้เลยครับ'
      : 'Thanks for chatting. If you want the team to follow up, leave an email or phone and they will.';
  }
  return null;
}

import { saveLead, type Lead } from '@/lib/leads';
import { readEmailLog, sendStaffAlert } from '@/lib/email';
import { firstVisitorEmail } from '@/lib/contact';
import { formatWhatsapp, readPlatformConfig } from '@/lib/saas/platform';

const PHONE_RE = /(?:\+?66|0)\s*[\d\s\-()]{8,14}|\+\d{8,15}/;

const ASK_MARKER_EN = 'so we can reach you';
const ASK_MARKER_TH = 'เพื่อให้ทีมติดต่อกลับได้';

export function isLiveAgentRequest(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (
    /\b(live\s*agent|real\s+(person|human)|human\s+(agent|operator)|customer\s+service|talk\s+to\s+(a\s+|an\s+)?(human|person|someone|agent|operator)|speak\s+to\s+(a\s+|an\s+)?(human|person|someone|agent|operator)|connect\s+me(\s+with|\s+to)?|transfer\s+me|call\s+me\s+back)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  return /คุยกับคน|พนักงานจริง|เจ้าหน้าที่|คนจริง|โอนสาย|ติดต่อเจ้าหน้าที่|ขอคุยกับแอดมิน/.test(q);
}

export function isLiveAgentContactAsk(text: string): boolean {
  return text.includes(ASK_MARKER_EN) || text.includes(ASK_MARKER_TH);
}

export function visitorPhone(text: string): string | undefined {
  const m = text.match(PHONE_RE);
  if (!m) return undefined;
  return m[0].replace(/\s+/g, ' ').trim();
}

export function hasReachableContact(text: string): boolean {
  return Boolean(firstVisitorEmail(text) || visitorPhone(text));
}

function visitorName(text: string, email?: string): string {
  const named = text.match(
    /(?:my name is|i(?:'| a)?m|this is|ชื่อ(?:ของฉัน|ผม|ดิฉัน)?(?:คือ)?)\s+([A-Za-z\u0E00-\u0E7F][A-Za-z\u0E00-\u0E7F .'-]{1,50})/i,
  );
  if (named?.[1]) {
    return named[1].replace(/[,.].*/, '').replace(/\s+(and|และ)\s+.*/i, '').trim();
  }
  if (email) return email.split('@')[0];
  return 'Website visitor';
}

export function liveAgentAskReply(lang: 'en' | 'th'): string {
  const { href, display } = formatWhatsapp(readPlatformConfig().urgentWhatsapp);
  if (lang === 'th') {
    return `แชทนี้ไม่ได้ต่อสายไปหาเจ้าหน้าที่โดยตรงครับ ฝากชื่อกับอีเมลหรือเบอร์โทรไว้${ASK_MARKER_TH} หากเร่งด่วน ส่ง WhatsApp มาที่ ${display} ได้เลย ${href}`;
  }
  return `We don't connect a live agent in this chat. Please leave your name and an email or phone number ${ASK_MARKER_EN}. If it's urgent, WhatsApp us now on ${display} — ${href}`;
}

export function liveAgentConfirmReply(lang: 'en' | 'th', email?: string, phone?: string): string {
  const { href, display } = formatWhatsapp(readPlatformConfig().urgentWhatsapp);
  const via = email || phone || '';
  if (lang === 'th') {
    return `รับไว้แล้วครับ ทีมงานจะติดต่อกลับที่ ${via} โดยเร็วที่สุด หากเร่งด่วน ส่ง WhatsApp มาที่ ${display} ได้เลย ${href}`;
  }
  return `Thanks — a teammate will email or call you back at ${via} as soon as possible. For something urgent, WhatsApp us on ${display} — ${href}`;
}

export async function notifyLiveAgentStaff(lead: Lead, question: string): Promise<void> {
  if (!lead.email && !lead.phone) return;

  const visitorKey = (lead.email || lead.phone || 'anon').toLowerCase();
  const recent = Date.now() - 10 * 60 * 1000;
  const alreadyAlerted = readEmailLog().some(
    (e) =>
      e.requestType === 'live-agent' &&
      e.leadName === visitorKey &&
      Date.parse(e.sentAt) > recent,
  );
  if (alreadyAlerted) return;

  const platform = readPlatformConfig();
  const { display } = formatWhatsapp(platform.urgentWhatsapp);

  await sendStaffAlert({
    to: platform.liveAgentEmails,
    leadId: lead.id,
    requestType: 'live-agent',
    visitorKey,
    subject: `Live agent request — ${lead.name || 'visitor'}`,
    text: [
      'A visitor asked to speak with a live agent on the VARA assistant.',
      'We did not connect them in-product. Please email or call them back ASAP.',
      '',
      `Language: ${lead.language}`,
      `Name: ${lead.name || '—'}`,
      `Email: ${lead.email || 'not given'}`,
      `Phone: ${lead.phone || 'not given'}`,
      `Urgent WhatsApp we offered: ${display}`,
      '',
      'Their message:',
      question,
    ].join('\n'),
  });
}

export async function handleLiveAgentRequest(opts: {
  lang: 'en' | 'th';
  question: string;
  historyText: string;
  source: Lead['source'];
  tenantSlug?: string;
}): Promise<string> {
  const blob = `${opts.historyText}\n${opts.question}`;
  const email = firstVisitorEmail(opts.question, blob);
  const phone = visitorPhone(opts.question) || visitorPhone(blob);

  if (!email && !phone) {
    return liveAgentAskReply(opts.lang);
  }

  const name = visitorName(`${opts.historyText}\n${opts.question}`, email);
  const originalAsk =
    opts.historyText
      .split('\n')
      .reverse()
      .find((line) => isLiveAgentRequest(line)) || opts.question;

  const lead = saveLead({
    source: opts.source,
    language: opts.lang,
    name,
    email,
    phone,
    requestType: 'live-agent',
    interest: 'Requested a live person',
    notes: originalAsk.slice(0, 2000),
    preferredContact: email ? 'email' : 'phone',
    tenantSlug: opts.tenantSlug,
    tenantId: opts.tenantSlug,
  });

  void notifyLiveAgentStaff(lead, originalAsk);

  return liveAgentConfirmReply(opts.lang, email, phone);
}

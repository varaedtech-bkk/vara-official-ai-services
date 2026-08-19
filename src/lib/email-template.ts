import type { Lead } from './leads';

export type EmailBrand = {
  companyName?: string;
  assistantName?: string;
  fromEmail?: string;
  website?: string;
  phone?: string;
  address?: string;
};

export type EmailPassage = {
  title: string;
  body: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function textToHtml(text: string): string {
  const paras = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111;line-height:1.55;">${paras}</body></html>`;
}

export function displayEmailAddress(from?: string) {
  const m = from?.match(/<([^>]+)>/);
  if (m) return m[1];
  return from?.trim() || 'info@varaedtech.com';
}

/** Pull the client's ask from a call summary — not the admin recap. */
export function inferClientAsk(summary?: string, interest?: string, topic?: string): string {
  const topicClean = topic?.trim();
  if (topicClean && topicClean.length < 120 && !/visitor|inquired|followed up/i.test(topicClean)) {
    return topicClean;
  }
  if (interest?.trim() && interest.length < 100 && !/visitor|inquired|followed up/i.test(interest)) {
    return interest.trim();
  }

  const src = [summary, interest, topic].filter(Boolean).join(' ');
  const patterns = [
    /inquir(?:ed|y)\s+about\s+([^.]{8,160})/i,
    /asked\s+(?:about|for)\s+([^.]{8,160})/i,
    /requested\s+(?:an email with\s+)?([^.]{8,160})/i,
    /interested\s+in\s+([^.]{8,160})/i,
  ];
  for (const re of patterns) {
    const m = src.match(re);
    if (!m) continue;
    let ask = m[1]
      .replace(/\s+and\s+requested\b[\s\S]*/i, '')
      .replace(/\s+and\s+provided\b[\s\S]*/i, '')
      .replace(/\b(an email with|comprehensive details|their email address)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[,;\s]+|[,;\s]+$/g, '')
      .trim();
    if (ask.length >= 8 && ask.length <= 140) return ask;
  }

  const known = [
    'chatbot',
    'voice assistant',
    'voice ai',
    'answer engine',
    'aeo',
    'university',
    'private ai',
    'redline',
    'estimaro',
  ];
  const lower = src.toLowerCase();
  for (const word of known) {
    if (lower.includes(word)) {
      if (word === 'chatbot') return 'AI chatbot services';
      if (word === 'voice assistant' || word === 'voice ai') return 'AI voice assistant services';
      if (word === 'aeo' || word === 'answer engine') return 'Answer Engine Optimization';
      return word;
    }
  }

  return 'our services';
}

export function pickSkillsForAsk(
  skills: { title: string; body: string }[],
  ask: string,
): EmailPassage[] {
  if (!skills.length) return [];
  const words = ask.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const scored = skills.map((s) => {
    const hay = `${s.title} ${s.body}`.toLowerCase();
    const n = words.filter((w) => hay.includes(w)).length;
    return { s, n };
  });
  scored.sort((a, b) => b.n - a.n);
  const matched = scored.filter((x) => x.n > 0).map((x) => x.s);
  return (matched.length ? matched : skills).slice(0, 3).map((s) => ({
    title: s.title,
    body: s.body.trim(),
  }));
}

/** Client-facing letter. Call recap stays on the dashboard, not in this body. */
export function buildEmailBody(
  lead: Lead,
  brand?: EmailBrand,
  extras?: { ask?: string; passages?: EmailPassage[] },
): { subject: string; text: string; html: string } {
  const name = lead.name?.trim() || 'there';
  const company = brand?.companyName?.trim() || 'VARA EdTech';
  const assistant = brand?.assistantName?.trim() || 'Sunny';
  const ask = extras?.ask || inferClientAsk(lead.summary, lead.interest, lead.topic);
  const fromEmail = displayEmailAddress(brand?.fromEmail);
  const phone = brand?.phone || '+66 94 887 7955';
  const address = brand?.address || '5th Floor, Forum Tower, 184 Ratchadaphisek Rd, Bangkok 10310';
  const website = brand?.website?.replace(/^https?:\/\//, '') || 'varaedtech.com';

  const subject = `${ask.charAt(0).toUpperCase()}${ask.slice(1)} — details from ${company}`;

  const greeting = `Hi ${name},`;
  const opening = `Thanks for speaking with ${assistant} today. You asked for details on ${ask} — here is an overview from our team.`;

  const detailBlocks = (extras?.passages ?? [])
    .filter((p) => p.body.trim())
    .map((p) => `${p.title}\n${p.body.trim()}`);

  const details = detailBlocks.length
    ? detailBlocks.join('\n\n')
    : `We can follow up with a full write-up of ${ask}, including how we would approach your use case, timeline, and next steps.`;

  const close = [
    'Reply to this email with any extra questions, or tell us if you would like pricing, a short demo, or a tailored proposal.',
    '',
    `Kind regards,`,
    `The ${company} team`,
    fromEmail,
    phone,
    website,
    address,
  ].join('\n');

  const text = [greeting, '', opening, '', details, '', close].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { subject, text, html: textToHtml(text) };
}

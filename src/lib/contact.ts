/** Pull visitor contact details out of transcripts and Vapi analysis. */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const COMPANY_DOMAINS = ['varaedtech.com'];

/** True when the address belongs to VARA, not the visitor. */
export function isCompanyEmail(raw?: string | null): boolean {
  if (!raw) return false;
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return false;
  const domain = email.slice(at + 1);
  return COMPANY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function extractEmails(text?: string | null): string[] {
  if (!text) return [];
  const found = text.match(EMAIL_RE) ?? [];
  const unique: string[] = [];
  for (const raw of found) {
    const email = raw.toLowerCase();
    if (isCompanyEmail(email)) continue;
    if (email.endsWith('.png') || email.endsWith('.jpg')) continue;
    if (!unique.includes(email)) unique.push(email);
  }
  return unique;
}

export function firstVisitorEmail(
  ...sources: Array<string | undefined | null>
): string | undefined {
  for (const source of sources) {
    const hit = extractEmails(source)[0];
    if (hit) return hit;
  }
  return undefined;
}

/** Rank addresses so the LLM summary (usually spelled correctly) wins over raw STT. */
export function emailsFromSources(sources: Array<{ text?: string | null; weight: number }>): {
  preferred?: string;
  all: string[];
} {
  const scored = new Map<string, number>();
  for (const { text, weight } of sources) {
    for (const email of extractEmails(text)) {
      scored.set(email, Math.max(scored.get(email) ?? 0, weight));
    }
  }
  const all = [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([email]) => email);
  return { preferred: all[0], all };
}

/** Pull visitor contact details out of transcripts and Vapi analysis. */

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const INTERNAL = new Set([
  'info@varaedtech.com',
  'ceo@varaedtech.com',
]);

export function extractEmails(text?: string | null): string[] {
  if (!text) return [];
  const found = text.match(EMAIL_RE) ?? [];
  const unique: string[] = [];
  for (const raw of found) {
    const email = raw.toLowerCase();
    if (INTERNAL.has(email)) continue;
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

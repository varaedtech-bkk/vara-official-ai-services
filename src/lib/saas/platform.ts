import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type PlatformConfig = {
  liveAgentEmails: string[];
  urgentWhatsapp: string;
};

const DATA_DIR = process.env.LEADS_DIR || join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'platform.json');

export const DEFAULT_LIVE_AGENT_EMAIL = 'ceo@varaedtech.com';
export const DEFAULT_WHATSAPP_DIGITS = '66948877955';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseEmailList(raw: string): string[] {
  const parts = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const unique: string[] = [];
  for (const email of parts) {
    if (!EMAIL_RE.test(email)) continue;
    if (!unique.includes(email)) unique.push(email);
  }
  return unique;
}

export function whatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return DEFAULT_WHATSAPP_DIGITS;
  if (digits.startsWith('0') && digits.length === 10) return `66${digits.slice(1)}`;
  return digits;
}

export function formatWhatsapp(digits: string): { href: string; display: string } {
  const d = whatsappDigits(digits);
  let display = `+${d}`;
  if (d.startsWith('66') && d.length >= 11) {
    display = `+66 ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  return { href: `https://wa.me/${d}`, display };
}

function defaults(): PlatformConfig {
  return {
    liveAgentEmails: [DEFAULT_LIVE_AGENT_EMAIL],
    urgentWhatsapp: DEFAULT_WHATSAPP_DIGITS,
  };
}

export function readPlatformConfig(): PlatformConfig {
  const fallback = defaults();
  if (!existsSync(FILE)) return fallback;
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<PlatformConfig>;
    const emails = Array.isArray(raw.liveAgentEmails)
      ? parseEmailList(raw.liveAgentEmails.join('\n'))
      : fallback.liveAgentEmails;
    return {
      liveAgentEmails: emails.length ? emails : fallback.liveAgentEmails,
      urgentWhatsapp: whatsappDigits(raw.urgentWhatsapp || fallback.urgentWhatsapp),
    };
  } catch {
    return fallback;
  }
}

export function writePlatformConfig(input: { liveAgentEmails: string; urgentWhatsapp: string }): PlatformConfig {
  const emails = parseEmailList(input.liveAgentEmails);
  if (!emails.length) throw new Error('Add at least one valid email.');
  const next: PlatformConfig = {
    liveAgentEmails: emails,
    urgentWhatsapp: whatsappDigits(input.urgentWhatsapp),
  };
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

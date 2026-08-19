import nodemailer from 'nodemailer';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Lead } from './leads';
import { getTenant } from './saas/store';
import { buildEmailBody as composeEmailBody, textToHtml } from './email-template';

export { buildEmailBody } from './email-template';

/* ------------------------------------------------------------------ log */

const DATA_DIR = process.env.LEADS_DIR || join(process.cwd(), 'data');
const EMAIL_LOG_FILE = join(DATA_DIR, 'email-log.jsonl');

export type EmailLogEntry = {
  id: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'skipped';
  leadId: string;
  to: string;
  subject: string;
  messageId?: string;
  error?: string;
  /** lead snapshot fields for display */
  leadName?: string;
  leadOrg?: string;
  requestType?: string;
};

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function writeLog(entry: EmailLogEntry) {
  try {
    ensureDir();
    appendFileSync(EMAIL_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('[email-log] failed to write log entry', err);
  }
}

export function readEmailLog(): EmailLogEntry[] {
  if (!existsSync(EMAIL_LOG_FILE)) return [];
  const entries: EmailLogEntry[] = [];
  for (const line of readFileSync(EMAIL_LOG_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line) as EmailLogEntry); } catch { /* skip */ }
  }
  return entries.reverse();
}

/** True if we already successfully mailed this address in the last 24 hours. */
export function recentlySentTo(email: string, withinMs = 24 * 60 * 60 * 1000): boolean {
  const target = email.trim().toLowerCase();
  const cutoff = Date.now() - withinMs;
  return readEmailLog().some(
    (e) =>
      e.status === 'sent' &&
      e.to.trim().toLowerCase() === target &&
      Date.parse(e.sentAt) > cutoff,
  );
}

/* -------------------------------------------------------------- mailer */

function getTransporter(smtp?: { host: string; port: number; user: string; pass: string } | null) {
  const host = smtp?.host || process.env.EMAIL_HOST;
  const user = smtp?.user || process.env.EMAIL_USER;
  const pass = smtp?.pass || process.env.EMAIL_PASS;
  if (!host || !user || !pass) return null;
  const port = smtp?.port || Number(process.env.EMAIL_PORT ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendStaffAlert(opts: {
  to: string[];
  subject: string;
  text: string;
  leadId: string;
  requestType?: string;
  visitorKey?: string;
}): Promise<void> {
  const recipients = [...new Set(opts.to.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return;

  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const replyTo = process.env.EMAIL_REPLY_TO || from;
  const visitorKey = opts.visitorKey;

  if (!transporter || !from) {
    console.warn('[email] SMTP not configured — skipping staff alert', opts.leadId);
    for (const to of recipients) {
      writeLog({
        id: `${opts.leadId}-${Date.now()}`,
        sentAt: new Date().toISOString(),
        status: 'skipped',
        leadId: opts.leadId,
        to,
        subject: opts.subject,
        error: 'SMTP not configured',
        requestType: opts.requestType,
        leadName: visitorKey,
      });
    }
    return;
  }

  try {
    const info = await transporter.sendMail({
      from,
      replyTo,
      to: recipients.join(', '),
      subject: opts.subject,
      text: opts.text,
      html: textToHtml(opts.text),
    });
    console.log(`[email] staff alert to ${recipients.join(', ')} msgId=${info.messageId}`);
    for (const to of recipients) {
      writeLog({
        id: `${opts.leadId}-${Date.now()}`,
        sentAt: new Date().toISOString(),
        status: 'sent',
        leadId: opts.leadId,
        to,
        subject: opts.subject,
        messageId: info.messageId,
        requestType: opts.requestType,
        leadName: visitorKey,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[email] staff alert failed', err);
    for (const to of recipients) {
      writeLog({
        id: `${opts.leadId}-${Date.now()}`,
        sentAt: new Date().toISOString(),
        status: 'failed',
        leadId: opts.leadId,
        to,
        subject: opts.subject,
        error,
        requestType: opts.requestType,
        leadName: visitorKey,
      });
    }
  }
}

export async function sendFollowUpEmail(
  lead: Lead,
  opts?: { force?: boolean; subject?: string; text?: string; html?: string },
): Promise<void> {
  if (!lead.email) return;

  if (!opts?.force && recentlySentTo(lead.email)) {
    console.log(`[email] skip duplicate to ${lead.email} (already sent in last 24h)`);
    return;
  }

  const tenant = lead.tenantId || lead.tenantSlug ? getTenant(lead.tenantId || lead.tenantSlug || '') : undefined;
  const transporter = getTransporter(tenant?.smtp);
  if (!transporter) {
    console.warn('[email] SMTP not configured — skipping follow-up for lead', lead.id);
    writeLog({
      id: `${lead.id}-${Date.now()}`,
      sentAt: new Date().toISOString(),
      status: 'skipped',
      leadId: lead.id,
      to: lead.email,
      subject: '(not sent — SMTP not configured)',
      leadName: lead.name,
      leadOrg: lead.organization,
      requestType: lead.requestType,
    });
    return;
  }

  const drafted = composeEmailBody(lead, {
    companyName: tenant?.companyName,
    assistantName: tenant?.assistantName,
    fromEmail: tenant?.smtp?.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
  });
  const subject = opts?.subject?.trim() || drafted.subject;
  const text = opts?.text?.trim() || drafted.text;
  const html = opts?.html?.trim() || (opts?.text?.trim() ? textToHtml(text) : drafted.html);
  const from = tenant?.smtp?.from || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const replyTo = tenant?.smtp?.replyTo || process.env.EMAIL_REPLY_TO || from;

  try {
    const info = await transporter.sendMail({ from, replyTo, to: lead.email, subject, text, html });
    console.log(`[email] sent to ${lead.email} (lead ${lead.id}) msgId=${info.messageId}`);
    writeLog({
      id: `${lead.id}-${Date.now()}`,
      sentAt: new Date().toISOString(),
      status: 'sent',
      leadId: lead.id,
      to: lead.email,
      subject,
      messageId: info.messageId,
      leadName: lead.name,
      leadOrg: lead.organization,
      requestType: lead.requestType,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[email] send failed for lead', lead.id, err);
    writeLog({
      id: `${lead.id}-${Date.now()}`,
      sentAt: new Date().toISOString(),
      status: 'failed',
      leadId: lead.id,
      to: lead.email,
      subject,
      error,
      leadName: lead.name,
      leadOrg: lead.organization,
      requestType: lead.requestType,
    });
  }
}

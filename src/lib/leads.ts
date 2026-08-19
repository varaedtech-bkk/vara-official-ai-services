import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Append-only JSONL lead store. No database, no external service — leads
 * survive a restart and can be read with `cat`, which is exactly what a live
 * demo needs.
 *
 * File: <LEADS_DIR or ./data>/leads.jsonl
 */

export type Lead = {
  id: string;
  createdAt: string;
  source: 'voice' | 'form' | 'chat';
  language: 'en' | 'th';
  name?: string;
  organization?: string;
  role?: string;
  email?: string;
  phone?: string;
  interest?: string;
  /** What they actually asked for: proposal, quote, callback, meeting… */
  requestType?: string;
  /** What the proposal or follow-up should cover, in their own words. */
  topic?: string;
  audience?: string;
  notes?: string;
  preferredContact?: string;
  callId?: string;
  transcript?: string;
  summary?: string;
  tenantId?: string;
  tenantSlug?: string;
};

const DATA_DIR = process.env.LEADS_DIR || join(process.cwd(), 'data');
const LEADS_FILE = join(DATA_DIR, 'leads.jsonl');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

const clean = (value: unknown, max = 2000): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

export function saveLead(input: Partial<Lead> & { source: Lead['source'] }): Lead {
  ensureDir();

  /*
   * The same capture can arrive twice — once from the voice platform's webhook
   * and once mirrored from the browser — so that a lead is never lost if one
   * path fails. Reuse the existing id when that happens; readLeads() merges
   * records by id, so the two become one row with the better fields from each.
   */
  const callId = clean(input.callId, 200);
  const name = clean(input.name, 200);
  const email = clean(input.email, 320);
  const phone = clean(input.phone, 60);

  const sameName = (l: Lead) =>
    !!name && (l.name || '').trim().toLowerCase() === name.trim().toLowerCase();

  // Prefer the call id. It is not always available in the browser, so fall
  // back to the same person appearing again within a few minutes — which is
  // what a duplicated save from the other path looks like.
  const RECENT_MS = 15 * 60 * 1000;
  const now = Date.now();
  const existing = name
    ? readLeads().find((l) => {
        if (callId && l.callId === callId) return sameName(l);
        if (!sameName(l)) return false;
        const age = now - Date.parse(l.createdAt || '');
        if (!Number.isFinite(age) || age > RECENT_MS) return false;
        return (
          (!!email && l.email === email) ||
          (!!phone && l.phone === phone) ||
          (!email && !phone && !l.email && !l.phone)
        );
      })
    : undefined;

  const lead: Lead = {
    id: existing?.id ?? randomUUID(),
    createdAt: new Date().toISOString(),
    source: input.source,
    language: input.language === 'th' ? 'th' : 'en',
    name,
    organization: clean(input.organization, 300),
    role: clean(input.role, 200),
    email,
    phone,
    interest: clean(input.interest, 500),
    requestType: clean(input.requestType, 40),
    topic: clean(input.topic, 1000),
    audience: clean(input.audience, 60),
    notes: clean(input.notes, 4000),
    preferredContact: clean(input.preferredContact, 40),
    callId,
    transcript: clean(input.transcript, 60000),
    summary: clean(input.summary, 4000),
    tenantId: clean(input.tenantId, 80),
    tenantSlug: clean(input.tenantSlug, 80),
  };

  appendFileSync(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');
  return lead;
}

/**
 * Read every lead, newest first.
 *
 * The store is append-only, so a lead can appear more than once — a later
 * record is an update (for example the transcript attached when the call
 * ended). Records are merged by id, later fields winning, so callers always
 * see one row per lead.
 */
export function readLeads(): Lead[] {
  if (!existsSync(LEADS_FILE)) return [];

  const merged = new Map<string, Lead>();
  const order: string[] = [];

  for (const line of readFileSync(LEADS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;

    let record: Lead;
    try {
      record = JSON.parse(line) as Lead;
    } catch {
      continue;
    }
    if (!record?.id) continue;

    const previous = merged.get(record.id);
    if (previous) {
      // Keep the original capture time; take the newer non-empty fields.
      merged.set(record.id, { ...previous, ...record, createdAt: previous.createdAt });
    } else {
      merged.set(record.id, record);
      order.push(record.id);
    }
  }

  return order
    .map((id) => merged.get(id))
    .filter((lead): lead is Lead => lead !== undefined)
    .reverse();
}

/**
 * Attach an end-of-call transcript and summary to the most recent lead from
 * the same call, so a captured lead carries the conversation that produced it.
 * Returns true if a matching lead was found.
 */
export function annotateCall(callId: string, patch: { transcript?: string; summary?: string }): boolean {
  const leads = readLeads();
  const match = leads.find((lead) => lead.callId === callId);
  if (!match) return false;

  ensureDir();
  appendFileSync(
    LEADS_FILE,
    JSON.stringify({ ...match, ...patch, createdAt: new Date().toISOString(), id: match.id }) + '\n',
    'utf8'
  );
  return true;
}

const CSV_COLUMNS: (keyof Lead)[] = [
  'createdAt', 'requestType', 'source', 'language', 'name', 'organization', 'role',
  'email', 'phone', 'preferredContact', 'interest', 'topic', 'audience', 'notes', 'summary',
];

export function leadsToCsv(leads: Lead[]): string {
  const escape = (value: unknown) => {
    const str = value === undefined || value === null ? '' : String(value);
    return `"${str.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  };
  const header = CSV_COLUMNS.join(',');
  const rows = leads.map((lead) => CSV_COLUMNS.map((col) => escape(lead[col])).join(','));
  // BOM so Excel opens Thai text correctly.
  return '﻿' + [header, ...rows].join('\n');
}

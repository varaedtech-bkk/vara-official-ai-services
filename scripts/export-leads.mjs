#!/usr/bin/env node
/**
 * Export captured leads to CSV, straight from the JSONL store.
 *
 *   npm run leads:export                 -> writes data/leads-YYYY-MM-DD.csv
 *   npm run leads:export -- --print      -> prints a summary table instead
 *
 * Runs entirely on the server; no token and no HTTP involved.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = process.env.LEADS_DIR || join(ROOT, 'data');
const FILE = join(DATA_DIR, 'leads.jsonl');

const COLUMNS = [
  'createdAt', 'requestType', 'source', 'language', 'name', 'organization', 'role',
  'email', 'phone', 'preferredContact', 'interest', 'topic', 'audience', 'notes', 'summary',
];

if (!existsSync(FILE)) {
  console.log(`No leads yet — ${FILE} does not exist.`);
  process.exit(0);
}

const leads = readFileSync(FILE, 'utf8')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

// Later records with the same id supersede earlier ones (transcript attachment).
const byId = new Map();
for (const lead of leads) byId.set(lead.id, { ...(byId.get(lead.id) || {}), ...lead });
const rows = [...byId.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

if (process.argv.includes('--print')) {
  console.log(`\n${rows.length} lead(s)\n`);
  for (const row of rows) {
    console.log(
      `${row.createdAt}  [${(row.requestType || 'general').toUpperCase()}]  ${row.name || '-'}` +
        `  |  ${row.organization || '-'}` +
        `\n    send via: ${row.preferredContact || '-'}  ->  ${row.email || row.phone || 'NO CONTACT'}` +
        `\n    about:    ${row.topic || row.interest || '-'}`
    );
  }
  console.log('');
  process.exit(0);
}

const escape = (value) =>
  `"${String(value ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

// UTF-8 BOM so Excel renders Thai correctly.
const csv =
  '﻿' +
  [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((col) => escape(row[col])).join(','))].join('\n');

const out = join(DATA_DIR, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
writeFileSync(out, csv, 'utf8');
console.log(`Wrote ${rows.length} lead(s) to ${out}`);

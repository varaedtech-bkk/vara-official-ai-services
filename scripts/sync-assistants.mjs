#!/usr/bin/env node
/**
 * Create or update the two Vara assistants on Vapi.
 *
 *   npm run vapi:sync     -> creates/updates both assistants via the Vapi API
 *   npm run vapi:print    -> writes paste-ready JSON to vapi/out/ instead
 *
 * Requires in .env (or the real environment):
 *   VAPI_PRIVATE_KEY          your Vapi private/server API key
 *   NEXT_PUBLIC_SITE_URL      the public https URL of this app (tool webhooks)
 *   VAPI_ASSISTANT_ID_EN      optional — set to update in place instead of create
 *   VAPI_ASSISTANT_ID_TH      optional
 *
 * After a create, the script prints the new assistant IDs. Put them in .env.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAssistant, LANGS } from '../vapi/assistant-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.vapi.ai';

/* ------------------------------------------------------------- .env loader */

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

/* ------------------------------------------------------------------ helpers */

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function fail(msg) {
  console.error(`\n${c.red('✕')} ${msg}\n`);
  process.exit(1);
}

async function vapiRequest(method, path, key, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const detail =
      typeof json?.message === 'string'
        ? json.message
        : JSON.stringify(json, null, 2);
    throw new Error(`${method} ${path} → ${res.status}\n${detail}`);
  }
  return json;
}

/* --------------------------------------------------------------------- main */

async function main() {
  loadEnv();

  const printOnly = process.argv.includes('--print');
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim();

  if (!baseUrl) {
    fail(
      'NEXT_PUBLIC_SITE_URL is not set.\n' +
        '  This must be the public https URL of the deployed app, because Vapi\n' +
        '  calls it for the search_knowledge and capture_lead tools.\n' +
        '  Example: NEXT_PUBLIC_SITE_URL=https://ai.varaedtech.com'
    );
  }
  if (!printOnly && !/^https:\/\//i.test(baseUrl)) {
    fail(
      `NEXT_PUBLIC_SITE_URL must start with https:// (got "${baseUrl}").\n` +
        '  Vapi will not call an http:// or localhost webhook.\n' +
        '  For local testing, expose the app with a tunnel and use that URL.'
    );
  }

  const built = Object.fromEntries(
    LANGS.map((lang) => [lang, buildAssistant(lang, { baseUrl, env: process.env })])
  );

  /* --print: write JSON files and stop. */
  if (printOnly) {
    const outDir = join(ROOT, 'vapi', 'out');
    mkdirSync(outDir, { recursive: true });
    for (const lang of LANGS) {
      const file = join(outDir, `assistant.${lang}.json`);
      writeFileSync(file, JSON.stringify(built[lang], null, 2) + '\n', 'utf8');
      console.log(`${c.green('✓')} wrote ${c.bold(`vapi/out/assistant.${lang}.json`)}`);
    }
    console.log(
      `\n${c.dim('Paste each file into Vapi Dashboard → Assistants → Create → JSON/import.')}`
    );
    console.log(
      `${c.dim('Then copy each assistant ID into .env as VAPI_ASSISTANT_ID_EN / _TH.')}\n`
    );
    return;
  }

  const key = (process.env.VAPI_PRIVATE_KEY || '').trim();
  if (!key) {
    fail(
      'VAPI_PRIVATE_KEY is not set.\n' +
        '  Get it from Vapi Dashboard → Settings → API Keys → Private Key.\n' +
        '  Or run `npm run vapi:print` to generate JSON you can paste in manually.'
    );
  }

  console.log(`\n${c.bold('Syncing Vara assistants')}`);
  console.log(`${c.dim('webhook base')} ${baseUrl}\n`);

  const results = {};

  for (const lang of LANGS) {
    const envKey = `VAPI_ASSISTANT_ID_${lang.toUpperCase()}`;
    const existingId = (process.env[envKey] || '').trim();
    const payload = built[lang];

    try {
      let assistant;
      if (existingId) {
        assistant = await vapiRequest('PATCH', `/assistant/${existingId}`, key, payload);
        console.log(`${c.green('✓')} updated ${c.bold(payload.name)}  ${c.dim(assistant.id)}`);
      } else {
        assistant = await vapiRequest('POST', '/assistant', key, payload);
        console.log(`${c.green('✓')} created ${c.bold(payload.name)}  ${c.dim(assistant.id)}`);
      }
      results[envKey] = assistant.id;
    } catch (err) {
      console.error(`${c.red('✕')} ${payload.name}`);
      console.error(c.dim(String(err.message || err)));
      process.exitCode = 1;
    }
  }

  const created = Object.entries(results).filter(
    ([envKey]) => !(process.env[envKey] || '').trim()
  );

  if (created.length) {
    console.log(`\n${c.yellow('Add these to .env:')}`);
    for (const [envKey, id] of created) console.log(`  ${envKey}=${id}`);
  }
  console.log('');
}

main().catch((err) => fail(String(err?.stack || err)));

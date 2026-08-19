# Vara — VARA EdTech AI Assistant

A real-time AI voice assistant for VARA EdTech. Visitors open the page, tap the orb, and talk to **Vara** — an assistant that knows the company, its services, its shipped products and its university offer, and that captures their details when they want to be contacted.

The interface is a single screen that never scrolls: a wide grid backdrop and one glowing particle orb. No forms, no chips, no marketing sections. Everything else fades away the moment a conversation starts.

Fully white-labelled: no third-party branding anywhere in the interface, and the assistant is instructed never to name the technology behind it.

---

## What's in the box

| | |
|---|---|
| **Voice** | Tap-to-talk particle orb, live captions, round call controls, voice-reactive animation |
| **Theme** | Light and dark backgrounds, toggled top-right, remembered per browser |
| **Language** | EN / TH toggle in the header. Each language starts its own voice assistant. Switching mid-call ends the conversation. |
| **Knowledge** | 9 markdown documents covering the whole business, searched live by the assistant |
| **Lead capture** | Vara takes name, organisation and contact details mid-conversation |
| **Lead store** | Append-only JSONL on your own server, CSV export. Nothing leaves the box |
| **Deploy** | Next.js standalone + PM2 + Nginx configs for your existing VPS |

There is deliberately **no contact form, no text-chat panel, no suggestion chips and no marketing sections** — the assistant is the whole interface. The `/api/chat` endpoint still exists if you ever want a typing fallback back.

### The orb

Plain canvas 2D — no WebGL, no libraries, no assets. A circle cut across its upper half by a morphing wave, wrapped in ~260 orbiting particles, with sparks thrown off on loud peaks.

Three palettes, all in the VARA red family, cross-faded by who is talking:

| State | Colour |
|---|---|
| Idle | dusky crimson, low and slow |
| You speaking | warm gold |
| Vara speaking | vivid VARA red into coral |

On a light background the orb switches from additive blending to normal painting with darkened colour and reduced bloom — additive glow on white just washes out to white.

Telling *your* voice from Vara's needs real audio analysis — the voice SDK only reports its own output level. The visitor's microphone is tapped with a Web Audio `AnalyserNode` (RMS plus three frequency bands, fast attack / slow release). Those levels live in a **ref, not React state**: at 60fps, `useState` would re-render the whole tree sixty times a second.

Two things that are easy to break if you touch `FluidOrb.tsx`:

- **`prefers-reduced-motion` must not freeze it.** It scales motion to 40% and drops the sparks. Windows reports "animation effects off" as reduced motion for everyone, and a frozen orb reads as a broken page.
- **There is a rAF watchdog.** Some embedded webviews never fire `requestAnimationFrame`; if no frames land within 250ms the loop falls back to a timer and logs a warning.
- **The canvas edge is erased with a vignette every frame.** Without it, particles that reach the bitmap boundary get clipped into a hard straight line down the side.

Theme colours are applied as **inline styles from React state**, not through inherited CSS custom properties, so a theme change is a plain re-render with nothing to recompute.

---

## Quick start

```bash
npm install
```

Then fill in `.env` (start from `.env.example`):

```bash
cp .env.example .env
```

You need three things before voice will work:

1. **`VAPI_PUBLIC_KEY`** — already filled in from your `vapi.txt`.
2. **`VAPI_PRIVATE_KEY`** — Dashboard → Settings → API Keys → Private Key.
3. **`NEXT_PUBLIC_SITE_URL`** — the public **https** URL where this will live.

Create the two assistants:

```bash
npm run vapi:sync
```

It prints two assistant IDs. Paste them into `.env` as `VAPI_ASSISTANT_ID_EN` and `VAPI_ASSISTANT_ID_TH`, then run it again any time you edit a system prompt — it will update in place rather than create duplicates.

Run it:

```bash
npm run dev
```

> **Microphone needs HTTPS.** `localhost` is treated as secure, so local development works. Any other host must be served over HTTPS or the browser will refuse microphone access and the assistant will not start.

> **Tool webhooks need a public URL.** `search_knowledge` and `capture_lead` are called by the voice platform over the internet, so they cannot reach `localhost`. For local end-to-end testing, expose the app with a tunnel and set `NEXT_PUBLIC_SITE_URL` to the tunnel URL before running `vapi:sync`. Without that, voice still works — Vara just answers from his system prompt alone and can't save leads.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Local development server |
| `npm run build` | Production build (standalone output) |
| `npm start` | Run the production build |
| `npm run vapi:sync` | Create or update both assistants via the API |
| `npm run vapi:print` | Write paste-ready assistant JSON to `vapi/out/` instead |
| `npm run leads:export` | Export captured leads to CSV |
| `npm run leads:export -- --print` | Print a lead summary to the terminal |

---

## Project layout

```
knowledge/
  core/            The business knowledge, English, 9 documents
  th/              Thai language layer — terminology, tone, model answers
vapi/
  system-prompt.en.md    Vara's instructions (English)
  system-prompt.th.md    Vara's instructions (Thai)
  assistant-config.mjs   Single source of truth for both assistants
src/
  app/api/         config · kb · lead · leads · chat · vapi/events
  components/      FluidOrb (canvas) + the single-screen stage
  lib/             Retrieval, lead store, i18n, voice session hook
deploy/nginx.conf  Nginx site config
ecosystem.config.js  PM2 process definition
data/leads.jsonl   Captured leads (created on first lead, gitignored)
```

---

## Editing what Vara knows

Two layers, and the distinction matters:

**1. The system prompt** — `vapi/system-prompt.en.md` and `.th.md`.
Everything Vara knows by heart and answers instantly. Persona, tone, the headline facts, the rules he must not break. Changing these requires `npm run vapi:sync` to take effect.

**2. The knowledge base** — `knowledge/core/*.md`.
Depth he looks up on demand via the `search_knowledge` tool: full service descriptions, pricing tables, client lists, university programmes, FAQ. Changing these takes effect on the next server restart (`pm2 reload vara-assistant`) — no rebuild, no re-sync.

Adding a new knowledge document: drop a `.md` file into `knowledge/core/` with frontmatter, and it is indexed automatically.

```markdown
---
id: short-id
title: Human readable title
tags: [comma, separated, search, terms]
---

# Section

## Sub-section
Content here. Every heading starts a new searchable chunk.
```

The `tags` matter — they are weighted in retrieval, so put the words a visitor would actually say.

### Checking retrieval

```bash
curl -s -X POST http://localhost:8080/api/kb \
  -H 'Content-Type: application/json' \
  -d '{"query":"how much does a university workshop cost"}'
```

Retrieval is a dependency-free BM25-style scorer with IDF weighting, light English stemming, and Thai character-bigram tokenisation (Thai has no word spaces). Heading matches outrank document-title matches so the right *section* wins, not just the right file.

---

## Changing the voice

In `vapi/assistant-config.mjs`, or by env var:

```bash
VAPI_EN_VOICE_ID=Elliot                # male, soothing. Alternatives: Kai (warmer), Sid (deeper)
VAPI_TH_VOICE_ID=th-TH-NiwatNeural     # the only male Thai neural voice
```

**Do not switch the Thai pipeline to Deepgram multi-language.** Thai is covered by Azure speech-to-text and Azure Neural TTS. Deepgram's multilingual model and the ElevenLabs turbo/flash v2.5 models do not support Thai. That's why the two languages run different pipelines instead of one auto-detecting assistant — the reason is recorded in a comment at the top of the config file.

Both voices are male. Sunny refers to himself as **ผม** and ends Thai sentences with **ครับ** — if you switch to a female voice you must flip those back to ผม→ดิฉัน and ครับ→ค่ะ/คะ across `vapi/system-prompt.th.md`, `knowledge/th/th-localization.md` and `src/lib/i18n.ts`, or the voice and the grammar will disagree.

The Thai voice has an OpenAI fallback; the English one does not, because the API rejects a `fallbackPlan` for its own voice provider — that provider runs managed auto-fallback internally.

---

## Response speed

The pipeline is tuned for conversational latency:

| Setting | Value | Effect |
|---|---|---|
| `startSpeakingPlan.waitSeconds` | 0.15 | how long Vara waits after you stop before replying |
| `smartEndpointingEnabled` | true | detects a finished sentence rather than just a silence gap |
| `stopSpeakingPlan.numWords` | 0 | he stops the instant you speak, so interrupting feels immediate |
| `model.maxTokens` | 220 | fewer tokens to generate, so audio starts sooner |

The voice SDK is also **pre-warmed on page load** rather than fetched on click — that chunk download used to happen after you tapped the orb, which is most of what "slow to connect" felt like.

The biggest remaining lever is the language model. If you want it faster still and can accept slightly less nuance, especially in Thai:

```bash
VAPI_LLM_MODEL=gpt-4o-mini
```

then `npm run vapi:sync`. The default is `gpt-4o`, chosen for answer quality in front of a university audience.

---

## Leads

Every captured lead is appended to `data/leads.jsonl` as one JSON object per line. When a call ends, the transcript and an AI summary are attached to the lead from that call.

Read them any of these ways:

```bash
npm run leads:export -- --print          # summary in the terminal
npm run leads:export                     # writes data/leads-YYYY-MM-DD.csv
cat data/leads.jsonl                     # raw
```

Or over HTTP, if you set `LEADS_ACCESS_TOKEN`:

```
GET /api/leads?token=YOUR_TOKEN
GET /api/leads?token=YOUR_TOKEN&format=csv
```

Leave `LEADS_ACCESS_TOKEN` blank and that endpoint stays disabled entirely.

CSV is written with a UTF-8 BOM so Excel opens Thai names correctly.

---

## Security notes

- **`VAPI_WEBHOOK_SECRET`** is sent as an `x-vara-secret` header on every tool webhook. The API rejects webhook-shaped payloads that don't carry it. Plain (non-webhook) requests to the same endpoints are deliberately *not* gated by it, so a browser-side caller could still use them — they are validated by their own field rules instead. That matters if you ever restore a contact form or typing panel.
- **The private key never reaches the browser.** Only the public key and assistant IDs are served, via `/api/config` at runtime, so you can rotate them with an `.env` edit and a reload instead of a rebuild.
- **Lead data is never public.** `/api/leads` needs a token, and `deploy/nginx.conf` includes a commented IP allowlist as a second lock.
- Vara is instructed to refuse passwords, card numbers and ID numbers, and to stop anyone who starts to share them.

---

## Deployment

See **[DEPLOY.md](DEPLOY.md)** for the full VPS sequence (Nginx + PM2 + Let's Encrypt).

## Running the demo

See **[DEMO-SCRIPT.md](DEMO-SCRIPT.md)** for a rehearsed 6-minute university demo, the questions that show best, and what to do when something goes wrong in the room.

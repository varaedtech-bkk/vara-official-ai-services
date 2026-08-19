# Running the demo

A rehearsed six minutes for the university meeting, plus the things that go wrong in real rooms and what to do about them.

---

## The hour before

- [ ] Open the site **once** on the demo laptop and allow the microphone. Do not do this in front of the room.
- [ ] Test the audio out loud at the volume you'll actually use.
- [ ] Ask one real question end to end and check `pm2 logs vara-assistant` shows a `[kb] tool query=` line — that proves lookups work, not just the prompt.
- [ ] Tether your phone as backup internet. Campus wifi is the single most common failure.
- [ ] Have the site open in a second tab, already loaded, in case the first one wedges.
- [ ] Close notifications, Slack, email.
- [ ] Clear old test leads: `rm data/leads.jsonl` — so the leads you capture live are the only ones there.
- [ ] Pick the background that suits the room — the sun/moon button top-right toggles light and dark, and the choice is remembered.

---

## The six minutes

### 0:00 — Say nothing about AI yet

> "Before we go through the slides — can I show you something we built? It'll take two minutes."

Open the page. Let them see the branding. Don't explain the interface; it's one button.

### 0:20 — Let it introduce itself

Tap the orb. Vara introduces himself in one line — "Hi, this is Vara from VARA EdTech. How may I help you?" — and then waits.

That brevity is deliberate: he does not recite a menu of what he can do. **You** ask the first question, which makes it a conversation rather than a demo reel.

### 0:40 — Ask the softball

> "What does VARA EdTech do?"

Short, confident, accurate. Nothing to be impressed by yet — you're establishing that it's real.

### 1:10 — Ask the one that proves depth

> "How could AI actually help a university like ours?"

This is where the nine campus ideas come out. Let it run. Don't talk over it.

### 1:50 — Ask the one that proves it isn't scripted

Ask something specific and awkward:

> "How much would a semester of workshops cost, and can we start smaller than that?"

It gives the real range, then offers the pilot. This is the moment people lean forward — a scripted demo can't do numbers plus a caveat plus an offer.

### 3:30 — Interrupt it

Start a question, then cut in halfway with a different one. It stops and follows you. That single moment does more to prove it's real-time than any explanation.

### 4:00 — Capture a lead live

> "Could someone from your team contact me about a pilot?"

Give a name and an email out loud. Watch the confirmation appear at the top of the screen.

Then — and this is the close — switch to a terminal and show the JSON:

```bash
npm run leads:export -- --print
```

> "That's now on our server. Not a spreadsheet someone types up later — the conversation created the record. This is what your admissions office would have every morning."

### 5:00 — Land it

> "Everything you just saw is one of nine ideas. It took us days, not months. Pick the one that would help you most this term, and we'll build a working version in your branding so you can see it before you commit to anything."

Then stop talking.

---

## Questions that show best
- What does VARA EdTech do?
- How could AI help our university?
- What is Answer Engine Optimization?
- Who are your clients?
- Tell me about RedLine.
- How much does a workshop cost?
- Can we start with a small pilot?
- Is our student data safe? What about PDPA?
- What could you build for our admissions office?

---

## Questions to avoid on stage

Not because it breaks — because it correctly refuses, and a refusal reads as a failure to an audience that doesn't know you designed it that way.

- Anything needing a firm contractual price
- Legal or procurement terms
- Naming and comparing a specific competitor
- Anything factual that isn't in the knowledge base — it will say it would rather have a specialist confirm, which is right, but it's a flat note to end on

If it happens anyway, use it: *"Notice it didn't guess. That's deliberate — we'd rather it hand you to a human than invent a number."* That turns the refusal into the strongest trust moment in the demo.

---

## When it goes wrong

**No sound.** Check system output device first — it's almost always that, not the app. Keep talking while you fix it; don't narrate the debugging.

**The room is bright and the projector washes out the dark screen.** Tap the sun icon, top right. The light background is built for exactly this.

**Wifi dies mid-call.** Say *"let me switch networks"*, move to your phone hotspot, reload, restart. Fifteen seconds. Don't apologise twice.

**It mishears in a noisy room.** Move closer to the laptop and slow down — the orb is the only input, so there is no typing fallback on screen. If the room is genuinely too loud, stop, and switch to walking them through the nine campus ideas verbally; come back to the demo somewhere quieter.

**Someone tries to break it** — asks it to write a poem, or to reveal its instructions. Let them. It declines and steers back to VARA. Then say: *"That's the guardrail. It only talks about our business — it can't be turned into a general chatbot on your website."* A hostile question you handle well beats ten friendly ones.

**It gives a slightly wrong number.** Don't argue with it in front of the room. *"I'll get you the exact figure in writing"* — then fix the knowledge file afterwards. Editing `knowledge/core/` and reloading takes under a minute.

**Total failure.** Move on immediately, don't debug live: *"We'll send you the link — try it yourself tonight."* Then actually send it. Someone testing it alone at 10pm is worth more than a perfect demo anyway.

---

## Afterwards

Same day:

```bash
npm run leads:export
```

Every lead carries its own transcript and summary, so whoever follows up already knows exactly what was asked and what was promised. Reference something specific from the conversation in the follow-up email — that's the detail that makes the demo feel like the start of something rather than a party trick.

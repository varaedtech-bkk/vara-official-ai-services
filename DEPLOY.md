# Deploying to your VPS (Nginx + PM2)

This matches the stack VARA already runs. Roughly 20 minutes end to end.

Throughout, replace `ai.varaedtech.com` with the subdomain you're actually using.

---

## 0. Before you start

**Point DNS first.** Create an `A` record for `ai.varaedtech.com` pointing at your VPS IP, and let it propagate. Certbot will fail otherwise.

**HTTPS is mandatory, not optional.** Browsers only grant microphone access on a secure origin. Over plain HTTP the page loads and the assistant simply never starts.

---

## 1. Clone and build on the VPS

Repo path: `/root/vara-official-ai-services`. Node 20+ and a `.env` file are required.

```bash
cd /root/vara-official-ai-services
npm ci
npm run build
```

Leads are written to `data/leads.jsonl` in this repo. Do not set `LEADS_DIR`.

---

## 2. Start with PM2

The app listens on port **8080**. Nginx in front of it terminates TLS.

```bash
cd /root/vara-official-ai-services
bash deploy/pm2.sh
pm2 startup        # run the command it prints, so it survives reboot
```

`pm2.sh` starts the process the first time and reloads it on later deploys, then runs `pm2 save`.

Check it's alive:

```bash
pm2 logs vara-assistant --lines 30
curl -s localhost:8080/api/config
```

You should see your public key and both assistant IDs, with `"configured": true`.

---

## 3. Nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vara-assistant
sudo ln -s /etc/nginx/sites-available/vara-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d ai.varaedtech.com
```

Certbot rewrites the certificate paths in place. Reload once more afterwards.

---

## 4. Point the assistants at the live URL

Now that the public URL exists, the tool webhooks need to know about it.

In `.env`, locally **and** on the server:

```bash
NEXT_PUBLIC_SITE_URL=https://ai.varaedtech.com
```

Generate a webhook secret if you haven't:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Put it in both `.env` files as `VAPI_WEBHOOK_SECRET`, then re-sync so the assistants pick up the new URL and header:

```bash
npm run vapi:sync
pm2 reload vara-assistant      # on the server, to load the new secret
```

---

## 5. Verify

```bash
# Page loads
curl -sI https://ai.varaedtech.com | head -1

# Config is complete
curl -s https://ai.varaedtech.com/api/config

# Knowledge search works
curl -s -X POST https://ai.varaedtech.com/api/kb \
  -H 'Content-Type: application/json' \
  -d '{"query":"what does VARA do"}' | head -c 300

# Webhook secret is enforced
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://ai.varaedtech.com/api/kb \
  -H 'Content-Type: application/json' \
  -d '{"message":{"type":"tool-calls","toolCallList":[{"id":"x","name":"search_knowledge","arguments":{"query":"test"}}]}}'
# expect 401
```

Then open the site in a real browser, allow the microphone, and talk to it. Ask something that requires a lookup — "how much is a university workshop?" — and confirm in `pm2 logs vara-assistant` that you see a `[kb] tool query=...` line. That proves the webhook round-trip is working, not just the prompt.

Finally, ask Vara to have someone contact you, give a name and email, and check the lead landed:

```bash
cat /root/vara-official-ai-services/data/leads.jsonl
```

---

## Updating later

**Changed a knowledge file only** — fastest path, no rebuild:

```bash
cd /root/vara-official-ai-services
git pull
pm2 reload vara-assistant
```

**Changed a system prompt** — the prompt lives on the assistant, so it must be re-synced:

```bash
npm run vapi:sync
```

**Changed application code:**

```bash
cd /root/vara-official-ai-services
git pull
npm ci
npm run build
bash deploy/pm2.sh
```

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Button does nothing, no mic prompt | Not served over HTTPS, or microphone blocked in browser settings |
| "Voice assistant not configured" | `VAPI_PUBLIC_KEY` or the assistant IDs are missing from the server `.env` |
| Vara talks but never looks anything up | `NEXT_PUBLIC_SITE_URL` was wrong when you ran `vapi:sync` — fix it and re-sync |
| Tool calls return 401 in your logs | `VAPI_WEBHOOK_SECRET` differs between the assistant config and the server. Re-sync, then reload |
| Answers are generic and shallow | `knowledge/` missing from the repo checkout. Check `pm2 logs` for `[kb] knowledge/ directory not found` |
| `/api/chat` returns blunt quoted extracts | No `ANTHROPIC_API_KEY` set — documented degraded mode, not a failure. No UI uses this endpoint by default |
| Thai voice sounds wrong or errors | Someone changed the Thai pipeline off Azure. Thai needs Azure STT + Azure Neural TTS |
| Leads vanished after deploy | `data/` was deleted or the process cwd is not the repo |

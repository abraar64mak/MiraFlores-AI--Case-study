# Putting the workpaper on the public web, with the AI helpers

The app is static files. The three AI helpers (explain a number, draft a client question, summarize) need a model, and a public website must never contain an API key, so they call a small serverless function, `api/ai.js`, that holds the key. If that function is not there, the AI buttons simply do not appear and everything else works.

| Where it runs | Website | AI helpers | Notes |
|---|---|---|---|
| **Vercel (recommended)** | yes | yes | Hosts the static site and `api/ai.js` from this repo in one deploy. Free tier is enough for a demo. |
| claude.ai hosted link | yes | yes | Private unless you share it; viewers use their own Claude usage. No server or key needed. |
| GitHub Pages | yes | no | Static only. |
| Single file `dist/workpaper.html` | yes | no | Works offline; no server. |

## Vercel, step by step
1. Create an API key in the Anthropic Console. In the Console, **set a monthly spend limit** on the key's workspace: that is the real cost ceiling.
2. Go to vercel.com, **Add New, Project**, import `abraar64mak/MiraFlores-AI--Case-study`.
3. **Production Branch**: choose the branch to publish (`claude/gifted-wright-vops7y`, or `main` once you have merged it).
4. **Framework Preset**: Other. Leave the build command and output directory empty.
5. **Environment Variables** (mark the key as Sensitive):
   - `ANTHROPIC_API_KEY` = your key (required)
   - `AI_ACCESS_CODE` = a short code you tell people at the event (recommended: without it, anyone with the link can spend your credit, up to the limits below)
   - `AI_DAILY_LIMIT` = e.g. `150` (requests per day per server instance)
   - optional: `AI_RATE_PER_MIN` (default 12 per visitor), `AI_MODEL` (default `claude-opus-5-5`), `ALLOWED_ORIGINS`, `AI_FALLBACK=off`
6. **Deploy.** Your site is at `https://<project>.vercel.app`. Open a number, click **Explain this number**: you get a notice about what is sent, then (if you set a code) a prompt for the code.

Share that link. The code is only needed the first time per browser session.

## What protects your key and your bill
- The key exists only in Vercel's environment. The browser never sees it; the repo never contains it (`.env*` is git-ignored; `.env.example` has placeholders).
- `api/ai.js` accepts only JSON posts from the site's own origin (plus any `ALLOWED_ORIGINS`), caps the prompt at 30,000 characters and the answer at 4,000 tokens, and rate-limits per visitor and per day.
- The in-memory limits are best-effort (serverless instances are short-lived and there can be several). For a hard guarantee use the Anthropic spend limit, plus Vercel's firewall rate limiting if you expect a crowd.
- An access code is the simplest way to keep strangers off your credit at a public event.
- Prompts contain the evidence listed in "Evidence sent to Claude"; SSNs and account numbers are masked in the browser first, and the case-study data is invented. Prompts are not logged by the function.

## Cost
At the default model (Claude Opus 5.5: $4 per million input tokens, $20 per million output) a typical call is about 2,000 tokens in and 500 out, so roughly **$0.02 per click**. 100 clicks is about $2. Set `AI_MODEL=claude-haiku-5-5` for about a twentieth of that if you prefer speed and cost over depth.

## Run it on your machine
```
npm install
ANTHROPIC_API_KEY=sk-ant-... node tools/dev-server.mjs 8000    # http://localhost:8000
```
Without a key the site works and the AI buttons are hidden.

## Tests
`npm test` (logic and the endpoint against a mock model), `node tools/ai-proxy-e2e.mjs` (the browser path against the mock). I could not call the real model from this environment, so the first real call should be a quick manual check after you deploy: open any number and click **Explain this number**.

# Afterink AI server

A small Cloudflare Worker that holds an API key so the Afterink page on GitHub Pages can run its AI steps live for every viewer. The page itself stays static.

## What it does

- Seven named tasks, one route each: `extract`, `ask`, `brief`, `dispute`, `invoice`, `filter`, `amend`. The page sends data; the prompts live in `src/tasks.js`. There is no free-form route, so the key cannot be used as a general chatbot.
- Streams every reply back as server-sent events, so the viewer watches the reading happen.
- Works with either provider. **Gemini** (Google AI Studio) has a free tier. **Claude** (Anthropic) is paid. Set one key and the server uses that provider; set both and `PROVIDER` decides.
- Caps: input size per task, 20 calls a minute per visitor, and an optional daily token budget. When the daily budget runs out the page switches to its saved results and says why; when the per-minute limit is hit, the viewer is told to try again in a minute.
- The model never does arithmetic. Dates, price comparisons and the quote checks are done by the page's own code.

## Deploy in about ten minutes

You need a free Cloudflare account and one API key.

```bash
cd proxy
npm install
npx wrangler login
```

Put in the key. For the free option, create a key at Google AI Studio (aistudio.google.com) and run:

```bash
npx wrangler secret put GEMINI_API_KEY
```

For Claude instead (or as well), run `npx wrangler secret put ANTHROPIC_API_KEY`. With both keys set, add `PROVIDER = "gemini"` or `"anthropic"` under `[vars]` in `wrangler.toml`.

Then:

```bash
npx wrangler deploy
```

Wrangler prints the server's address, something like `https://afterink-proxy.<your-account>.workers.dev`. Put that address in `AI_URL_DEFAULT` near the top of `app.js` and push the page. Until that is done, the published page says that no AI server is set up for it and replays saved results.

To test the page against a local server, open it with `?ai=http://127.0.0.1:8787` added to the address. Only local addresses are accepted there, and nothing is remembered between visits.

Check it is up: open `<address>/v1/health` in a browser. It should say `"ok": true` and name the provider and model.

## Settings (`wrangler.toml`)

| Setting | Meaning | Default |
|---|---|---|
| `ALLOWED_ORIGINS` | Which page addresses may call the server | the GitHub Pages site and localhost |
| `PROVIDER` | `gemini` or `anthropic` when both keys are set | whichever key exists |
| `GEMINI_MODELS` | Gemini models tried in order; the next one is tried when a model is over quota, overloaded, not available to the key, or sends nothing for 20 seconds; if every model is busy, the list is tried up to twice more, after pauses of 3 and 6 seconds | `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.8-flash` |
| `GEMINI_THINKING` | How hard Gemini thinks before answering: `MINIMAL`, `LOW`, `MEDIUM` or `HIGH`. Higher is slower; `LOW` read the sample contract perfectly in about five seconds | `LOW` |
| `ANTHROPIC_MODEL` | The Claude model | `claude-opus-5-5` |
| `DAILY_OUTPUT_TOKENS` | Daily cap across all visitors, only enforced when the `BUDGET` store exists | 400,000 |

**The daily budget** needs a small key-value store. Create it once with `npx wrangler kv namespace create BUDGET`, paste the id it prints into the commented block in `wrangler.toml`, and deploy again. Without it the per-visitor rate limit is the only cap.

## About the free Gemini tier

- Free-tier keys are free and need no card, but Google states that content sent on the free tier may be used to improve its products. Every contract in this prototype is invented, so that is acceptable here. Do not paste a real contract into the page while the server runs on a free key.
- The free tier has small daily request limits per project, and they change. Check the current numbers in Google AI Studio for your key. The default model list starts with Flash-Lite, which has a much larger free daily allowance and was the fastest and most dependable model in testing, and falls back to the Flash models.
- When the day's quota is used up, every call returns `rate_limited`, and the page shows its saved results with a note saying so.

## Run it locally

```bash
cp .dev.vars.example .dev.vars   # then put your key in .dev.vars
npm run dev                       # serves http://127.0.0.1:8787
```

The local server reads `.dev.vars` only when it starts, so restart it after changing the key.

Serve the page from the repository root on port 8765 (`python -m http.server 8765`) and it will use the local server automatically.

`npm test` runs the prompt, routing and page-logic tests, which need no key and make no network calls.

`npm run smoke` sends every AI task to the deployed server and checks the answers (add a server address to test another one, such as `npm run smoke -- http://127.0.0.1:8787`). It calls the real model, about nine calls a run.

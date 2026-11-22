# Afterink: guide for AI coding assistants

Read this before changing anything. It explains what the project is, how the live AI works end to end, and the rules that keep the demo correct. `README.md` is the short version for people; `APPROACH.md` is the reasoning behind every number; `proxy/README.md` covers the AI server's settings.

## What Afterink is

A working prototype of an AI contract repository for the stage after signature. A sample company, Kestrel Mobility, has signed supplier contracts that nobody acts on. Afterink reads each signed document with AI, turns it into dates and prices, and puts each one in front of the team that must act:

- **Legal team, Inbox**: signed documents that are not filed yet. AI reads each one; code checks every quote; a person files it.
- **Buying team, Renewal desk**: every notice deadline, soonest first. AI writes a renewal brief and a draft letter; a person decides.
- **Finance team, Invoice check**: every invoice line compared with the signed price. AI reads a pasted invoice; code does all the arithmetic; a person disputes or approves.
- **Everyone, Repository and Ask**: search and filter every contract; ask in plain words and get an answer that cites the clause.

The Overview page shows three ways money leaks out of signed contracts, each with a "Show me, step by step" walkthrough. The menu has two groups. "Why Afterink" holds the Overview and the business case (The problem, Why after signature, Who it serves, Measuring success); "The product" holds the desks, each labelled with its team.

## The one rule behind the design

**AI reads, code calculates, people decide.**

- The model only reads documents and drafts text. It never does arithmetic, compares prices or works out dates.
- The page's own code computes every deadline, total and difference, and checks every quote the AI returns against the document text by exact match.
- Nothing binding happens automatically. A named person files, decides, disputes or approves. Nothing is ever sent to a supplier.

Keep this split when you change anything. If a change would let the model produce a number that the page then shows as fact, move that calculation into code instead.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page shell, all CSS (inline), and the HTML templates for the four "Why Afterink" pages |
| `app.js` | All page logic: views, AI calls, extraction review, filing, renewals, invoice checks, Ask, walkthroughs |
| `data.js` | The sample company's data: contracts, unfiled documents, invoices, saved AI results, and `DEMO_TODAY` |
| `proxy/` | The AI server, a Cloudflare Worker. It holds the API key and the prompts |
| `proxy/src/worker.js` | Routing, origin check, rate limit, daily budget, streaming |
| `proxy/src/tasks.js` | The seven AI tasks: each turns the page's data into a prompt |
| `proxy/src/gemini.js` | Gemini adapter: model fallback list, retries, first-text timeout |
| `proxy/src/anthropic.js` | Claude adapter (the paid alternative) |
| `proxy/src/common.js` | Input clamping helpers and the `Reject` error type |
| `proxy/test/` | 20 tests: prompts, routing and page logic. No key, no network |
| `proxy/scripts/live-smoke.mjs` | Nine real AI calls against a deployed server, with answer checks |
| `proxy/wrangler.toml` | Worker settings: allowed origins, rate limit, budget store |
| `APPROACH.md` | Reasoning, assumptions and the source of every figure on the page |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. Keep it |

There is no build step. The page is three static files served by GitHub Pages.

## How the live AI works

```
Browser (GitHub Pages)                      Cloudflare Worker (proxy/)                Model
app.js  --POST /v1/<task>, JSON data-->      tasks.js builds the prompt     -->       Gemini (free) or Claude
        <--server-sent events (text)--       streams the reply back         <--
app.js checks quotes, computes dates and money, shows the result for a person to decide
```

1. **The page sends data, never prompts.** `aiCall(task, body, onText)` in `app.js` POSTs JSON to `AI_URL + '/v1/' + task`.
2. **The server owns the prompts.** `TASKS[task](body)` in `proxy/src/tasks.js` clamps every input and returns `{ system, user, max_tokens, effort }`. There is no free-form route, so the key cannot be used as a general chatbot.
3. **The reply streams back** as server-sent events, one `data:` line per event:
   - `{"t": "...text..."}` a chunk of the reply
   - `{"done": true, "ms", "in", "out", "provider", "model", "modelName", "truncated"}` the closing event
   - `{"error": "<code>", "message": "..."}` on failure
4. **The page checks and calculates.** It parses the text, checks quotes, computes everything numeric, and shows each AI output tagged "Read by AI", each code result tagged "Calculated by code", and each human step tagged "Your decision".

`GET /v1/health` returns `{ ok, provider, model, modelName, tasks, budget, rateLimit }`. The page calls it on load (`initAI()`); the green "AI: live, <model>" chip in the header comes from it.

### Where the page finds the server

Near the top of `app.js`:

```js
const AI_URL_DEFAULT = 'https://afterink-proxy.<account>.workers.dev';
```

- On the published page, the page uses `AI_URL_DEFAULT`.
- On `localhost` or `127.0.0.1`, it uses `http://127.0.0.1:8787` (the local worker from `npm run dev`).
- `?ai=http://127.0.0.1:<port>` overrides it, local addresses only.

### The seven tasks

| Task | Where in the page | Page sends | Model returns | What code does after |
|---|---|---|---|---|
| `extract` | Inbox, "Read with AI"; "Read a document of your own" | document text, the field list, categories | NDJSON, one line per item: `meta`, `amends` (amendments only), one `field` line per field with a verbatim `quote`, `rate` lines, `risk` lines, `end` | `applyLine` / `normEx` / `coerce` parse each line as it streams; every quote is checked against the text by exact match; `valueInQuote` checks the value appears in its quote; failed checks are flagged for the person |
| `amend` | Reviewing an amendment in the Inbox | the parent contract, the changes the reader extracted (old value, new value, quote), the amendment text | a plain-English explanation, at most 120 words | the changes themselves come from `extract` and are checked by code; the explanation is shown beside them, and a person decides whether to file |
| `ask` | Ask | the question, a register of contracts (with day counts already computed), the clauses retrieved by code, today | plain text with citations like `[C-1001 §3]` | citations become buttons that open the clause; the register's day counts come from code |
| `filter` | Repository, "Find with AI" | the question, today | JSON filters `{filters:[{field,op,value}], match, explanation, unsupported}` | `passes()` applies the filters in code against `contractFacts()` |
| `brief` | Renewal desk, "Write a fresh brief with AI" | the contract's facts and signals | JSON `{recommendation, headline, why, asks, letter}` | the deadline and money in the brief come from code; a person picks the decision |
| `invoice` | Invoice check, "Check an invoice of your own" | pasted invoice text, the known rate cards | JSON with supplier, dates and the invoice lines | `checkInvoice()` compares every line with the signed price; the model does no sums |
| `dispute` | Invoice detail, "Redraft with AI" | a dispute note code wrote from the facts it found (`tplDispute`) | the same note, firmer and shorter, with every number and quote kept | shown in an editable box; a person sends it, outside the demo |

### When the AI is not available

The page never breaks. If the health check fails, the key is missing, the free quota is used, or a call errors, the page shows saved AI results that were prepared in advance from the same sample documents (stored in `data.js`), and a bar explains why (`WHY_OFF` and `AI_COPY` in `app.js` hold the wording). The checks, dates and sums still run live in the browser.

Error codes the server can return: `rate_limited` (per-visitor limit or Gemini quota), `budget` (daily cap reached), `auth` (no key), `overloaded` (every Gemini model busy), `prompt_too_large`, `too_short`, `bad_request`, `forbidden` (origin not allowed), `not_found`, `refused`, `upstream_error`.

### Providers and models

- **Gemini (default, free).** Set the secret `GEMINI_API_KEY`. Models are tried in order from `GEMINI_MODELS` (default `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.8-flash`). The next model is tried when one is over quota, overloaded, unavailable, or sends nothing for 20 seconds; the whole list is retried up to twice, after 3 and 6 seconds. Thinking is `LOW` (`GEMINI_THINKING`). Flash-Lite at LOW was the fastest and most reliable in testing.
- **Claude (paid).** Set the secret `ANTHROPIC_API_KEY`; model from `ANTHROPIC_MODEL` (default `claude-opus-5-5`). With both keys set, `PROVIDER = "gemini"` or `"anthropic"` in `wrangler.toml` picks one.
- Gemini sometimes returns numbers as text such as `"6%"` or `"USD 1,200"`. `coerce()` in `app.js` strips `%`, `,`, `$` and `USD`. Keep that.

### Safety limits on the server

- **Origins:** only addresses in `ALLOWED_ORIGINS` (`wrangler.toml`) may call it. Add any new page address there and redeploy.
- **Rate limit:** 20 model calls a minute per visitor address.
- **Daily budget:** optional, needs the `BUDGET` key-value store; caps output tokens across all visitors per UTC day (`DAILY_OUTPUT_TOKENS`, default 400,000).
- **Input caps:** each task clamps its inputs; bodies over 400,000 characters are refused; `max_tokens` is clamped to 12,000.
- **Task lookup** uses own properties only, so names like `constructor` are refused.
- **The key is a secret** (`npx wrangler secret put GEMINI_API_KEY`), never a `[vars]` entry, never in the page, never committed. Locally it lives in `proxy/.dev.vars`, which is git-ignored.

## Rules that keep the demo correct

- **Do not change `DEMO_TODAY`** in `data.js` (17 November 2026). Every deadline and day count is computed from it, and the page, the walkthroughs and `APPROACH.md` all quote figures that depend on it.
- **These figures must stay true**, and the tests and the smoke test check several of them:
  - Fleetline invoice FL-20931: looks like $1,743.52 over contract; really **$9,486.92** once the signed amendment is filed.
  - Five invoices worth $502,751.56 total: $8,810.52 flagged before filing, **$28,561.92** after (5.7%).
  - Cloudmetric: $186,000 a year, last day to give notice 2 December 2026.
  - BrightClean: owes a $2,075 service credit for October.
  - Talentbridge: a $168,128 invoice cannot be checked until its agreement is filed; after filing, $12,008 of it is over contract.
  If you change data, update the page text, `APPROACH.md` and the tests together.
- **Quotes are checked by exact match.** Any prompt change to `extract` must keep "copy the quote character for character, one contiguous span".
- **The model never does arithmetic.** Prompts say so; code does every sum.
- **The page and `APPROACH.md` must agree.** If you change how something works, update both.
- **Product voice.** The page speaks as a product: no "brief", "assignment", "invented" or "I". Short sentences, plain words.
- **Look.** Light only, in Sirion's light style: lavender-white page `#F3F3FF`, lavender panels `#E1E3FE` with 16px corners, navy text `#0B1821`, grey `#55595C`, white buttons with 8px corners, one purple main action `#92429F`, indigo outlined pills `#6E76D5` for section labels. Selected toggles are lavender with an indigo edge, never dark. The final "Sirion light" block in `index.html` sets these and wins over earlier blocks. Text must keep at least 4.5:1 contrast.
- **Demo state** lives in `sessionStorage`, so it lasts for the tab only and every new visit starts from the sample data.

## Commands

From the repository root:

```bash
python3 -m http.server 8765        # serve the page at http://127.0.0.1:8765
```

From `proxy/`:

```bash
npm install                        # once
cp .dev.vars.example .dev.vars     # then put GEMINI_API_KEY=... in .dev.vars
npm run dev                        # local AI server at http://127.0.0.1:8787 (restart after changing .dev.vars)
npm test                           # 20 tests, no key, no network
npm run smoke                      # 9 real AI calls against the server in AI_URL_DEFAULT
npm run smoke -- http://127.0.0.1:8787   # the same against the local server
npx wrangler deploy                # publish the AI server
```

Run `npm test` after every change. Run `npm run smoke` after any change to a prompt, the adapters, or the server address. A single "overloaded" failure in the smoke test is Google's free tier being busy; run it again.

`index.html` loads `data.js?v=...` and `app.js?v=...`. Change the `v=` value when you publish a change, so browsers don't keep an old copy.

## Deploying

1. **The page:** push to the `main` branch of the GitHub repository; GitHub Pages serves it within a minute or two.
2. **The AI server:** from `proxy/`, `npx wrangler login`, `npx wrangler secret put GEMINI_API_KEY`, optionally create the `BUDGET` store (`npx wrangler kv namespace create BUDGET` and paste its id into `wrangler.toml`), then `npx wrangler deploy`.
3. **Connect them:** put the printed `https://afterink-proxy.<account>.workers.dev` address in `AI_URL_DEFAULT` in `app.js`, make sure the page's address is in `ALLOWED_ORIGINS`, push, and check `<address>/v1/health` shows `"ok": true`.

## Adding a new AI task

1. Add a function to `TASKS` in `proxy/src/tasks.js` that clamps its inputs (`str`, `num`, `arr`, `list` from `common.js`) and returns `{ system, user, max_tokens, effort }`. Ask for JSON when the page needs structure; never ask the model for sums or dates.
2. Add a test in `proxy/test/tasks.test.js`.
3. In `app.js`, call it with `aiCall('<task>', body, onText)` or `aiJSON('<task>', body)`, add a label to `TASK_LABEL`, do any calculation in code, tag the output with `tag('ai')`, and add a saved result to `data.js` so the page still works when the AI is off.
4. Deploy the worker, then run `npm test` and `npm run smoke`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Bar: "The live AI is off: it cannot be reached" | Wrong `AI_URL_DEFAULT`, server down, or a brand-new worker address not live yet | Open `<address>/v1/health`; check `AI_URL_DEFAULT` has no typo or trailing slash |
| "it has no working key" | No secret, or an invalid key | `npx wrangler secret put GEMINI_API_KEY`, then deploy |
| AI never runs from a new page address | Origin not allowed | Add it to `ALLOWED_ORIGINS`, deploy |
| "The AI model is busy right now" | Every Gemini model overloaded | Wait a minute; the server already retries |
| "Today's AI budget for this demo is used up" | Daily cap reached | Resets at midnight UTC; raise `DAILY_OUTPUT_TOKENS` |
| Deploy fails mentioning `kv_namespaces` | Placeholder budget id | Create the store and paste its id, or comment the block out again |
| Local page doesn't use the local server | Worker not running, or key added after start | `npm run dev` in `proxy/`, restart after editing `.dev.vars` |
| Page shows an old version | Browser cache | Hard reload; bump the `?v=` on the script tags |

## Privacy

The Gemini free tier may use what it is sent to improve Google's products. Every contract, supplier and figure in this demo is sample data, so that is fine. Never paste a real contract into the live page while it runs on a free key. For real documents, use a paid key (Claude, or a paid Gemini project).

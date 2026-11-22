# Afterink

A working, AI-powered prototype of a contract repository for the stage after signature. Built for the Sirion assignment set through ISB.

**Open the prototype:** https://akshatj28.github.io/afterink/
Start with **Guided tour** in the top bar. It takes about two minutes.

## In 30 seconds

| | |
|---|---|
| **Stage** | Intelligent repository: one searchable, AI-understood record of every signed contract |
| **Users** | Legal Operations (files contracts), Procurement (decides renewals), Accounts Payable (checks invoices), plus anyone who asks a question |
| **Problem** | The brief's three losses (unreviewed auto-renewals, missed service levels, invoices above agreed prices) all come from signed terms nobody could see when it mattered |
| **How it works** | AI reads, code calculates, people decide. Every extracted term links to the sentence it came from, and code checks the value really is in that sentence |
| **North star** | The share of contract dates that got a recorded decision before they passed |
| **Demo data** | An invented company, Kestrel Mobility: 10 filed contracts, 3 unfiled signed documents, 5 invoices. Demo date fixed at 17 November 2026 |

The five sections the brief asks for (why this stage, stakeholder map, the problem, the working prototype, success metrics) are all inside the page, numbered in the left menu.

## AI in this copy

The AI steps run live for every viewer. The page is static, so a small server of our own (`proxy/`, a Cloudflare Worker) holds the API key and the prompts. The page sends data to one of seven named tasks and streams the reply back, so you watch each term arrive with the sentence it came from. A strip under the title names the model and lists every call made, with its time and token count.

The server works with a free Gemini key from Google AI Studio or a paid Claude key from Anthropic; see `proxy/README.md` to deploy it in about ten minutes. If the server is down, has no key, or has used up the day's budget, the page replays saved AI results and says why. The free key's provider may keep what is sent to it, which is acceptable here only because every contract in the prototype is invented.

The model reads and drafts. It never does the arithmetic: dates, price comparisons and the check that every quoted sentence really is in the document are done by code in your browser.

Nothing in the prototype sends an email, makes a payment or contacts a supplier. Use **Reset demo** to return to the starting state.

## Files

| File | What it holds |
|---|---|
| `index.html` | The page: layout, styles and the case sections |
| `app.js` | Logic: extraction review, filing, renewal dates, invoice checks, cited answers, guided tour |
| `data.js` | Invented contracts, documents and invoices |
| `APPROACH.md` | The reasoning: decisions, assumptions, and where an evaluator is likely to push |
| `proxy/` | The AI server: seven named tasks, streaming, caps, and the deploy steps |

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8765
```

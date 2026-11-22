# Afterink: how the problem was approached

Notes on the thinking behind the prototype: the order the decisions were made in, what was chosen, what was rejected, and which assumptions carry the most weight. Written so you can defend each call if an evaluator pushes on it.

Prototype: https://akshatj28.github.io/afterink/ (the AI steps run live for every viewer through a small server of our own; see section 7)

---

## 1. How I read the brief

Three things in the brief shaped everything that followed.

1. **It names the losses.** "Unreviewed autorenewals, missed service levels and invoices that don't match agreed prices." These are the only outcomes the brief puts a cost on. I chose to define the problem as those three and to treat the rest (email, Word, shared drives, lost requests) as causes. That is a judgment, not something the brief forces: lost requests are a real problem too. The test for whether the judgment was right is in section 3.
2. **It asks for depth.** "Go deep rather than broad." One stage, done properly. That ruled out a light tour of intake, negotiation and repository.
3. **It tells you what will be judged.** Five sections must sit inside the prototype: why this stage, stakeholder map, problem, working flows, metrics. So the page was organised around those five, numbered, so nothing has to be hunted for.

It also leaves three choices open on purpose: who to build for, how much the product does on its own, and what to assume. I treated each as a decision to argue, not a detail to fill in.

## 2. The order the decisions were made in

Each decision constrained the next one.

1. Which stage
2. Who to build for
3. How much the product does without a person
4. Which flows, and how they connect
5. What to build and what to fake
6. How to measure it

---

## 3. Decision 1: which stage

**Choice: the intelligent repository.**

**The reasoning.** I traced each named loss back to where it starts.

| Loss in the brief | Where it starts |
|---|---|
| Unreviewed auto-renewal | A notice period inside a signed PDF that nobody turned into a date |
| Missed service level | A credit clause not connected to any performance report |
| Invoice above agreed price | A rate card Accounts Payable has never seen |

All three are failures to use a contract that is already signed. Intake and negotiation only improve contracts that have not been written yet. The repository is the only stage that reaches the roughly 4,000 contracts the company already has.

**Three supporting arguments.**

- **Fewest people have to change.** Intake needs every requester in a 3,000-person company to adopt a new front door. The repository needs Legal Operations to file, and one small habit from people who sign: forward the signed copy to one address. Where an e-signature tool is used, even that happens on its own. A weekly ledger sweep (suppliers paid with no filed contract) catches what nobody forwarded, so the repository does not depend on people remembering. This is still a behaviour change. It is smaller than intake's because it happens once per signature, not once per request, and the ledger backs it up.
- **The other two stages depend on it.** Intake has to know what is already signed with a supplier. Negotiation has to know what was agreed last time.
- **Value arrives soonest.** The next notice date and the next invoice are days away.

**What I gave up.** Lost requests and stalled approvals are in the brief and are not solved here. I said so on the page. The argument: a faster intake that feeds a repository nobody reads produces unread contracts faster.

**What would change the call.** Both stages are compared on one yardstick: money lost a year. The 50-contract audit and three months of invoices give the loss after signature (each missed notice date times the increase it let through, plus overbilling and unclaimed credits, scaled from the sample to all spend). A count of last quarter's lost or restarted purchase requests, with a cost per delay from the interviews, gives a rough loss before signature. If the loss after signature is under USD 550,000 a year (a quarter of the $2.2M sizing, about 0.25% of spend), or below the loss before signature, intake is the better start. This is written into the problem page as the test that would prove the choice wrong.

An earlier version used "fewer than one missed date in ten and invoice variance under 1%". That was wrong on two counts: 1% of $220M is the whole $2.2M case, so it would have walked away from a $2M problem, and it never measured intake, so it could not show intake was better.

---

## 4. Decision 2: who to build for

**Step 1: list everyone with a stake.** Eight groups: General Counsel, Legal Operations, Procurement, Accounts Payable, CFO and Controller, contract owners in the business, IT and Security, supplier account managers.

**Step 2: map them twice.** A single power/interest grid tells you who must approve the project. It does not tell you who lives with the result. So I ran a second grid, impact against power, and compared them.

**Step 3: the finding.** Legal Operations, Accounts Payable analysts and contract owners sit in "keep informed" on the first grid and "high impact, low power" on the second. They do the daily work, feel every failure, and would normally be briefed last.

**The call: two of those three get their own screen. The third screen goes to Procurement, on purpose. The sponsors get the metrics page.**

Legal Operations and Accounts Payable get the Inbox and Invoice check. The renewal desk is built for the Procurement category manager, not the contract owner. That departs from the finding: stopping a renewal takes someone with the leverage to say no, and that is Procurement, who sits higher on power. Contract owners are served inside the renewal desk: every renewal names its owner, and the owner sends any notice. A view of their own is the first addition after interviews. An earlier draft said the screens were built for "those three", which did not match the table below.

| Persona | Why chosen | Their screen |
|---|---|---|
| Legal Operations manager | The only person who can make the repository true. If filing is slow, nothing downstream works. | Inbox |
| Procurement category manager | Owns the renewal loss. Needs a date with their name on it while they can still say no. | Renewal desk |
| Accounts Payable analyst | Owns the invoice loss. Currently checks an invoice against itself. | Invoice check |

**Rejected.**

- **General Counsel or CFO as the primary user.** They buy it but do not use it day to day. A dashboard for them would have been a thinner product.
- **A supplier-facing portal.** Suppliers are affected, but they benefit from the current inertia. Building for them first would not stop any of the three losses.
- **One persona only.** Tempting for depth. But the brief says to show how experiences connect, and the value of a repository only shows when one person's filing changes what another person sees.

**Honest gap.** The personas come from the brief and general knowledge of these roles, not interviews. The "how it makes them feel" lines are marked as hypotheses on the page for that reason.

---

## 5. Decision 3: how much the product does on its own

**Choice: AI reads, code calculates, people decide.**

| Step | Who does it | Why |
|---|---|---|
| Read terms out of a document | AI, automatic | This is what language models are good at |
| Confirm the quoted sentence exists, compute dates, compare prices | Code, automatic | Arithmetic and string matching must be exact and repeatable |
| Write the brief, notice letter, dispute note | AI, a person edits | Drafting is cheap to review |
| Send a notice, hold a payment, end a contract | A named person only | These bind the company or touch a supplier relationship |

**Five specific calls inside this.**

1. **The model never does the arithmetic.** Notice dates and invoice differences are computed by code from the extracted terms. A model that is right 98% of the time on sums is not acceptable to Finance.
2. **Every extracted term carries its source sentence, and code checks two things.** First, that the sentence is really in the document. Second, that the extracted number or date appears inside that sentence (digits, comma forms, common number words, or a written-out date). A quote that exists only proves where a term came from: the model could quote "ninety (90) days" and extract 60. Either check failing sends the term to a person, marked "Quote not found" or "Value not in its quote". This is the answer to the General Counsel's fear of a wrong summary being relied on.
3. **Review by exception, not review of everything.** Only the terms that set a deadline or a price are gated, and only when the AI was unsure, the quote did not match, the value was not in its quote, or the value was missing. "Unsure" has a fixed definition in the prompt: high confidence only when the document states the value outright, medium when the model had to interpret, low otherwise. Anything below high is reviewed. Model confidence is not well calibrated, so the gate never relies on it alone, and the monthly audit of terms accepted without review measures the real error rate. The arithmetic: three people giving half their time have about 750 hours a quarter. Checking every term by hand takes about an hour a contract, so the 800 documents for the top 20% of suppliers would fill the whole quarter and all 4,000 would take more than five quarters. Checking only flagged terms takes about 15 minutes, so the top 20% takes about 200 hours (roughly a month) and all 4,000 about 1,000 hours.
4. **A change to a price or a cap is always confirmed by a person**, whatever the confidence. Amendments move money directly.
5. **Amendments govern from their effective date, term by term.** The later signed document wins for the terms it changes, and only from the date it takes effect. An invoice for an earlier period is checked against the terms that applied then. When an amendment changes a term an earlier amendment already changed, the review screen says so and asks the reviewer to check the two do not conflict. Partly superseded or contradictory terms are a person's call.

**Why not more autonomy.** A non-renewal notice has legal effect and a wrong dispute costs goodwill. The cost of one wrong automatic action is larger than the minutes saved. I would revisit this once the correction rate is measured.

---

## 6. Decision 4: the flows

**Why four desks.** One to make the repository true (Inbox), one for each money loss (Renewal desk, Invoice check), and one that serves everybody (Ask). Service levels did not get their own desk. They appear as an extracted term and as a credit check inside the invoice flow, which is where a missed level turns into money. This is the thinnest of the three losses: the credit check needs service performance data the company may not hold. The two-week invoice sample notes, for each top supplier, whether a usable service report exists. If few do, the credit check waits.

**Why they are connected.** The strongest way to show a repository's value is to let the evaluator cause it. So the sample data was written around three deliberate situations:

| Situation in the data | What it demonstrates |
|---|---|
| A signed Fleetline amendment sitting unfiled in a mailbox | File it, and the same invoice goes from $1,743.52 to $9,486.92 above contract |
| A Talentbridge agreement in a shared drive | Before filing, a $168,128 invoice cannot be checked at all. After, $12,008 is flagged. |
| A Corvid renewal whose notice date already passed | The cost of the problem, shown as history, and why the north star can never reach 100% on old misses |

A fourth document, a two-page catering letter, was written to be vague on purpose. It shows the AI saying "not stated" instead of guessing.

**The five-step path** on the Overview orders these so one desk's work visibly changes the next desk's screen.

**Two places where the model is used beyond the four desks' main steps.** Both follow the same rule: the model reads or translates, code does the exact work.

- **Find in plain words**, on the repository. The viewer types "which contracts renew in the next 90 days with an uncapped increase". The model turns that into a structured filter (field, operator, value) and never sees the contracts. Code runs the filter over every record and shows the filter it ran, so the person can confirm it. The one piece of arithmetic left to the model is turning a relative date such as "the next 90 days" into a day count, and that count is shown in the filter for the person to check. The list is exact, and it would still be exact over 4,000 contracts, because nothing has to be sent to the model.
- **An amendment in plain English**, on the review screen. After the model has read an amendment term by term, it writes a short plain-English account of what changes, what stays and what new obligation the company takes on. The term-by-term table is what gets applied; the account is for the person checking it, and is kept on the contract record.

**Deliberately left out.**

- Intake and negotiation (the other two stages)
- Access control by role (described as an assumption, not built)
- Text recognition for scanned documents
- Real integrations with a ledger, single sign-on or service reports (sample values instead)
- A standalone obligations tracker
- Sending anything: no email, no payment

---

## 7. Decision 5: what to build and what to fake

| Call | Reason |
|---|---|
| One web page with a link, no install | The brief asks for a link |
| The case and the product in the same page | The brief says no separate slides |
| Invented company and invented contracts | Real contracts raise confidentiality and copyright questions. Forms follow common contract types. |
| Fixed demo date (17 November 2026) | Deadlines stay the same whenever the link is opened |
| Sample contracts written with the source sentence tagged in the text | The "show source" highlight is exact by construction for the saved readings. The tags never reach the model: a live reading, or any contract pasted into the Inbox, goes through the real quote and value checks |
| Live AI for every viewer, through a small server of our own | The page is static (GitHub Pages) and cannot hold a key. A Cloudflare Worker (`proxy/`) holds the key and the prompts. The page sends data only, to one of seven named tasks (read a document, answer a question, write a brief, redraft a dispute, read an invoice, turn a question into a filter, explain an amendment). There is no free-form route, so the key cannot be used as a chatbot. Every reply streams, so the viewer watches the reading happen, and a strip under the title lists every call made with its time and token count |
| Either model provider, chosen by which key is set | Gemini through Google AI Studio has a free tier, which keeps the demo at no cost. Claude through the Anthropic API is the paid alternative. The prompts and the checks are the same for both. The free tier has small daily limits and Google may use free-tier content to improve its products, which is acceptable only because every contract here is invented |
| Saved AI results as a fallback | The page still works end to end without the AI. When the server cannot be reached, has no key or has used up the day's budget, a bar at the top says so and every desk replays saved results. When the free tier's per-minute limit is hit, the screen in use says so and the viewer can retry; inbox documents fall back to their saved reading |
| Search by clause, then answer | Mirrors how this would work at 4,000 contracts, where the whole set cannot be sent to a model |
| State kept in the viewer's browser tab only | Each evaluator gets a clean copy, cannot break another's, and every new visit starts fresh |

**The trade-off in the fallback.** Saved results make the demo reliable, but a viewer who meets the fallback sees a replay of the AI steps rather than the AI. The page labels every such result, and the top bar says why the server could not be reached. The first submitted version only ever showed the replay to evaluators, because its live path depended on the viewer being signed in to Claude. The server removes that dependency.

---

## 8. Decision 6: how to measure it

**Headline result in the sample (used word for word on the first screen and the metrics page):** "Filing three signed documents that sat outside the repository raises the amount flagged on the sample's five invoices from $8,810.52 to $28,561.92, about 5.7% of the $502,751.56 billed." Flagged means billed above the agreed rate or cap, or a service credit the contract gives that the invoice leaves out. All figures come from invented sample data.

**North star: the share of contract dates that got a recorded decision before they passed.**

**Why this one.** A decision made on time needs every part to have worked: the contract was filed, the term was read correctly, the right person was told, and they acted. "Let it renew" counts. Silence does not.

**What it divides by.** Every date that fell due, not only dates in the repository. A signed document known to exist but not filed counts as one undecided date until it is filed. A date that passed while its document sat unfiled is recorded as a miss when the document turns up, in the period the date fell. Without this rule, filing fewer contracts would raise the number. The prototype's live tile applies the first part: the inbox's unfiled documents sit in the denominator as undecided.

**Two things it cannot do alone, and what covers them.**

- **It can be gamed by renewing everything.** Guardrail: a monthly sample of renewals where the brief flagged low usage, a missed service level or an uncapped increase. If more than half went through with no reason recorded, a one-line reason becomes required whenever someone renews against the brief.
- **It does not see invoices.** Overbilling and unclaimed credits are not dates. They are tracked by the share of invoices over USD 10,000 checked against a contract, and by money confirmed back.

**Coverage is measured from the ledger, not the repository.** It is the share of the last 12 months' supplier spend paid to suppliers with a verified contract. A contract nobody filed shows up as uncovered spend, so it cannot hide.

**Rejected.**

- **Dollars saved.** Arrives months later, depends on negotiating skill, and is easy to inflate. Tracked as an outcome, not targeted.
- **Contracts filed.** A full repository nobody acts on is what the company has today with better search.
- **Questions asked.** Usage without consequence.

**Rethink triggers** were written as "if I see this, it means that, so I would do the other". The most important one: if alerts arrive on time but fewer than half get a decision, the constraint is ownership, and the right move is to go build intake.

---

## 9. Key assumptions, ranked by how much rests on them

| # | Assumption | What rests on it | How solid |
|---|---|---|---|
| 1 | Most signed contracts exist as readable text | The whole reading step | Reasonable for recent contracts, weak for old scans |
| 2 | AI extraction is accurate enough to review by exception | Legal Operations' capacity, and trust | Untested here. First thing to measure. |
| 3 | Three people at half time (about 750 hours a quarter) and about 15 minutes a contract by exception can cover the top 20% of suppliers in about a month | Time to value, and the case for review by exception (an hour a contract by hand would take a full quarter) | A guess. The first 300 contracts measure it, and over 30 minutes triggers a scope cut. |
| 4 | The top 20% of suppliers is about 80% of spend | Why filing by spend works | A common pattern, not checked for this company |
| 5 | USD 220M supplier spend, about 4,000 contracts, 1% recoverable | The $2.2M sizing, cross-checked bottom up: renewals $1.0M ($66M auto-renewing, half unreviewed, 3% avoided), invoices $0.8M (0.75% of $110M rate-card spend), credits $0.5M (2% of $25M with credit clauses), total $2.3M | Invented for sizing. Each row has a two-week check that replaces it. |
| 6 | Usage, ledger and service data can be fed in | The renewal brief and credit check | Simulated |
| 7 | Every contract gets a named owner at filing: the budget holder whose cost centre pays the supplier in the ledger, else the category manager. An undecided date escalates to the category lead at 30 days and the Head of Procurement at 10 | Whether a deadline reaches a person with authority | Still the most likely to fail. The design now names who gets silence, but whether they act is the rethink trigger in section 8. |
| 8 | Contract text may be sent to an AI model under an enterprise agreement | Whether this can run at all | Depends on the company's policy. The prototype's free-tier key is fine for invented contracts and would not be for real ones |

## 10. Where an evaluator is likely to push, and the answer

- **"Why not intake? Requests getting lost is the first thing in the brief."** I chose to treat it as a cause, because every loss the brief names happens after signature. That was a judgment, and the kill test in section 3 measures both stages in money lost a year, so the choice can be proved wrong.
- **"Isn't getting documents in just intake by another name?"** Partly, yes. The repository still needs signed copies to arrive. The difference is one habit at signature (or none, with e-signature) instead of a new front door for every request, backed by a weekly ledger sweep that finds what nobody forwarded.
- **"Who gets the alert when a contract has no owner?"** The budget holder whose cost centre pays the supplier, else the category manager, with escalation at 30 and 10 days. Silence always reaches someone who can decide.
- **"How is this different from what Sirion already sells?"** It is not a claim to a new category. Enterprise platforms already extract terms with AI and raise renewal alerts. The prototype argues three positions: measure decisions, not alerts; let code verify every AI reading, including that the value appears in its quote; and make Accounts Payable a first-class reader. I have not done a feature-by-feature comparison, and would say so.
- **"How do you trust the AI's reading?"** You do not have to. Every term shows its sentence, code checks the sentence exists and that the value appears in it, and uncertain deadline and price terms wait for a person. The correction rate is a tracked metric with a threshold that changes the design.
- **"Isn't this three products?"** It is one record with three readers. The demo is built to show a single filing changing two other screens.
- **"Your numbers are made up."** Yes, and labelled. The two-week plan (a 50-contract audit, three months of invoices, six interviews, a count of lost requests) is what replaces them.
- **"Can't someone hit the north star by renewing everything, or by not filing?"** Not filing: unfiled documents count as undecided, and coverage is measured from the ledger. Renewing everything: a monthly sample of renewals made against a flagged brief, with a required reason if more than half have none.
- **"Why doesn't it just send the notice?"** Legal effect and supplier goodwill. The line can move once error rates are known.
- **"Is the AI actually live, or a recording?"** Live, for every viewer, through a small server that holds the key. The strip under the title names the model and lists every call with its time and token count. Paste any contract into the inbox and it is read with no saved answer to fall back on, and the code checks run on what comes back.

## 11. What was not validated

- No user interviews. Personas and feelings are hypotheses.
- External statistics came from search summaries, not the primary reports. Two are vendor-sourced and one is from 2020. The sizing no longer leans on them: it is built from the three losses, and the 8.6% figure is cited only as context.
- No comparison with existing contract management products beyond the general point that they already extract terms and alert on renewals.
- The first submitted version had only exercised the saved-result paths, and evaluators saw only those. The live paths were tested on 22 November 2026 against a free Gemini key, through the server running locally. What that showed:
  - All seven tasks returned well-formed results. Reading the three inbox documents live and filing them reproduced the figures the page quotes: $9,486.92 on the Fleetline invoice, $12,008 on the Talentbridge invoice, $28,561.92 across all five. On the vague Greenleaf letter the model marked the notice period, price cap, liability and governing law as not stated, so none of its deadline or price terms passed without a person.
  - The first amendment prompt caught both Fleetline changes in 1 of 6 runs: it kept missing the new surcharge cap. A prompt that asks for the changes clause by clause, plus code that reads "6%" as 6, caught both in all 6 runs that completed. Two more runs failed on model overload and would have fallen back to the next model.
  - On the free tier the Flash models were often overloaded or slow to start, and their default deep thinking made one reading take over two minutes. The server therefore tries Flash-Lite first at low thinking, and moves to the next model on overload, quota or 20 seconds of silence. Most calls took 1 to 11 seconds; one that fell back took 15.
- The server was then deployed to Cloudflare the same day and the same checks passed against it, called as if from the published page: both Fleetline changes read correctly in about 5 seconds, and requests from other sites, with no origin, or to unknown routes were refused. Not yet tested: the Claude path against a real key.
- Six runs on one amendment is a smoke test, not an accuracy measure. Extraction accuracy on real, messy contracts is unknown, and the monthly audit described in section 5 is what would measure it.

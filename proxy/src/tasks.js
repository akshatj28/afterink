/* The seven named tasks. Each turns the page's data into a prompt:
   { system, user, max_tokens, effort, schema? }
   - schema: a JSON schema for structured output. The reply is exactly that JSON.
   - without a schema the reply is plain text, or NDJSON for extract.
   There is no free-form task: the page sends data, the prompts live here. */

import { Reject, str, num, arr, list } from './common.js';

export const DEFAULT_CATEGORIES = ['Software', 'Logistics', 'Facilities', 'Marketing', 'Consulting', 'IT infrastructure', 'HR services', 'Security', 'Telecom', 'Staffing', 'Catering', 'Other'];

export const TASKS = {

  /* Read one signed document. Streams one JSON line per term so the page can show each term,
     with its quote and its code checks, as it arrives. */
  extract(b) {
    const text = str(b.text, 60000);
    if (text.length < 200) throw new Reject('too_short', 'Paste the full text of a contract first.');
    const fields = arr(b.fields, 30).map(f => ({ k: str(f.k, 40), label: str(f.label, 80), type: ['date', 'bool', 'text', 'num', 'money'].includes(f.type) ? f.type : 'text' })).filter(f => f.k);
    if (!fields.length) throw new Reject('bad_request', 'No fields given.');
    const cats = list(b.categories, 30, 40);
    const categories = cats.length ? cats : DEFAULT_CATEGORIES;
    const fieldLines = fields.map(f => `  "${f.k}": ${f.type === 'date' ? 'YYYY-MM-DD' : f.type === 'bool' ? 'true/false' : f.type === 'text' ? 'short plain-English string' : 'number'} (${f.label})`).join('\n');
    return {
      max_tokens: 12000, effort: 'medium',
      system: `You read one signed supplier document for a company's contract repository. The company is Kestrel Mobility Ltd. (the customer). Use ONLY the document text. Do not guess, and do not do any arithmetic: copy values as the document states them.

Reply as NDJSON: one JSON object per line, no code fences, no text before or after. Lines in this order:

1. {"type":"meta","docType":"contract" or "amendment","supplier","title","kind" (for example "SaaS order form"),"category" (one of: ${categories.join(', ')}),"summary" (at most two plain sentences)}
2. For an amendment only, next: {"type":"amends","parentSupplier","effectiveFrom":"YYYY-MM-DD","changes":[...]}. Build "changes" by going through the amendment clause by clause. Every clause that sets a new value for a term of the base agreement is one change, including a clause that replaces a whole clause of the agreement:
   - a new or changed price for an item is {"kind":"rate","item","newRate" (number),"quote"}
   - a new or changed cap, percentage, number of days, multiplier, date or other term that matches one of the field keys below is {"kind":"field","field": that key,"label","newValue","quote"}. For example a new cap on a surcharge is field "surchargeCapPct", a changed notice period is field "noticeDays".
   Leave out clauses that only restate, confirm or say terms are unchanged. A new obligation on the customer, such as a minimum volume or minimum spend, is NOT a field change: write it as a risk line. Use annualValue only when the amendment states a new yearly contract value in money.
   For number fields, newValue is a plain number such as 6, never text such as "6%" or "20,000 pallets".
3. One line per field, in the order listed below: {"type":"field","k","value","quote","confidence","note"}
   - "quote" is copied character for character from the document: one contiguous span of at most 300 characters. It is checked by exact match, so never paraphrase or join separate passages.
   - "confidence" is "high" only when the document states the value outright, "medium" when you had to interpret, "low" when unsure.
   - If the document does not state a field, set value and quote to null, confidence "low", and say in "note" what is missing.
   - upliftPct is the largest percentage price increase the supplier may apply at a renewal or anniversary. Use 0 if prices are fixed or change only by signed amendment. Use null if increases are allowed with no cap.
   - termEnd is the end date of the current term.
   For an amendment, field lines hold only what the amendment itself states, and may be null.
4. One line per priced item: {"type":"rate","item","unit","rate" (number, USD),"quote"}
5. Up to four lines {"type":"risk","text"}: terms a buyer should know (uncapped increases, missing protections, new obligations on the customer).
6. Last line: {"type":"end"}

Fields:
${fieldLines}`,
      user: `DOCUMENT:\n<<<\n${text}\n>>>`
    };
  },

  /* Answer a question from the register and the clauses the page retrieved. Plain text, cited. */
  ask(b) {
    const q = str(b.question, 600).trim();
    if (!q) throw new Reject('bad_request', 'No question given.');
    const clauses = arr(b.clauses, 20).map(c => ({ cid: str(c.cid, 12), sec: str(c.sec, 6), supplier: str(c.supplier, 80), text: str(c.text, 3000) }));
    return {
      max_tokens: 2000, effort: 'low',
      system: `You answer questions about a company's signed supplier contracts for staff in Legal, Procurement and Finance. Today is ${str(b.today, 10, 'today')}.

Rules:
- Use only the REGISTER and CLAUSES given.
- Cite every factual claim with the contract id and clause number in square brackets, exactly like [C-1001 §3]. Cite amendments like [C-1002 §A1]. When a fact comes from the REGISTER rather than a clause, cite the contract id alone, like [C-1001]. Never cite anything else in brackets.
- Take dates from the REGISTER ("notice by") instead of recalculating them. The REGISTER already says how many days each date is from today: use those counts to decide what falls inside a period such as "the next 90 days". Never do arithmetic of your own.
- If the material does not answer the question, say so plainly and say which document would.
- Lead with the answer in one or two sentences, then a short list. Plain text only. Use "- " for list items and no other formatting.
- The repository holds ${num(b.contracts) || 0} verified contracts. ${num(b.unfiled) || 0} signed documents are still unfiled and are not included. Mention them only when they could change this answer.`,
      user: `REGISTER\n${str(b.register, 20000)}\n\nCLAUSES\n${clauses.map(c => `[${c.cid} §${c.sec}] (${c.supplier}) ${c.text}`).join('\n\n')}\n\nQUESTION: ${q}`
    };
  },

  /* A renewal brief: recommendation, reasons, asks and a draft letter, as JSON. */
  brief(b) {
    const c = b.contract || {};
    const choices = arr(b.choices, 4).map(x => [str(x[0], 20), str(x[1], 60)]).filter(x => x[0]);
    if (!choices.length) throw new Reject('bad_request', 'No choices given.');
    const facts = `CONTRACT ${str(c.id, 12)}: ${str(c.supplier, 100)}, ${str(c.title, 160)}. Owner: ${str(c.owner, 80)}. Annual value: ${str(c.annualValue, 30, 'not stated')}. Term ends ${str(c.termEnd, 12, 'not stated')}. Renewal term: ${str(c.renewalMonths, 8, 'none')} months. Price rule: ${str(c.upliftText, 300, 'not stated')}. Notice method: ${str(c.noticeMethod, 200, 'not stated')}.`;
    return {
      max_tokens: 2500, effort: 'low',
      schema: { type: 'object', additionalProperties: false, required: ['recommendation', 'headline', 'why', 'asks', 'letter'], properties: {
        recommendation: { type: 'string', enum: choices.map(x => x[0]) },
        headline: { type: 'string' },
        why: { type: 'array', items: { type: 'string' } },
        asks: { type: 'array', items: { type: 'string' } },
        letter: { type: 'string' } } },
      system: `You help a procurement manager decide what to do about a supplier contract before a deadline. Today is ${str(b.today, 10, 'today')}. Use only the facts given. Do not invent usage figures, prices or clause terms, and do not do arithmetic.

Reply with JSON: {"recommendation": one of ${choices.map(x => `"${x[0]}" (${x[1]})`).join(', ')}, "headline": one sentence, "why": three short reasons, each resting on a fact given and naming the clause number where relevant, "asks": up to three specific things to ask the supplier for, "letter": a short formal letter or email to the supplier for a human to review before sending. The letter must follow the notice method in the contract. If the recommendation is renegotiate while the notice window is open, the letter gives notice of non-renewal to protect the position and invites a revised proposal. Sign off as: Procurement, Kestrel Mobility Ltd.}`,
      user: `${facts}\nSITUATION: ${str(b.situation, 600)}\nCLAUSES (verbatim): ${list(b.clauses, 8, 600).map(q => '"' + q + '"').join(' | ') || 'none'}\nSIGNALS FROM OTHER SYSTEMS: ${list(b.signals, 10, 200).join(' | ') || 'none on file'}\nFULL TEXT:\n${str(b.fullText, 60000)}`
    };
  },

  /* Redraft a dispute note the page wrote from its own arithmetic. Plain text. */
  dispute(b) {
    const facts = str(b.facts, 8000).trim();
    if (!facts) throw new Reject('bad_request', 'No dispute facts given.');
    return {
      max_tokens: 1500, effort: 'low',
      system: 'Rewrite the invoice dispute note you are given so it is firm, courteous and brief. Keep every number, invoice reference and quoted contract sentence exactly as given. Do not add facts and do not do arithmetic. Plain text only, no headings or markdown.',
      user: facts
    };
  },

  /* Read a pasted invoice into lines. The comparison with the rate card is then done by the page. */
  invoice(b) {
    const text = str(b.text, 20000).trim();
    if (text.length < 40) throw new Reject('too_short', 'Paste the invoice text first.');
    return {
      max_tokens: 4000, effort: 'low',
      schema: { type: 'object', additionalProperties: false, required: ['supplier', 'invoiceNo', 'date', 'period', 'periodLabel', 'termsDays', 'total', 'lines'], properties: {
        supplier: { type: 'string' }, invoiceNo: { type: 'string' }, date: { type: 'string' }, period: { type: 'string' }, periodLabel: { type: 'string' },
        termsDays: { type: ['number', 'null'] }, total: { type: 'number' },
        lines: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['desc', 'kind', 'item', 'overtime', 'qty', 'unitPrice', 'pct', 'amount'], properties: {
          desc: { type: 'string' }, kind: { type: 'string', enum: ['rate', 'surcharge'] }, item: { type: ['string', 'null'] }, overtime: { type: 'boolean' },
          qty: { type: 'number' }, unitPrice: { type: 'number' }, pct: { type: ['number', 'null'] }, amount: { type: 'number' } } } } } },
      system: `Read a supplier invoice and return its lines as data. Do not check anything and do not do arithmetic beyond copying what the invoice says.

Reply with JSON: {"supplier": the matching known supplier name or the name on the invoice, "invoiceNo", "date": "YYYY-MM-DD", "period": "YYYY-MM", "periodLabel", "termsDays": number or null, "total": number, "lines": [{"desc", "kind": "rate" or "surcharge", "item": the exact rate card item this line is for or null, "overtime": true/false, "qty": number, "unitPrice": number, "pct": number or null, "amount": number}]}

Known suppliers and their contract rate card items:
${str(b.cards, 10000)}`,
      user: `INVOICE:\n<<<\n${text}\n>>>`
    };
  },

  /* Turn a plain-English question into a structured filter. The page runs the filter, so the
     result is exact and would still be exact over 4,000 contracts. */
  filter(b) {
    const q = str(b.question, 300).trim();
    if (!q) throw new Reject('bad_request', 'No question given.');
    const FIELDS = ['supplier', 'owner', 'category', 'type', 'autoRenew', 'termEnd', 'noticeBy', 'daysLeft', 'noticeDays', 'renewalMonths', 'upliftPct', 'upliftText', 'annualValue', 'paymentDays', 'liabilityCap', 'sla', 'law', 'noticeMethod', 'amendments', 'decided'];
    const OPS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains', 'isnull', 'notnull', 'before', 'after'];
    return {
      max_tokens: 800, effort: 'low',
      schema: { type: 'object', additionalProperties: false, required: ['filters', 'match', 'explanation', 'unsupported'], properties: {
        filters: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'op', 'value'], properties: {
          field: { type: 'string', enum: FIELDS }, op: { type: 'string', enum: OPS }, value: { type: ['string', 'number', 'boolean', 'null'] } } } },
        match: { type: 'string', enum: ['all', 'any'] },
        explanation: { type: 'string' },
        unsupported: { type: ['string', 'null'] } } },
      system: `You turn a plain-English question about a company's supplier contracts into a structured filter. Code runs the filter over the repository; you never see the contracts and never compute results yourself. Today is ${str(b.today, 10, 'today')}.

Fields you can filter on, and their meaning:
- supplier, owner, category, type, upliftText (price change rule, text), liabilityCap (text), sla (text), law (governing law, text), noticeMethod (text): text fields. Use "contains" or "eq".
- autoRenew (true/false): whether the contract renews automatically.
- termEnd (date YYYY-MM-DD): when the current term ends. noticeBy (date): the last day to give notice. Use "before"/"after" with a YYYY-MM-DD value, or "isnull"/"notnull".
- daysLeft (number): days from today until the last day to act (notice date, or term end when there is no notice period). Negative means the date has passed.
- noticeDays, renewalMonths, paymentDays (numbers).
- upliftPct (number): the largest allowed percentage increase. null means increases are allowed with no cap. 0 means prices are fixed.
- annualValue (number, USD).
- amendments (number): how many signed amendments are filed against the contract.
- decided (true/false): whether a renewal decision has been recorded.

Rules:
- Translate relative dates yourself from today's date ("in the next 90 days" means daysLeft gte 0 and daysLeft lte 90). This is the only date arithmetic you do.
- "Uncapped" or "no cap on price increases" means upliftPct isnull.
- Use "all" unless the question clearly asks for alternatives.
- "explanation": one plain sentence saying what the filter does, for a person to confirm.
- "unsupported": if part of the question cannot be expressed with these fields, say which part in one sentence, else null.
Reply with JSON only: {"filters":[{"field","op","value"}],"match":"all" or "any","explanation","unsupported": string or null}`,
      user: `QUESTION: ${q}`
    };
  },

  /* Explain an amendment in plain English. The page still applies the changes term by term. */
  amend(b) {
    const p = b.parent || {};
    const changes = arr(b.changes, 12).map(ch => `- ${str(ch.label, 80)}: on file now "${str(ch.was, 120, 'not stated')}", after this amendment "${str(ch.now, 120)}"${ch.quote ? ` (the amendment says: "${str(ch.quote, 300)}")` : ''}`);
    if (!changes.length) throw new Reject('bad_request', 'No changes given.');
    return {
      max_tokens: 1200, effort: 'low',
      system: 'You explain a signed contract amendment in plain English for a procurement manager, in at most 120 words and plain text with no headings. Say what changes, what stays, and any new obligation the customer (Kestrel Mobility Ltd.) takes on. Use only the facts given. Do not do arithmetic and do not estimate money effects: the page computes those. If the amendment text mentions a term that is not in the list of changes, point it out as something a person should check.',
      user: `PARENT CONTRACT: ${str(p.supplier, 100)}, ${str(p.title, 160)}.\nTAKES EFFECT: ${str(b.effectiveFrom, 12, 'not stated')}.\nCHANGES EXTRACTED BY THE READER:\n${changes.join('\n')}\n\nAMENDMENT TEXT:\n<<<\n${str(b.text, 20000)}\n>>>`
    };
  }
};

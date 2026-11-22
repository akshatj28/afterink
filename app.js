(function () {
  'use strict';
  const { DEMO_TODAY, FIELDS, CATEGORIES, SEED_CONTRACTS, SEED_INBOX, SEED_INVOICES, SAMPLE_INVOICE_TEXT, SAMPLE_CONTRACT_TEXT, SUGGESTED } = window.AFTERINK;
  const KEY = 'afterink.v3';

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const D = iso => new Date(iso + 'T00:00:00Z');
  const addDays = (iso, n) => { const d = D(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
  const fmtDate = iso => iso ? D(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not stated';
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = n => { if (n == null || isNaN(n)) return 'Not stated'; const frac = Math.abs(n % 1) > 0.004; return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: 2 }); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'per', 'rate', 'we', 'our', 'is', 'are', 'what', 'which', 'do', 'does', 'have', 'has', 'each', 'one', 'any', 'can', 'their', 'with', 'when', 'where', 'it', 'its', 'be', 'at', 'by', 'us', 'hrs', 'hours', 'hour', 'x']);
  const toks = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(w => w.replace(/ies$/, 'y').replace(/(ing|ed|s)$/, ''));

  function parseMarked(src) {
    const prov = {};
    const text = src.replace(/\[\[([\w,]+)\|([^\]]+)\]\]/g, (m, keys, q) => { keys.split(',').forEach(k => { prov[k] = q; }); return q; });
    return { text, prov };
  }
  function findSpan(text, q) {
    if (!q) return null;
    const i = text.indexOf(q);
    if (i >= 0) return [i, i + q.length];
    try {
      const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');
      const m = re.exec(text);
      return m ? [m.index, m.index + m[0].length] : null;
    } catch (e) { return null; }
  }
  function docHtml(text, items) {
    const found = [];
    for (const it of items) { const sp = findSpan(text, it.quote); if (sp) found.push({ k: it.k, s: sp[0], e: sp[1] }); }
    found.sort((a, b) => a.s - b.s || b.e - a.e);
    const merged = []; let last = -1;
    for (const f of found) { if (f.s < last) { merged[merged.length - 1].ks.push(f.k); continue; } merged.push({ ks: [f.k], s: f.s, e: f.e }); last = f.e; }
    let h = '', i = 0;
    for (const m of merged) {
      h += esc(text.slice(i, m.s)) + `<mark class="hl${m.ks.includes(T.hl) ? ' on' : ''}" data-ks="${m.ks.join(' ')}">` + esc(text.slice(m.s, m.e)) + '</mark>';
      i = m.e;
    }
    return h + esc(text.slice(i));
  }

  /* ---------- state ---------- */
  function buildContract(s) {
    const { text, prov } = parseMarked(s.src);
    const c = clone(s); delete c.src;
    return Object.assign(c, { text, prov, notes: s.notes || {}, amendments: [], history: s.history || [], signals: s.signals || [], risks: [], status: 'verified', source: 'seed' });
  }
  function buildDoc(d) {
    const { text, prov } = parseMarked(d.src);
    const sv = d.saved;
    const ex = { docType: sv.docType, supplier: sv.supplier, title: sv.title, type: sv.type, category: sv.category, summary: sv.summary, risks: sv.risks || [], fields: {}, rates: [], amends: null };
    for (const fd of FIELDS) {
      const v = (sv.values || {})[fd.k];
      ex.fields[fd.k] = v ? { value: v[0], quote: prov[fd.k] || null, confidence: v[1], note: v[2] || '' } : { value: null, quote: null, confidence: 'low', note: '' };
    }
    ex.rates = (sv.rates || []).map(r => Object.assign({}, r, { quote: prov.rates || null }));
    if (sv.amends) ex.amends = { parentSupplier: sv.amends.parentSupplier, effectiveFrom: sv.amends.effectiveFrom, changes: sv.amends.changes.map(ch => Object.assign({}, ch, { quote: prov[ch.qk] || null })) };
    return { id: d.id, filename: d.filename, found: d.found, owner: d.owner, text, saved: ex, status: 'new' };
  }
  function fresh() {
    return { v: 3, route: 'start', contracts: SEED_CONTRACTS.map(buildContract), inbox: SEED_INBOX.map(buildDoc), invoices: SEED_INVOICES.map(i => Object.assign(clone(i), { status: 'unchecked' })), decisions: {}, log: [], asked: 0, sel: {} };
  }
  function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.v === 3 && Array.isArray(j.contracts)) return j; } catch (e) { /* storage unavailable */ } return fresh(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  let S = load();
  const T = { hl: null, busy: null, review: null, ask: null, briefs: {}, choice: {}, letters: {}, disputes: {}, repoQ: '', repoF: 'all', pasteInv: '', pasteText: '', find: null, showLog: false, aiDraft: {} };
  const DESK = { legal: 'Legal Operations', proc: 'Procurement', fin: 'Accounts Payable', any: 'Anyone' };
  function log(desk, text, ref) { S.log.unshift({ desk, text, ref: ref || null, n: S.log.length + 1 }); save(); }

  /* ---------- the AI server ---------- */
  /* The page sends data to a small server that holds the API key and the prompts (see proxy/).
     Below: the server's address, the health check, the streaming call, and a log of every call,
     so a viewer can see that the AI is live and what each call cost in time and tokens. */
  const AI_URL_DEFAULT = 'https://afterink-proxy.afterink-proxy.workers.dev';
  /* ?ai=http://127.0.0.1:8787 points this one page load at a local server, for testing. Only local
     addresses are accepted and nothing is stored, so a shared link cannot send a viewer's text elsewhere. */
  const AI_URL_OVERRIDE = (() => {
    try { localStorage.removeItem('afterink.ai.url'); } catch (e) { /* storage unavailable; an older build stored an override here */ }
    try { const q = new URLSearchParams(location.search).get('ai'); return q && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(q) ? q.replace(/\/$/, '') : ''; } catch (e) { return ''; }
  })();
  const AI_URL = AI_URL_OVERRIDE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://127.0.0.1:8787' : AI_URL_DEFAULT);
  const AI_UNSET = /REPLACE-ME/.test(AI_URL);
  const AI = { state: 'checking', provider: null, model: null, modelName: null, calls: [], why: '' };
  const AI_COPY = { rate_limited: 'The AI server is busy or its free quota is used up for now. Try again in a minute.', budget: "Today's AI budget for this demo is used up.", auth: 'The AI server has no working key.', offline: 'The AI server is not reachable.', refused: 'The model declined this input.', invalid_json: 'The model replied in a format this page could not read. Try again.', upstream_error: 'The connection to the AI server dropped. Try again.', overloaded: 'The AI model is busy right now: Google reports high demand on its free tier. Try again in a minute.', prompt_too_large: 'That text is too long. Paste a shorter document.', too_short: 'Paste the full text first.', empty: 'The model returned nothing. Try again.', bad_request: 'The AI server rejected the request.' };
  const live = () => AI.state === 'live';
  function aiErr(e) { const code = e && e.code; if (code === 'auth' || code === 'offline' || code === 'budget') { AI.state = 'off'; AI.why = code; chrome(); strip(); } return AI_COPY[code] || AI_COPY.upstream_error; }
  const WHY_OFF = { auth: 'it has no working key', budget: "today's AI budget for this demo is used up", unset: 'no AI server is set up for this copy yet', offline: 'it cannot be reached' };
  const TASK_LABEL = { extract: 'Read a document', ask: 'Answer a question', brief: 'Write a renewal brief', dispute: 'Redraft a dispute note', invoice: 'Read an invoice', filter: 'Turn a question into a filter', amend: 'Explain an amendment' };
  const fmtMs = ms => (ms / 1000).toFixed(1) + ' s';
  async function aiCall(task, body, onText) {
    const t0 = performance.now(), entry = { task, label: TASK_LABEL[task] || task, chars: JSON.stringify(body).length, status: 'running' };
    AI.calls.unshift(entry); if (AI.calls.length > 40) AI.calls.length = 40; strip();
    let res;
    try { res = await fetch(AI_URL + '/v1/' + task, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { entry.status = 'failed'; entry.err = 'offline'; strip(); throw { code: 'offline' }; }
    if (!res.ok) { let j = {}; try { j = await res.json(); } catch (e) { /* no body */ } entry.status = 'failed'; entry.err = j.error || (res.status === 429 ? 'rate_limited' : 'upstream_error'); strip(); throw { code: entry.err, message: j.message }; }
    const fail = (code, message) => { entry.status = 'failed'; entry.err = code; entry.ms = Math.round(performance.now() - t0); strip(); return { code, message }; };
    let buf = '', text = '', meta = null, err = null;
    try {
      const reader = res.body.getReader(), dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            let j; try { j = JSON.parse(line.slice(6)); } catch (e) { continue; }
            if (j.t) { text += j.t; if (onText) onText(text, j.t); }
            else if (j.error) err = j;
            else if (j.done) meta = j;
          }
        }
      }
    } catch (e) { throw fail('upstream_error'); }
    if (err) throw fail(err.error, err.message);
    if (!meta) throw fail('upstream_error');            /* the stream ended without its closing event: the answer may be cut off */
    if (!text.trim()) throw fail('empty');
    entry.status = 'done'; entry.ms = Math.round(performance.now() - t0); entry.in = meta.in; entry.out = meta.out; entry.model = meta.modelName || meta.model; entry.truncated = !!meta.truncated; strip();
    return { text, meta, entry };
  }
  function parseJSONText(t) {
    const s = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(s); } catch (e) { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) { /* fall through */ } } throw { code: 'invalid_json' }; }
  }
  async function aiJSON(task, body) { const r = await aiCall(task, body); return { data: parseJSONText(r.text), entry: r.entry }; }

  /* ---------- domain logic ---------- */
  const findContract = supplier => { const k = toks(supplier)[0]; return S.contracts.find(c => toks(c.supplier)[0] === k) || null; };
  const getC = id => S.contracts.find(c => c.id === id);
  function matchRate(c, name) {
    if (!name) return null;
    const exact = c.rates.find(r => r.item.toLowerCase() === String(name).toLowerCase());
    if (exact) return exact;
    const a = new Set(toks(name)); let best = null, bs = 0;
    for (const r of c.rates) { const b = toks(r.item); const ov = b.filter(t => a.has(t)).length; const sc = ov / Math.max(1, Math.min(a.size, b.length)); if (sc > bs) { bs = sc; best = r; } }
    return bs >= 0.6 ? best : null;
  }
  const noticeBy = c => (c.f.autoRenew && c.f.termEnd && c.f.noticeDays != null) ? addDays(c.f.termEnd, -c.f.noticeDays) : null;
  function renewalItem(c) {
    const te = c.f.termEnd; if (!te || te < DEMO_TODAY) return null;
    const nb = noticeBy(c); let kind, actBy;
    if (c.f.autoRenew) { if (nb && nb >= DEMO_TODAY) { kind = 'open'; actBy = nb; } else if (nb) { kind = 'closed'; actBy = te; } else { kind = 'nonotice'; actBy = te; } }
    else { kind = 'expiry'; actBy = te; }
    const months = c.f.renewalMonths || 12, base = c.f.annualValue || 0;
    return { c, kind, actBy, left: daysBetween(DEMO_TODAY, actBy), commit: c.f.autoRenew ? r2(base * months / 12) : 0, uplift: (c.f.autoRenew && c.f.upliftPct) ? r2(base * c.f.upliftPct / 100 * months / 12) : 0 };
  }
  const renewalItems = (horizon) => S.contracts.map(renewalItem).filter(x => x && x.left <= (horizon || 150)).sort((a, b) => a.left - b.left);
  function choicesFor(it) {
    if (it.kind === 'expiry') return [['renegotiate', 'Extend by change order'], ['exit', 'Let it end']];
    if (it.kind === 'closed') return [['renew', 'Accept the renewal'], ['renegotiate', 'Ask for better terms anyway']];
    return [['renew', 'Let it renew'], ['renegotiate', 'Give notice and renegotiate'], ['exit', 'Give notice and leave']];
  }
  function checkInvoice(inv) {
    const c = findContract(inv.supplier);
    const res = { c, rows: [], findings: [], over: 0, credit: 0, flagged: 0, state: 'clean' };
    if (!c) { res.state = 'nocontract'; res.findings.push({ tone: 'crit', title: 'No verified contract on file', text: `Nothing in the repository covers ${inv.supplier}. None of the ${inv.lines.length} lines (${money(inv.total)}) can be checked against agreed prices.` }); return res; }
    /* An amendment governs only from its effective date. An invoice for an earlier period is
       checked against the terms that applied then. */
    const pStart = /^\d{4}-\d{2}$/.test(inv.period || '') ? inv.period + '-01' : (inv.date || DEMO_TODAY);
    const before = x => x && x.from && pStart < x.from;
    let base = 0;
    for (const ln of inv.lines) {
      const row = { ln, exp: null, expAmt: null, varc: 0, note: '', quote: null, tone: 'good' };
      if (ln.kind === 'surcharge') {
        const fw = c.fWas && c.fWas.surchargeCapPct, old = before(fw);
        const cap = old ? fw.was : c.f.surchargeCapPct; row.quote = old ? null : (c.prov.surchargeCapPct || null);
        if (cap == null) { row.tone = 'mute'; row.expAmt = ln.amount; row.note = old ? `No cap applied in this period. ${fw.src} sets one only from ${fmtDate(fw.from)}.` : 'The contract on file sets no cap on this surcharge, so it cannot be challenged.'; }
        else { row.exp = cap + '% cap'; row.expAmt = r2(base * cap / 100); row.varc = Math.max(0, r2(ln.amount - row.expAmt)); if (row.varc > 0) { row.tone = 'crit'; row.note = `Billed at ${ln.pct}% of line-haul. The cap is ${cap}% of the correct line-haul charges.`; } }
      } else {
        const rt0 = matchRate(c, ln.item || ln.desc), old = before(rt0);
        const rt = old ? (rt0.was == null ? null : Object.assign({}, rt0, { rate: rt0.was, src: 'the agreement as it stood before ' + rt0.src, quote: null })) : rt0;
        if (!rt) { row.tone = 'warn'; row.note = old ? `Added to the rate card by ${rt0.src}, which applies only from ${fmtDate(rt0.from)}. This invoice period is earlier.` : 'Not on the contract rate card. The contract owner should confirm this was agreed.'; }
        else {
          const mult = ln.overtime ? (c.f.overtimeMultiplier || 1) : 1;
          row.exp = r2(rt.rate * mult); row.expAmt = r2(row.exp * ln.qty); row.varc = r2(ln.amount - row.expAmt);
          row.quote = (ln.overtime && c.prov.overtimeMultiplier) ? c.prov.overtimeMultiplier : (rt.quote || (old ? null : c.prov.rates) || null);
          row.src = rt.src || null;
          if (row.varc > 0.005) { row.tone = 'crit'; row.note = `Billed ${money(ln.unitPrice)} per ${rt.unit}. The contract rate is ${money(row.exp)}${ln.overtime ? ` (${money(rt.rate)} x ${mult} for overtime)` : ''}${rt.src ? ', set by ' + rt.src : ''}.`; }
          else if (row.varc < -0.005) { row.tone = 'info'; row.note = 'Billed below the contract rate.'; row.varc = 0; }
          else row.varc = 0;
          if (ln.base !== false) base += row.expAmt;
        }
      }
      if (row.varc > 0) res.over = r2(res.over + row.varc);
      res.rows.push(row);
    }
    const sc = c.slaCredit, act = sc && c.perf ? c.perf[inv.period] : undefined;
    if (sc && act != null && act < sc.target && !inv.creditApplied) {
      const pct = sc.perPoint ? Math.min(sc.maxPct || 100, Math.floor(sc.target - act) * sc.creditPct) : sc.creditPct;
      if (pct > 0) { res.credit = r2(base * pct / 100); res.findings.push({ tone: 'crit', title: 'Service credit not applied', text: `${sc.metric} was ${act}${sc.unit} for ${inv.periodLabel || inv.period} against a target of ${sc.target}${sc.unit}. The contract gives a credit of ${pct}% of the correct charges, which is ${money(res.credit)}. The invoice does not show it.`, quote: c.prov.sla }); }
    }
    if (inv.lines.some(l => l.overtime)) res.findings.push({ tone: 'warn', title: 'Overtime needs written approval in advance', text: `No approval is on file. Ask ${c.owner} to confirm before the overtime lines are paid.`, quote: c.prov.overtimeMultiplier });
    if (inv.termsDays != null && c.f.paymentDays != null && inv.termsDays < c.f.paymentDays) res.findings.push({ tone: 'warn', title: 'Payment terms shorter than agreed', text: `The invoice asks for payment in ${inv.termsDays} days. The contract allows ${c.f.paymentDays}.`, quote: c.prov.paymentDays });
    res.flagged = r2(res.over + res.credit);
    res.state = res.flagged > 0 ? 'variance' : (res.findings.some(f => f.tone === 'warn') || res.rows.some(r => r.tone === 'warn') ? 'query' : 'clean');
    return res;
  }
  function northStar() {
    /* Unfiled documents count against the metric: each signed document known to exist but not
       filed is one undecided date, so filing less can never raise the number. */
    const items = renewalItems(90), unfiled = S.inbox.filter(d => d.status === 'new').length;
    const onTime = items.filter(it => S.decisions[it.c.id] && S.decisions[it.c.id].onTime).length;
    return { due: items.length + unfiled, onTime, unfiled, missed: items.filter(it => it.kind === 'closed').length };
  }
  function invoiceTotals() {
    let checked = 0, total = 0, flagged = 0, held = 0, blind = 0;
    for (const inv of S.invoices) { const r = checkInvoice(inv); total += inv.total; if (r.c) { checked += inv.total; flagged += r.flagged; } else blind += inv.total; if (inv.status === 'disputed') held += r.flagged; }
    return { checked: r2(checked), total: r2(total), flagged: r2(flagged), held: r2(held), blind: r2(blind) };
  }

  /* ---------- reading a document: the model's lines become terms, and code checks each one ---------- */
  /* The server streams one JSON line per term. Each line is applied as it arrives, so the review
     screen fills in term by term, with the quote check and the value-in-quote check run by code. */
  function emptyEx() {
    const ex = { docType: 'contract', supplier: '', title: '', type: '', category: 'Other', summary: '', risks: [], fields: {}, rates: [], amends: null, source: 'live', meta: false, done: false };
    for (const fd of FIELDS) ex.fields[fd.k] = { value: null, quote: null, confidence: 'low', note: '', pending: true };
    return ex;
  }
  function applyLine(ex, j) {
    if (!j || typeof j !== 'object') return false;
    const str = (x, d) => (x == null ? (d || '') : String(x));
    if (j.type === 'meta') { ex.docType = j.docType === 'amendment' ? 'amendment' : 'contract'; ex.supplier = str(j.supplier, 'Unknown supplier'); ex.title = str(j.title, 'Untitled document'); ex.type = str(j.kind || j.type, 'Contract'); ex.category = CATEGORIES.includes(j.category) ? j.category : 'Other'; ex.summary = str(j.summary); ex.meta = true; return true; }
    if (j.type === 'field') { const fd = FIELDS.find(f => f.k === j.k); if (!fd || (ex.touched && ex.touched[fd.k])) return false; const v = coerce(fd.type, j.value); ex.fields[fd.k] = { value: v, quote: j.quote ? String(j.quote) : null, confidence: ['high', 'medium', 'low'].includes(j.confidence) ? j.confidence : (v == null ? 'low' : 'medium'), note: j.note ? String(j.note) : '' }; return true; }
    if (j.type === 'rate') { const rate = coerce('money', j.rate); if (j.item && rate != null) ex.rates.push({ item: String(j.item), unit: str(j.unit, 'unit'), rate, quote: j.quote ? String(j.quote) : null }); return true; }
    if (j.type === 'risk') { if (j.text && ex.risks.length < 6) ex.risks.push(String(j.text)); return true; }
    if (j.type === 'amends') { ex.amends = normEx({ docType: 'amendment', amends: j }).amends; return true; }
    if (j.type === 'end') { for (const fd of FIELDS) delete ex.fields[fd.k].pending; ex.done = true; return true; }
    return false;
  }
  function coerce(type, v) {
    if (v === undefined || v === null || v === '') return null;
    if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null;
    if (type === 'bool') return v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
    if (type === 'text') return String(v);
    const n = Number(String(v).replace(/[, $%]/g, '').replace(/^USD/i, '')); return isNaN(n) ? null : n;  /* models sometimes write "6%" or "USD 35.50" */
  }
  function normEx(r) {
    r = r && typeof r === 'object' ? r : {};
    const str = (x, d) => (x == null ? (d || '') : String(x));
    const ex = { docType: r.docType === 'amendment' ? 'amendment' : 'contract', supplier: str(r.supplier, 'Unknown supplier'), title: str(r.title, 'Untitled document'), type: str(r.type, 'Contract'), category: CATEGORIES.includes(r.category) ? r.category : 'Other', summary: str(r.summary), risks: Array.isArray(r.risks) ? r.risks.map(String).slice(0, 6) : [], fields: {}, rates: [], amends: null };
    for (const fd of FIELDS) {
      const x = (r.fields && r.fields[fd.k] && typeof r.fields[fd.k] === 'object') ? r.fields[fd.k] : {};
      const v = coerce(fd.type, x.value);
      ex.fields[fd.k] = { value: v, quote: x.quote ? String(x.quote) : null, confidence: ['high', 'medium', 'low'].includes(x.confidence) ? x.confidence : (v == null ? 'low' : 'medium'), note: x.note ? String(x.note) : '' };
    }
    if (Array.isArray(r.rates)) ex.rates = r.rates.filter(x => x && x.item && coerce('money', x.rate) != null).map(x => ({ item: String(x.item), unit: str(x.unit, 'unit'), rate: coerce('money', x.rate), quote: x.quote ? String(x.quote) : null }));
    if (ex.docType === 'amendment' && r.amends && Array.isArray(r.amends.changes)) {
      ex.amends = { parentSupplier: str(r.amends.parentSupplier, ex.supplier), effectiveFrom: coerce('date', r.amends.effectiveFrom), changes: r.amends.changes.map(ch => ch && ch.kind === 'rate' ? { kind: 'rate', item: str(ch.item), newRate: coerce('money', ch.newRate), quote: ch.quote ? String(ch.quote) : null } : (ch && FIELDS.some(f => f.k === ch.field) ? { kind: 'field', field: ch.field, label: str(ch.label, ch.field), newValue: coerce(FIELDS.find(f => f.k === ch.field).type, ch.newValue), quote: ch.quote ? String(ch.quote) : null } : null)).filter(Boolean) };
    }
    return ex;
  }
  function chunks() {
    const out = [];
    for (const c of S.contracts) {
      c.text.split(/\n(?=\d+\.\s)/).forEach(p => { const m = /^(\d+)\.\s/.exec(p); if (m) out.push({ cid: c.id, sec: m[1], supplier: c.supplier, text: p.trim() }); });
      (c.amendments || []).forEach((a, i) => out.push({ cid: c.id, sec: 'A' + (i + 1), supplier: c.supplier, text: a.text }));
    }
    return out;
  }
  function retrieve(q, k) {
    const qt = new Set(toks(q));
    const syn = { renew: ['renewal', 'automatically', 'notice', 'term'], price: ['fee', 'increase', 'cpi', 'percent', 'charge'], raise: ['increase', 'cpi', 'fee'], liability: ['liability', 'limited'], owed: ['credit'], credit: ['credit', 'service', 'audit'], stop: ['notice', 'non', 'renewal'], cap: ['exceed', 'more', 'limited'] };
    Array.from(qt).forEach(t => (syn[t] || []).forEach(x => qt.add(toks(x)[0] || x)));
    return chunks().map(ch => { const tt = toks(ch.text + ' ' + ch.supplier); let s = 0; const seen = new Set(); for (const t of tt) if (qt.has(t) && !seen.has(t)) { s += 1; seen.add(t); } return { ch, s }; }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.ch);
  }
  function register() {
    return S.contracts.map(c => `${c.id} | ${c.supplier} | ${c.type} | owner ${c.owner} | annual value ${c.f.annualValue != null ? money(c.f.annualValue) : 'not stated'} | term ends ${c.f.termEnd || 'not stated'} | auto-renews ${c.f.autoRenew ? 'yes, ' + (c.f.renewalMonths || '?') + ' months' : 'no'} | notice ${c.f.noticeDays != null ? c.f.noticeDays + ' days' : 'n/a'} | notice by ${noticeBy(c) ? `${noticeBy(c)} (${daysBetween(DEMO_TODAY, noticeBy(c)) < 0 ? `passed ${-daysBetween(DEMO_TODAY, noticeBy(c))} days ago` : `${daysBetween(DEMO_TODAY, noticeBy(c))} days from today`})` : 'n/a'} | term ends in ${c.f.termEnd ? daysBetween(DEMO_TODAY, c.f.termEnd) + ' days' : 'n/a'} | price rule: ${c.f.upliftText || 'not stated'} | liability: ${c.f.liabilityCap || 'not stated'}`).join('\n');
  }
  const secOf = (c, k) => { const q = c.prov[k]; const ch = q && chunks().find(x => x.cid === c.id && x.text.includes(q)); return ch ? ' §' + ch.sec : ''; };
  function cannedAnswer(id) {
    if (id === 'q1') {
      const its = renewalItems(90).filter(it => it.c.f.autoRenew);
      const open = its.filter(it => it.kind === 'open'), closed = its.filter(it => it.kind === 'closed');
      let t = `${open.length} contracts can still be stopped in the next 90 days.${closed.length ? ` For ${closed.length} more the notice date has already passed.` : ''}\n`;
      open.forEach(it => { t += `- ${it.c.supplier}: give notice by ${fmtDate(it.actBy)} (${it.left} days). ${it.c.f.noticeMethod || 'Notice method not stated'}. Otherwise it renews for ${it.c.f.renewalMonths} months [${it.c.id}${secOf(it.c, 'noticeDays')}]\n`; });
      closed.forEach(it => { t += `- ${it.c.supplier}: notice was due ${fmtDate(noticeBy(it.c))}. It renews on ${fmtDate(addDays(it.c.f.termEnd, 1))} [${it.c.id}${secOf(it.c, 'noticeDays')}]\n`; });
      return t;
    }
    if (id === 'q2') {
      const cs = S.contracts.filter(c => c.f.upliftPct == null);
      let t = cs.length ? `${cs.length} verified ${cs.length === 1 ? 'contract lets' : 'contracts let'} the supplier raise prices with no cap.\n` : 'No verified contract allows an uncapped increase.\n';
      cs.forEach(c => { t += `- ${c.supplier}: ${c.f.upliftText || 'No price rule stated'} [${c.id}${secOf(c, 'upliftText')}]\n`; });
      const cap = S.contracts.filter(c => c.f.upliftPct > 0);
      if (cap.length) t += 'Capped increases, for comparison: ' + cap.map(c => `${c.supplier} ${c.f.upliftPct}% [${c.id}${secOf(c, 'upliftPct')}]`).join('; ') + '.';
      return t;
    }
    if (id === 'q3') {
      const c = S.contracts.find(x => /brightclean/i.test(x.supplier)); if (!c) return null;
      const misses = Object.entries(c.perf || {}).filter(e => e[1] < c.slaCredit.target);
      return `A credit of ${c.slaCredit.creditPct}% of that month's service fee, which is ${money(r2(c.rates[0].rate * c.slaCredit.creditPct / 100))} a month, applied on the next invoice [${c.id}${secOf(c, 'sla')}].\n- The trigger is a joint monthly audit score below ${c.slaCredit.target}% [${c.id}${secOf(c, 'sla')}]\n- The audit log shows ${misses.length} recent ${misses.length === 1 ? 'miss' : 'misses'}: ${misses.map(e => `${e[0]} at ${e[1]}%`).join(', ')}\n- The contract does not say the credit lapses if unclaimed, but the supplier has to apply it. Check each invoice after a miss.`;
    }
    if (id === 'q4') {
      /* Comparing a cap written in words with 12 months of fees is a reading task, so without the AI
         the page lists each cap as filed and leaves the comparison to the reader. */
      const cs = S.contracts.filter(c => c.f.liabilityCap), none = S.contracts.filter(c => !c.f.liabilityCap);
      let t = 'Without the AI this page cannot judge which caps fall below 12 months of fees, so here is each verified contract\'s liability cap as filed.\n';
      cs.forEach(c => { t += `- ${c.supplier}: ${c.f.liabilityCap} [${c.id}${secOf(c, 'liabilityCap')}]\n`; });
      if (none.length) t += `No liability cap is recorded for ${none.map(c => c.supplier).join(', ')}.`;
      return t;
    }
    return null;
  }
  function situationFor(it) {
    const c = it.c;
    return it.kind === 'open' ? `The contract renews automatically unless notice is given by ${it.actBy} (${it.left} days from today).` : it.kind === 'closed' ? `The notice deadline (${noticeBy(c)}) has passed. The contract renews on ${addDays(c.f.termEnd, 1)}.` : it.kind === 'expiry' ? `The contract ends on ${c.f.termEnd} and does not renew. Work continuing after that date would be out of contract.` : `The contract renews automatically and gives no notice period in days.`;
  }
  /* Find in plain words: the model turns the question into a filter, code runs it. The result is
     exact, and would still be exact over 4,000 contracts, because the model never sees them. */
  function contractFacts(c) {
    const nb = noticeBy(c);
    /* daysLeft is what the filter prompt says it is: days to the notice date when there is one (negative
       once it has passed), otherwise days to the end of the term. */
    return { supplier: c.supplier, owner: c.owner, category: c.category, type: c.type, autoRenew: !!c.f.autoRenew, termEnd: c.f.termEnd || null, noticeBy: nb,
      daysLeft: nb ? daysBetween(DEMO_TODAY, nb) : c.f.termEnd ? daysBetween(DEMO_TODAY, c.f.termEnd) : null,
      noticeDays: c.f.noticeDays, renewalMonths: c.f.renewalMonths, upliftPct: c.f.upliftPct == null ? null : c.f.upliftPct, upliftText: c.f.upliftText || null, annualValue: c.f.annualValue, paymentDays: c.f.paymentDays,
      liabilityCap: c.f.liabilityCap || null, sla: c.f.sla || null, law: c.f.law || null, noticeMethod: c.f.noticeMethod || null, amendments: c.amendments.length, decided: !!S.decisions[c.id] };
  }
  function passes(c, F) {
    const facts = contractFacts(c);
    /* A value that is not clearly yes or no fails the test rather than counting as no. */
    const asBool = x => (x === true || /^(true|yes)$/i.test(String(x))) ? true : (x === false || /^(false|no)$/i.test(String(x))) ? false : null;
    const test = f => {
      if (!Object.prototype.hasOwnProperty.call(facts, f.field)) return false;
      const v = facts[f.field], x = f.value, isNull = v == null || v === '';
      const bad = typeof v === 'boolean' && x != null && asBool(x) === null;
      const same = () => typeof v === 'string' ? v.toLowerCase() === String(x).toLowerCase() : typeof v === 'boolean' ? v === asBool(x) : Number(v) === Number(x);
      switch (f.op) {
        case 'isnull': return isNull;
        case 'notnull': return !isNull;
        case 'contains': return !isNull && String(v).toLowerCase().includes(String(x == null ? '' : x).toLowerCase());
        case 'eq': return x == null ? isNull : !bad && !isNull && same();
        case 'ne': return x == null ? !isNull : !bad && (isNull || !same());
        case 'lt': return !isNull && Number(v) < Number(x);
        case 'lte': return !isNull && Number(v) <= Number(x);
        case 'gt': return !isNull && Number(v) > Number(x);
        case 'gte': return !isNull && Number(v) >= Number(x);
        case 'before': return !isNull && String(v) < String(x);
        case 'after': return !isNull && String(v) > String(x);
        default: return false;
      }
    };
    if (!F.filters.length) return true;
    return F.match === 'any' ? F.filters.some(test) : F.filters.every(test);
  }
  const OP_WORD = { eq: 'is', ne: 'is not', lt: 'under', lte: 'at most', gt: 'over', gte: 'at least', contains: 'contains', isnull: 'is not stated', notnull: 'is stated', before: 'before', after: 'after' };
  const FIELD_WORD = { supplier: 'supplier', owner: 'owner', category: 'category', type: 'type', autoRenew: 'renews automatically', termEnd: 'term ends', noticeBy: 'notice by', daysLeft: 'days left to act', noticeDays: 'notice days', renewalMonths: 'renewal months', upliftPct: 'allowed increase %', upliftText: 'price rule', annualValue: 'annual value', paymentDays: 'payment days', liabilityCap: 'liability cap', sla: 'service levels', law: 'governing law', noticeMethod: 'notice method', amendments: 'amendments filed', decided: 'renewal decided' };
  const filterWords = f => `${FIELD_WORD[f.field] || f.field} ${OP_WORD[f.op] || f.op}${f.op === 'isnull' || f.op === 'notnull' ? '' : ' ' + (f.value === true ? 'yes' : f.value === false ? 'no' : f.value)}`;
  function tplLetter(c, it, choice, asks) {
    const head = `To: ${c.supplier}\nRe: ${c.title} (${c.id})\nDate: ${fmtDate(DEMO_TODAY)}\n\n`;
    const sign = '\n\nProcurement, Kestrel Mobility Ltd.';
    const list = (asks && asks.length ? asks : ['Revised pricing for the next term']).map(a => '- ' + a).join('\n');
    const how = c.f.noticeMethod ? ` This notice is sent as the agreement requires (${c.f.noticeMethod}).` : '';
    const next = addDays(c.f.termEnd, 1);
    if (it.kind === 'expiry') {
      if (choice === 'exit') return head + `We confirm that the above agreement ends on ${fmtDate(c.f.termEnd)} and will not be extended. Please plan the handover of work in progress and the return of Kestrel materials by that date.` + sign;
      return head + `The above agreement ends on ${fmtDate(c.f.termEnd)}. We would like to extend it by a signed change order before that date. Please send a proposal that covers:\n${list}\n\nNo work should continue after ${fmtDate(c.f.termEnd)} without a signed change order.` + sign;
    }
    if (choice === 'renew') return head + `We intend to let the above agreement renew on ${fmtDate(next)}. Please confirm in writing the fees for the renewal term${c.f.upliftPct != null ? `, which under the agreement may rise by no more than ${c.f.upliftPct}%` : ''}.` + sign;
    if (it.kind === 'closed') return head + `The above agreement renews on ${fmtDate(next)}. We recognise that the notice date has passed. Before the new term starts, we ask you to consider:\n${list}\n\nWe would like to agree this by ${fmtDate(c.f.termEnd)}.` + sign;
    const notice = `This is formal notice that Kestrel Mobility Ltd. does not wish the above agreement to renew when the current term ends on ${fmtDate(c.f.termEnd)}.${how}\n\n`;
    if (choice === 'exit') return head + notice + 'Please confirm receipt in writing and send your exit plan, including the return or deletion of our data.' + sign;
    return head + notice + `We would like to keep working with you on revised terms. Please send a proposal that covers:\n${list}\n\nPlease confirm receipt of this notice in writing.` + sign;
  }
  function tplDispute(inv, res) {
    const c = res.c; let t = `To: ${inv.supplier}, Accounts Receivable\nRe: Invoice ${inv.id} dated ${fmtDate(inv.date)}\n\nWe have checked this invoice against ${c.title} (${c.id})${c.amendments.length ? ' as amended' : ''}. These amounts differ from the agreed terms:\n`;
    res.rows.filter(r => r.varc > 0).forEach(r => { t += `- ${r.ln.desc}: billed ${money(r.ln.amount)}, agreed ${money(r.expAmt)}, difference ${money(r.varc)}.${r.quote ? ` The agreement says: "${r.quote}".` : ''}\n`; });
    res.findings.filter(f => f.title === 'Service credit not applied').forEach(f => { t += `- Service credit of ${money(res.credit)} is due and is not shown.${f.quote ? ` The agreement says: "${f.quote}".` : ''}\n`; });
    t += `\nTotal difference: ${money(res.flagged)}. We will pay the undisputed ${money(r2(inv.total - res.flagged))} on the agreed terms. Please send a credit note or a corrected invoice for the rest.\n\nAccounts Payable, Kestrel Mobility Ltd.`;
    return t;
  }

  /* ---------- small view parts ---------- */
  const chip = (tone, text) => `<span class="chip ${tone}">${esc(text)}</span>`;
  /* Which team each screen is for. Shown as a badge at the top of every desk. */
  const TEAM = {
    legal: { ic: 'scale', name: 'the legal team', who: 'Legal Operations', job: 'Files every signed contract and makes sure it was read correctly.' },
    proc: { ic: 'cart', name: 'the buying team', who: 'Procurement', job: 'Decides every renewal before the last day to say no.' },
    fin: { ic: 'wallet', name: 'the finance team', who: 'Accounts Payable', job: 'Pays suppliers only what their contracts allow.' },
    any: { ic: 'users', name: 'everyone', who: 'any employee', job: 'Finds what a contract says, with the clause that proves it.' }
  };
  const deskTag = d => `<div class="team"><span class="team-ic">${icon(TEAM[d].ic)}</span><div><b>For ${TEAM[d].name}</b> <span class="team-who">${esc(TEAM[d].who)}</span><p>${TEAM[d].job}</p></div></div>`;
  /* Who produced each piece of output: the AI, ordinary code, or a person. The hover text says why. */
  const TAG = {
    ai: ['sparkle', 'Read by AI', 'AI is used here because contracts and invoices word the same thing in many different ways, so fixed rules would miss it.'],
    code: ['calc', 'Calculated by code', 'Dates, money and checks follow exact rules, so ordinary code does them the same way every time. No AI is involved.'],
    you: ['usercheck', 'Your decision', 'This commits the company or affects a supplier, so a named person decides. Nothing is sent automatically.']
  };
  const tag = (k, label) => `<span class="tag tag-${k}" title="${esc(TAG[k][2])}">${icon(TAG[k][0])}${esc(label || TAG[k][1])}</span>`;
  const aiNote = () => live() ? '' : `<p class="note">${AI.state === 'checking' ? 'Checking whether the AI server is reachable.' : `The live AI is off because ${WHY_OFF[AI.why] || WHY_OFF.offline}, so this page replays saved AI results. The checks, dates and sums still run live in your browser.`}</p>`;
  const PASTE_NOTE = 'Text you paste here is sent to the AI model through this demo\'s server, which runs on a free key whose provider may keep what it receives. Paste only public or sample documents.';
  const readingNow = () => !!(T.review && T.review.streaming);
  function hero() {
    if (!live()) return '';
    const next = S.inbox.find(d => d.status === 'new');
    return next
      ? `<div class="hero"><div><span class="glowpill">Afterink &#183; AI contract repository</span><b>Watch the AI read a signed document</b><p>${esc(next.filename)} is signed but not filed. Each term appears with the sentence it came from, and code checks every quote before a person decides anything.</p></div><button class="btn pri" data-act="read-doc" data-id="${next.id}" ${readingNow() ? 'disabled' : ''}>Read it with AI now</button></div>`
      : `<div class="hero"><div><span class="glowpill">Afterink &#183; AI contract repository</span><b>Every inbox document is filed</b><p>Paste a contract of your own and watch the AI read it, or ask the repository a question in plain words.</p></div><button class="btn pri" data-act="go" data-r="inbox">Read a contract of your own</button></div>`;
  }
  function fmtVal(fd, v) { if (v == null) return '<span class="muted">Not stated</span>'; if (fd.type === 'date') return fmtDate(v); if (fd.type === 'bool') return v ? 'Yes' : 'No'; if (fd.type === 'money') return money(v); return esc(v); }
  function fmtAnswer(t) {
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(C-\d{4})(?:\s*§\s*(\w+))?\]/g, (m, id, sec) => `<button class="cite" data-act="cite" data-id="${id}" data-sec="${sec || ''}">${id}${sec ? ' §' + sec : ''}</button>`);
    let h = '', ul = false;
    for (const ln of String(t).split('\n')) { const m = /^\s*[-•]\s+(.*)/.exec(ln); if (m) { if (!ul) { h += '<ul>'; ul = true; } h += '<li>' + inline(m[1]) + '</li>'; } else { if (ul) { h += '</ul>'; ul = false; } if (ln.trim()) h += '<p>' + inline(ln) + '</p>'; } }
    return h + (ul ? '</ul>' : '');
  }
  function renewChip(it) {
    const d = S.decisions[it.c.id];
    if (d) return chip(d.onTime ? 'good' : 'warn', 'Decided: ' + (choicesFor(it).find(x => x[0] === d.choice) || ['', d.choice])[1]);
    if (it.kind === 'closed') return chip('crit', 'Notice window closed');
    if (it.kind === 'expiry') return chip(it.left <= 60 ? 'warn' : 'mute', `Ends in ${it.left} days`);
    if (it.kind === 'nonotice') return chip('warn', 'No notice period stated');
    return chip(it.left <= 21 ? 'crit' : it.left <= 60 ? 'warn' : 'mute', `${it.left} days to give notice`);
  }
  function invChip(inv, res) {
    if (inv.status === 'disputed') return chip('info', `Dispute queued, ${money(res.flagged)} held`);
    if (inv.status === 'approved') return chip('good', 'Approved for payment');
    if (inv.status === 'blind') return chip('warn', 'Paid without a contract check');
    if (res.state === 'nocontract') return chip('crit', 'No contract on file');
    if (res.state === 'variance') return chip('crit', `${money(res.flagged)} over contract`);
    if (res.state === 'query') return chip('warn', 'Matches, with a query');
    return chip('good', 'Matches contract');
  }

  /* ---------- views ---------- */
  const tpl = id => { const t = $('#tpl-' + id); return t ? t.innerHTML : ''; };
  const VIEWS = {
    why: () => tpl('why'),
    stakeholders: () => tpl('stakeholders'),
    problem: () => tpl('problem'),
    metrics: () => tpl('metrics'),

    start() {
      /* The three money leaks, each computed from the demo's own data. */
      const cm = getC('C-1001'), ri = cm && renewalItem(cm), dec = cm && S.decisions[cm.id];
      const flInv = S.invoices.find(i => i.id === 'FL-20931'), flR = checkInvoice(flInv), flFiled = filed('D-1');
      const bcInv = S.invoices.find(i => i.id === 'BC-1187'), bcR = checkInvoice(bcInv), bc = getC('C-1003');
      const bcAct = bc && bc.perf ? bc.perf[bcInv.period] : null;
      const step = (team, k, text) => `<li><span class="lk-team">${esc(team)}</span>${tag(k)}<span>${text}</span></li>`;
      const leak = (o) => `<article class="leak"><div class="leak-h"><span class="leak-ic">${icon(o.ic)}</span><div><span class="leak-n">Leak ${o.n}</span><h3>${o.title}</h3></div></div>
        <p class="leak-k">Where it happens today</p><p>${o.today}</p>
        <p class="leak-k">What it costs</p><p class="leak-cost">${o.cost}</p>
        <p class="leak-k">How Afterink stops it</p><ol class="leak-steps">${o.steps.join('')}</ol>
        <div class="bar"><button class="btn pri" data-act="walk" data-w="${o.w}">${icon('play')}Show me, step by step</button><button class="btn" data-act="go" data-r="${o.r}">Open ${o.desk}</button></div></article>`;
      const ns = northStar(), t = invoiceTotals();
      return `<span class="glowpill">Afterink &#183; AI contract repository</span>
      <h1>Afterink catches the deadlines and overcharges hidden in signed contracts.</h1>
      <p class="lede">Companies sign thousands of supplier contracts, then file them away. Notice dates pass, invoices charge more than agreed, refunds go unclaimed. Afterink reads every signed contract with AI, turns its terms into dates and prices, and puts each one in front of the team that has to act.</p>
      <p class="sub">This is a working demo on a sample company, Kestrel Mobility: 3,000 staff and about 2,500 suppliers. Everything works, the AI runs live, and nothing is ever sent outside the company. Today in the demo is ${fmtDate(DEMO_TODAY)}.</p>

      <h2>Three ways money leaks out of signed contracts</h2>
      <p class="sub">All three are happening in this demo right now. Each card shows where it happens today, what it costs, and how Afterink stops it.</p>
      <div class="leaks">
        ${leak({ n: 1, ic: 'clock', w: 'renewal', r: 'renewals', desk: 'the Renewal desk', title: 'A contract renews because nobody said no in time',
          today: cm ? `Cloudmetric's software contract renews for another year unless someone gives notice ${cm.f.noticeDays} days before it ends. That last day, ${fmtDate(noticeBy(cm))}, is written in clause 3 of a PDF. Nobody has it in a calendar.` : '',
          cost: dec ? `Decided in this session: ${esc((choicesFor(ri).find(x => x[0] === dec.choice) || ['', dec.choice])[1].toLowerCase())}.` : ri ? `<b>${money(ri.commit)}</b> commits automatically, with up to <b>${money(ri.uplift)}</b> of price rise. <b>${ri.left} days</b> left to say no.` : '',
          steps: [step('Buying team', 'code', 'works out the last day to say no from the signed terms, for every contract'), step('Buying team', 'ai', 'writes a short brief and a draft notice letter'), step('Buying team', 'you', 'decides to renew, renegotiate or leave. Nothing is sent automatically.')] })}
        ${leak({ n: 2, ic: 'coin', w: 'overcharge', r: 'inbox', desk: 'the Inbox', title: 'An invoice charges more than the agreed price',
          today: `Fleetline signed a lower pallet price and a 6% cap on fuel surcharges in September. The signed change sits in someone's email, so the finance team checks October's invoice against the old prices.`,
          cost: flFiled ? `<b>${money(flR.flagged)}</b> overcharged on one invoice, now that the signed change is filed.` : `Checked against the old prices it looks like <b>${money(flR.flagged)}</b>. File the signed change and the same invoice is <b>$9,486.92</b> over.`,
          steps: [step('Legal team', 'ai', 'reads the signed change and quotes each new price'), step('Legal team', 'code', 'checks every quote is really in the document; a person confirms and files'), step('Finance team', 'code', 'compares every invoice line with the price in force'), step('Finance team', 'you', 'holds only the difference; AI drafts the dispute letter')] })}
        ${leak({ n: 3, ic: 'gift', w: 'credit', r: 'invoices', desk: 'Invoice check', title: 'A refund the supplier owes is never claimed',
          today: bc ? `BrightClean promised a monthly audit score of at least ${bc.slaCredit.target}%. October scored ${bcAct}%, so the contract owes a ${bc.slaCredit.creditPct}% credit. The clause sits in a contract the finance team has never seen, so the invoice is paid in full.` : '',
          cost: bcR.credit ? `<b>${money(bcR.credit)}</b> owed on October's invoice alone, and September was missed too.` : 'Claimed in this session.',
          steps: [step('Finance team', 'code', 'compares the service report with the credit clause on every invoice'), step('Finance team', 'you', 'claims the credit; AI drafts the note to the supplier')] })}
      </div>

      <h2>Who uses what</h2>
      <p class="sub">Each part of Afterink is built for one team. Filing a contract in one changes what the others can see.</p>
      <div class="teams">
        ${[['legal', 'inbox', 'Inbox', 'File each signed contract. AI reads it, code checks it, a person confirms only the terms that move money.'], ['proc', 'renewals', 'Renewal desk', 'See every deadline that costs money if it passes, and decide each renewal in time.'], ['fin', 'invoices', 'Invoice check', 'Check each invoice line against the signed price, and hold only what does not match.'], ['any', 'ask', 'Ask and Repository', 'Search every contract, or ask in plain words and get an answer that cites the clause.']].map(x => `<button class="teamcard" data-act="go" data-r="${x[1]}"><span class="team-ic">${icon(TEAM[x[0]].ic)}</span><b>${x[2]}</b><span class="team-who">For ${TEAM[x[0]].name} (${esc(TEAM[x[0]].who)})</span><span>${x[3]}</span></button>`).join('')}
      </div>

      <h2>Where AI is used, and where it is not</h2>
      <p class="sub">Every screen tags its output with one of these, so you can always see who produced it.</p>
      <div class="legend">
        <div>${tag('ai')}<p><b>Reading and writing.</b> Contracts and invoices word the same thing in many ways: "ninety (90) days", "not less than three months". An invoice says "Security officers" where the contract says "Guarding hour". Fixed rules miss that, so AI reads, and drafts letters and answers.</p></div>
        <div>${tag('code')}<p><b>Dates, money and checks.</b> Deadlines, price comparisons and the check that every AI quote is really in the document follow exact rules. Ordinary code does them the same way every time, with no AI involved.</p></div>
        <div>${tag('you')}<p><b>Anything that commits the company.</b> Filing a contract, renewing or giving notice, holding a payment. A named person decides, and Afterink never sends anything by itself.</p></div>
      </div>

      <div class="bar"><button class="btn pri" data-act="tour-start">${icon('play')}Take the two-minute guided tour</button><button class="btn" data-act="go" data-r="why">${icon('pen')}Why Afterink focuses on signed contracts</button></div>

      <h2>Right now in this workspace</h2>
      <div class="tiles">
        <div class="tile"><span class="tl">Decisions due in 90 days</span><span class="tn">${ns.onTime} of ${ns.due}</span><span class="ts">made before the deadline${ns.unfiled ? `, counting ${ns.unfiled} unfiled document${ns.unfiled === 1 ? '' : 's'} as undecided` : ''}</span></div>
        <div class="tile"><span class="tl">Invoices in the queue</span><span class="tn">${money(t.flagged)}</span><span class="ts">billed above contract, of ${money(t.total)}</span></div>
        <div class="tile"><span class="tl">Signed but unfiled</span><span class="tn">${S.inbox.filter(d => d.status === 'new').length}</span><span class="ts">documents the business is already paying against</span></div>
      </div>
      ${S.log.length ? `<h2>What has happened in this session</h2><ul class="logl">${S.log.slice(0, 8).map(l => `<li><span class="chip mute">${esc(DESK[l.desk])}</span> ${esc(l.text)}</li>`).join('')}</ul>` : ''}`;
    },

    inbox() {
      const rows = S.inbox.map(d => `<li class="docrow">
        <div><b class="mono">${esc(d.filename)}</b><p>${esc(d.found)}. Likely owner: ${esc(d.owner)}.</p></div>
        <div class="docact">${d.status === 'filed' ? chip('good', 'Filed as ' + d.filedAs) + ` <button class="btn sm" data-act="open-contract" data-id="${d.filedAs}">Open</button>` : (T.busy === 'read:' + d.id ? '<span class="thinking">Reading the document…</span>' : `<button class="btn pri" data-act="read-doc" data-id="${d.id}" ${readingNow() ? 'disabled title="Another document is being read"' : ''}>${live() ? 'Read with AI' : 'Show saved reading'}</button>`)}</div>
      </li>`).join('');
      return `${deskTag('legal')}<h1>Inbox</h1>
      <p class="lede">Signed documents that exist somewhere in the company but are not in the repository. Until one is filed, nobody downstream can act on it.</p>
      <p class="tags">${tag('ai', 'AI reads each document')} ${tag('code', 'Code checks every quote')} ${tag('you', 'You confirm and file')}</p>
      <p class="sub"><b>How documents get here without anyone remembering to file.</b> Where an e-signature tool is used, the signed copy arrives on its own. Everyone else forwards a signed copy to one address. Each week the ledger lists suppliers that were paid with no filed contract, and Legal Operations goes looking. The three below are the kind that sweep turns up: an attachment in a mailbox, a file on a team drive, a scanned letter.</p>
      ${aiNote()}
      <ul class="doclist">${rows}</ul>
      <h2>Read a document of your own</h2>
      <p class="sub">Paste the text of any supplier contract, for example one from the Law Insider samples, or load the bundled sample. ${live() ? `${esc(AI.modelName || 'The AI')} reads it live, with no saved answer to fall back on, and you check the result.` : 'This needs the live AI server, which is not reachable right now.'}</p>
      <textarea id="paste-contract" class="inp ta" rows="7" placeholder="Paste contract text here" data-inp="pastedoc" ${live() ? '' : 'disabled'}>${esc(T.pasteText)}</textarea>
      ${live() ? `<p class="sub">${PASTE_NOTE}</p>` : ''}
      <div class="bar">${T.busy === 'read:paste' ? '<span class="thinking">Reading the document…</span>' : `<button class="btn" data-act="paste-sample" ${live() ? '' : 'disabled'}>Load a sample contract</button><button class="btn pri" data-act="read-paste" ${live() && !readingNow() ? '' : 'disabled'}>Read pasted contract</button>`}</div>
      <div class="callout"><b>What the product does here, and what it leaves to a person.</b> AI extracts every term with the sentence it came from. Code checks that the sentence really appears in the document. Terms that set a deadline or a price are accepted without review only when the AI is confident, the quote matches word for word, and the extracted number or date appears inside that quote. Everything else waits for a person.</div>`;
    },

    review() {
      const R = T.review; if (!R) return VIEWS.inbox();
      const ex = R.ex, am = ex.docType === 'amendment';
      const items = am ? (ex.amends ? ex.amends.changes.map((ch, i) => ({ k: 'ch' + i, quote: ch.quote })) : []) : FIELDS.map(fd => ({ k: fd.k, quote: ex.fields[fd.k].quote })).concat(ex.rates.length ? [{ k: 'rates', quote: ex.rates[0].quote }] : []);
      let body;
      if (am) {
        const parent = ex.amends ? findContract(ex.amends.parentSupplier) : null;
        body = `<div class="card"><div class="cardhead"><h3>This amends an existing contract</h3><span>${tag('ai', 'Changes read by AI')} ${tag('you', 'You confirm each one')}</span></div>
          ${!ex.amends && R.streaming ? '<p class="thinking">Reading the changes…</p>' : !ex.amends || !ex.amends.changes.length ? '<p class="warnp">The reading did not list any changed terms, so there is nothing to apply. Go back to the inbox and read the document again.</p>' : parent ? `<p>Matched to <button class="lnk" data-act="open-contract" data-id="${parent.id}">${parent.id} ${esc(parent.supplier)}, ${esc(parent.title)}</button>. Changes take effect ${fmtDate(ex.amends.effectiveFrom)}.</p>` : `<p class="warnp">No contract for "${esc(ex.amends ? ex.amends.parentSupplier : ex.supplier)}" is in the repository. File the base agreement first.</p>`}
          ${parent && ex.amends ? `<div class="scroll"><table class="tbl"><thead><tr><th>Term</th><th>On file now</th><th>After this amendment</th><th>Source</th><th>Checked</th></tr></thead><tbody>${ex.amends.changes.map((ch, i) => {
            let was, now, label;
            if (ch.kind === 'rate') { const rt = matchRate(parent, ch.item); label = /\brate$/i.test(ch.item) ? ch.item : ch.item + ' rate'; was = rt ? money(rt.rate) : 'Not on rate card'; now = money(ch.newRate); }
            else { const fd = FIELDS.find(f => f.k === ch.field); label = fd.label + (ch.label && ch.label.toLowerCase() !== fd.label.toLowerCase() && !fd.label.toLowerCase().startsWith(ch.label.toLowerCase()) ? ` (the AI called it "${ch.label}")` : ''); was = parent.f[ch.field] == null ? 'No cap or not stated' : (fd.type === 'money' ? money(parent.f[ch.field]) : String(parent.f[ch.field])); now = fd.type === 'money' ? money(ch.newValue) : String(ch.newValue); }
            const unread = unreadChange(ch);
            const qv = ch.quote && findSpan(R.text, ch.quote), vq = qv && !unread && valueInQuote('num', ch.kind === 'rate' ? ch.newRate : ch.newValue, ch.quote) === false;
            const prior = ch.kind === 'rate' ? (matchRate(parent, ch.item) || {}).src : (/^Set by (.+?),/.exec(parent.notes[ch.field] || '') || [])[1];
            return `<tr><td>${esc(label)}</td><td>${esc(was)}${prior ? `<span class="fnote">Already changed by ${esc(prior)}. The later signed document governs from its effective date. Check the two do not conflict.</span>` : ''}</td><td><b>${unread ? 'Not read' : esc(now)}</b></td><td>${qv ? `<button class="lnk" data-act="hl" data-k="ch${i}">Show source</button>${vq ? ' ' + chip('warn', 'Value not in its quote') : ''}` : chip('warn', 'Quote not found')}</td><td>${unread ? chip('crit', 'Value not read') : `<input type="checkbox" id="ok-ch${i}" data-chg="tick" data-k="ch${i}" ${R.ok['ch' + i] ? 'checked' : ''} aria-label="Checked against the document">`}</td></tr>`;
          }).join('')}</tbody></table></div><p class="sub">A change to a price or a cap is always confirmed by a person, whatever the AI's confidence.</p>` : ''}
        </div>${explainCard(parent)}`;
      } else {
        body = `<p class="tags">${tag('ai', 'Terms read by AI')} ${tag('code', 'Quotes and values checked by code')}</p><p class="sub">For each term: the AI's confidence, then what code found when it looked for the quoted sentence in the document and for the value inside that sentence.</p><div class="card fields">${FIELDS.map(fd => fieldRow(fd)).join('')}
          <div class="frow${needsCheck('rates') && !R.ok.rates ? ' need' : ''}"><span class="flabel">Rate card <span class="crit-dot" title="Drives a deadline or a price">●</span></span>
            <div class="fval">${ex.rates.length ? `<table class="tbl mini"><tbody>${ex.rates.map(r => `<tr><td>${esc(r.item)}</td><td class="num">${money(r.rate)}</td><td>per ${esc(r.unit)}</td></tr>`).join('')}</tbody></table>` : '<span class="muted">No priced items found</span>'}</div>
            <div class="fmeta">${R.streaming && !ex.done ? '<span class="thinking">Reading…</span>' : ex.rates.length && ex.rates[0].quote && findSpan(R.text, ex.rates[0].quote) ? `${valueInQuote('money', ex.rates[0].rate, ex.rates[0].quote) === false ? chip('warn', 'Quote found, rate not in it') : chip('good', 'Quote checked by code')} <button class="lnk" data-act="hl" data-k="rates">Show source</button>` : (ex.rates.length ? chip('warn', 'Quote not found in document') : '')}</div>
            ${needsCheck('rates') ? `<label class="tick"><input type="checkbox" id="ok-rates" data-chg="tick" data-k="rates" ${R.ok.rates ? 'checked' : ''}> I checked this against the document</label>` : ''}
          </div></div>`;
      }
      return `${deskTag('legal')}<p><button class="lnk" data-act="go" data-r="inbox">← Back to inbox</button></p>
      <h1>${ex.supplier ? esc(ex.supplier) : '<span class="thinking">Reading the document…</span>'}</h1>
      <p class="sub">${(ex.meta || ex.source !== 'live' ? [ex.title, ex.type, ex.category] : []).filter(Boolean).map(x => esc(x) + ' · ').join('')}<span class="mono">${esc(R.filename)}</span> · ${R.streaming ? chip('info', 'Reading live…') : ex.source === 'live' ? chip('info', 'Read live by ' + (R.read && R.read.model ? R.read.model : (AI.modelName || 'the AI')) + (R.read && R.read.ms ? ' in ' + fmtMs(R.read.ms) : '')) : chip('mute', 'Saved AI reading')}</p>
      ${R.note ? `<p class="note">${esc(R.note)}</p>` : ''}
      ${ex.summary ? `<p class="lede">${esc(ex.summary)}</p>` : ''}
      ${ex.risks.length ? `<div class="callout"><b>Worth knowing before you file</b><ul>${ex.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
      <div class="split"><div>${body}<div id="file-bar">${fileBar()}</div></div>
      <div><p class="doccap">Source document. Highlighted text is what each term was read from.</p><div class="doc" id="doc">${docHtml(R.text, items)}</div></div></div>`;
    },

    repository() {
      const unfiled = S.inbox.filter(d => d.status === 'new').length;
      const fs = [['all', 'All'], ['auto', 'Renews automatically'], ['due', 'Decision due in 90 days'], ['uncapped', 'Uncapped price rise']];
      return `${deskTag('any')}<h1>Repository</h1>
      <p class="lede">One record per signed contract. Each term on file links back to the sentence it was read from, so nobody has to trust a spreadsheet cell.</p>
      ${unfiled ? `<p class="note">${unfiled} signed ${unfiled === 1 ? 'document is' : 'documents are'} not filed yet. <button class="lnk" data-act="go" data-r="inbox">Open the inbox</button></p>` : ''}
      <div class="bar"><input id="repo-q" class="inp" type="search" placeholder="Search supplier, type, owner or any word in the contract" value="${esc(T.repoQ)}" data-inp="repo" aria-label="Search contracts">
      <div class="seg" role="group" aria-label="Filter">${fs.map(f => `<button class="segb${T.repoF === f[0] ? ' on' : ''}" data-act="repo-filter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div></div>
      ${findBar()}
      <div class="scroll"><table class="tbl"><thead><tr><th>Contract</th><th>Owner</th><th class="num">Annual value</th><th>Term ends</th><th>Give notice by</th><th>Price rule</th><th>Status</th></tr></thead><tbody id="repo-body">${repoRows()}</tbody></table></div>`;
    },

    contract() {
      const c = getC(S.sel.contract); if (!c) return VIEWS.repository();
      const it = renewalItem(c), nb = noticeBy(c);
      const items = FIELDS.map(fd => ({ k: fd.k, quote: c.prov[fd.k] })).concat([{ k: 'rates', quote: c.prov.rates }]);
      if (T.citeText) items.unshift({ k: 'cite', quote: T.citeText });
      const invs = S.invoices.filter(i => findContract(i.supplier) === c);
      const events = S.log.filter(l => l.ref === c.id);
      return `<p><button class="lnk" data-act="go" data-r="repository">← Back to repository</button></p>
      <p class="desk"><span class="mono">${c.id}</span> · ${esc(c.type)} · ${esc(c.category)}</p><h1>${esc(c.supplier)}</h1>
      <p class="sub">${esc(c.title)} · Owner: ${esc(c.owner)} · ${chip('good', 'Verified')} ${c.source === 'seed' ? '' : chip('info', 'Filed in this session')} ${it && it.left <= 150 ? renewChip(it) : ''}</p>
      <div class="split"><div>
        <div class="card"><div class="cardhead"><h3>Key terms</h3>${tag('ai', 'Read by AI, confirmed by a person')}</div><dl class="kv">${FIELDS.filter(fd => !(fd.opt && c.f[fd.k] == null && !c.prov[fd.k])).map(fd => `<div><dt>${fd.label}</dt><dd>${fmtVal(fd, c.f[fd.k])}${c.prov[fd.k] ? ` <button class="lnk" data-act="hl" data-k="${fd.k}">Show source</button>` : ''}${c.notes[fd.k] ? `<span class="fnote">${esc(c.notes[fd.k])}</span>` : ''}</dd></div>`).join('')}
          ${nb ? `<div><dt>Last day to give notice</dt><dd><b>${fmtDate(nb)}</b><span class="fnote">${tag('code')} Term end minus ${c.f.noticeDays} days.</span></dd></div>` : ''}</dl></div>
        <div class="card"><h3>Rate card</h3>${c.rates.length ? `<div class="scroll"><table class="tbl mini"><thead><tr><th>Item</th><th class="num">Rate</th><th>Unit</th><th>Note</th></tr></thead><tbody>${c.rates.map(r => `<tr><td>${esc(r.item)}</td><td class="num">${money(r.rate)}</td><td>${esc(r.unit)}</td><td>${r.was != null ? `Was ${money(r.was)} until ${esc(r.src)}` : esc(r.note || '')}</td></tr>`).join('')}</tbody></table></div>${c.prov.rates ? '<button class="lnk" data-act="hl" data-k="rates">Show source</button>' : ''}` : '<p class="muted">No priced items.</p>'}</div>
        ${c.signals.length ? `<div class="card"><h3>Signals from other systems</h3><ul class="sig">${c.signals.map(s => `<li>${chip(s.tone, s.tone === 'good' ? 'OK' : s.tone === 'crit' ? 'Act' : 'Watch')} <span><b>${esc(s.label)}</b><br>${esc(s.value)}</span></li>`).join('')}</ul></div>` : ''}
        ${c.risks && c.risks.length ? `<div class="card"><h3>Flagged when filed</h3><ul>${c.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
        <div class="card"><h3>Linked work</h3><ul class="plain">
          ${it && it.left <= 150 ? `<li><button class="lnk" data-act="open-renewal" data-id="${c.id}">Renewal decision</button> ${renewChip(it)}</li>` : ''}
          ${invs.map(i => `<li><button class="lnk" data-act="open-invoice" data-id="${esc(i.id)}">Invoice ${esc(i.id)}</button> ${invChip(i, checkInvoice(i))}</li>`).join('')}
          ${(c.history || []).map(h => `<li>${fmtDate(h.date)}: ${esc(h.text)}</li>`).join('')}
          ${events.map(l => `<li>${esc(DESK[l.desk])}: ${esc(l.text)}</li>`).join('')}
          ${!(it && it.left <= 150) && !invs.length && !(c.history || []).length && !events.length ? '<li class="muted">Nothing open.</li>' : ''}</ul></div>
      </div><div>
        <p class="doccap">Signed text${c.amendments.length ? ', followed by its amendments' : ''}</p><div class="doc" id="doc">${docHtml(c.text, items)}</div>
        ${c.amendments.map((a, i) => `<p class="doccap">${esc(a.title)}, effective ${fmtDate(a.effectiveFrom)}</p><div class="doc">${esc(a.text)}</div>${a.explain ? `<p class="sub"><b>In plain English, written by the AI when it was filed:</b> ${esc(a.explain)}</p>` : ''}`).join('')}
      </div></div>`;
    },

    ask() {
      const A = T.ask;
      return `${deskTag('any')}<h1>Ask</h1>
      <p class="lede">Ask about the contracts in plain words. The answer is written only from the verified repository, and each claim carries the contract and clause it rests on.</p>
      ${aiNote()}
      <div class="bar"><input id="ask-q" class="inp" type="text" placeholder="For example: what notice do we owe Vaultline?" value="${esc(A ? A.q : '')}" aria-label="Your question"><button class="btn pri" data-act="ask" ${T.busy === 'ask' ? 'disabled' : ''}>Ask</button></div>
      <div class="sugg">${SUGGESTED.map(s => `<button class="chipb" data-act="ask-s" data-id="${s.id}">${esc(s.q)}</button>`).join('')}</div>
      ${A ? `<div class="card answer"><div class="cardhead"><p class="aq">${esc(A.q)}</p>${A.mode === 'saved' || A.mode === 'none' ? tag('code', 'Built by code from the filed terms') : tag('ai', 'Answer written by AI')}</div><div id="ask-out">${A.text ? fmtAnswer(A.text) : '<span class="thinking">Thinking…</span>'}</div>
        <p class="sub" id="ask-meta">${A.done ? (A.mode === 'live' ? `Written live by ${esc(A.model || AI.modelName || 'the AI')} from the clauses below${A.ms ? ' in ' + fmtMs(A.ms) : ''}.` : A.mode === 'saved' ? `${A.err ? esc(A.err) + ' ' : ''}This answer was built by the page from the filed terms, without the AI.` : esc(A.err || '')) : ''}</p></div>
        ${A.src && A.src.length ? `<h2>Clauses the answer was drawn from</h2><p class="tags">${tag('code', 'Clauses found by code')}</p><ul class="srcl">${A.src.map(c => `<li><button class="cite" data-act="cite" data-id="${c.cid}" data-sec="${c.sec}">${c.cid} §${c.sec}</button> <span class="muted">${esc(c.supplier)}</span><p>${esc(c.text.length > 260 ? c.text.slice(0, 260) + '…' : c.text)}</p></li>`).join('')}</ul>` : ''}` : ''}`;
    },

    renewals() {
      const its = renewalItems(150), d90 = its.filter(x => x.left <= 90);
      const atStake = d90.filter(x => x.kind !== 'expiry' && !S.decisions[x.c.id]).reduce((s, x) => s + x.commit, 0);
      const upl = d90.filter(x => !S.decisions[x.c.id]).reduce((s, x) => s + x.uplift, 0);
      const ns = northStar();
      return `${deskTag('proc')}<h1>Renewal desk</h1>
      <p class="lede">Every contract with a date that costs money if it passes unseen, ordered by the last day someone can still act.</p>
      <p class="tags">${tag('code', 'Deadlines calculated by code')} ${tag('ai', 'Briefs and letters drafted by AI')} ${tag('you', 'You decide each renewal')}</p>
      <div class="tiles">
        <div class="tile"><span class="tl">Decided before the deadline</span><span class="tn">${ns.onTime} of ${ns.due}</span><span class="ts">dates falling in the next 90 days${ns.unfiled ? `. ${ns.unfiled} of them are unfiled documents, counted as undecided until filed` : ''}</span></div>
        <div class="tile"><span class="tl">Renews if nobody acts</span><span class="tn">${money(atStake)}</span><span class="ts">committed spend, next 90 days, undecided</span></div>
        <div class="tile"><span class="tl">Price increases at stake</span><span class="tn">${money(upl)}</span><span class="ts">from capped increases alone</span></div>
      </div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Supplier</th><th>Owner</th><th>Act by</th><th>What happens otherwise</th><th class="num">Committed</th><th>Status</th><th></th></tr></thead><tbody>
      ${its.map(it => `<tr><td><b>${esc(it.c.supplier)}</b><br><span class="muted mono">${it.c.id}</span></td><td>${esc(it.c.owner)}</td><td>${fmtDate(it.actBy)}</td>
        <td>${it.kind === 'expiry' ? 'Contract ends. Work after that date is uncovered.' : `Renews for ${it.c.f.renewalMonths || 12} months${it.c.f.upliftPct ? ` at up to +${it.c.f.upliftPct}%` : it.c.f.upliftPct == null ? ' with an uncapped increase' : ''}`}</td>
        <td class="num">${it.commit ? money(it.commit) : '—'}</td><td>${renewChip(it)}</td><td><button class="btn sm" data-act="open-renewal" data-id="${it.c.id}">${S.decisions[it.c.id] ? 'View' : 'Decide'}</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="callout"><b>Where the dates come from.</b> Nobody typed these deadlines. Each is the term end minus the notice period, both read from the signed text and checked by Legal Operations. File the Talentbridge agreement from the inbox and its date appears here.</div>`;
    },

    renewal() {
      const c = getC(S.sel.renewal), it = c && renewalItem(c); if (!it) return VIEWS.renewals();
      const d = S.decisions[c.id], B = T.briefs[c.id] || (c.hint ? Object.assign({ source: 'saved' }, c.hint) : { source: 'saved', rec: choicesFor(it)[0][0], headline: 'No warning signals are on file for this supplier.', why: ['No usage, service or billing problem is recorded against this contract.'], asks: [] });
      const ch = choicesFor(it), choice = d ? d.choice : (T.choice[c.id] || (ch.some(x => x[0] === B.rec) ? B.rec : ch[0][0]));
      const letter = d ? d.letter : (T.letters[c.id] != null ? T.letters[c.id] : (B.source === 'live' && B.rec === choice && B.letter ? B.letter : tplLetter(c, it, choice, B.asks)));
      const p = c.prov;
      return `${deskTag('proc')}<p><button class="lnk" data-act="go" data-r="renewals">← Back to renewal desk</button></p>
      <h1>${esc(c.supplier)}</h1><p class="sub">${esc(c.title)} · <button class="lnk" data-act="open-contract" data-id="${c.id}">${c.id}</button> · Owner: ${esc(c.owner)} · ${renewChip(it)}</p>
      <div class="split"><div>
        <div class="card"><div class="cardhead"><h3>The facts, from the signed text</h3>${tag('code', 'Deadline calculated by code')}</div><dl class="kv">
          <div><dt>${it.kind === 'expiry' ? 'Contract ends' : 'Current term ends'}</dt><dd>${fmtDate(c.f.termEnd)}</dd></div>
          ${it.kind !== 'expiry' ? `<div><dt>Last day to give notice</dt><dd><b>${noticeBy(c) ? fmtDate(noticeBy(c)) : 'Not stated'}</b> ${it.kind === 'open' ? `(${it.left} days left)` : it.kind === 'closed' ? '(passed)' : ''}${p.noticeDays ? `<span class="fnote">"${esc(p.noticeDays)}"</span>` : ''}</dd></div>
          <div><dt>If nobody acts</dt><dd>Renews for ${c.f.renewalMonths || 12} months, committing ${money(it.commit)}${it.uplift ? `, including up to ${money(it.uplift)} of increase` : ''}${p.autoRenew ? `<span class="fnote">"${esc(p.autoRenew)}"</span>` : ''}</dd></div>
          <div><dt>Price rule</dt><dd>${esc(c.f.upliftText || 'Not stated')}</dd></div>` : `<div><dt>If nobody acts</dt><dd>The contract ends and does not renew${p.autoRenew ? `<span class="fnote">"${esc(p.autoRenew)}"</span>` : ''}</dd></div>`}
          <div><dt>How notice must be given</dt><dd>${esc(c.f.noticeMethod || 'Not stated')}</dd></div></dl></div>
        <div class="card"><h3>Signals from other systems</h3>${c.signals.length ? `<ul class="sig">${c.signals.map(s => `<li>${chip(s.tone, s.tone === 'good' ? 'OK' : s.tone === 'crit' ? 'Act' : 'Watch')} <span><b>${esc(s.label)}</b><br>${esc(s.value)}</span></li>`).join('')}</ul>` : '<p class="muted">None on file.</p>'}<p class="sub">Assumed integrations: single sign-on, the ledger, service reports. In this prototype they are sample values.</p></div>
      </div><div>
        <div class="card"><div class="cardhead"><h3>Renewal brief</h3><span>${tag('ai', B.source === 'live' ? 'Written live by AI' : 'Written by AI (saved)')}</span></div>
          ${T.busy === 'brief:' + c.id ? '<p class="thinking">Writing the brief…</p>' : `<p class="headline">${esc(B.headline)}</p><ul>${(B.why || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
          ${B.asks && B.asks.length ? `<p class="mini-h">Ask the supplier for</p><ul>${B.asks.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
          ${live() && !d ? `<button class="btn sm" data-act="brief" data-id="${c.id}">${B.source === 'live' ? 'Write it again' : 'Write a fresh brief with AI'}</button>` : ''}`}</div>
        <div class="card"><div class="cardhead"><h3>${d ? 'Decision on record' : 'Your decision'}</h3>${tag('you')}</div>
          ${d ? `<p>${chip(d.onTime ? 'good' : 'warn', d.onTime ? 'Made before the deadline' : 'Made after the notice date')} <b>${esc((ch.find(x => x[0] === d.choice) || ['', d.choice])[1])}</b>, recorded ${fmtDate(d.at)}.</p>
            <p class="sub">${d.sent ? 'Marked as sent by the owner.' : 'The notice is queued for the contract owner to send. This product never sends it.'}</p>
            <pre class="letter">${esc(d.letter)}</pre>
            <div class="bar">${d.sent ? '' : `<button class="btn pri" data-act="mark-sent" data-id="${c.id}">Mark as sent</button>`}<button class="btn" data-act="reopen" data-id="${c.id}">Reopen decision</button></div>`
          : `<div class="seg wide" role="group" aria-label="Decision">${ch.map(x => `<button class="segb${choice === x[0] ? ' on' : ''}" data-act="choose" data-id="${c.id}" data-c="${x[0]}">${x[1]}${B.rec === x[0] ? ' <span class="rec">recommended</span>' : ''}</button>`).join('')}</div>
            <label class="mini-h" for="letter">Draft to the supplier. Edit before you record it.</label>
            <textarea id="letter" class="inp ta" rows="13" data-inp="letter" data-id="${c.id}">${esc(letter)}</textarea>
            <div class="bar"><button class="btn pri" data-act="decide" data-id="${c.id}" data-c="${choice}">Record decision and queue the notice</button></div>
            <p class="sub">Recording a decision does not send anything. A notice has legal effect, so a named person sends it.</p>`}
        </div>
      </div></div>`;
    },

    invoices() {
      const t = invoiceTotals();
      return `${deskTag('fin')}<h1>Invoice check</h1>
      <p class="lede">Each invoice line is compared with the price in the signed contract before anyone pays it.</p>
      <p class="tags">${tag('code', 'Every line compared by code')} ${tag('ai', 'Pasted invoices and dispute letters by AI')} ${tag('you', 'You decide what to pay')}</p>
      <div class="tiles">
        <div class="tile"><span class="tl">Billed above contract</span><span class="tn">${money(t.flagged)}</span><span class="ts">across ${S.invoices.length} invoices worth ${money(t.total)}</span></div>
        <div class="tile"><span class="tl">Held under dispute</span><span class="tn">${money(t.held)}</span><span class="ts">approved by Accounts Payable</span></div>
        <div class="tile"><span class="tl">Cannot be checked</span><span class="tn">${money(t.blind)}</span><span class="ts">no contract on file for the supplier</span></div>
      </div>
      <div class="scroll"><table class="tbl"><thead><tr><th>Invoice</th><th>Supplier</th><th>Period</th><th class="num">Billed</th><th>Checked against</th><th>Result</th><th></th></tr></thead><tbody>
      ${S.invoices.map(inv => { const r = checkInvoice(inv); return `<tr><td class="mono">${esc(inv.id)}</td><td>${esc(inv.supplier)}</td><td>${esc(inv.periodLabel || inv.period || '')}</td><td class="num">${money(inv.total)}</td><td>${r.c ? `<span class="mono">${r.c.id}</span>${r.c.amendments.length ? ' as amended' : ''}` : '<span class="muted">Nothing on file</span>'}</td><td>${invChip(inv, r)}</td><td><button class="btn sm" data-act="open-invoice" data-id="${esc(inv.id)}">Open</button></td></tr>`; }).join('')}
      </tbody></table></div>
      <h2>Check an invoice of your own</h2>
      <p class="sub">Paste invoice text. ${live() ? `${esc(AI.modelName || 'The AI')} reads the lines and maps each one to a rate card item. The comparison is then done by code.` : 'Reading a pasted invoice needs the live AI server, which is not reachable right now.'}</p>
      <textarea id="paste-inv" class="inp ta mono" rows="8" placeholder="Paste invoice text here" data-inp="pasteinv" ${live() ? '' : 'disabled'}>${esc(T.pasteInv)}</textarea>
      ${live() ? `<p class="sub">${PASTE_NOTE}</p>` : ''}
      <div class="bar">${T.busy === 'inv' ? '<span class="thinking">Reading the invoice…</span>' : `<button class="btn" data-act="inv-sample" ${live() ? '' : 'disabled'}>Use a sample invoice</button><button class="btn pri" data-act="inv-parse" ${live() ? '' : 'disabled'}>Read and check</button>`}</div>`;
    },

    invoice() {
      const inv = S.invoices.find(i => i.id === S.sel.invoice); if (!inv) return VIEWS.invoices();
      const r = checkInvoice(inv), c = r.c, dis = T.disputes[inv.id];
      const closed = ['disputed', 'approved', 'blind'].includes(inv.status);
      return `${deskTag('fin')}<p><button class="lnk" data-act="go" data-r="invoices">← Back to invoice check</button></p>
      <h1>Invoice <span class="mono">${esc(inv.id)}</span></h1>
      <p class="sub">${esc(inv.supplier)} · dated ${fmtDate(inv.date)} · ${esc(inv.periodLabel || '')} · ${invChip(inv, r)}${inv.parsed ? ' ' + chip('info', 'Lines read by AI') : ''}</p>
      ${c ? `<p class="note">Checked against <button class="lnk" data-act="open-contract" data-id="${c.id}">${c.id} ${esc(c.title)}</button>${c.amendments.length ? `, including ${c.amendments.length} filed amendment${c.amendments.length > 1 ? 's' : ''}` : ''}.</p>` : ''}
      <p class="tags">${tag('code', 'Compared with the contract by code')}${inv.parsed ? ' ' + tag('ai', 'Lines read from the pasted invoice by AI') : ''}</p>
      <div class="scroll"><table class="tbl"><thead><tr><th>Line</th><th class="num">Qty</th><th class="num">Billed rate</th><th class="num">Contract rate</th><th class="num">Billed</th><th class="num">Agreed</th><th class="num">Difference</th></tr></thead><tbody>
      ${(c ? r.rows : inv.lines.map(ln => ({ ln, tone: 'mute', note: '' }))).map(row => `<tr class="${row.tone === 'crit' ? 'bad' : ''}"><td>${esc(row.ln.desc)}${row.note ? `<span class="fnote">${esc(row.note)}</span>` : ''}${row.quote && row.tone === 'crit' ? `<span class="fnote q">"${esc(row.quote)}"</span>` : ''}</td>
        <td class="num">${row.ln.qty != null ? Number(row.ln.qty).toLocaleString('en-US') : ''}</td><td class="num">${row.ln.kind === 'surcharge' ? row.ln.pct + '%' : money(row.ln.unitPrice)}</td><td class="num">${row.exp == null ? '—' : (typeof row.exp === 'number' ? money(row.exp) : esc(row.exp))}</td>
        <td class="num">${money(row.ln.amount)}</td><td class="num">${row.expAmt == null ? '—' : money(row.expAmt)}</td><td class="num">${row.varc > 0 ? `<b class="critt">${money(row.varc)}</b>` : '—'}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">Total</td><td class="num">${money(inv.total)}</td><td class="num">${c ? money(r2(inv.total - r.over)) : '—'}</td><td class="num">${r.over ? `<b class="critt">${money(r.over)}</b>` : '—'}</td></tr></tfoot></table></div>
      ${r.findings.map(f => `<div class="finding ${f.tone}">${chip(f.tone, f.tone === 'crit' ? 'Act' : 'Query')} <div><b>${esc(f.title)}</b><p>${esc(f.text)}</p>${f.quote ? `<p class="fnote q">"${esc(f.quote)}"</p>` : ''}</div></div>`).join('')}
      ${!c ? `<div class="callout"><b>This is the problem in one screen.</b> The invoice is real and due, and the signed agreement exists, but it sits in a shared drive where Accounts Payable cannot see it. <button class="lnk" data-act="go" data-r="inbox">Ask Legal Operations to file it from the inbox</button>, then come back.</div>` : ''}
      <div class="card"><div class="cardhead"><h3>${closed ? 'Outcome' : 'Your call'}</h3>${tag('you')}</div>
      ${closed ? `<p>${inv.status === 'disputed' ? `Dispute queued. ${money(r.flagged)} is held and ${money(r2(inv.total - r.flagged))} is released for payment on the agreed terms.` : inv.status === 'approved' ? 'Approved for payment in full.' : 'Released for payment without a contract check. This is logged as a blind payment.'}</p>${inv.dispute ? `<pre class="letter">${esc(inv.dispute)}</pre>` : ''}<div class="bar"><button class="btn" data-act="inv-reopen" data-id="${esc(inv.id)}">Reopen</button></div>`
        : r.state === 'variance' ? `<p>Undisputed amount: <b>${money(r2(inv.total - r.flagged))}</b>. In question: <b class="critt">${money(r.flagged)}</b>.</p>
          <label class="mini-h" for="dispute">Dispute note to the supplier. Edit before you queue it.</label>
          <p class="tags">${T.aiDraft[inv.id] ? tag('ai', 'Redrafted by AI') : tag('code', 'Drafted by code from the checks')}</p>
          <textarea id="dispute" class="inp ta" rows="11" data-inp="dispute" data-id="${esc(inv.id)}">${esc(dis != null ? dis : tplDispute(inv, r))}</textarea>
          <div class="bar">${T.busy === 'dispute:' + inv.id ? '<span class="thinking">Drafting…</span>' : (live() ? `<button class="btn" data-act="dispute-ai" data-id="${esc(inv.id)}">Redraft with AI</button>` : '')}<button class="btn pri" data-act="inv-dispute" data-id="${esc(inv.id)}">Queue dispute and pay the undisputed amount</button><button class="btn" data-act="inv-approve" data-id="${esc(inv.id)}">Pay in full anyway</button></div>
          <p class="sub">The supplier still gets paid on time for everything that matches. Only the difference is held.</p>`
        : r.state === 'nocontract' ? `<div class="bar"><button class="btn pri" data-act="go" data-r="inbox">Go to the inbox</button><button class="btn" data-act="inv-blind" data-id="${esc(inv.id)}">Pay without a check</button></div>`
        : `<p>${r.state === 'query' ? 'The prices match the contract. Resolve the query above with the contract owner, then approve.' : 'Every line matches the contract.'}</p><div class="bar"><button class="btn pri" data-act="inv-approve" data-id="${esc(inv.id)}">Approve for payment</button></div>`}
      </div>`;
    }
  };

  /* review helpers */
  function needsCheck(k) {
    const R = T.review, ex = R.ex;
    if (k === 'rates') return !(ex.rates.length && ex.rates.every(r => r.quote && findSpan(R.text, r.quote) && valueInQuote('money', r.rate, r.quote) !== false) && ex.source !== 'live');
    const fd = FIELDS.find(x => x.k === k), f = ex.fields[k];
    if (!fd.crit || f.pending) return false;
    return !(f.confidence === 'high' && f.value != null && f.quote && findSpan(R.text, f.quote) && valueInQuote(fd.type, f.value, f.quote) !== false);
  }
  /* A quote that exists proves where a term came from, not that the value was read correctly.
     So code also looks for the extracted number or date inside its own quote.
     true = found, false = not found (a person must check), null = nothing to compare (booleans, text, 0). */
  const NUM_WORDS = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 12: 'twelve', 14: 'fourteen', 15: 'fifteen', 18: 'eighteen', 20: 'twenty', 24: 'twenty-four', 30: 'thirty', 36: 'thirty-six', 45: 'forty-five', 60: 'sixty', 90: 'ninety', 120: 'one hundred twenty', 180: 'one hundred eighty' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function valueInQuote(type, v, quote) {
    if (v == null || !quote) return null;
    const q = String(quote).replace(/\s+/g, ' ');
    /* Whole numbers only: 5 must not match inside 2.5, 250 inside 1,250, or 1 inside 31. */
    const has = s => new RegExp('(?<![\\d.,])' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d]|[.,]\\d)', 'i').test(q);
    if (type === 'num' || type === 'money') {
      const n = Number(v); if (!isFinite(n) || n === 0) return null;
      const forms = [String(n), n.toLocaleString('en-US'), n.toFixed(2), n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
      if (forms.some(has)) return true;
      return NUM_WORDS[n] ? new RegExp('\\b' + NUM_WORDS[n] + '\\b', 'i').test(q) : false;
    }
    if (type === 'date') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); if (!m) return null;
      const y = m[1], mo = MONTHS[Number(m[2]) - 1], d = String(Number(m[3]));
      return [`(?<!\\d)${d} ${mo} ${y}`, `${mo} ${d}, ${y}`, `${mo} ${d} ${y}`, `(?<!\\d)${d}(st|nd|rd|th) ${mo} ${y}`, String(v)].some(f => new RegExp(f, 'i').test(q));
    }
    return null;
  }
  const unreadChange = ch => (ch.kind === 'rate' ? ch.newRate : ch.newValue) == null;
  function pending() {
    const R = T.review, ex = R.ex;
    if (ex.docType === 'amendment') { if (!ex.amends || !ex.amends.changes.length) return ['nochanges']; if (!findContract(ex.amends.parentSupplier)) return ['parent']; return ex.amends.changes.map((c, i) => 'ch' + i).filter((k, i) => !R.ok[k] || unreadChange(ex.amends.changes[i])); }
    return FIELDS.filter(fd => fd.crit).map(fd => fd.k).concat(['rates']).filter(k => needsCheck(k) && !R.ok[k]);
  }
  function fileBar() {
    const R = T.review, p = pending(), am = R.ex.docType === 'amendment';
    /* Count only terms that have arrived: a term still being read has not been accepted. */
    const auto = am ? 0 : FIELDS.filter(fd => fd.crit && !R.ex.fields[fd.k].pending && !needsCheck(fd.k)).length;
    const unread = am && R.ex.amends && R.ex.amends.changes.some(unreadChange);
    return `<div class="bar filebar">${tag('you')}<button class="btn pri" data-act="file" ${p.length || R.streaming ? 'disabled' : ''}>${am ? 'Apply amendment to the contract' : 'File in the repository'}</button>
      <span class="sub">${R.streaming ? 'Still reading the document.' : p[0] === 'nochanges' ? 'The reading found no changed terms. Go back to the inbox and read the document again.' : p[0] === 'parent' ? 'The base agreement has to be filed first.' : unread ? 'A changed value could not be read. Go back to the inbox and read the document again.' : p.length ? `${p.length} ${p.length === 1 ? 'term still needs' : 'terms still need'} your check.` : 'Ready to file.'}${am || R.streaming ? '' : ` ${auto} of ${FIELDS.filter(f => f.crit).length} deadline and price terms were accepted without review.`}</span></div>`;
  }
  function inputFor(fd, f) {
    const id = 'f-' + fd.k, at = `id="${id}" data-chg="field" data-k="${fd.k}" class="inp"${f.pending ? ' disabled' : ''}`;
    if (fd.type === 'bool') return `<select ${at}><option value=""${f.value == null ? ' selected' : ''}>Not stated</option><option value="true"${f.value === true ? ' selected' : ''}>Yes</option><option value="false"${f.value === false ? ' selected' : ''}>No</option></select>`;
    if (fd.type === 'date') return `<input type="date" ${at} value="${esc(f.value || '')}">`;
    if (fd.type === 'num' || fd.type === 'money') return `<input type="number" step="any" ${at} value="${f.value == null ? '' : f.value}" placeholder="Not stated">`;
    return `<input type="text" ${at} value="${esc(f.value || '')}" placeholder="Not stated">`;
  }
  function fieldRow(fd) {
    const R = T.review, f = R.ex.fields[fd.k];
    if (fd.opt && f.value == null && !f.quote) return '';
    const qv = f.quote && findSpan(R.text, f.quote), vq = qv ? valueInQuote(fd.type, f.value, f.quote) : null, need = needsCheck(fd.k), ok = !!R.ok[fd.k];
    const conf = f.value == null ? chip('warn', 'Not stated') : chip(f.confidence === 'high' ? 'good' : f.confidence === 'medium' ? 'warn' : 'crit', f.confidence === 'high' ? 'High confidence' : f.confidence === 'medium' ? 'Interpreted' : 'Unsure');
    return `<div class="frow${need && !ok ? ' need' : ''}" id="fr-${fd.k}">
      <label class="flabel" for="f-${fd.k}">${fd.label}${fd.crit ? ' <span class="crit-dot" title="Drives a deadline or a price">●</span>' : ''}</label>
      <div class="fval">${inputFor(fd, f)}</div>
      <div class="fmeta">${f.pending ? '<span class="thinking">Reading…</span>' : `${conf} ${f.quote ? (qv ? `${vq === false ? chip('warn', 'Quote found, value not in it') : chip('good', vq === true ? 'Quote and value checked by code' : 'Quote checked by code')} <button class="lnk" data-act="hl" data-k="${fd.k}">Show source</button>` : chip('warn', 'Quote not found in document')) : (f.value != null ? chip('warn', 'No quote given') : '')}`}</div>
      ${f.note ? `<p class="fnote">${esc(f.note)}</p>` : ''}
      ${need ? `<label class="tick"><input type="checkbox" id="ok-${fd.k}" data-chg="tick" data-k="${fd.k}" ${ok ? 'checked' : ''}> I checked this against the document</label>` : ''}
    </div>`;
  }
  function explainCard(parent) {
    const R = T.review, ex = R.ex;
    const E = R.explain;
    if (!parent || !ex.amends || R.streaming || (!live() && !E)) return '';
    return `<div class="card"><div class="cardhead"><h3>In plain English</h3>${tag('ai', 'Written by AI')}</div>
      ${E ? (E.status === 'failed' ? `<p class="sub">${esc(E.err)}</p>` : `<p id="explain-out">${E.text ? esc(E.text) : '<span class="thinking">Writing…</span>'}</p>`) : '<p class="sub">A plain-English reading of what changes and what stays, for the person checking the table above. The table is what gets applied.</p>'}
      ${live() && !(E && E.status === 'running') ? `<button class="btn sm" data-act="explain">${E && E.status === 'done' ? 'Write it again' : 'Explain with AI'}</button>` : ''}</div>`;
  }
  function findBar() {
    const F = T.find;
    return `<div class="bar"><input id="find-q" class="inp" type="text" placeholder="Or ask in plain words, for example: which contracts renew in the next 90 days with an uncapped increase?" value="${esc(F ? F.q : '')}" aria-label="Find contracts in plain words" ${live() ? '' : 'disabled'}><button class="btn pri" data-act="find" ${!live() || (F && F.status === 'running') ? 'disabled' : ''}>Find with AI</button></div>
      ${!live() ? '<p class="sub">Finding by plain words needs the live AI server. The search box and filters above work without it.</p>' : ''}
      ${F ? (F.status === 'running' ? '<p class="thinking">Turning the question into a filter…</p>' : F.status === 'failed' ? `<p class="sub">${esc(F.err)}</p>` : !F.filters.length ? `<div class="findbox"><p>No filter could be built from these words, so the list below is not filtered.${F.unsupported ? ' ' + esc(F.unsupported) : ''} Try naming a term, such as a notice date, a price rise, an annual value or an owner.</p><p class="sub"><button class="lnk" data-act="find-clear">Clear</button></p></div>` : `<div class="findbox"><p class="tags">${tag('ai', 'Filter written by AI from your words')} ${tag('code', 'Run over every contract by code')}</p><p>${esc(F.explanation)}</p><div class="sugg">${F.filters.map(f => `<span class="fchip">${esc(filterWords(f))}</span>`).join(' ')}${F.match === 'any' && F.filters.length > 1 ? '<span class="fchip">any of these</span>' : ''}</div>${F.unsupported ? `<p class="sub">Not covered by the filter: ${esc(F.unsupported)}</p>` : ''}<p class="sub">The AI wrote this filter from your words. Code ran it over every contract, so the list is exact. <button class="lnk" data-act="find-clear">Clear</button></p></div>`) : ''}`;
  }
  function repoRows() {
    const q = T.repoQ.trim().toLowerCase();
    let cs = S.contracts.filter(c => !q || (c.supplier + ' ' + c.title + ' ' + c.type + ' ' + c.owner + ' ' + c.category + ' ' + c.text).toLowerCase().includes(q));
    if (T.repoF === 'auto') cs = cs.filter(c => c.f.autoRenew);
    if (T.repoF === 'due') cs = cs.filter(c => { const it = renewalItem(c); return it && it.left <= 90; });
    if (T.repoF === 'uncapped') cs = cs.filter(c => c.f.upliftPct == null);
    if (T.find && T.find.status === 'done') cs = cs.filter(c => passes(c, T.find));
    if (!cs.length) return '<tr><td colspan="7" class="muted">No contract matches. Try fewer words, or check the inbox for unfiled documents.</td></tr>';
    return cs.map(c => { const it = renewalItem(c), nb = noticeBy(c); return `<tr class="rowlink" data-act="open-contract" data-id="${c.id}" tabindex="0"><td><b>${esc(c.supplier)}</b><br><span class="muted"><span class="mono">${c.id}</span> · ${esc(c.type)}</span></td><td>${esc(c.owner)}</td><td class="num">${c.f.annualValue != null ? money(c.f.annualValue) : '—'}</td><td>${fmtDate(c.f.termEnd)}</td><td>${nb ? fmtDate(nb) : '—'}</td><td>${esc(c.f.upliftText || 'Not stated')}</td><td>${it && it.left <= 150 ? renewChip(it) : chip('mute', c.f.autoRenew ? 'Renews automatically' : 'Fixed term')}</td></tr>`; }).join('');
  }
  function liveMetrics() {
    const ns = northStar(), t = invoiceTotals();
    const pct = ns.due ? Math.round(ns.onTime / ns.due * 100) : 0, cov = t.total ? Math.round(t.checked / t.total * 100) : 0;
    return `<div class="tiles">
      <div class="tile star"><span class="tl">North star in this session</span><span class="tn">${pct}%</span><span class="ts">${ns.onTime} of ${ns.due} dates in the next 90 days decided on time${ns.unfiled ? `. The ${ns.due} includes ${ns.unfiled} unfiled document${ns.unfiled === 1 ? '' : 's'}, each counted as undecided until filed` : ''}${ns.missed ? `. ${ns.missed} already missed before the product existed.` : '.'}</span></div>
      <div class="tile"><span class="tl">Coverage</span><span class="tn">${cov}%</span><span class="ts">of invoiced spend has a verified contract behind it. Measured from the ledger, so an unfiled contract shows as a gap.</span></div>
      <div class="tile"><span class="tl">Value protected</span><span class="tn">${money(t.held)}</span><span class="ts">held under dispute, of ${money(t.flagged)} found above contract</span></div>
      <div class="tile"><span class="tl">Reach</span><span class="tn">${S.asked}</span><span class="ts">questions answered with a cited clause</span></div>
    </div><p class="sub">These four numbers are computed from what you do in the prototype. Record a renewal decision or queue a dispute and they move.</p>`;
  }

  /* ---------- actions ---------- */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 6000); }
  let skipHash = false;
  function go(r) { T.hl = null; if (r !== 'contract') T.citeText = null; S.route = VIEWS[r] ? r : 'start'; if (location.hash.slice(1) !== S.route) { skipHash = true; location.hash = S.route; } render(); window.scrollTo(0, 0); }
  function startReview(doc, ex, note, streaming) { T.review = { docId: doc.id, filename: doc.filename, owner: doc.owner || 'Unassigned', text: doc.text, ex, ok: {}, note: note || '', streaming: !!streaming }; T.busy = null; go('review'); }
  async function readDoc(doc, key) {
    T.busy = 'read:' + key; render();
    let note = '';
    if (live()) {
      /* Live: open the review screen at once and fill it in as the lines arrive. */
      const ex = emptyEx(); let seen = 0;
      const R = { doc, ex };
      startReview(doc, ex, '', true);
      const feed = text => {
        const lines = text.split('\n'), complete = lines.length - 1; let changed = false; /* the last element is a partial line, or '' after a trailing newline */
        for (; seen < complete; seen++) { const ln = lines[seen].trim(); if (!ln) continue; let j = null; try { j = JSON.parse(ln); } catch (e) { continue; } if (applyLine(ex, j)) changed = true; }
        if (changed && S.route === 'review' && T.review && T.review.ex === ex) render();
      };
      try {
        const r = await aiCall('extract', { text: doc.text, fields: FIELDS.map(f => ({ k: f.k, label: f.label, type: f.type })), categories: CATEGORIES }, feed);
        feed(r.text + '\n');
        if (!ex.meta) throw { code: 'invalid_json' };
        for (const fd of FIELDS) delete ex.fields[fd.k].pending;
        ex.done = true;
        if (T.review && T.review.ex === ex) { T.review.streaming = false; T.review.read = r.entry; T.review.note = r.entry.truncated ? 'The reading was cut short by the length limit. Check the last terms with care.' : ''; render(); if (ex.docType === 'amendment') explainAmendment(); }
        return;
      } catch (e) {
        note = aiErr(e);
        if (!(T.review && T.review.ex === ex)) { T.busy = null; toast(`The reading of ${doc.filename} failed. ${note}`); return; }   /* the viewer has moved on to something else */
        T.review = null;
        if (S.route !== 'review') { T.busy = null; render(); toast(`The reading of ${doc.filename} failed. ${note}`); return; }
      }
    }
    let ex = null;
    if (doc.saved) { ex = clone(doc.saved); ex.source = 'saved'; }
    if (!ex) { T.busy = null; go('inbox'); toast(note || 'Reading a pasted document needs the live AI server, which is not reachable.'); return; }
    startReview(doc, ex, note ? note + ' Showing the saved reading instead.' : '');
  }
  async function explainAmendment() {
    const R = T.review; if (!R) return;
    const ex = R.ex; if (ex.docType !== 'amendment' || !ex.amends || !live()) return;
    const parent = findContract(ex.amends.parentSupplier); if (!parent) return;
    const changes = ex.amends.changes.map(ch => {
      if (ch.kind === 'rate') { const rt = matchRate(parent, ch.item); return { label: /\brate$/i.test(ch.item) ? ch.item : ch.item + ' rate', was: rt ? money(rt.rate) : 'Not on rate card', now: money(ch.newRate), quote: ch.quote }; }
      const fd = FIELDS.find(f => f.k === ch.field); return { label: ch.label || fd.label, was: parent.f[ch.field] == null ? 'No cap or not stated' : String(parent.f[ch.field]), now: String(ch.newValue), quote: ch.quote };
    });
    R.explain = { text: '', status: 'running' }; render();
    try {
      const r = await aiCall('amend', { parent: { supplier: parent.supplier, title: parent.title }, effectiveFrom: ex.amends.effectiveFrom, changes, text: R.text }, t => { R.explain.text = t; const el = $('#explain-out'); if (el) el.textContent = t; });
      R.explain = { text: r.text.trim(), status: 'done', model: r.entry.model };
    } catch (e) { R.explain = { text: '', status: 'failed', err: aiErr(e) }; }
    if (T.review === R) render();
  }
  async function findInWords(q) {
    q = (q || '').trim(); if (!q || !live()) return;
    T.find = { q, status: 'running' }; render();
    try {
      const { data: j } = await aiJSON('filter', { question: q, today: DEMO_TODAY });
      const filters = (Array.isArray(j.filters) ? j.filters : []).filter(f => f && typeof f.field === 'string' && typeof f.op === 'string');
      T.find = { q, status: 'done', filters, match: j.match === 'any' ? 'any' : 'all', explanation: String(j.explanation || ''), unsupported: j.unsupported ? String(j.unsupported) : null };
      T.repoF = 'all'; T.repoQ = '';
      log('any', `Found contracts by asking: "${q.length > 60 ? q.slice(0, 60) + '…' : q}"`);
    } catch (e) { T.find = { q, status: 'failed', err: aiErr(e) }; }
    render();
  }
  const nextId = () => 'C-' + (Math.max.apply(null, S.contracts.map(c => Number(c.id.slice(2)))) + 1);
  function fileReview() {
    const R = T.review, ex = R.ex; if (pending().length) return;
    const doc = S.inbox.find(d => d.id === R.docId);
    if (ex.docType === 'amendment') {
      const parent = findContract(ex.amends.parentSupplier), label = (/Amendment\s+(No\.?\s*)?\d+/i.exec(ex.title) || [])[0] || 'Amendment ' + (parent.amendments.length + 1);
      for (const ch of ex.amends.changes) {
        const from = ex.amends.effectiveFrom || null;
        if (ch.kind === 'rate') { const rt = matchRate(parent, ch.item); if (rt) { rt.was = rt.rate; rt.rate = ch.newRate; rt.src = label; rt.quote = ch.quote; rt.from = from; } else parent.rates.push({ item: ch.item, unit: 'unit', rate: ch.newRate, src: label, quote: ch.quote, from, was: null }); }
        else { parent.fWas = parent.fWas || {}; parent.fWas[ch.field] = { was: parent.f[ch.field], from, src: label }; parent.f[ch.field] = ch.newValue; if (ch.quote) parent.prov[ch.field] = ch.quote; parent.notes[ch.field] = 'Set by ' + label + ', effective ' + fmtDate(ex.amends.effectiveFrom) + '.'; }
      }
      parent.amendments.push({ title: ex.title, effectiveFrom: ex.amends.effectiveFrom, text: R.text, explain: R.explain && R.explain.status === 'done' ? R.explain.text : '' });
      (ex.risks || []).forEach(r => parent.risks.push(r));
      if (doc) { doc.status = 'filed'; doc.filedAs = parent.id; }
      log('legal', `Applied ${label} to ${parent.supplier}: ${ex.amends.changes.length} terms changed from ${fmtDate(ex.amends.effectiveFrom)}.`, parent.id);
      const n = S.invoices.filter(i => findContract(i.supplier) === parent && !['disputed', 'approved'].includes(i.status)).length;
      T.review = null; S.sel.contract = parent.id; save(); go('contract');
      toast(`Amendment applied to ${parent.id}.${n ? ` ${n} open ${n === 1 ? 'invoice' : 'invoices'} from this supplier will now be checked against the new terms.` : ''}`);
      return;
    }
    const id = nextId(), f = {}, prov = {}, notes = {};
    for (const fd of FIELDS) { const x = ex.fields[fd.k]; f[fd.k] = x.value; if (x.quote && findSpan(R.text, x.quote)) prov[fd.k] = x.quote; if (x.note) notes[fd.k] = x.note; }
    if (ex.rates[0] && ex.rates[0].quote && findSpan(R.text, ex.rates[0].quote)) prov.rates = ex.rates[0].quote;
    const c = { id, supplier: ex.supplier, title: ex.title, type: ex.type, category: ex.category, owner: R.owner && R.owner !== 'Unassigned' ? R.owner : `Procurement, ${ex.category} category manager`, f, prov, notes, rates: ex.rates.map(r => ({ item: r.item, unit: r.unit, rate: r.rate, quote: r.quote })), text: R.text, amendments: [], history: [], signals: [], risks: ex.risks || [], status: 'verified', source: ex.source };
    S.contracts.push(c);
    if (doc) { doc.status = 'filed'; doc.filedAs = id; }
    log('legal', `Filed ${c.supplier} as ${id} after a person checked ${Object.keys(R.ok).length} flagged ${Object.keys(R.ok).length === 1 ? 'term' : 'terms'}.`, id);
    const nb = noticeBy(c), n = S.invoices.filter(i => findContract(i.supplier) === c).length;
    T.review = null; S.sel.contract = id; save(); go('contract');
    toast(`Filed as ${id}.${nb ? ` Notice date ${fmtDate(nb)} is now on the renewal desk.` : ''}${n ? ` ${n} waiting ${n === 1 ? 'invoice' : 'invoices'} from this supplier can now be checked.` : ''}`);
  }
  async function ask(q, cannedId) {
    q = (q || '').trim(); if (!q) return;
    const src = retrieve(q, 14);
    T.ask = { q, text: '', done: false, src, mode: null }; T.busy = 'ask'; render();
    const finish = () => { T.busy = null; S.asked += 1; log('any', `Asked: "${q.length > 70 ? q.slice(0, 70) + '…' : q}"`); render(); };
    if (live()) {
      try {
        const out = await aiCall('ask', { question: q, register: register(), clauses: src, today: DEMO_TODAY, contracts: S.contracts.length, unfiled: S.inbox.filter(d => d.status === 'new').length }, t => { T.ask.text = t; const el = $('#ask-out'); if (el) el.innerHTML = fmtAnswer(t); });
        T.ask.text = out.text; T.ask.mode = 'live'; T.ask.model = out.entry.model; T.ask.ms = out.entry.ms; T.ask.done = true; return finish();
      } catch (e) { T.ask.err = aiErr(e); }
    }
    const canned = cannedId ? cannedAnswer(cannedId) : null;
    if (canned) { T.ask.text = canned; T.ask.mode = 'saved'; T.ask.done = true; return finish(); }
    T.ask.text = src.length ? 'A written answer needs the live AI server. These are the clauses that match your question most closely.' : 'Nothing in the verified repository matches that question.';
    T.ask.mode = 'none'; T.ask.done = true; T.ask.err = T.ask.err || 'Try one of the suggested questions to see a full answer in this view.'; T.busy = null; render();
  }
  const ACT = {
    go: d => go(d.r),
    reset() { const rc = $('#reset-confirm'); if (rc) rc.hidden = true; S = fresh(); S.route = location.hash.slice(1) && VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'start'; Object.assign(T, { hl: null, busy: null, review: null, ask: null, briefs: {}, choice: {}, letters: {}, disputes: {}, repoQ: '', repoF: 'all', pasteInv: '', pasteText: '', find: null, citeText: null, aiDraft: {} }); save(); render(); toast('Demo data restored.'); },
    'paste-sample'() { T.pasteText = SAMPLE_CONTRACT_TEXT; render(); const ta = $('#paste-contract'); if (ta) ta.scrollIntoView({ block: 'center' }); },
    explain: explainAmendment,
    find() { findInWords($('#find-q').value); },
    'find-clear'() { T.find = null; render(); },
    'ai-log'() { T.showLog = !T.showLog; strip(); },
    'read-doc'(d) { if (readingNow()) return toast('Another document is still being read. Wait for it to finish.'); readDoc(S.inbox.find(x => x.id === d.id), d.id); },
    'read-paste'() { if (readingNow()) return toast('Another document is still being read. Wait for it to finish.'); const t = $('#paste-contract').value.trim(); if (t.length < 200) return toast('Paste the full text of a contract first.'); T.pasteText = t; readDoc({ id: null, filename: 'Pasted text', owner: 'Unassigned', text: t }, 'paste'); },
    hl(d) { T.hl = d.k; $$('mark.hl').forEach(m => m.classList.toggle('on', m.dataset.ks.split(' ').includes(d.k))); const m = $('mark.hl.on'); if (m) m.scrollIntoView({ block: 'center', behavior: 'smooth' }); },
    file: fileReview,
    'open-contract'(d) { S.sel.contract = d.id; T.citeText = null; save(); go('contract'); },
    cite(d) { const c = getC(d.id); if (!c) return toast('That contract is not in the repository.'); S.sel.contract = d.id; const ch = chunks().find(x => x.cid === d.id && x.sec === d.sec); T.citeText = ch && !/^A/.test(d.sec) ? ch.text : null; save(); go('contract'); if (T.citeText) { T.hl = 'cite'; render(); const m = $('mark.hl.on'); if (m) m.scrollIntoView({ block: 'center' }); } },
    'repo-filter'(d) { T.repoF = d.f; render(); },
    ask() { ask($('#ask-q').value); },
    'ask-s'(d) { const s = SUGGESTED.find(x => x.id === d.id); ask(s.q, s.id); },
    'open-renewal'(d) { S.sel.renewal = d.id; save(); go('renewal'); },
    choose(d) { T.choice[d.id] = d.c; delete T.letters[d.id]; render(); },
    async brief(d) {
      const c = getC(d.id), it = renewalItem(c); T.busy = 'brief:' + d.id; render();
      try {
        const p = c.prov, ch = choicesFor(it), keys = ch.map(x => x[0]);
        const { data: b, entry } = await aiJSON('brief', { contract: { id: c.id, supplier: c.supplier, title: c.title, owner: c.owner, annualValue: c.f.annualValue != null ? money(c.f.annualValue) : 'not stated', termEnd: c.f.termEnd, renewalMonths: c.f.renewalMonths || 'none', upliftText: c.f.upliftText || 'not stated', noticeMethod: c.f.noticeMethod || 'not stated' }, situation: situationFor(it), choices: ch, clauses: ['autoRenew', 'noticeDays', 'upliftText', 'noticeMethod', 'sla'].map(k => p[k]).filter(Boolean), fullText: c.text, signals: (c.signals || []).map(s => `${s.label}: ${s.value}`), today: DEMO_TODAY });
        T.briefs[d.id] = { source: 'live', model: entry.model, rec: keys.includes(b.recommendation) ? b.recommendation : keys[0], headline: String(b.headline || ''), why: Array.isArray(b.why) ? b.why.map(String).slice(0, 4) : [], asks: Array.isArray(b.asks) ? b.asks.map(String).slice(0, 4) : [], letter: b.letter ? String(b.letter) : '' }; delete T.choice[d.id]; delete T.letters[d.id];
      } catch (e) { toast(aiErr(e)); }
      T.busy = null; render();
    },
    decide(d) {
      const c = getC(d.id), it = renewalItem(c), letter = $('#letter').value, label = (choicesFor(it).find(x => x[0] === d.c) || ['', d.c])[1];
      S.decisions[d.id] = { choice: d.c, at: DEMO_TODAY, onTime: it.kind !== 'closed', letter, sent: false };
      log('proc', `${c.supplier}: decided "${label}"${it.kind === 'closed' ? ', after the notice date had passed' : `, ${it.left} days before the deadline`}.`, c.id); save(); render(); toast('Decision recorded. The notice is queued for the owner to send.');
    },
    'mark-sent'(d) { S.decisions[d.id].sent = true; log('proc', `${getC(d.id).supplier}: owner marked the notice as sent.`, d.id); save(); render(); },
    reopen(d) { delete S.decisions[d.id]; save(); render(); },
    'open-invoice'(d) { S.sel.invoice = d.id; save(); go('invoice'); },
    'inv-dispute'(d) { const inv = S.invoices.find(i => i.id === d.id), r = checkInvoice(inv); inv.status = 'disputed'; inv.dispute = $('#dispute').value; log('fin', `Invoice ${inv.id}: dispute queued for ${money(r.flagged)}, ${money(r2(inv.total - r.flagged))} released.`, r.c && r.c.id); save(); render(); toast('Dispute queued. The undisputed amount is released for payment.'); },
    'inv-approve'(d) { const inv = S.invoices.find(i => i.id === d.id), r = checkInvoice(inv); inv.status = 'approved'; log('fin', `Invoice ${inv.id}: approved in full${r.flagged ? ` despite ${money(r.flagged)} above contract` : ''}.`, r.c && r.c.id); save(); render(); },
    'inv-blind'(d) { const inv = S.invoices.find(i => i.id === d.id); inv.status = 'blind'; log('fin', `Invoice ${inv.id}: paid with no contract on file.`); save(); render(); },
    'inv-reopen'(d) { const inv = S.invoices.find(i => i.id === d.id); inv.status = 'unchecked'; delete inv.dispute; save(); render(); },
    async 'dispute-ai'(d) {
      const inv = S.invoices.find(i => i.id === d.id), r = checkInvoice(inv); T.busy = 'dispute:' + d.id; render();
      const facts = tplDispute(inv, r);
      try { const out = await aiCall('dispute', { facts }, t => { const el = $('#dispute'); if (el && el.dataset.id === d.id) el.value = t; }); T.disputes[d.id] = out.text.trim(); T.aiDraft[d.id] = true; }
      catch (e) { toast(aiErr(e)); }
      T.busy = null; render();
    },
    'inv-sample'() { T.pasteInv = SAMPLE_INVOICE_TEXT; render(); },
    async 'inv-parse'() {
      const text = ($('#paste-inv').value || '').trim(); if (text.length < 40) return toast('Paste the invoice text first.');
      T.pasteInv = text; T.busy = 'inv'; render();
      const cards = S.contracts.map(c => `${c.supplier}: ${c.rates.map(r => '"' + r.item + '"').join(', ')}`).join('\n');
      try {
        const { data: j } = await aiJSON('invoice', { text, cards });
        const lines = (Array.isArray(j.lines) ? j.lines : []).filter(l => l && !isNaN(Number(l.amount))).map(l => ({ desc: String(l.desc || 'Line'), kind: l.kind === 'surcharge' ? 'surcharge' : 'rate', item: l.item ? String(l.item) : null, overtime: !!l.overtime, qty: Number(l.qty) || 1, unitPrice: Number(l.unitPrice) || Number(l.amount), pct: l.pct != null ? Number(l.pct) : null, amount: Number(l.amount), base: true }));
        if (!lines.length) throw { code: 'invalid_json' };
        const id = String(j.invoiceNo || '').replace(/[^\w.\/ -]/g, '').trim().slice(0, 40) || 'PASTED-' + (S.invoices.length + 1);
        S.invoices = S.invoices.filter(i => i.id !== id);
        S.invoices.push({ id, supplier: String(j.supplier || 'Unknown supplier'), date: coerce('date', j.date) || DEMO_TODAY, period: String(j.period || ''), periodLabel: String(j.periodLabel || j.period || ''), termsDays: j.termsDays != null ? Number(j.termsDays) : null, total: Number(j.total) || r2(lines.reduce((s, l) => s + l.amount, 0)), lines, status: 'unchecked', parsed: true });
        T.pasteInv = ''; T.busy = null; S.sel.invoice = id; save(); go('invoice');
      } catch (e) { T.busy = null; render(); toast(aiErr(e)); }
    }
  };
  const CHG = {
    tick(d, el) { T.review.ok[d.k] = el.checked; const row = $('#fr-' + d.k) || el.closest('.frow'); if (row) row.classList.toggle('need', !el.checked); $('#file-bar').innerHTML = fileBar(); },
    field(d, el) { const fd = FIELDS.find(f => f.k === d.k), f = T.review.ex.fields[d.k]; (T.review.ex.touched = T.review.ex.touched || {})[d.k] = true; f.value = coerce(fd.type, el.value); if (needsCheck(d.k)) { T.review.ok[d.k] = true; const cb = $('#ok-' + d.k); if (cb) cb.checked = true; const row = $('#fr-' + d.k); if (row) row.classList.remove('need'); } $('#file-bar').innerHTML = fileBar(); }
  };
  /* ---------- guided tour and first-visit intro ---------- */
  const filed = id => (S.inbox.find(d => d.id === id) || {}).status === 'filed';
  const TOUR_STEPS = [
    { r: 'inbox', also: ['review', 'contract'], t: '.doclist', title: 'Watch the AI read a signed document',
      why: 'Legal Operations makes the repository true. The AI reads each term with the sentence it came from, code checks the quote and the value, and a person confirms only what is flagged.',
      tryIt: () => filed('D-1') ? 'The Fleetline amendment is filed. Press Next to see what it changed.' : (live() ? 'Click Read with AI on the Fleetline amendment and watch the terms arrive. Tick the two changed terms, then click Apply amendment.' : 'Click Show saved reading on the Fleetline amendment, tick the two changed terms, then click Apply amendment.') },
    { r: 'invoice', sel: { invoice: 'FL-20931' }, t: '#main .scroll', title: 'Watch one filing change another desk',
      why: 'Accounts Payable checks each line against the rate in force for that period. Code does the arithmetic, not the model.',
      tryIt: () => filed('D-1') ? 'With the amendment filed, this invoice shows $9,486.92 flagged against the contract. Read the line notes and the service-credit finding.' : 'Before filing, this invoice shows $1,743.52 flagged. File the Fleetline amendment in the Inbox and come back: it rises to $9,486.92.' },
    { r: 'renewal', sel: { renewal: 'C-1001' }, t: '.split > div:last-child', title: 'Decide before the notice date',
      why: 'The deadline is worked out by code from the filed terms. AI drafts the renewal brief and the letter. A person records the decision, and nothing is sent.',
      tryIt: () => 'Pick an option, edit the draft letter, then click Record decision.' },
    { r: 'ask', also: ['contract'], t: '.sugg', title: 'Ask, and get a cited answer',
      why: 'Answers come only from the verified repository, and every claim names the contract and clause it rests on.',
      tryIt: () => (live() ? 'Type any question, or click a suggested one, and watch the answer stream in. ' : 'Click a suggested question. ') + 'Then click a citation to open the clause it came from.' },
    { r: 'why', t: '.pos', title: 'What Afterink believes',
      why: 'Three positions shape every screen: AI reads but code verifies, success means decisions made in time, and Accounts Payable reads the same contracts as Legal.',
      tryIt: () => 'Read the three positions, then press Next.' },
    { r: 'metrics', t: '#live-metrics', title: 'See how success is measured, including the downside',
      why: "The north star counts silence as a miss. Corvid's notice date passed before the product existed, so the score can never reach 100% on old misses, and unfiled documents count as undecided.",
      tryIt: () => 'Check how the tiles moved with what you did, then scroll to the table of what would make us rethink the approach.' }
  ];
  /* One walkthrough per money leak, started from the cards on the Start page. */
  const fl = () => checkInvoice(S.invoices.find(i => i.id === 'FL-20931')).flagged;
  const WALKS = {
    renewal: { label: 'Missed renewal, step by step', steps: [
      { r: 'renewals', t: '#main .scroll', title: 'The buying team sees every deadline', why: 'Code worked out each last day to say no from the signed terms, and lists them by days left. Cloudmetric is near the top.', tryIt: () => 'Find Cloudmetric in the list, then press Next.' },
      { r: 'renewal', sel: { renewal: 'C-1001' }, t: '.split > div:first-child .card', title: 'The deadline comes from the signed text', why: 'The last day to give notice is calculated by code from the term end and the notice period, and each fact shows the sentence it came from. Nobody typed it.', tryIt: () => 'Read the quoted clause under "Last day to give notice", then press Next.' },
      { r: 'renewal', sel: { renewal: 'C-1001' }, t: '.split > div:last-child', title: 'AI drafts, a person decides', why: 'The AI writes a short brief and a draft notice from the contract and the seat usage. Nothing is sent: the buying team records a decision and the contract owner sends the notice.', tryIt: () => 'Pick an option, edit the letter if you like, then click Record decision.' }
    ] },
    overcharge: { label: 'Overcharged invoice, step by step', steps: [
      { r: 'invoice', sel: { invoice: 'FL-20931' }, t: '#main .scroll', title: 'Today the invoice looks almost right', why: 'Checked against the prices the finance team knows about, Fleetline\'s October invoice is only slightly over. The signed price cut is still sitting in an email.', tryIt: () => filed('D-1') ? `The price change is already filed, so this invoice now shows ${money(fl())} over contract. Press Next.` : `It shows ${money(fl())} over contract. Press Next to file the signed change.` },
      { r: 'inbox', also: ['review', 'contract'], t: '.doclist', title: 'The legal team files the signed change', why: 'The AI reads the amendment and quotes each changed term. Code checks every quote is really in the document. A person confirms the two changes.', tryIt: () => filed('D-1') ? 'Already filed. Press Next.' : (live() ? 'Click Read with AI on the Fleetline amendment, tick both changes, then click Apply amendment.' : 'Click Show saved reading on the Fleetline amendment, tick both changes, then click Apply amendment.') },
      { r: 'invoice', sel: { invoice: 'FL-20931' }, t: '#main .scroll', title: 'The finance team sees the real overcharge', why: 'With the new prices on file, code compares every line again and finds the true overcharge on the same invoice.', tryIt: () => filed('D-1') ? `It now shows ${money(fl())} over contract. Queue the dispute: only the difference is held and the rest is paid on time.` : 'File the Fleetline amendment first (previous step), then come back.' }
    ] },
    credit: { label: 'Unclaimed refund, step by step', steps: [
      { r: 'invoice', sel: { invoice: 'BC-1187' }, t: '.finding', title: 'The refund nobody claimed', why: 'BrightClean promised a monthly audit score of at least 90%. October scored 86%, so the contract owes a credit. Code compared the service report with the credit clause and found the invoice leaves it out.', tryIt: () => 'Read the "Service credit not applied" finding and the quoted clause, then press Next.' },
      { r: 'contract', sel: { contract: 'C-1003' }, t: '.split > div:first-child .card', title: 'The promise was always in the contract', why: 'The credit clause sits in a contract the finance team had never seen. Now every team can find it, with the sentence it came from.', tryIt: () => 'Click Show source next to "Service levels and credits".' }
    ] }
  };
  const TOUR = { on: false, i: 0, steps: TOUR_STEPS, label: 'Guided tour' };
  function startTour(steps, label) { TOUR.steps = steps; TOUR.label = label; $('#intro').hidden = true; tourGo(0); }
  function tourHere() {
    const st = TOUR.steps[TOUR.i];
    if (S.route === st.r) return !st.sel || Object.keys(st.sel).every(k => S.sel[k] === st.sel[k]);
    return (st.also || []).includes(S.route);
  }
  function tourGo(i) {
    TOUR.on = true; TOUR.i = Math.max(0, Math.min(TOUR.steps.length - 1, i));
    const st = TOUR.steps[TOUR.i];
    if (st.sel) Object.assign(S.sel, st.sel);
    go(st.r);
    const t = $(st.t); if (t) t.scrollIntoView({ block: 'center' });
  }
  function tourPaint() {
    const el = $('#tour'); if (!el) return;
    $$('.tour-target').forEach(n => n.classList.remove('tour-target'));
    document.body.classList.toggle('touring', TOUR.on);
    if (!TOUR.on) { el.hidden = true; return; }
    const st = TOUR.steps[TOUR.i], here = tourHere(), last = TOUR.i === TOUR.steps.length - 1;
    el.hidden = false;
    el.innerHTML = `<p class="tour-step">${esc(TOUR.label)} · stop ${TOUR.i + 1} of ${TOUR.steps.length}</p>
      <div class="tour-dots" aria-hidden="true">${TOUR.steps.map((s, k) => `<span class="${k <= TOUR.i ? 'on' : ''}"></span>`).join('')}</div>
      <h3 class="tour-h">${esc(st.title)}</h3>
      ${here ? `<p class="tour-why"><b>Why this matters.</b> ${esc(st.why)}</p><p class="tour-try"><b>Try this.</b> ${esc(st.tryIt())}</p>` : '<p class="tour-why">You moved to another screen. The tour is waiting at this stop.</p>'}
      <div class="tour-nav">${here ? '' : '<button class="btn sm pri" data-act="tour-here">Back to this stop</button>'}<button class="btn sm" data-act="tour-prev" ${TOUR.i === 0 ? 'disabled' : ''}>Back</button>${last ? '<button class="btn sm pri" data-act="tour-end">Finish</button>' : `<button class="btn sm${here ? ' pri' : ''}" data-act="tour-next">Next</button>`}<button class="lnk tour-x" data-act="tour-end">Exit tour</button></div>`;
    if (here && S.route === st.r) { const t = $(st.t); if (t) t.classList.add('tour-target'); }
  }
  const IKEY = 'afterink.intro.v1';
  function introSeen() { try { localStorage.setItem(IKEY, '1'); } catch (e) { /* storage unavailable */ } $('#intro').hidden = true; }
  function introInit() { let seen = false; try { seen = localStorage.getItem(IKEY) === '1'; } catch (e) { seen = false; } if (!seen) { $('#intro').hidden = false; const b = $('#intro-start'); if (b) b.focus(); } }
  Object.assign(ACT, {
    'tour-start'() { startTour(TOUR_STEPS, 'Guided tour'); },
    walk(d) { const w = WALKS[d.w]; if (w) startTour(w.steps, w.label); },
    'tour-next'() { tourGo(TOUR.i + 1); },
    'tour-prev'() { tourGo(TOUR.i - 1); },
    'tour-here'() { tourGo(TOUR.i); },
    'tour-end'() { TOUR.on = false; tourPaint(); toast('Walkthrough closed. Start another from the Start page, or the guided tour from the top bar.'); },
    'intro-tour'() { introSeen(); startTour(TOUR_STEPS, 'Guided tour'); },
    'intro-skip'() { introSeen(); },
    'reset-ask'() { const rc = $('#reset-confirm'); rc.hidden = !rc.hidden; if (!rc.hidden) $('#reset-yes').focus(); },
    'reset-cancel'() { $('#reset-confirm').hidden = true; }
  });
  document.addEventListener('click', e => { if (e.target && e.target.id === 'intro') introSeen(); });
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el || el.disabled) return; const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset, el); } });
  document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el.dataset, el); });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-inp]'); if (!el) return;
    if (el.dataset.inp === 'repo') { T.repoQ = el.value; $('#repo-body').innerHTML = repoRows(); }
    if (el.dataset.inp === 'letter') T.letters[el.dataset.id] = el.value;
    if (el.dataset.inp === 'dispute') T.disputes[el.dataset.id] = el.value;
    if (el.dataset.inp === 'pasteinv') T.pasteInv = el.value;
    if (el.dataset.inp === 'pastedoc') T.pasteText = el.value;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#intro').hidden) { introSeen(); return; } if (!$('#reset-confirm').hidden) { $('#reset-confirm').hidden = true; return; } if (TOUR.on) { ACT['tour-end'](); return; } }
    if (e.key !== 'Enter') return;
    if (e.target.id === 'ask-q') { e.preventDefault(); ask(e.target.value); }
    else if (e.target.id === 'find-q') { e.preventDefault(); findInWords(e.target.value); }
    else if (e.target.classList && e.target.classList.contains('rowlink')) ACT['open-contract'](e.target.dataset);
  });

  /* ---------- chrome and render ---------- */
  /* Line icons, drawn inline so they need nothing to load and take the colour of the text around them. */
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
    chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M12 14v3l2 1"/>',
    receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6.2"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/><path d="M21 11h-5a2 2 0 0 0 0 4h5z"/>',
    sparkle: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/>',
    usercheck: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="m16 11 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2a2.5 2 0 0 1-2.5-1.5M12 6v1.5M12 16.5V18"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'
  };
  const icon = name => ICON[name] ? `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[name]}</svg>` : '';
  const NAV = [
    { r: 'start', t: 'Start here', ic: 'home' },
    { g: 'Legal team' }, { r: 'inbox', t: 'Inbox', ic: 'inbox', alias: ['review'], ct: () => S.inbox.filter(d => d.status === 'new').length },
    { g: 'Buying team' }, { r: 'renewals', t: 'Renewal desk', ic: 'calendar', alias: ['renewal'], ct: () => renewalItems(90).filter(it => !S.decisions[it.c.id]).length },
    { g: 'Finance team' }, { r: 'invoices', t: 'Invoice check', ic: 'receipt', alias: ['invoice'], ct: () => S.invoices.filter(i => !['disputed', 'approved', 'blind'].includes(i.status)).length },
    { g: 'Everyone' }, { r: 'repository', t: 'Repository', ic: 'archive', alias: ['contract'] }, { r: 'ask', t: 'Ask', ic: 'chat' },
    { g: 'Why Afterink' }, { r: 'why', t: 'Why after signature', ic: 'pen' }, { r: 'stakeholders', t: 'Who it serves', ic: 'users' }, { r: 'problem', t: 'The problem', ic: 'alert' },
    { r: 'metrics', t: 'Measuring success', ic: 'target' }
  ];
  /* The strip under the top band: which model is live, and every call made in this session. */
  function strip() {
    const el = $('#ai-strip'); if (!el) return;
    const calls = AI.calls;
    if (AI.state !== 'live' && !calls.length) { el.hidden = true; return; }
    el.hidden = false;
    const last = calls[0];
    const lastText = !last ? '' : ` Last call: ${esc(last.label.toLowerCase())}, ${last.status === 'running' ? 'running…' : last.status === 'failed' ? 'failed. ' + esc(AI_COPY[last.err] || last.err) : fmtMs(last.ms) + (last.in != null ? `, ${(last.in + last.out).toLocaleString('en-US')} tokens` : '') + '.'}`;
    const head = AI.state === 'live'
      ? `<b>Live AI: ${esc(AI.modelName || AI.model || '')}</b>, through a small server that holds the key${AI_URL_OVERRIDE ? ` (test server ${esc(AI_URL_OVERRIDE)})` : ''}. The page sends data, the server holds the prompts, and the model never does the arithmetic. ${calls.length ? `${calls.length} call${calls.length === 1 ? '' : 's'} this session.` : 'No calls yet.'}`
      : `<b>AI calls this session: ${calls.length}.</b>`;
    el.innerHTML = `<div class="aistrip-in"><span>${head}${lastText}</span>${calls.length ? `<button class="lnk" data-act="ai-log">${T.showLog ? 'Hide the log' : 'Show the log'}</button>` : ''}</div>
      ${T.showLog && calls.length ? `<div class="scroll ailog"><table class="tbl mini"><thead><tr><th>Call</th><th>Status</th><th class="num">Time</th><th class="num">Sent</th><th class="num">Tokens in</th><th class="num">Tokens out</th><th>Model</th></tr></thead><tbody>${calls.map(c => `<tr><td>${esc(c.label)}</td><td>${c.status === 'done' ? chip('good', c.truncated ? 'Done, cut short' : 'Done') : c.status === 'running' ? chip('info', 'Running') : chip('crit', 'Failed')}</td><td class="num">${c.ms ? fmtMs(c.ms) : '—'}</td><td class="num">${c.chars.toLocaleString('en-US')} chars</td><td class="num">${c.in != null ? c.in.toLocaleString('en-US') : '—'}</td><td class="num">${c.out != null ? c.out.toLocaleString('en-US') : '—'}</td><td>${esc(c.model || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  }
  function chrome() {
    const bar = $('#ai-bar');
    if (bar) {
      bar.hidden = AI.state !== 'off';
      if (AI.state === 'off') bar.innerHTML = `<b>The live AI is off: ${esc(WHY_OFF[AI.why] || WHY_OFF.offline)}.</b> This page is replaying saved AI results, prepared in advance from these same documents. The checks, dates and invoice sums still run live in your browser.${AI.why === 'unset' ? '' : ' Reload the page to try again later.'}`;
    }
    const chipEl = $('#ai-chip');
    if (chipEl) { chipEl.className = 'chip ' + (AI.state === 'live' ? 'good' : 'mute'); chipEl.textContent = AI.state === 'live' ? `AI: live, ${AI.modelName || AI.model}` : AI.state === 'off' ? 'AI: saved results' : 'AI: checking'; }
    $('#nav').innerHTML = NAV.map(n => n.g ? `<p class="ng">${n.n ? `<span class="nn">${n.n}</span>` : ''}${n.g}</p>` : `<a class="nl${S.route === n.r || (n.alias || []).includes(S.route) ? ' on' : ''}" href="#${n.r}">${n.n ? `<span class="nn">${n.n}</span>` : ''}${icon(n.ic)}<span>${n.t}</span>${n.ct && n.ct() ? `<span class="ct">${n.ct()}</span>` : ''}</a>`).join('');
  }
  let lastRoute = null;
  function render() {
    if (!VIEWS[S.route]) S.route = 'start';
    const same = S.route === lastRoute, ae = document.activeElement, main = $('#main');
    const keep = same && ae && ae.id && main.contains(ae) && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== 'checkbox' ? { id: ae.id, v: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
    const docEl = $('#doc'), docTop = same && docEl ? docEl.scrollTop : null;
    chrome();
    main.innerHTML = VIEWS[S.route]();
    lastRoute = S.route;
    if (keep) { const el = document.getElementById(keep.id); if (el && !el.disabled) { if (el.value !== keep.v) el.value = keep.v; el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { /* not a text input */ } } }
    if (docTop != null) { const d2 = $('#doc'); if (d2) d2.scrollTop = docTop; }
    const lm = $('#live-metrics'); if (lm) lm.innerHTML = liveMetrics();
    tourPaint();
    save();
  }
  window.addEventListener('hashchange', () => { if (skipHash) { skipHash = false; return; } const r = location.hash.slice(1); S.route = VIEWS[r] ? r : 'start'; if (S.route === 'review' && !T.review) S.route = 'inbox'; T.hl = null; render(); window.scrollTo(0, 0); });
  const h0 = location.hash.slice(1);
  if (h0 && VIEWS[h0]) S.route = h0;
  if ((S.route === 'review' && !T.review)) S.route = 'inbox';
  async function initAI() {
    if (AI_UNSET) { AI.state = 'off'; AI.why = 'unset'; }
    else {
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(AI_URL + '/v1/health', { signal: ctl.signal }); clearTimeout(tm);
        const j = await r.json();
        if (j && j.ok) { AI.state = 'live'; AI.provider = j.provider; AI.model = j.model; AI.modelName = j.modelName || j.model; }
        else { AI.state = 'off'; AI.why = 'auth'; }
      } catch (e) { AI.state = 'off'; AI.why = 'offline'; }
    }
    strip();
    render();   /* render keeps the focused input and its caret, so this is safe while someone types */
  }
  /* Light and dark: Night is the default. The top-bar button switches, and this viewer's choice is
     remembered in their browser. The page sets the mode before it first paints (see index.html). */
  function themeButton() {
    const light = document.documentElement.dataset.theme === 'light', b = $('#theme-btn');
    if (b) { b.innerHTML = light ? icon('moon') + 'Dark mode' : icon('sun') + 'Light mode'; b.setAttribute('aria-pressed', String(light)); }
    const tb = $('#tour-btn'), rb = $('#reset-btn');
    if (tb && !tb.querySelector('svg')) tb.insertAdjacentHTML('afterbegin', icon('play'));
    if (rb && !rb.querySelector('svg')) rb.insertAdjacentHTML('afterbegin', icon('reset'));
  }
  Object.assign(ACT, {
    'theme-toggle'() {
      const next = document.documentElement.dataset.theme === 'light' ? 'night' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('afterink.theme', next); } catch (e) { /* storage unavailable: the choice lasts this page load */ }
      themeButton();
    },
    'announce-x'() { $('#announce').hidden = true; try { sessionStorage.setItem('afterink.announce', 'hidden'); } catch (e) { /* storage unavailable */ } }
  });
  themeButton();
  try { if (sessionStorage.getItem('afterink.announce') === 'hidden') $('#announce').hidden = true; } catch (e) { /* storage unavailable */ }
  $('#demo-date').textContent = fmtDate(DEMO_TODAY);
  render();
  introInit();
  initAI();
})();

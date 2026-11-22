/* Live smoke test: sends every AI task to a running server and checks the answers, not just that
   something came back. It calls the real model, so it uses free-tier quota (about 9 calls a run).

     npm run smoke                                   # the server the page uses (AI_URL_DEFAULT in app.js)
     npm run smoke -- http://127.0.0.1:8787          # a local server (npm run dev)

   Exit code 0 when every check passes. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/* With no address given, test the server the page itself uses (AI_URL_DEFAULT in app.js). */
const PAGE_SERVER = (/const AI_URL_DEFAULT = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8')) || [])[1];
const SERVER = (process.argv[2] || PAGE_SERVER || '').replace(/\/$/, '');
if (!SERVER) { console.error('No server address: pass one, for example npm run smoke -- https://your-server.workers.dev'); process.exit(2); }
const ORIGIN = SERVER.includes('127.0.0.1') || SERVER.includes('localhost') ? 'http://127.0.0.1:8765' : 'https://akshatj28.github.io';

const window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(window);
const D = window.AFTERINK;
const plain = src => src.replace(/\[\[[\w,]+\|([^\]]+)\]\]/g, '$1');
const FIELDS = D.FIELDS.map(f => ({ k: f.k, label: f.label, type: f.type }));
const num = v => (v == null ? null : Number(String(v).replace(/[, $%]/g, '').replace(/^USD/i, '')));
const json = t => JSON.parse(String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''));
const ndjson = t => String(t).trim().split('\n').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

async function call(task, body) {
  const t0 = Date.now();
  const res = await fetch(`${SERVER}/v1/${task}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, why: `HTTP ${res.status} ${(await res.text()).slice(0, 120)}` };
  let buf = '', text = '', meta = null, err = null;
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString('utf8'); let i;
    while ((i = buf.indexOf('\n\n')) >= 0) { const c = buf.slice(0, i); buf = buf.slice(i + 2); for (const l of c.split('\n')) { if (!l.startsWith('data: ')) continue; const j = JSON.parse(l.slice(6)); if (j.t) text += j.t; else if (j.error) err = j; else if (j.done) meta = j; } }
  }
  if (err) return { ok: false, why: `${err.error}: ${err.message}` };
  if (!meta) return { ok: false, why: 'stream ended without its closing event' };
  return { ok: true, text, ms: Date.now() - t0, model: meta.model };
}

const vault = 'C-1007 | Vaultline Data Centers Inc. | notice 180 days | notice by 2027-01-01';
const fleet = plain(D.SEED_INBOX.find(d => d.id === 'D-1').src);
const greenleaf = plain(D.SEED_INBOX.find(d => d.id === 'D-3').src);
const CASES = [
  ['read a contract (bundled sample)', 'extract', { text: D.SAMPLE_CONTRACT_TEXT, fields: FIELDS, categories: D.CATEGORIES }, t => {
    const L = ndjson(t), f = k => (L.find(x => x.type === 'field' && x.k === k) || {}).value;
    const want = { termEnd: '2028-02-28', noticeDays: 90, upliftPct: 4, paymentDays: 45, autoRenew: true };
    const wrong = Object.entries(want).filter(([k, v]) => String(typeof v === 'number' ? num(f(k)) : f(k)) !== String(v)).map(([k]) => k);
    const quotes = L.filter(x => x.type === 'field' && x.quote), found = quotes.filter(x => D.SAMPLE_CONTRACT_TEXT.includes(x.quote)).length;
    return [!wrong.length && L.some(x => x.type === 'end'), `wrong: ${wrong.join(', ') || 'none'}; quotes found ${found}/${quotes.length}`];
  }],
  ['read an amendment (Fleetline)', 'extract', { text: fleet, fields: FIELDS, categories: D.CATEGORIES }, t => {
    const a = ndjson(t).find(x => x.type === 'amends'), ch = (a && a.changes) || [];
    const rate = ch.some(c => c.kind === 'rate' && num(c.newRate) === 35.5), cap = ch.some(c => c.field === 'surchargeCapPct' && num(c.newValue) === 6);
    return [rate && cap && a.effectiveFrom === '2026-10-01', `rate ${rate ? 'ok' : 'MISSED'}, surcharge cap ${cap ? 'ok' : 'MISSED'}, from ${a && a.effectiveFrom}`];
  }],
  ['read a vague letter without guessing (Greenleaf)', 'extract', { text: greenleaf, fields: FIELDS, categories: D.CATEGORIES }, t => {
    const L = ndjson(t), f = k => (L.find(x => x.type === 'field' && x.k === k) || {}).value;
    const guessed = ['noticeDays', 'upliftPct', 'law'].filter(k => f(k) != null);
    return [!guessed.length, guessed.length ? `guessed ${guessed.join(', ')}` : 'notice days, cap and law left as not stated'];
  }],
  ['answer a question with citations', 'ask', { question: 'What notice do we owe Vaultline?', register: vault, clauses: [{ cid: 'C-1007', sec: '2', supplier: 'Vaultline', text: '2. Renewal. Renews for twelve (12) months unless either party gives one hundred and eighty (180) days written notice by courier.' }], today: D.DEMO_TODAY, contracts: 10, unfiled: 3 }, t =>
    [/180/.test(t) && /\[C-1007/.test(t), /180/.test(t) ? 'cites C-1007 and the 180 days' : 'missing the 180 days']],
  ['write a renewal brief', 'brief', { contract: { id: 'C-1001', supplier: 'Cloudmetric Inc.', title: 'SaaS Order Form', owner: 'Data & Analytics', annualValue: '$186,000', termEnd: '2027-01-31', renewalMonths: 12, upliftText: 'Lesser of 5% or CPI', noticeMethod: 'Email' }, situation: 'Renews unless notice is given by 2026-12-02.', choices: [['renew', 'Let it renew'], ['renegotiate', 'Give notice and renegotiate'], ['exit', 'Give notice and leave']], clauses: [], fullText: 'SaaS order form, 400 seats.', signals: ['Seat usage: 212 of 400 active'], today: D.DEMO_TODAY }, t => {
    const b = json(t); return [['renew', 'renegotiate', 'exit'].includes(b.recommendation) && b.letter && b.why.length > 0, `recommends ${b.recommendation}`];
  }],
  ['redraft a dispute, keeping every number', 'dispute', { facts: 'Re: Invoice FL-20931\n- Standard pallet line-haul: billed $38.00 x 2,410, agreed $35.50, difference $6,025.00.\nTotal difference: $9,486.92.' }, t => {
    const kept = ['FL-20931', '$6,025.00', '$9,486.92'].filter(x => t.includes(x)); return [kept.length === 3, `kept ${kept.length}/3 figures`];
  }],
  ['read a pasted invoice', 'invoice', { text: D.SAMPLE_INVOICE_TEXT, cards: 'Harborview Security Services Ltd.: "Guarding hour", "Supervisor hour"' }, t => {
    const j = json(t), sum = j.lines.reduce((s, l) => s + Number(l.amount), 0);
    return [Math.abs(sum - 45090) < 0.01 && num(j.total) === 45090, `${j.lines.length} lines, sum ${sum}`];
  }],
  ['turn a question into a filter', 'filter', { question: 'which contracts have already missed their notice date', today: D.DEMO_TODAY }, t => {
    const j = json(t), ok = j.filters.some(f => f.field === 'daysLeft' && /lt/.test(f.op) && Number(f.value) <= 0);
    return [ok, JSON.stringify(j.filters)];
  }],
  ['explain an amendment', 'amend', { parent: { supplier: 'Fleetline Logistics LLC', title: 'Transportation Services Agreement' }, effectiveFrom: '2026-10-01', changes: [{ label: 'Standard pallet line-haul rate', was: '$38', now: '$35.50' }, { label: 'Fuel surcharge cap (%)', was: 'No cap', now: '6' }], text: fleet }, t =>
    [/35\.50/.test(t) && /20,000/.test(t), /20,000/.test(t) ? 'mentions the new volume commitment' : 'missed the 20,000-pallet commitment']],
];

console.log(`Live smoke test against ${SERVER}\n`);
let failed = 0;
for (const [name, task, body, check] of CASES) {
  let r = await call(task, body);
  if (!r.ok && /overloaded|rate_limited/.test(r.why)) { await new Promise(x => setTimeout(x, 8000)); r = await call(task, body); }  /* one patient retry for a free-tier spike */
  let pass = false, note = r.why;
  if (r.ok) { try { [pass, note] = check(r.text); } catch (e) { note = 'unreadable reply: ' + e.message; } }
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(48)} ${r.ok ? `${(r.ms / 1000).toFixed(1)}s ${r.model}  ` : ''}${note}`);
}
console.log(`\n${CASES.length - failed} of ${CASES.length} passed`);
process.exit(failed ? 1 : 0);

/* Tests for pure functions in the page (../../app.js). The page is one script with no build step, so
   each function is lifted out of the source by name and evaluated on its own with the seed data. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const window = {};
new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(window);
const { DEMO_TODAY, FIELDS, CATEGORIES, SEED_CONTRACTS } = window.AFTERINK;

/* A function body up to its matching brace, or a one-line const. */
function fn(name) {
  const i = app.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'app.js has function ' + name);
  let k = app.indexOf('{', i), depth = 0;
  for (; k < app.length; k++) { if (app[k] === '{') depth++; else if (app[k] === '}' && --depth === 0) break; }
  return app.slice(i, k + 1);
}
function line(decl) {
  const i = app.indexOf(decl);
  assert.ok(i >= 0, 'app.js has ' + decl);
  return app.slice(i, app.indexOf('\n', i));
}

const lib = new Function('DEMO_TODAY', 'FIELDS', 'CATEGORIES', 'S', [
  line('const D = iso'), line('const addDays ='), line('const daysBetween ='), line('const clone ='),
  line('const NUM_WORDS'), line('const MONTHS'), line('const noticeBy ='),
  fn('parseMarked'), fn('buildContract'), fn('coerce'), fn('normEx'), fn('applyLine'), fn('emptyEx'),
  fn('valueInQuote'), fn('contractFacts'), fn('passes'),
  'return { coerce, valueInQuote, contractFacts, passes, applyLine, emptyEx, buildContract };'
].join('\n'));

const S = { contracts: [], decisions: {} };
const L = lib(DEMO_TODAY, FIELDS, CATEGORIES, S);
S.contracts = SEED_CONTRACTS.map(L.buildContract);
const byId = id => S.contracts.find(c => c.id === id);
const find = (filters, match = 'all') => S.contracts.filter(c => L.passes(c, { filters, match })).map(c => c.id);

test('value in quote: a number or day does not match inside a longer one', () => {
  assert.equal(L.valueInQuote('date', '2027-01-01', 'ends on 31 January 2027'), false);
  assert.equal(L.valueInQuote('date', '2027-01-31', 'ends on 31 January 2027'), true);
  assert.equal(L.valueInQuote('date', '2026-12-02', 'by 12 December 2026'), false);
  assert.equal(L.valueInQuote('num', 5, 'rises by 2.5% each year'), false);
  assert.equal(L.valueInQuote('num', 2.5, 'rises by 2.5% each year'), true);
  assert.equal(L.valueInQuote('money', 250, 'a fee of $1,250 a month'), false);
  assert.equal(L.valueInQuote('money', 1250, 'a fee of $1,250 a month'), true);
  assert.equal(L.valueInQuote('money', 35.5, 'USD 35.50 per pallet'), true);
  assert.equal(L.valueInQuote('money', 1743.52, 'a total of $1,743.52.'), true);
  assert.equal(L.valueInQuote('num', 90, 'at least ninety (90) days before'), true);
  assert.equal(L.valueInQuote('num', 6, 'six percent (6%) of line-haul'), true);
  assert.equal(L.valueInQuote('num', 60, 'within sixty days.'), true);
});

test('numbers written with %, $, commas or USD are read as numbers', () => {
  assert.equal(L.coerce('num', '6%'), 6);
  assert.equal(L.coerce('money', 'USD 35.50'), 35.5);
  assert.equal(L.coerce('money', '$295,200.00'), 295200);
  assert.equal(L.coerce('num', 'six'), null);
  assert.equal(L.coerce('bool', 'yes'), null);
});

test('daysLeft counts to the notice date, negative once it has passed (Corvid)', () => {
  const corvid = L.contractFacts(byId('C-1010'));
  assert.equal(corvid.noticeBy, '2026-09-01');
  assert.ok(corvid.daysLeft < 0, 'Corvid notice date has passed');
  assert.deepEqual(find([{ field: 'daysLeft', op: 'lt', value: 0 }]), ['C-1010']);
  assert.ok(!find([{ field: 'daysLeft', op: 'gte', value: 0 }, { field: 'daysLeft', op: 'lte', value: 30 }]).includes('C-1010'));
  assert.equal(L.contractFacts(byId('C-1001')).daysLeft, 15, 'Cloudmetric: 15 days, as the page says');
});

test('eq and ne with a null value mean "is not stated" and "is stated"; 0 is not null', () => {
  const capped = find([{ field: 'upliftPct', op: 'ne', value: null }]);
  const uncapped = find([{ field: 'upliftPct', op: 'eq', value: null }]);
  assert.deepEqual(uncapped, find([{ field: 'upliftPct', op: 'isnull', value: null }]));
  assert.equal(capped.length + uncapped.length, S.contracts.length);
  const fixed = S.contracts.filter(c => c.f.upliftPct === 0).map(c => c.id);
  assert.ok(fixed.length > 0 && fixed.every(id => capped.includes(id)), 'fixed-price contracts (0%) count as stated');
});

test('yes/no values are read as booleans, and anything else fails instead of inverting', () => {
  const auto = find([{ field: 'autoRenew', op: 'eq', value: true }]);
  assert.deepEqual(find([{ field: 'autoRenew', op: 'eq', value: 'yes' }]), auto);
  assert.deepEqual(find([{ field: 'autoRenew', op: 'eq', value: 'Yes' }]), auto);
  assert.deepEqual(find([{ field: 'autoRenew', op: 'eq', value: 'maybe' }]), []);
  assert.deepEqual(find([{ field: 'autoRenew', op: 'ne', value: 'maybe' }]), []);
  assert.deepEqual(find([{ field: 'notAField', op: 'notnull', value: null }]), []);
});

test('the live reading: a field a person edited is not overwritten, and money strings are kept', () => {
  const ex = L.emptyEx();
  ex.touched = { noticeDays: true };
  ex.fields.noticeDays = { value: 45, quote: null, confidence: 'high', note: '' };
  assert.equal(L.applyLine(ex, { type: 'field', k: 'noticeDays', value: 90, quote: 'q', confidence: 'high' }), false);
  assert.equal(ex.fields.noticeDays.value, 45);
  L.applyLine(ex, { type: 'rate', item: 'Pallet', unit: 'pallet', rate: 'USD 35.50', quote: 'q' });
  assert.equal(ex.rates[0].rate, 35.5);
  L.applyLine(ex, { type: 'amends', parentSupplier: 'Fleetline', effectiveFrom: '2026-10-01', changes: [{ kind: 'rate', item: 'Pallet', newRate: '$35.50', quote: 'q' }, { kind: 'rate', item: 'Other', newRate: 'n/a', quote: 'q' }] });
  assert.equal(ex.amends.changes[0].newRate, 35.5);
  assert.equal(ex.amends.changes[1].newRate, null, 'an unreadable rate is kept as null so the page blocks filing');
});

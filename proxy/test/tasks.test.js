import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS } from '../src/tasks.js';
import { Reject } from '../src/common.js';

const FIELDS = [{ k: 'termEnd', label: 'Current term ends', type: 'date' }, { k: 'noticeDays', label: 'Notice (days)', type: 'num' }];

test('every task exists and rejects an empty body', () => {
  for (const name of ['extract', 'ask', 'brief', 'dispute', 'invoice', 'filter', 'amend']) {
    assert.equal(typeof TASKS[name], 'function', name);
    assert.throws(() => TASKS[name]({}), Reject, name + ' should reject an empty body');
  }
});

test('extract builds an NDJSON prompt that lists the fields and caps the text', () => {
  const spec = TASKS.extract({ text: 'x'.repeat(70000), fields: FIELDS, categories: ['Software'] });
  assert.equal(spec.effort, 'medium');
  assert.ok(spec.system.includes('"termEnd": YYYY-MM-DD'));
  assert.ok(spec.system.includes('one of: Software'));
  assert.ok(spec.system.includes('{"type":"end"}'));
  assert.ok(spec.user.length < 60100, 'document text is capped at 60,000 characters');
  assert.equal(spec.schema, undefined);
});

test('brief constrains the recommendation to the choices given', () => {
  const spec = TASKS.brief({ contract: { id: 'C-1', supplier: 'S' }, choices: [['renew', 'Let it renew'], ['exit', 'Leave']], situation: 's', fullText: 't' });
  assert.deepEqual(spec.schema.properties.recommendation.enum, ['renew', 'exit']);
  assert.ok(spec.system.includes('"renew" (Let it renew)'));
});

test('filter exposes only the known fields and operators', () => {
  const spec = TASKS.filter({ question: 'which contracts renew in the next 90 days', today: '2026-11-17' });
  assert.ok(spec.schema.properties.filters.items.properties.field.enum.includes('daysLeft'));
  assert.ok(!spec.schema.properties.filters.items.properties.field.enum.includes('text'));
  assert.ok(spec.system.includes('Today is 2026-11-17'));
});

test('invoice and ask cap their inputs', () => {
  assert.throws(() => TASKS.invoice({ text: 'short' }), /Paste the invoice/);
  const ask = TASKS.ask({ question: 'q', register: 'r', clauses: [{ cid: 'C-1001', sec: '3', supplier: 'S', text: 'clause' }], today: '2026-11-17', contracts: 10, unfiled: 3 });
  assert.ok(ask.user.includes('[C-1001 §3] (S) clause'));
  assert.ok(ask.system.includes('10 verified contracts. 3 signed documents'));
});

test('extract asks for the amendment changes clause by clause, right after the meta line', () => {
  const spec = TASKS.extract({ text: 'x'.repeat(300), fields: [{ k: 'surchargeCapPct', label: 'Surcharge cap (%)', type: 'num' }] });
  const i = spec.system.indexOf('"type":"amends"'), j = spec.system.indexOf('"type":"field"');
  assert.ok(i > 0 && i < j, 'the amends line comes before the field lines');
  assert.ok(spec.system.includes('clause by clause'));
  assert.ok(spec.system.includes('field "surchargeCapPct"'));
});

test('ask tells the model how to cite the register', () => {
  const spec = TASKS.ask({ question: 'q', register: 'r', clauses: [] });
  assert.ok(spec.system.includes('cite the contract id alone, like [C-1001]'));
});

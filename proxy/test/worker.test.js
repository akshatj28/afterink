import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

/* These run the worker's routing in Node with no key or a fake key. Network access is switched off,
   so no model is ever called: a call that gets that far fails at once, inside the stream. */
globalThis.fetch = async () => { throw new TypeError('fetch failed: network is off in tests'); };
const ORIGIN = 'http://localhost:8765';
const ctx = { waitUntil: () => {} };
const call = (path, { method = 'POST', body = '{}', origin = ORIGIN, env = {} } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  return worker.fetch(new Request('http://worker.test' + path, { method, headers, body: method === 'GET' ? undefined : body }), env, ctx);
};
const withKey = { GEMINI_API_KEY: 'test-key-not-real' };

test('names inherited from Object are not tasks', async () => {
  for (const name of ['constructor', 'tostring', 'valueof', 'hasownproperty']) {
    const r = await call('/v1/' + name, { env: withKey, body: JSON.stringify({ system: 'x', user: 'y', max_tokens: 99999 }) });
    assert.equal(r.status, 404, name);
  }
});

test('unknown routes and tasks are 404, a GET on a task is 405', async () => {
  assert.equal((await call('/v1/nope', { env: withKey })).status, 404);
  assert.equal((await call('/other', { env: withKey })).status, 404);
  assert.equal((await call('/v1/ask', { method: 'GET', env: withKey })).status, 405);
});

test('origins: a foreign origin is refused, a POST with no origin is refused, health works without one', async () => {
  assert.equal((await call('/v1/ask', { origin: 'https://evil.example', env: withKey })).status, 403);
  assert.equal((await call('/v1/ask', { origin: '', env: withKey })).status, 403);
  const h = await call('/v1/health', { method: 'GET', origin: '', env: withKey });
  assert.equal(h.status, 200);
  const j = await h.json();
  assert.equal(j.ok, true);
  assert.equal(j.provider, 'gemini');
  assert.ok(!JSON.stringify(j).includes('test-key-not-real'), 'health never echoes the key');
});

test('no key configured gives 503 on a task and ok:false on health', async () => {
  assert.equal((await call('/v1/ask')).status, 503);
  const j = await (await call('/v1/health', { method: 'GET' })).json();
  assert.equal(j.ok, false);
});

test('bad JSON, an empty body and an oversized body are rejected before any model call', async () => {
  assert.equal((await call('/v1/ask', { env: withKey, body: '{not json' })).status, 400);
  assert.equal((await call('/v1/ask', { env: withKey, body: '{}' })).status, 400);
  assert.equal((await call('/v1/ask', { env: withKey, body: 'x'.repeat(400001) })).status, 413);
});

test('a used-up daily budget refuses the call before it is made', async () => {
  const store = new Map([['budget:' + new Date().toISOString().slice(0, 10), '400000']]);
  const BUDGET = { get: async k => store.get(k) || null, put: async (k, v) => { store.set(k, v); } };
  const r = await call('/v1/ask', { env: { ...withKey, BUDGET }, body: JSON.stringify({ question: 'q', register: 'r', clauses: [] }) });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, 'budget');
});

test('the budget reserves the largest possible output before a call starts', async () => {
  const store = new Map();
  const BUDGET = { get: async k => store.get(k) || null, put: async (k, v) => { store.set(k, v); } };
  /* The fake key makes the model call fail later, inside the stream; the reservation must already be there. */
  const r = await call('/v1/ask', { env: { ...withKey, BUDGET }, body: JSON.stringify({ question: 'q', register: 'r', clauses: [] }) });
  assert.equal(r.status, 200);
  assert.equal(Number([...store.values()][0]), 2000, 'the ask task reserves its max_tokens');
});

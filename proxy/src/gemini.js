/* Provider adapter: Gemini through the Google AI Studio API (the one with a free tier).
   run() is an async generator: it yields text deltas and returns {model, in, out, stop}.

   GEMINI_MODELS is a comma-separated list tried in order. The next model is tried when one is over
   its quota (429), overloaded (503), not available to the key (404), or sends no text within
   GEMINI_FIRST_TEXT_MS. Once text has started to stream, the call stays on that model.

   The default order puts Flash-Lite first. In live tests on 22 November 2026 it read the bundled
   sample contract with every quote and value right in about four seconds, and its free daily
   allowance is far larger than Flash's. The Flash models were often overloaded, over their
   per-minute quota, or slow to start on the free tier, so they are the fallbacks. */

import { GoogleGenAI, ApiError } from '@google/genai';
import { Reject } from './common.js';

export const DEFAULT_MODELS = 'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.8-flash';
const FIRST_TEXT_MS = 20000;   // give up on a model that has sent nothing after this long
const TOTAL_MS = 110000;       // hard cap on one model's whole reply

class Slow extends Error { constructor(model, ms) { super(`${model} sent no text in ${ms} ms`); this.slow = true; } }

function mapError(e) {
  const status = e && e.status, msg = String((e && e.message) || e).slice(0, 300);
  console.error('gemini error', status || '', msg);
  if (e && e.slow) return new Reject('overloaded', 'Gemini is slow to answer right now. Try again in a minute.', 504);
  if (e instanceof ApiError || (e && typeof e.status === 'number')) {
    if (e.status === 429) return new Reject('rate_limited', "Gemini's free quota is used up for now. Try again in a minute, or later today.", 429);
    if (e.status === 503) return new Reject('overloaded', 'Gemini is overloaded right now. Try again in a minute.', 503);
    /* Google answers a bad key with 400 INVALID_ARGUMENT, so look at the reason as well as the status. */
    if (e.status === 401 || e.status === 403 || /API_KEY_INVALID|API key not valid/i.test(msg)) return new Reject('auth', 'The AI server is not configured with a valid key.', 502);
    if (e.status === 400) return new Reject('bad_request', 'The AI server rejected the request.', 502);
    return new Reject('upstream_error', `Gemini returned an error (${status}). Try again.`, 502);
  }
  if (e && /abort|fetch|network|ECONN|timeout/i.test(String(e.message))) return new Reject('upstream_error', 'The connection to Gemini dropped or timed out. Try again.', 502);
  return new Reject('upstream_error', 'Something went wrong. Try again.', 500);
}

/* Thinking depth. The Flash models think deeply by default, which made a document reading take over
   two minutes. LOW reads the bundled sample in about five seconds with every quote and value right,
   the same as MEDIUM at three times the wait. GEMINI_THINKING can change it (MINIMAL, LOW, MEDIUM, HIGH). */
const LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];
function config(spec, env, signal) {
  const want = String(env.GEMINI_THINKING || 'LOW').toUpperCase();
  const c = { systemInstruction: spec.system, maxOutputTokens: spec.max_tokens, thinkingConfig: { thinkingLevel: LEVELS.includes(want) ? want : 'LOW' }, abortSignal: signal };
  if (spec.schema) { c.responseMimeType = 'application/json'; c.responseJsonSchema = spec.schema; }
  return c;
}

async function* once(ai, model, spec, env) {
  const firstMs = Number(env.GEMINI_FIRST_TEXT_MS) || FIRST_TEXT_MS;
  const ctl = new AbortController();
  let slow = false, gotText = false;
  const firstTimer = setTimeout(() => { if (!gotText) { slow = true; ctl.abort(); } }, firstMs);
  const totalTimer = setTimeout(() => ctl.abort(), TOTAL_MS);
  try {
    const res = await ai.models.generateContentStream({ model, contents: spec.user, config: config(spec, env, ctl.signal) });
    let last = null;
    for await (const chunk of res) {
      const t = chunk.text;
      if (t) { gotText = true; yield t; }
      last = chunk;
    }
    const u = (last && last.usageMetadata) || {};
    const fr = last && last.candidates && last.candidates[0] && last.candidates[0].finishReason;
    const stop = fr === 'MAX_TOKENS' ? 'truncated' : (fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT' || fr === 'BLOCKLIST') ? 'refusal' : 'end';
    /* Thinking tokens are billed as output, so they count towards the budget and the call log. */
    return { model, in: u.promptTokenCount || 0, out: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), stop };
  } catch (e) {
    if (slow) throw new Slow(model, firstMs);
    throw e;
  } finally { clearTimeout(firstTimer); clearTimeout(totalTimer); }
}

export async function* run(spec, env) {
  const models = String(env.GEMINI_MODELS || env.GEMINI_MODEL || DEFAULT_MODELS).split(',').map(s => s.trim()).filter(Boolean);
  /* One HTTP attempt per model: the fallback list does the retrying, so a busy model costs seconds,
     not the SDK's half-minute of backoff. */
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: TOTAL_MS + 5000, retryOptions: { attempts: 1 } } });
  /* Up to three passes over the list. Free-tier demand spikes are usually short, so when every model is
     busy, a pause (3 seconds, then 6) and another pass gets most calls through. A model missing for this
     key (404) is skipped on later passes. */
  const PAUSE_MS = Number(env.GEMINI_RETRY_PAUSE_MS) || 3000;
  const missing = new Set();
  let lastErr = null;
  for (let pass = 0; pass < 3; pass++) {
    if (pass) { console.error('gemini: every model busy, trying again in', PAUSE_MS, 'ms'); await new Promise(r => setTimeout(r, PAUSE_MS * pass)); }
    for (let i = 0; i < models.length; i++) {
      if (missing.has(models[i])) continue;
      let started = false;
      try {
        const gen = once(ai, models[i], spec, env);
        let r;
        while (!(r = await gen.next()).done) { started = true; yield r.value; }
        return r.value;
      } catch (e) {
        lastErr = e;
        /* Move on only when nothing has been streamed yet, so the viewer never sees two answers spliced. */
        const st = e && e.status, next = e.slow || st === 429 || st === 503 || st === 404 || st === 500;
        if (!next || started) throw mapError(e);
        if (st === 404) missing.add(models[i]);
        console.error('gemini', models[i], 'unavailable (' + (e.slow ? 'slow to start' : st) + ')');
      }
    }
  }
  throw mapError(lastErr);
}

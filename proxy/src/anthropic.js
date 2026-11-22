/* Provider adapter: Claude through the Anthropic API.
   run() is an async generator: it yields text deltas and returns {model, in, out, stop}. */

import Anthropic from '@anthropic-ai/sdk';
import { Reject } from './common.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

function mapError(e) {
  if (e instanceof Anthropic.RateLimitError) return new Reject('rate_limited', 'Claude is busy. Try again in a minute.', 429);
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new Reject('auth', 'The AI server is not configured with a valid key.', 502);
  if (e instanceof Anthropic.BadRequestError) return new Reject('bad_request', 'The AI server rejected the request.', 502);
  if (e instanceof Anthropic.APIConnectionError) return new Reject('upstream_error', 'The connection to Claude dropped. Try again.', 502);
  if (e instanceof Anthropic.APIError) return new Reject('upstream_error', 'Claude returned an error. Try again.', 502);
  return new Reject('upstream_error', 'Something went wrong. Try again.', 500);
}

function params(spec, model) {
  const p = {
    model, max_tokens: spec.max_tokens, system: spec.system,
    messages: [{ role: 'user', content: spec.user }],
    output_config: { effort: spec.effort || 'low' },
    /* A policy refusal re-runs on a fallback model inside the same call, routed by refusal
       category, so a reading never silently stops. */
    betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default'
  };
  if (spec.schema) p.output_config.format = { type: 'json_schema', schema: spec.schema };
  return p;
}

/* Yields the text of one streamed reply. If the model declines part-way and the server-side fallback
   takes over, the text already sent belongs to a different answer, so the call fails instead of
   splicing two answers together. A decline before any text simply carries on with the fallback. */
async function* pump(stream) {
  let sent = false;
  for await (const ev of stream) {
    if (ev.type === 'content_block_start' && ev.content_block && ev.content_block.type === 'fallback' && sent) throw new Reject('refused', 'The model declined part-way through. Try again.', 502);
    if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { sent = true; yield ev.delta.text; }
  }
}

export async function* run(spec, env) {
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 180000 });
  let p = params(spec, model), stream, final;
  try {
    stream = client.beta.messages.stream(p);
    yield* pump(stream);
    final = await stream.finalMessage();
  } catch (e) {
    if (e instanceof Reject) throw e;
    /* If the API objected to the structured-output schema itself, try once as plain JSON text. */
    if (spec.schema && e instanceof Anthropic.BadRequestError && /schema|output_config|format/i.test(String(e.message))) {
      delete p.output_config.format;
      try {
        stream = client.beta.messages.stream(p);
        yield* pump(stream);
        final = await stream.finalMessage();
      } catch (e2) { throw e2 instanceof Reject ? e2 : mapError(e2); }
    } else throw mapError(e);
  }
  const u = final.usage || {};
  return { model: final.model || model, in: u.input_tokens || 0, out: u.output_tokens || 0, stop: final.stop_reason === 'refusal' ? 'refusal' : final.stop_reason === 'max_tokens' ? 'truncated' : 'end' };
}

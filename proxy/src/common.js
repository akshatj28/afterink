/* Small shared helpers for the Afterink AI server. */

export class Reject extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status || 400; }
}

export const str = (v, max, d) => (v == null ? (d == null ? '' : d) : String(v)).slice(0, max);
export const num = v => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
export const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
export const list = (v, max, each) => arr(v, max).map(x => str(x, each)).filter(Boolean);

/* Human names for the model ids the server may run. Anything else is shown as its id. */
export const MODEL_NAMES = {
  'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5',
  'gemini-4-hydrogen': 'Gemini 4 Hydrogen', 'gemini-3.8-flash': 'Gemini 3.8 Flash', 'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite', 'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite', 'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite'
};
export const modelName = id => MODEL_NAMES[id] || id;

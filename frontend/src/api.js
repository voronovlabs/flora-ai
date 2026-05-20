// Thin wrappers over the backend HTTP API.
//
// All paths are relative so Caddy / nginx routing continues to work
// unchanged in production. Every call:
//   • accepts an AbortSignal for cancellation,
//   • surfaces a uniform { ok, status, text, payload } shape,
//   • never throws on HTTP errors — only on network / abort errors.

const DEFAULT_TIMEOUT_MS = 30_000;

async function postJSON(url, body, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (signal) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const t = setTimeout(() => ctl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (_) { /* not JSON */ }
    return { ok: r.ok, status: r.status, text, payload };
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

async function getJSON(url, { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (signal) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const t = setTimeout(() => ctl.abort(), timeoutMs);

  try {
    const r = await fetch(url, { signal: ctl.signal });
    const text = await r.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (_) { /* not JSON */ }
    return { ok: r.ok, status: r.status, text, payload };
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export function getStats(opts) {
  // Preserves the old call-site that did `.then(j => …)` — we return
  // the JSON payload directly so renderStatsBox keeps working.
  return getJSON('/stats', opts).then(({ payload }) => payload || { ok: false });
}

export function askPreset(presetId, opts) {
  return postJSON('/ask', { preset: presetId }, opts);
}

export function askSmart(question, opts) {
  return postJSON('/smart', { question }, opts);
}

// Thin wrappers over backend HTTP API.
// IMPORTANT: paths are relative so that Caddy / reverse-proxy routing
// continues to work unchanged in production.

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch (e) { /* ignore */ }
  return { ok: r.ok, status: r.status, text, payload };
}

export function getStats() {
  return fetch('/stats').then((r) => r.json());
}

export function askPreset(presetId) {
  return postJSON('/ask', { preset: presetId });
}

export function askSmart(question) {
  return postJSON('/smart', { question });
}

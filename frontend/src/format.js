// Pure formatting helpers. No DOM access, no I/O.

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateISO(s) {
  // YYYY-MM-DD -> DD-MM-YYYY
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s || ''));
  if (!m) return String(s || '');
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function fmtInt(v) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? '');
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
}

export function fmtMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return String(v ?? '');
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
}

export function normalizeSource(s) {
  if (!s) return '';
  if (s === 'florist_ru') return 'florist.ru';
  return String(s);
}

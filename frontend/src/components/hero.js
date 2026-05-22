// Hero / command-center component: keeps the three live chips
// (SKU · конкурентов · обновлено) in sync with store.stats.
//
// No store/action/reducer changes — subscribes to existing select.stats,
// which is already populated by app.js bootStats() once at boot.
//
// Browser-compat: no spread/rest, no destructuring inside non-loops, no
// optional chaining inside expressions; aligned with reducers.js.

import { store, select } from '../state/store.js';
import { fmtInt, fmtDateISO } from '../format.js';

function setChip(host, key, value) {
  const chip = host.querySelector('[data-chip="' + key + '"]');
  if (!chip) return;
  const v = chip.querySelector('.hero-chip__value');
  if (v) v.textContent = value;
}

function applyStats(host, stats) {
  if (!host) return;
  if (!stats || !stats.loaded) {
    setChip(host, 'sku', '—');
    setChip(host, 'competitors', '—');
    setChip(host, 'snapshot', '…');
    return;
  }
  setChip(host, 'sku',         fmtInt(stats.total_sku || 0));
  setChip(host, 'competitors', fmtInt((stats.sources || []).length));
  setChip(host, 'snapshot',    stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—');
}

export function mountHero(host) {
  if (!host) return;
  const chips = host.querySelector('#heroChips') || host;
  applyStats(chips, select.stats(store.getState()));
  store.subscribeSlice(select.stats, function (s) { applyStats(chips, s); });
}

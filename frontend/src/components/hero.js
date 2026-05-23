// Hero / command-center component:
//   • держит три live-chip'а (SKU · конкурентов · обновлено) в синхроне
//     с store.stats;
//   • заполняет компактную строку «N магазинов · M товаров под
//     наблюдением» (#heroLive) — пересказывает чипы человеческим
//     языком, чтобы hero ощущался как живая система, а не дашборд.
//
// Не меняет ни store, ни actions, ни reducers — подписка на
// существующий select.stats.
//
// Browser-compat: без spread/rest, без optional chaining.

import { store, select } from '../state/store.js';
import { fmtInt, fmtDateISO } from '../format.js';

function setChip(host, key, value) {
  const chip = host.querySelector('[data-chip="' + key + '"]');
  if (!chip) return;
  const v = chip.querySelector('.hero-chip__value');
  if (v) v.textContent = value;
}

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function applyStats(chipsHost, liveEl, stats) {
  if (chipsHost) {
    if (!stats || !stats.loaded) {
      setChip(chipsHost, 'sku', '—');
      setChip(chipsHost, 'competitors', '—');
      setChip(chipsHost, 'snapshot', '…');
    } else {
      setChip(chipsHost, 'sku',         fmtInt(stats.total_sku || 0));
      setChip(chipsHost, 'competitors', fmtInt((stats.sources || []).length));
      setChip(chipsHost, 'snapshot',    stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—');
    }
  }
  if (liveEl) {
    if (!stats || !stats.loaded) {
      liveEl.textContent = 'Подключаюсь к источникам данных…';
      liveEl.removeAttribute('data-ready');
    } else {
      const shops = (stats.sources || []).length;
      const sku   = stats.total_sku || 0;
      const parts = [];
      if (shops > 0) parts.push(fmtInt(shops) + ' ' + plural(shops, 'магазин', 'магазина', 'магазинов'));
      if (sku   > 0) parts.push(fmtInt(sku)   + ' ' + plural(sku,   'товар',   'товара',   'товаров'));
      // "Отслеживается N магазинов · M товаров" — без слова «под наблюдением»,
      // покороче и без «зависшего» loading-текста после загрузки.
      liveEl.textContent = parts.length
        ? 'Отслеживается ' + parts.join(' · ')
        : 'Данные загружены.';
      liveEl.setAttribute('data-ready', 'true');
    }
  }
}

export function mountHero(host) {
  if (!host) return;
  const chips  = host.querySelector('#heroChips') || host;
  const liveEl = host.querySelector('#heroLive');
  applyStats(chips, liveEl, select.stats(store.getState()));
  store.subscribeSlice(select.stats, function (s) { applyStats(chips, liveEl, s); });
}

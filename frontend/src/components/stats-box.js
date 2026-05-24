// "Подключённые магазины" — карточка справа.
//
// This turn:
//   • Каждая строка теперь кликабельная: <a href="{site_url || https://domain}">
//     открывается в новой вкладке. Если URL нет — рендерится <div>.
//   • Имя строки = brand_name || source (brand_name приходит из
//     ref.shop_directory через backend); сырой домен — в title= для tooltip.
//   • Для длинных названий: text-overflow: ellipsis + native browser
//     tooltip через атрибут title (без новых библиотек).
//   • Toggle "Показать ещё N магазинов" / "Свернуть список" вынесен на
//     глобальный data-action="toggle-coverage" делегатор в app.js —
//     избавляет от риска потери click-handler'а при пере-рендере.
//
// Подписан только на select.stats — структура данных не трогается.

import { fmtInt, fmtDateISO, escapeHtml } from '../format.js';
import { store, select } from '../state/store.js';

const DEFAULT_VISIBLE = 5;

let host = null;
let expanded = false;
let sortedSources = [];

function setMeta(text) {
  const m = document.getElementById('coverageMeta');
  if (m) m.textContent = text;
}

function renderEmpty() {
  if (!host) return;
  host.innerHTML = '<div class="coverage-empty">Не удалось загрузить покрытие.</div>';
}

function shopLabel(s) {
  if (s && s.brand_name) return String(s.brand_name);
  if (s && s.source) return String(s.source);
  return '—';
}

function shopHref(s) {
  if (!s) return null;
  if (s.site_url && /^https?:\/\//i.test(String(s.site_url))) return String(s.site_url);
  if (s.source && String(s.source).indexOf('.') > 0) return 'https://' + String(s.source);
  return null;
}

function rowHtml(s, max) {
  const count = s.sku_count || 0;
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  const label = shopLabel(s);
  const tooltip = s.brand_name && s.source ? String(s.source) : label;
  const href = shopHref(s);

  const inner =
    '<span class="coverage-row__name" title="' + escapeHtml(tooltip) + '">' +
      escapeHtml(label) +
    '</span>' +
    '<div class="coverage-row__bar">' +
      '<div class="coverage-row__fill" style="width:' + pct + '%"></div>' +
    '</div>' +
    '<span class="coverage-row__value">' + fmtInt(count) + '</span>';

  if (href) {
    return '<a class="coverage-row coverage-row--link" href="' + escapeHtml(href) +
      '" target="_blank" rel="noopener">' + inner + '</a>';
  }
  return '<div class="coverage-row">' + inner + '</div>';
}

function paint() {
  if (!host) return;
  if (!sortedSources.length) {
    host.innerHTML = '<div class="coverage-empty">Источники пока не подключены.</div>';
    setMeta('—');
    return;
  }
  const max = Math.max.apply(null, sortedSources.map(function (s) { return s.sku_count || 0; }));
  const visible = expanded ? sortedSources : sortedSources.slice(0, DEFAULT_VISIBLE);
  const rowsHtml = visible.map(function (s) { return rowHtml(s, max); }).join('');

  const total = sortedSources.length;
  const remaining = total - DEFAULT_VISIBLE;
  let toggleHtml = '';
  if (remaining > 0) {
    // Toggle используется через event-delegation (см. app.js); никаких
    // локальных click-обработчиков, которые ломаются при перерисовке.
    const label = expanded
      ? 'Свернуть список'
      : 'Показать ещё ' + fmtInt(remaining) + ' ' + pluralShops(remaining);
    toggleHtml = '<button type="button" class="coverage-toggle" ' +
      'data-action="toggle-coverage" ' +
      'aria-expanded="' + (expanded ? 'true' : 'false') + '">' +
      escapeHtml(label) +
      '</button>';
  }

  const stats = select.stats(store.getState()) || {};
  host.innerHTML =
    '<div class="coverage-list">' + rowsHtml + '</div>' +
    toggleHtml +
    '<div class="coverage-summary">' +
      '<span class="coverage-summary__total"><strong>' + fmtInt(stats.total_sku || 0) + '</strong> позиций</span>' +
      '<span class="coverage-summary__sep">·</span>' +
      '<span class="coverage-summary__date">обновлено ' +
        (stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—') +
      '</span>' +
    '</div>';

  setMeta(total === 1 ? '1 источник' : total + ' источников');
}

function pluralShops(n) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return 'магазинов';
  if (last === 1) return 'магазин';
  if (last >= 2 && last <= 4) return 'магазина';
  return 'магазинов';
}

function applyStats(stats) {
  if (!stats || !stats.loaded) return renderEmpty();
  sortedSources = (stats.sources || []).slice().sort(function (a, b) {
    return (b.sku_count || 0) - (a.sku_count || 0);
  });
  paint();
}

// Toggle handler called by event-delegation (app.js). Module-scope
// `expanded` is the source of truth; re-paints from current sortedSources.
export function toggleCoverage() {
  expanded = !expanded;
  paint();
}

export function mountStatsBox(hostEl) {
  host = hostEl;
  if (!host) return;
  host.innerHTML = '<div class="coverage-skeleton">Загружаю покрытие…</div>';
  applyStats(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStats);
}

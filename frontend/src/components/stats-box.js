// "Подключённые магазины" card body. Renders a tiny bar visualisation
// of each source's SKU count, relative to the leader.
//
// This turn: список сворачиваемый. По умолчанию показываем первые 5
// строк + кнопку «Показать все»; после раскрытия — все строки +
// кнопку «Скрыть». Состояние локальное (не в store) — это чистый UI
// toggle без бизнес-эффектов.
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

function rowHtml(s, max) {
  const count = s.sku_count || 0;
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
  return (
    '<div class="coverage-row">' +
      '<span class="coverage-row__name" title="' + escapeHtml(String(s.source)) + '">' +
        escapeHtml(String(s.source)) +
      '</span>' +
      '<div class="coverage-row__bar">' +
        '<div class="coverage-row__fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<span class="coverage-row__value">' + fmtInt(count) + '</span>' +
    '</div>'
  );
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
    const moreLabel = 'Показать ещё ' + fmtInt(remaining) + ' ' +
      pluralShops(remaining);
    toggleHtml = '<button type="button" class="coverage-toggle" data-coverage-toggle>' +
      (expanded ? 'Скрыть' : escapeHtml(moreLabel)) +
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

  const btn = host.querySelector('[data-coverage-toggle]');
  if (btn) {
    btn.addEventListener('click', function () {
      expanded = !expanded;
      paint();
    });
  }

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

export function mountStatsBox(hostEl) {
  host = hostEl;
  if (!host) return;
  host.innerHTML = '<div class="coverage-skeleton">Загружаю покрытие…</div>';
  applyStats(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStats);
}

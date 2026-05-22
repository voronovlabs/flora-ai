// "Live data coverage" card body. Renders a tiny bar visualisation of
// each source's SKU count, relative to the leader.
//
// Subscribes to select.stats — does NOT change the store contract.

import { fmtInt, fmtDateISO, escapeHtml } from '../format.js';
import { store, select } from '../state/store.js';

let host = null;

function setMeta(text) {
  const m = document.getElementById('coverageMeta');
  if (m) m.textContent = text;
}

function renderEmpty() {
  if (!host) return;
  host.innerHTML = '<div class="coverage-empty">Не удалось загрузить покрытие.</div>';
}

function renderLoaded(stats) {
  if (!host) return;
  const sources = (stats.sources || []).slice().sort(function (a, b) {
    return (b.sku_count || 0) - (a.sku_count || 0);
  });

  if (sources.length === 0) {
    host.innerHTML = '<div class="coverage-empty">Источники пока не подключены.</div>';
    setMeta('—');
    return;
  }

  const max = Math.max.apply(null, sources.map(function (s) { return s.sku_count || 0; }));
  const visible = sources.slice(0, 8);

  const rows = visible.map(function (s) {
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
  }).join('');

  const more = sources.length > visible.length
    ? '<div class="coverage-more">и ещё ' + fmtInt(sources.length - visible.length) + ' источн.</div>'
    : '';

  host.innerHTML =
    '<div class="coverage-list">' + rows + more + '</div>' +
    '<div class="coverage-summary">' +
      '<span class="coverage-summary__total"><strong>' + fmtInt(stats.total_sku || 0) + '</strong> позиций</span>' +
      '<span class="coverage-summary__sep">·</span>' +
      '<span class="coverage-summary__date">обновлено ' +
        (stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—') +
      '</span>' +
    '</div>';

  setMeta((sources.length === 1 ? '1 источник' : sources.length + ' источников'));
}

export function mountStatsBox(hostEl) {
  host = hostEl;
  if (!host) return;
  // Loading placeholder until /stats resolves.
  host.innerHTML = '<div class="coverage-skeleton">Загружаю покрытие…</div>';

  store.subscribeSlice(select.stats, function (stats) {
    if (!stats || !stats.loaded) return renderEmpty();
    renderLoaded(stats);
  });
}

// Results summary — a small "Результат анализа" header above the table.
// Subscribes to store.results.data; recomputes the counts on every
// update. Doesn't touch the renderer contract — the actual table is
// still drawn by tableRenderer into #resultsContent.

import { store, select } from '../state/store.js';
import { fmtInt, fmtDateISO, escapeHtml } from '../format.js';

let host = null;

function apply(data) {
  if (!host) return;
  if (!Array.isArray(data) || data.length === 0) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  const sources = {};
  data.forEach(function (row) {
    if (row && row.source !== null && row.source !== undefined) {
      sources[String(row.source)] = true;
    }
  });
  const sourceCount = Object.keys(sources).length;
  const stats = select.stats(store.getState());
  const snap = (stats && stats.snapshot_date) ? fmtDateISO(stats.snapshot_date) : '—';

  host.hidden = false;
  host.innerHTML =
    '<div class="results-summary__title">Результат анализа</div>' +
    '<div class="results-summary__row">' +
      '<span class="results-summary__metric"><strong>' + fmtInt(sourceCount) + '</strong> ' + escapeHtml(plural(sourceCount, 'магазин', 'магазина', 'магазинов')) + '</span>' +
      '<span class="results-summary__sep">·</span>' +
      '<span class="results-summary__metric"><strong>' + fmtInt(data.length) + '</strong> ' + escapeHtml(plural(data.length, 'позиция', 'позиции', 'позиций')) + '</span>' +
      '<span class="results-summary__sep">·</span>' +
      '<span class="results-summary__date">обновлено ' + escapeHtml(snap) + '</span>' +
    '</div>';
}

// Russian plural form picker (1 магазин / 2 магазина / 5 магазинов)
function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const lastTwo = abs;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function mountResultsSummary(hostEl) {
  host = hostEl;
  if (!host) return;
  apply(select.resultsData(store.getState()));
  store.subscribeSlice(select.resultsData, apply);
}

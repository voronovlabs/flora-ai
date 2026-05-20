// "Источники данных" — subscribes to stats slice and re-renders.

import { fmtInt, fmtDateISO } from '../format.js';
import { store, select } from '../state/store.js';

let host = null;

function renderEmpty() {
  if (!host) return;
  host.innerHTML = `
    <div style="font-size:14px; color: var(--text-secondary); line-height:1.6;">
      Не удалось загрузить статистику.
    </div>
  `;
}

function renderLoaded(stats) {
  if (!host) return;
  const lines = (stats.sources || []).slice(0, 6).map((s) =>
    `${String(s.source)} — ${fmtInt(s.sku_count)} позиций`,
  );
  const more = (stats.sources || []).length > 6
    ? `<div style="margin-top:6px; color: var(--text-tertiary);">и ещё ${fmtInt(stats.sources.length - 6)} источн.</div>`
    : '';
  host.innerHTML = `
    <div style="font-size:14px; color: var(--text-secondary); line-height:1.6;">
      ${lines.map((x) => `<div>${x}</div>`).join('')}
      ${more}
      <div style="margin-top:10px;">
        <strong>Всего:</strong> ${stats.total_sku ? fmtInt(stats.total_sku) : '—'} позиций
      </div>
      <div>
        <strong>Данные за:</strong> ${stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—'}
      </div>
    </div>
  `;
}

export function mountStatsBox(hostEl) {
  host = hostEl;
  // Loading placeholder; replaced after /stats resolves.
  host.innerHTML = 'Загружаю статистику…';

  store.subscribeSlice(select.stats, (stats) => {
    if (!stats || !stats.loaded) return renderEmpty();
    renderLoaded(stats);
  });
}

// "Источники данных" box in the right-side panel.

import { fmtInt, fmtDateISO } from '../format.js';

export function renderStatsBox(payload) {
  const box = document.getElementById('statsBox');
  if (!box) return;

  if (!payload || !payload.ok) {
    box.innerHTML = `
      <div style="font-size:14px; color: var(--text-secondary); line-height:1.6;">
        Не удалось загрузить статистику.
      </div>
    `;
    return;
  }

  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const snap = payload.snapshot_date ? String(payload.snapshot_date) : null;
  const total = payload.total_sku ?? null;

  const lines = sources.slice(0, 6).map((s) =>
    `${String(s.source)} — ${fmtInt(s.sku_count)} позиций`,
  );

  const more = sources.length > 6
    ? `<div style="margin-top:6px; color: var(--text-tertiary);">и ещё ${fmtInt(sources.length - 6)} источн.</div>`
    : '';

  box.innerHTML = `
    <div style="font-size:14px; color: var(--text-secondary); line-height:1.6;">
      ${lines.map((x) => `<div>${x}</div>`).join('')}
      ${more}
      <div style="margin-top:10px;">
        <strong>Всего:</strong> ${total !== null ? fmtInt(total) : '—'} позиций
      </div>
      <div>
        <strong>Данные за:</strong> ${snap ? fmtDateISO(snap) : '—'}
      </div>
    </div>
  `;
}

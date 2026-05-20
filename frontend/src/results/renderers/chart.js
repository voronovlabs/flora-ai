// Chart renderer — placeholder.
//
// Wired into the registry so the renderer-swap code path is real and
// exercised, but the actual visualization is intentionally a stub. When
// we adopt a charting library (Chart.js, ECharts) this file becomes the
// only place that knows about it.

import { escapeHtml } from '../../format.js';

export const chartRenderer = {
  name: 'chart',

  render(host, data) {
    const rows = Array.isArray(data) ? data : [];
    host.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📈</div>
        <div class="empty-text">
          Chart view is not yet implemented.<br/>
          ${escapeHtml(String(rows.length))} rows ready for visualization.
        </div>
      </div>
    `;
  },
};

// Right-side results panel — delegates rendering to the renderer
// registry and the mobile panel-open state to the store.

import { store, select } from '../state/store.js';
import { togglePanel, setPanelOpen } from '../state/actions.js';
import { getRenderer, registerRenderer } from '../results/renderer.js';
import { tableRenderer } from '../results/renderers/table.js';
import { chartRenderer } from '../results/renderers/chart.js';
import { insightRenderer } from '../results/renderers/insight.js';
import { exporter } from '../results/exporter.js';

// Register built-in renderers exactly once.
registerRenderer('table', tableRenderer);
registerRenderer('chart', chartRenderer);
registerRenderer('insight', insightRenderer);

let panelEl = null;
let contentEl = null;
let overlayEl = null;

function repaint() {
  if (!contentEl) return;
  const { data, renderer } = select.results(store.getState());
  const impl = getRenderer(renderer);
  if (!data || data.length === 0) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">Здесь будут отображаться результаты ваших запросов</div>
      </div>
    `;
    return;
  }
  impl.render(contentEl, data, {});
}

function syncPanelClasses() {
  if (!panelEl || !overlayEl) return;
  const open = select.panelOpen(store.getState());
  panelEl.classList.toggle('open', open);
  overlayEl.classList.toggle('active', open);
}

export function mountResultsPanel({ panel, content, overlay }) {
  panelEl = panel;
  contentEl = content;
  overlayEl = overlay;

  repaint();
  syncPanelClasses();

  store.subscribeSlice(select.results, repaint);
  store.subscribeSlice(select.panelOpen, syncPanelClasses);

  // Auto-open on first dataset arrival on mobile, preserving legacy UX.
  store.subscribeSlice(select.resultsData, (data, prev) => {
    const hadData = Array.isArray(prev) && prev.length > 0;
    const hasData = Array.isArray(data) && data.length > 0;
    if (!hadData && hasData && window.innerWidth <= 1024) {
      store.dispatch(setPanelOpen(true));
    }
  });
}

// Actions exposed to the event-delegation layer in app.js.
export function togglePanelAction() { store.dispatch(togglePanel()); }
export function downloadCsv() { exporter.csv(select.resultsData(store.getState())); }

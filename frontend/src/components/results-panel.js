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
// Mobile-only auto-open is a courtesy on the FIRST dataset arrival.
// After that, the user is in control: any manual close (mobile tab,
// overlay tap, ✕ button) sticks, and subsequent results don't override
// their decision.
let autoOpenedOnce = false;
let prevPanelOpen = false;

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
  prevPanelOpen = select.panelOpen(store.getState());

  store.subscribeSlice(select.results, repaint);
  store.subscribeSlice(select.panelOpen, (open) => {
    syncPanelClasses();
    // Detect a manual close: panel goes from open → closed. Once that
    // happens we permanently disable the courtesy auto-open below so
    // the panel doesn't keep popping back on every new dataset.
    if (prevPanelOpen && !open) autoOpenedOnce = true;
    prevPanelOpen = open;
  });

  // Auto-open on first dataset arrival on mobile, ONCE. After the user
  // has either closed the panel manually or the courtesy has fired,
  // `autoOpenedOnce` is true and we leave the panel state alone.
  store.subscribeSlice(select.resultsData, (data, prev) => {
    if (autoOpenedOnce) return;
    const hadData = Array.isArray(prev) && prev.length > 0;
    const hasData = Array.isArray(data) && data.length > 0;
    if (!hadData && hasData && window.innerWidth <= 1024) {
      autoOpenedOnce = true;
      store.dispatch(setPanelOpen(true));
    }
  });
}

// Actions exposed to the event-delegation layer in app.js.
export function togglePanelAction() { store.dispatch(togglePanel()); }
export function downloadCsv() { exporter.csv(select.resultsData(store.getState())); }

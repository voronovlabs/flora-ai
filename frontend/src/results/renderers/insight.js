// AI insight renderer — placeholder.
//
// Future: this view will surface model-generated summaries, anomalies,
// and recommended actions next to the raw table. Wiring lives here so
// the engine can dispatch `RESULTS_RENDERER_SET` with name="insight"
// and the panel will switch over without further changes.

export const insightRenderer = {
  name: 'insight',

  render(host, data, ctx) {
    const summary = (ctx && ctx.meta && ctx.meta.summary) || '';
    host.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔎</div>
        <div class="empty-text">
          ${summary ? summary : 'AI insights view is not yet implemented.'}
        </div>
      </div>
    `;
  },
};

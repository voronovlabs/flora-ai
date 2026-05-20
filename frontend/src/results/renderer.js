// Renderer registry for the right-side results panel.
//
// Goals:
//   • One mounting point in the DOM, swappable rendering strategies.
//   • Future-friendly: charts, AI insights, comparisons, recommendations
//     all plug in by registering a new renderer here.
//   • Today only "table" is fully implemented; "chart" and "insight"
//     are stubs so the boundary is real, not theoretical.
//
// API:
//   registerRenderer(name, renderer): renderer has a single method:
//      render(host: HTMLElement, data: any, ctx?: { meta? }): void
//   getRenderer(name): returns the renderer, or 'table' as the default.

const registry = new Map();

export function registerRenderer(name, renderer) {
  if (!name || typeof renderer.render !== 'function') {
    throw new Error('registerRenderer: name + {render} required');
  }
  registry.set(name, renderer);
}

export function getRenderer(name) {
  return registry.get(name) || registry.get('table');
}

export function listRenderers() {
  return Array.from(registry.keys());
}

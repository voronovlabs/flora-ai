// Tiny synchronous pub/sub. ~20 lines on purpose — no dependencies, no
// magic. Used by the store to broadcast state changes and by components
// to react to chat / results / UI events.
//
// Conventions for event names:
//   "chat:*"      — chat lifecycle (message added, request started, …)
//   "results:*"   — right-panel data updates
//   "stats:*"     — sources/snapshot box updates
//   "ui:*"        — purely visual state (panel open/close, debug toggle)
//   "state:*"     — store-level meta events ("state:changed", …)

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, fn) {
    if (typeof fn !== 'function') return () => {};
    const set = this._listeners.get(event) || new Set();
    set.add(fn);
    this._listeners.set(event, set);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;
    // Snapshot so subscribers added during dispatch don't fire this round.
    Array.from(set).forEach((fn) => {
      try { fn(payload); } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[event-bus] handler for "${event}" threw:`, err);
      }
    });
  }

  // For tests / hot-reload.
  clear() { this._listeners.clear(); }
}

export const bus = new EventBus();

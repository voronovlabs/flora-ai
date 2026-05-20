// Single source of truth for the app's initial state. Keep this file
// SHALLOW and EXPLICIT — every reducer must produce a shape compatible
// with what's described here.

export const initialState = Object.freeze({
  chat: {
    // Ordered list of messages. See chat/types.js for the canonical
    // Message shape.
    messages: [],
    // The id of the message currently being awaited (null when idle).
    pendingMessageId: null,
  },

  results: {
    data: null,              // Array<Row> | null
    renderer: 'table',       // 'table' | 'chart' | 'insight' (chart/insight are future)
    lastUpdatedAt: null,     // ms epoch
  },

  stats: {
    loaded: false,
    snapshot_date: null,
    total_sku: 0,
    sources: [],
  },

  ui: {
    panelOpen: false,        // mobile right-panel
    debug: false,            // synced with logger.isDebugMode() on boot
  },
});

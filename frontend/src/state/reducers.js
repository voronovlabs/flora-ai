// Pure reducer: (state, action) => state.
// No I/O, no DOM, no fetch. Side-effects belong in the chat engine.

import * as A from './actions.js';

function chat(state, action) {
  switch (action.type) {
    case A.CHAT_MESSAGE_APPENDED:
      return { ...state, messages: state.messages.concat(action.payload) };

    case A.CHAT_MESSAGE_PATCHED: {
      const { id, patch } = action.payload;
      const messages = state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
      return { ...state, messages };
    }

    case A.CHAT_REQUEST_STARTED:
      return { ...state, pendingMessageId: action.payload.id };

    case A.CHAT_REQUEST_RESOLVED:
    case A.CHAT_REQUEST_FAILED:
    case A.CHAT_REQUEST_CANCELED:
      return { ...state, pendingMessageId: null };

    case A.CHAT_CLEARED:
      return { ...state, messages: [], pendingMessageId: null };

    default:
      return state;
  }
}

function results(state, action) {
  switch (action.type) {
    case A.RESULTS_SET:
      return {
        ...state,
        data: action.payload.data || [],
        lastUpdatedAt: Date.now(),
      };
    case A.RESULTS_CLEARED:
      return { ...state, data: null, lastUpdatedAt: Date.now() };
    case A.RESULTS_RENDERER_SET:
      return { ...state, renderer: action.payload.renderer };
    default:
      return state;
  }
}

function stats(state, action) {
  switch (action.type) {
    case A.STATS_LOADED: {
      const p = action.payload || {};
      return {
        ...state,
        loaded: true,
        snapshot_date: p.snapshot_date || null,
        total_sku: p.total_sku || 0,
        sources: Array.isArray(p.sources) ? p.sources : [],
      };
    }
    case A.STATS_FAILED:
      return { ...state, loaded: false };
    default:
      return state;
  }
}

function ui(state, action) {
  switch (action.type) {
    case A.UI_PANEL_TOGGLED:
      return { ...state, panelOpen: !state.panelOpen };
    case A.UI_PANEL_SET:
      return { ...state, panelOpen: !!action.payload.open };
    case A.UI_DEBUG_SET:
      return { ...state, debug: !!action.payload.on };
    default:
      return state;
  }
}

export function rootReducer(state, action) {
  return {
    chat:    chat(state.chat, action),
    results: results(state.results, action),
    stats:   stats(state.stats, action),
    ui:      ui(state.ui, action),
  };
}

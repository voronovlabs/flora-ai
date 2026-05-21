// Pure reducer: (state, action) => state.
// No I/O, no DOM, no fetch. Side-effects belong in the chat engine.
//
// Browser-compat note: this file deliberately uses Object.assign(...) and
// Array#concat instead of object/array spread so it parses in older
// engines that don't accept the `...` token in expression position.

import * as A from './actions.js';

function chat(state, action) {
  switch (action.type) {
    case A.CHAT_MESSAGE_APPENDED:
      return Object.assign({}, state, {
        messages: state.messages.concat(action.payload),
      });

    case A.CHAT_MESSAGE_PATCHED: {
      const id = action.payload.id;
      const patch = action.payload.patch;
      const messages = state.messages.map(function (m) {
        return m.id === id ? Object.assign({}, m, patch) : m;
      });
      return Object.assign({}, state, { messages: messages });
    }

    case A.CHAT_REQUEST_STARTED:
      return Object.assign({}, state, { pendingMessageId: action.payload.id });

    case A.CHAT_REQUEST_RESOLVED:
    case A.CHAT_REQUEST_FAILED:
    case A.CHAT_REQUEST_CANCELED:
      return Object.assign({}, state, { pendingMessageId: null });

    case A.CHAT_CLEARED:
      return Object.assign({}, state, { messages: [], pendingMessageId: null });

    default:
      return state;
  }
}

function results(state, action) {
  switch (action.type) {
    case A.RESULTS_SET:
      return Object.assign({}, state, {
        data: action.payload.data || [],
        lastUpdatedAt: Date.now(),
      });
    case A.RESULTS_CLEARED:
      return Object.assign({}, state, {
        data: null,
        lastUpdatedAt: Date.now(),
      });
    case A.RESULTS_RENDERER_SET:
      return Object.assign({}, state, { renderer: action.payload.renderer });
    default:
      return state;
  }
}

function stats(state, action) {
  switch (action.type) {
    case A.STATS_LOADED: {
      const p = action.payload || {};
      return Object.assign({}, state, {
        loaded: true,
        snapshot_date: p.snapshot_date || null,
        total_sku: p.total_sku || 0,
        sources: Array.isArray(p.sources) ? p.sources : [],
      });
    }
    case A.STATS_FAILED:
      return Object.assign({}, state, { loaded: false });
    default:
      return state;
  }
}

function ui(state, action) {
  switch (action.type) {
    case A.UI_PANEL_TOGGLED:
      return Object.assign({}, state, { panelOpen: !state.panelOpen });
    case A.UI_PANEL_SET:
      return Object.assign({}, state, { panelOpen: !!action.payload.open });
    case A.UI_DEBUG_SET:
      return Object.assign({}, state, { debug: !!action.payload.on });
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

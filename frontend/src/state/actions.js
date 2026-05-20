// Action type constants + small typed creators. Constants prevent typos
// in reducer/selector code; creators are convenience helpers used by
// the chat engine and UI bindings.
//
// All action types are SCREAMING_SNAKE for grep-ability.

// ── Chat ─────────────────────────────────────────────────────────────
export const CHAT_MESSAGE_APPENDED   = 'CHAT_MESSAGE_APPENDED';
export const CHAT_REQUEST_STARTED    = 'CHAT_REQUEST_STARTED';
export const CHAT_REQUEST_RESOLVED   = 'CHAT_REQUEST_RESOLVED';
export const CHAT_REQUEST_FAILED     = 'CHAT_REQUEST_FAILED';
export const CHAT_REQUEST_CANCELED   = 'CHAT_REQUEST_CANCELED';
export const CHAT_MESSAGE_PATCHED    = 'CHAT_MESSAGE_PATCHED';
export const CHAT_CLEARED            = 'CHAT_CLEARED';

// ── Results ──────────────────────────────────────────────────────────
export const RESULTS_SET             = 'RESULTS_SET';
export const RESULTS_CLEARED         = 'RESULTS_CLEARED';
export const RESULTS_RENDERER_SET    = 'RESULTS_RENDERER_SET';

// ── Stats ────────────────────────────────────────────────────────────
export const STATS_LOADED            = 'STATS_LOADED';
export const STATS_FAILED            = 'STATS_FAILED';

// ── UI ───────────────────────────────────────────────────────────────
export const UI_PANEL_TOGGLED        = 'UI_PANEL_TOGGLED';
export const UI_PANEL_SET            = 'UI_PANEL_SET';
export const UI_DEBUG_SET            = 'UI_DEBUG_SET';

// ── creators ─────────────────────────────────────────────────────────
export const appendMessage      = (message) => ({ type: CHAT_MESSAGE_APPENDED, payload: message });
export const patchMessage       = (id, patch) => ({ type: CHAT_MESSAGE_PATCHED, payload: { id, patch } });
export const startRequest       = (id) => ({ type: CHAT_REQUEST_STARTED, payload: { id } });
export const resolveRequest     = (id) => ({ type: CHAT_REQUEST_RESOLVED, payload: { id } });
export const failRequest        = (id, error) => ({ type: CHAT_REQUEST_FAILED, payload: { id, error } });
export const cancelRequest      = (id) => ({ type: CHAT_REQUEST_CANCELED, payload: { id } });

export const setResults         = (data) => ({ type: RESULTS_SET, payload: { data } });
export const clearResults       = () => ({ type: RESULTS_CLEARED });
export const setRenderer        = (renderer) => ({ type: RESULTS_RENDERER_SET, payload: { renderer } });

export const statsLoaded        = (payload) => ({ type: STATS_LOADED, payload });
export const statsFailed        = (error) => ({ type: STATS_FAILED, payload: { error } });

export const togglePanel        = () => ({ type: UI_PANEL_TOGGLED });
export const setPanelOpen       = (open) => ({ type: UI_PANEL_SET, payload: { open } });
export const setDebug           = (on) => ({ type: UI_DEBUG_SET, payload: { on } });

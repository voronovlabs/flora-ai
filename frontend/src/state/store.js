// Concrete store instance — keeps the createStore boilerplate out of
// app.js and makes the module easy to import from any component.

import { createStore } from '../core/store.js';
import { initialState } from './initial.js';
import { rootReducer } from './reducers.js';

export const store = createStore(rootReducer, initialState);

// Convenient slice selectors. Keep this list tiny and predictable.
export const select = {
  chat:        (s) => s.chat,
  messages:    (s) => s.chat.messages,
  pendingId:   (s) => s.chat.pendingMessageId,
  results:     (s) => s.results,
  resultsData: (s) => s.results.data,
  stats:       (s) => s.stats,
  ui:          (s) => s.ui,
  panelOpen:   (s) => s.ui.panelOpen,
};

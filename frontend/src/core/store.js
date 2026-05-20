// Minimalist reactive store. ~60 LOC, no dependencies, vanilla.
//
// Design notes:
//   • Single root state object, replaced (not mutated) on each dispatch.
//   • dispatch(action) → reducer(state, action) → new state → fire events.
//   • Subscribers fall into two flavors:
//       store.subscribe(fn)            — every state change.
//       store.subscribeSlice(selector, fn) — only when slice changes.
//   • Action shape: { type: string, payload?: any }. Reducer is provided
//     by state/reducers.js.
//
// We intentionally don't ship Redux/Pinia/Zustand semantics — this is
// closer to a "useReducer-on-the-window" pattern: dead simple to debug,
// dead simple to extend.

import { bus } from './event-bus.js';

export function createStore(reducer, initialState) {
  let state = initialState;
  const subscribers = new Set();

  function getState() { return state; }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      // eslint-disable-next-line no-console
      console.warn('[store] dispatch called without a typed action', action);
      return state;
    }
    const next = reducer(state, action);
    if (next === state) return state;
    const prev = state;
    state = next;
    // Fire bus event so consumers can react via the event bus too.
    bus.emit('state:changed', { prev, next, action });
    bus.emit(`action:${action.type}`, action.payload);
    subscribers.forEach((fn) => {
      try { fn(state, action, prev); } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[store] subscriber threw:', err);
      }
    });
    return state;
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function subscribeSlice(selector, fn) {
    let cached = selector(state);
    return subscribe((nextState) => {
      const value = selector(nextState);
      if (value === cached) return;
      const prevSlice = cached;
      cached = value;
      try { fn(value, prevSlice); } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[store] slice subscriber threw:', err);
      }
    });
  }

  return { getState, dispatch, subscribe, subscribeSlice };
}

// ChatEngine: the only place that knows how to turn user input into
// API calls + state updates. Everything UI-side talks to it, so the
// components stay dumb.
//
// Lifecycle for a single user turn:
//
//   user/preset action
//        │
//        ▼
//   1. append USER message      → CHAT_MESSAGE_APPENDED
//   2. append ASSISTANT pending → CHAT_MESSAGE_APPENDED (status=PENDING)
//   3. CHAT_REQUEST_STARTED with assistant message id
//   4. call /ask or /smart via api.js with AbortController
//   5a. success → patch assistant message {status:DONE, text, sql}
//                + RESULTS_SET if data is present
//                + CHAT_REQUEST_RESOLVED
//   5b. AbortError → patch {status:CANCELED} + CHAT_REQUEST_CANCELED
//   5c. other error → patch {status:ERROR, error} + CHAT_REQUEST_FAILED
//
// Future-ready: streaming would just push more CHAT_MESSAGE_PATCHED
// events with appended text. Multi-agent is handled by additional
// assistant messages with role=ASSISTANT + meta.agent.

import { store } from '../state/store.js';
import {
  appendMessage,
  patchMessage,
  startRequest,
  resolveRequest,
  failRequest,
  cancelRequest,
  setResults,
} from '../state/actions.js';
import { askPreset, askSmart } from '../api.js';
import { createMessage, MessageRole, MessageStatus, MessageKind } from './types.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('chat');

const PRESET_LABELS = {
  count_sku:         'Count SKU',
  price_stats:       'Top / Min / AVG price',
  top_price_changes: 'Top 5 price changes',
};

// Maps assistant message id → AbortController so we can cancel/retry.
const inflight = new Map();

function _appendAssistantPending() {
  const msg = createMessage({
    role: MessageRole.ASSISTANT,
    status: MessageStatus.PENDING,
    text: '',
  });
  store.dispatch(appendMessage(msg));
  store.dispatch(startRequest(msg.id));
  return msg;
}

function _resolveAssistant(id, { answer, sql, data }) {
  store.dispatch(patchMessage(id, {
    status: MessageStatus.DONE,
    text: String(answer || ''),
    sql: sql || null,
    data: Array.isArray(data) ? data : null,
  }));
  store.dispatch(resolveRequest(id));
  if (Array.isArray(data) && data.length > 0) {
    store.dispatch(setResults(data));
  }
}

function _failAssistant(id, err, status = MessageStatus.ERROR) {
  const errorText = (err && err.message) ? err.message : String(err || 'unknown error');
  store.dispatch(patchMessage(id, {
    status,
    kind: status === MessageStatus.ERROR ? MessageKind.ERROR : MessageKind.TEXT,
    text: status === MessageStatus.CANCELED
      ? 'Запрос отменён.'
      : 'API call failed (/smart). Check flora-api container.',
    error: errorText,
  }));
  if (status === MessageStatus.CANCELED) store.dispatch(cancelRequest(id));
  else store.dispatch(failRequest(id, errorText));
}

async function _runRequest(assistantId, exec) {
  const controller = new AbortController();
  inflight.set(assistantId, controller);
  try {
    const { ok, status, text, payload } = await exec({ signal: controller.signal });
    if (!ok) {
      _failAssistant(assistantId, new Error(`API error: ${status}\n${text}`));
      return;
    }
    const answer = (payload && (payload.answer || payload.echo)) || text || 'OK';
    const sql = payload && payload.sql ? payload.sql : null;
    const data = payload && payload.data ? payload.data : null;
    _resolveAssistant(assistantId, { answer, sql, data });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      _failAssistant(assistantId, err, MessageStatus.CANCELED);
    } else {
      log.error('request failed', err);
      _failAssistant(assistantId, err);
    }
  } finally {
    inflight.delete(assistantId);
  }
}

export const ChatEngine = {
  sendPreset(presetId) {
    const label = PRESET_LABELS[presetId] || 'Preset: ' + presetId;
    store.dispatch(appendMessage(createMessage({
      role: MessageRole.USER,
      text: label,
      meta: { kind: 'preset', presetId },
    })));
    const pending = _appendAssistantPending();
    _runRequest(pending.id, ({ signal }) => askPreset(presetId, { signal }));
    return pending.id;
  },

  sendSmart(question) {
    const trimmed = (question || '').trim();
    if (!trimmed) return null;
    store.dispatch(appendMessage(createMessage({
      role: MessageRole.USER,
      text: trimmed,
      meta: { kind: 'smart' },
    })));
    const pending = _appendAssistantPending();
    _runRequest(pending.id, ({ signal }) => askSmart(trimmed, { signal }));
    return pending.id;
  },

  cancel(assistantMessageId) {
    const ctl = inflight.get(assistantMessageId);
    if (ctl) ctl.abort();
  },

  retry(/* assistantMessageId */) {
    // Future: look up the originating user message via meta, resubmit.
    // For now the UI doesn't expose retry; the hook stays so engine
    // consumers can wire a button later without restructuring.
    log.warn('retry() not yet wired to UI');
  },

  cancelAll() {
    inflight.forEach((ctl) => ctl.abort());
    inflight.clear();
  },
};

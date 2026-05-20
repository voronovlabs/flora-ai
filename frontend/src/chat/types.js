// Canonical message types for the chat engine.
//
// Forward-looking shape: we deliberately distinguish role from kind so
// the same role (assistant) can later emit reasoning blocks, tool
// calls, tool results, SQL blocks, dataset previews, etc. Today only
// TEXT and SQL are produced; the rest are reserved.

export const MessageRole = Object.freeze({
  USER:      'user',
  ASSISTANT: 'assistant',
  SYSTEM:    'system',
});

export const MessageKind = Object.freeze({
  TEXT:        'text',
  SQL:         'sql',          // assistant attaches a SQL block
  REASONING:   'reasoning',    // future: visible chain-of-thought
  TOOL_CALL:   'tool_call',    // future: agent tool invocation
  TOOL_RESULT: 'tool_result',  // future: result of a tool call
  DATA:        'data',         // future: structured dataset preview
  ERROR:       'error',
});

export const MessageStatus = Object.freeze({
  PENDING:   'pending',     // request in flight
  STREAMING: 'streaming',   // future: partial text being received
  DONE:      'done',
  ERROR:     'error',
  CANCELED:  'canceled',
});

// Cheap RFC-4122-ish id (no crypto dep needed for UI message ids).
function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'm-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createMessage(opts = {}) {
  return {
    id:     opts.id || randomId(),
    role:   opts.role || MessageRole.ASSISTANT,
    kind:   opts.kind || MessageKind.TEXT,
    status: opts.status || MessageStatus.DONE,
    text:   opts.text || '',
    ts:     opts.ts || Date.now(),
    // Optional fields any role may carry:
    sql:    opts.sql || null,         // SQL preview text
    data:   opts.data || null,        // dataset rows
    meta:   opts.meta || null,        // engine internals / debug
    error:  opts.error || null,
  };
}

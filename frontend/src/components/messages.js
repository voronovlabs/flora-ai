// Chat bubble renderer. Subscribes to the store and reconciles the
// chat container with `state.chat.messages`. Reconciliation is
// append-only with status-driven re-render of the pending bubble — no
// virtual DOM, no diffing libraries, no surprises.

import { escapeHtml, formatTime } from '../format.js';
import { store, select } from '../state/store.js';
import { MessageRole, MessageStatus, MessageKind } from '../chat/types.js';

let host = null;
const rendered = new Map(); // id → HTMLElement

function avatarHtml(role) {
  if (role === MessageRole.USER) {
    return '<div class="message-avatar user">👤</div>';
  }
  return '<div class="message-avatar assistant">🌿</div>';
}

function sqlBlockHtml(sql, id) {
  return `
    <div class="data-block" data-message-id="${id}">
      <div class="data-block-header" data-action="toggle-data-block">
        <span class="data-block-title">
          <svg class="data-block-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          Показать SQL запрос
        </span>
      </div>
      <div class="data-block-content">
        <div class="sql-code">${escapeHtml(sql)}</div>
      </div>
    </div>
  `;
}

function pendingBodyHtml() {
  return `
    <div class="loading">
      <div class="loading-dots">
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
        <div class="loading-dot"></div>
      </div>
      <span>Анализирую данные...</span>
    </div>
  `;
}

function bodyHtml(msg) {
  if (msg.status === MessageStatus.PENDING) return pendingBodyHtml();
  const main = `<div class="message-text">${escapeHtml(msg.text || '')}</div>`;
  const sql = msg.sql ? sqlBlockHtml(msg.sql, msg.id) : '';
  const time = `<div class="message-time">${formatTime()}</div>`;
  return main + sql + time;
}

function renderMessageNode(msg) {
  const node = document.createElement('div');
  node.className = 'message';
  node.dataset.messageId = msg.id;
  node.dataset.role = msg.role;
  if (msg.kind === MessageKind.ERROR) node.dataset.error = '1';
  node.innerHTML = `
    ${avatarHtml(msg.role)}
    <div class="message-content">${bodyHtml(msg)}</div>
  `;
  return node;
}

function updateMessageNode(node, msg) {
  // Status / kind may change between renders; reflect on dataset.
  node.dataset.role = msg.role;
  if (msg.kind === MessageKind.ERROR) node.dataset.error = '1';
  else delete node.dataset.error;
  const content = node.querySelector('.message-content');
  if (content) content.innerHTML = bodyHtml(msg);
}

function reconcile(messages) {
  if (!host) return;
  // Lazy first paint: drop the welcome-message div the first time a
  // message arrives, so the original UX is preserved.
  if (messages.length > 0) {
    const welcome = host.querySelector('.welcome-message');
    if (welcome) welcome.remove();
  }
  messages.forEach((msg) => {
    let node = rendered.get(msg.id);
    if (!node) {
      node = renderMessageNode(msg);
      rendered.set(msg.id, node);
      host.appendChild(node);
    } else {
      updateMessageNode(node, msg);
    }
  });
  host.scrollTop = host.scrollHeight;
}

export function mountMessages(hostEl) {
  host = hostEl;
  // Initial paint (empty by default, but be safe for hot-reload).
  reconcile(select.messages(store.getState()));
  store.subscribeSlice(select.messages, reconcile);
}

// Exported so the data-action delegator in app.js can flip a SQL block
// without poking at private state.
export function toggleDataBlock(headerEl) {
  const block = headerEl.parentElement;
  if (block) block.classList.toggle('expanded');
}

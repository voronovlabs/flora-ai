// Chat message rendering: user/assistant/loading bubbles + optional SQL block.

import { escapeHtml, formatTime } from '../format.js';
import { updateResultsPanel, openResultsPanelOnMobile } from './results-panel.js';
import { refs } from '../ui.js';

export function addMessage(text, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.innerHTML = `
    <div class="message-avatar ${isUser ? 'user' : 'assistant'}">
      ${isUser ? '👤' : '🌿'}
    </div>
    <div class="message-content">
      <div class="message-text">${escapeHtml(text)}</div>
      <div class="message-time">${formatTime()}</div>
    </div>
  `;
  refs.chatMessages.appendChild(messageDiv);
  refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
}

export function addLoadingMessage() {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.id = 'loadingMessage';
  messageDiv.innerHTML = `
    <div class="message-avatar assistant">🌿</div>
    <div class="message-content">
      <div class="loading">
        <div class="loading-dots">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
        <span>Анализирую данные...</span>
      </div>
    </div>
  `;
  refs.chatMessages.appendChild(messageDiv);
  refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;
}

export function removeLoadingMessage() {
  const loadingMsg = document.getElementById('loadingMessage');
  if (loadingMsg) loadingMsg.remove();
}

export function toggleDataBlock(header) {
  const block = header.parentElement;
  block.classList.toggle('expanded');
}

export function addAssistantMessage(answer, sql, data) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';

  let dataBlockHtml = '';
  if (sql) {
    dataBlockHtml = `
      <div class="data-block" id="dataBlock-${Date.now()}">
        <div class="data-block-header" onclick="toggleDataBlock(this)">
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

  messageDiv.innerHTML = `
    <div class="message-avatar assistant">🌿</div>
    <div class="message-content">
      <div class="message-text">${escapeHtml(answer)}</div>
      ${dataBlockHtml}
      <div class="message-time">${formatTime()}</div>
    </div>
  `;
  refs.chatMessages.appendChild(messageDiv);
  refs.chatMessages.scrollTop = refs.chatMessages.scrollHeight;

  if (data && data.length > 0) {
    updateResultsPanel(data);
    openResultsPanelOnMobile();
  }
}

// Entry point. Three jobs only:
//   1. Mount components against the DOM and the store.
//   2. Wire event-delegation: every interactive element uses
//      data-action / data-input, no inline handlers, no window.* globals.
//   3. Boot-time data loads (currently /stats).
//
// Anything domain-specific (chat lifecycle, results rendering, etc.)
// lives in dedicated modules.

import { autoResize } from './ui.js';
import { getStats } from './api.js';
import { store } from './state/store.js';
import { statsLoaded, statsFailed, togglePanel } from './state/actions.js';
import { ChatEngine } from './chat/engine.js';
import { mountMessages, toggleDataBlock } from './components/messages.js';
import { mountResultsPanel, downloadCsv } from './components/results-panel.js';
import { mountStatsBox } from './components/stats-box.js';
import { isDebugMode } from './core/logger.js';
import { setDebug } from './state/actions.js';

function $(id) { return document.getElementById(id); }

function bindEventDelegation() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    switch (action) {
      case 'preset':
        ChatEngine.sendPreset(target.dataset.preset);
        break;
      case 'send-message':
        sendCurrentInput();
        break;
      case 'toggle-results':
        store.dispatch(togglePanel());
        break;
      case 'download-csv':
        downloadCsv();
        break;
      case 'toggle-data-block':
        toggleDataBlock(target);
        break;
      default:
        // unknown action — ignore on purpose.
        break;
    }
  });

  const ta = $('messageInput');
  if (ta) {
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentInput();
      }
    });
    ta.addEventListener('input', () => autoResize(ta));
  }
}

function sendCurrentInput() {
  const ta = $('messageInput');
  if (!ta) return;
  const text = (ta.value || '').trim();
  if (!text) return;
  ChatEngine.sendSmart(text);
  ta.value = '';
  ta.style.height = 'auto';
}

function bootStats() {
  getStats()
    .then((payload) => {
      if (payload && payload.ok) store.dispatch(statsLoaded(payload));
      else store.dispatch(statsFailed('not ok'));
    })
    .catch((err) => store.dispatch(statsFailed(String(err))));
}

window.addEventListener('DOMContentLoaded', () => {
  // Sync debug flag from logger → store so components can react.
  store.dispatch(setDebug(isDebugMode()));

  mountMessages($('chatMessages'));
  mountStatsBox($('statsBox'));
  mountResultsPanel({
    panel: $('resultsPanel'),
    content: $('resultsContent'),
    overlay: $('overlay'),
  });

  bindEventDelegation();
  bootStats();
});

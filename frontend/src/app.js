// Entry point. Three jobs only:
//   1. Mount components against the DOM and the store.
//   2. Wire event-delegation: every interactive element uses
//      data-action / data-input, no inline handlers, no window.* globals.
//   3. Boot-time data loads (currently /stats).
//
// Anything domain-specific (chat lifecycle, results rendering, etc.)
// lives in dedicated modules.
//
// IMPORTANT — boot timing:
// Module scripts are deferred, so by the time this top-level code runs the
// DOM is already parsed. We DO NOT wrap boot() in DOMContentLoaded — that
// listener can race with a fired-but-not-yet-flushed event in some module
// load paths and silently never run. Boot immediately, defensively.

import { autoResize } from './ui.js';
import { getStats } from './api.js';
import { store } from './state/store.js';
import { statsLoaded, statsFailed, togglePanel, setDebug } from './state/actions.js';
import { ChatEngine } from './chat/engine.js';
import { mountMessages, toggleDataBlock } from './components/messages.js';
import { mountResultsPanel, downloadCsv } from './components/results-panel.js';
import { mountStatsBox } from './components/stats-box.js';
import { isDebugMode } from './core/logger.js';

function $(id) { return document.getElementById(id); }

function bindEventDelegation() {
  document.addEventListener('click', (e) => {
    const target = e.target.closest && e.target.closest('[data-action]');
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

function safe(label, fn) {
  try { fn(); }
  catch (err) {
    // One failed mount must not block the rest of the boot — most
    // importantly bindEventDelegation, which is what makes the
    // quick-buttons / send-button responsive.
    // eslint-disable-next-line no-console
    console.error('[flora] boot step failed:', label, err);
  }
}

function boot() {
  // Event delegation FIRST, so even if a mount later throws, the
  // quick-buttons and the send button still respond to user input.
  safe('bindEventDelegation', bindEventDelegation);
  safe('setDebug',            () => store.dispatch(setDebug(isDebugMode())));
  safe('mountMessages',       () => mountMessages($('chatMessages')));
  safe('mountStatsBox',       () => mountStatsBox($('statsBox')));
  safe('mountResultsPanel',   () => mountResultsPanel({
    panel:   $('resultsPanel'),
    content: $('resultsContent'),
    overlay: $('overlay'),
  }));
  safe('bootStats', bootStats);
  // eslint-disable-next-line no-console
  console.info('[flora] booted');
}

// Module scripts execute after the document has been parsed, so the DOM is
// already available when we get here. The legacy DOMContentLoaded wrapper
// is gone on purpose — see the file header.
if (document.readyState === 'loading') {
  // Defensive: still possible if some older browser/proxy strips the
  // defer behavior from module scripts.
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Entry point. Three jobs only:
//   1. Mount components against the DOM and the store.
//   2. Wire event-delegation: every interactive element uses
//      data-action / data-input, no inline handlers, no window.* globals.
//   3. Boot-time data loads (currently /stats + dashboard KPI bootstrap).
//
// Anything domain-specific (chat lifecycle, results rendering, etc.)
// lives in dedicated modules. ChatEngine and the store are untouched
// from prior turns.

import { autoResize } from './ui.js';
import { getStats } from './api.js';
import { store } from './state/store.js';
import { statsLoaded, statsFailed, togglePanel, setPanelOpen, setDebug } from './state/actions.js';
import { ChatEngine } from './chat/engine.js';
import { mountMessages, toggleDataBlock } from './components/messages.js';
import { mountResultsPanel, downloadCsv } from './components/results-panel.js';
import { mountStatsBox } from './components/stats-box.js';
import { mountDashboardTop } from './components/dashboard-top.js';
import { mountTabs, setTab } from './components/tabs.js';
import { mountHero } from './components/hero.js';
import { mountHeaderStatus } from './components/header-status.js';
import { mountResultsSummary } from './components/results-summary.js';
import { isDebugMode } from './core/logger.js';

function $(id) { return document.getElementById(id); }

function bindEventDelegation() {
  document.addEventListener('click', function (e) {
    var target = (e.target && e.target.closest) ? e.target.closest('[data-action]') : null;
    if (!target) return;
    var action = target.dataset.action;
    switch (action) {
      case 'preset':
        ChatEngine.sendPreset(target.dataset.preset);
        scrollChatIntoView();
        break;

      case 'send-message':
        sendCurrentInput();
        break;

      case 'smart-question':
        // Action card with a pre-built natural-language question — feeds
        // the same /smart pipeline the user gets from the composer.
        if (target.dataset.question) {
          ChatEngine.sendSmart(target.dataset.question);
          scrollChatIntoView();
        }
        break;

      case 'focus-composer':
        focusComposer();
        break;

      case 'tab':
        // Mobile-only tab switch between Chat and Results.
        var t = target.dataset.tab;
        if (t === 'results') {
          // Reuse the existing panel state so the right-panel JS
          // subscribers still fire on toggle.
          store.dispatch(setPanelOpen(true));
        } else {
          store.dispatch(setPanelOpen(false));
        }
        setTab(t);
        var ws = document.querySelector('.workspace');
        if (ws) ws.setAttribute('data-active-tab', t);
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
        break;
    }
  });

  var ta = $('messageInput');
  if (ta) {
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCurrentInput();
      }
    });
    ta.addEventListener('input', function () { autoResize(ta); });
  }
}

function sendCurrentInput() {
  var ta = $('messageInput');
  if (!ta) return;
  var text = (ta.value || '').trim();
  if (!text) return;
  ChatEngine.sendSmart(text);
  ta.value = '';
  ta.style.height = 'auto';
  scrollChatIntoView();
}

function focusComposer() {
  var ta = $('messageInput');
  if (!ta) return;
  ta.focus();
  // Move viewport so the composer is visible (mobile).
  ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function scrollChatIntoView() {
  // After the user fires a question from a quick-action, make sure the
  // chat scrolls into view so the response bubble is immediately visible.
  var chat = $('chatMessages');
  if (!chat) return;
  chat.scrollTop = chat.scrollHeight;
  // Also scroll the chat-area into the page viewport (helps on mobile
  // when the user clicked an action card and the chat lives below).
  var area = chat.closest && chat.closest('.chat-area');
  if (area && area.scrollIntoView) {
    try { area.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
  }
}

function bootStats() {
  getStats()
    .then(function (payload) {
      if (payload && payload.ok) store.dispatch(statsLoaded(payload));
      else store.dispatch(statsFailed('not ok'));
    })
    .catch(function (err) { store.dispatch(statsFailed(String(err))); });
}

function safe(label, fn) {
  try { fn(); }
  catch (err) {
    // One failed mount must not block the rest of the boot — most
    // importantly bindEventDelegation, which makes the quick-buttons
    // and Enter-to-send responsive.
    // eslint-disable-next-line no-console
    console.error('[flora] boot step failed:', label, err);
  }
}

function boot() {
  // Event delegation FIRST: even if a later mount throws, the
  // action-cards / send-button still respond.
  safe('bindEventDelegation', bindEventDelegation);
  safe('setDebug',            function () { store.dispatch(setDebug(isDebugMode())); });
  safe('mountHeaderStatus',   function () { mountHeaderStatus($('headerStatus')); });
  safe('mountHero',           function () { mountHero($('hero')); });
  safe('mountDashboardTop',   function () { mountDashboardTop($('dashboardTop')); });
  safe('mountTabs',           function () { mountTabs($('mobileTabs')); });
  safe('mountMessages',       function () { mountMessages($('chatMessages')); });
  safe('mountStatsBox',       function () { mountStatsBox($('statsBox')); });
  safe('mountResultsSummary', function () { mountResultsSummary($('resultsSummary')); });
  safe('mountResultsPanel',   function () {
    mountResultsPanel({
      panel:   $('resultsPanel'),
      content: $('resultsContent'),
      overlay: $('overlay'),
    });
  });
  safe('bootStats', bootStats);
  // eslint-disable-next-line no-console
  console.info('[flora] booted');
}

// Module scripts execute after the document has been parsed, so the DOM
// is already available. We boot immediately; the listener below is only
// a defensive fallback for environments that strip module-deferral.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

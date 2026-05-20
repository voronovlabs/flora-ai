// Entry point: wires DOM, exposes a stable set of globals for inline
// onclick/onkeydown handlers used in index.html (kept for safe refactor).

import { bindRefs, refs, autoResize } from './ui.js';
import { getStats, askPreset, askSmart } from './api.js';
import {
  addMessage,
  addLoadingMessage,
  removeLoadingMessage,
  addAssistantMessage,
  toggleDataBlock,
} from './components/messages.js';
import {
  updateResultsPanel,
  toggleResultsPanel,
  openResultsPanelOnMobile,
  downloadResults,
} from './components/results-panel.js';
import { renderStatsBox } from './components/stats-box.js';

const PRESET_LABELS = {
  count_sku: 'Count SKU',
  price_stats: 'Top / Min / AVG price',
  top_price_changes: 'Top 5 price changes',
};

async function sendPresetSafe(presetId) {
  const label = PRESET_LABELS[presetId] || 'Preset: ' + presetId;
  try {
    addMessage(label, true);
    addLoadingMessage();
    if (refs.sendBtn) refs.sendBtn.disabled = true;

    const { ok, status, text, payload } = await askPreset(presetId);
    removeLoadingMessage();

    if (!ok) {
      addAssistantMessage('API error: ' + status + '\n' + text, null, null);
      return;
    }

    const answer = (payload && (payload.answer || payload.echo))
      ? (payload.answer || payload.echo)
      : (text || 'OK');
    const sql = payload && payload.sql ? payload.sql : null;
    const data = payload && payload.data ? payload.data : null;

    addAssistantMessage(String(answer), sql, data);

    if (data && Array.isArray(data) && data.length > 0) {
      updateResultsPanel(data);
      openResultsPanelOnMobile();
    }
  } catch (e) {
    try { removeLoadingMessage(); } catch (_) {}
    addAssistantMessage('API call failed (/smart). Check flora-api container.', null, null);
    // eslint-disable-next-line no-console
    console.error(e);
  } finally {
    if (refs.sendBtn) refs.sendBtn.disabled = false;
  }
}

async function sendMessage() {
  const question = (refs.messageInput && refs.messageInput.value ? refs.messageInput.value : '').trim();
  if (!question) return;

  addMessage(question, true);
  refs.messageInput.value = '';
  refs.messageInput.style.height = 'auto';

  addLoadingMessage();
  refs.sendBtn.disabled = true;

  try {
    const { ok, status, text, payload } = await askSmart(question);
    removeLoadingMessage();

    if (!ok) {
      addAssistantMessage('API error: ' + status + '\n' + text, null, null);
      return;
    }

    const answer = (payload && (payload.answer || payload.echo))
      ? (payload.answer || payload.echo)
      : (text || 'OK');
    const sql = payload && payload.sql ? payload.sql : null;
    const data = payload && payload.data ? payload.data : null;

    addAssistantMessage(String(answer), sql, data);

    if (data && Array.isArray(data)) {
      updateResultsPanel(data);
      openResultsPanelOnMobile();
    }
  } catch (error) {
    removeLoadingMessage();
    addAssistantMessage('API call failed (/smart). Check flora-api container.', null, null);
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    refs.sendBtn.disabled = false;
  }
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  bindRefs();
  getStats()
    .then((j) => renderStatsBox(j))
    .catch(() => renderStatsBox(null));
});

// Inline HTML uses these names directly (onclick="…"), so expose them on window.
// This keeps the refactor visually identical and the diff minimal.
window.sendPresetSafe = sendPresetSafe;
window.sendMessage = sendMessage;
window.handleKeyDown = handleKeyDown;
window.autoResize = autoResize;
window.toggleResultsPanel = toggleResultsPanel;
window.toggleDataBlock = toggleDataBlock;
window.downloadResults = downloadResults;

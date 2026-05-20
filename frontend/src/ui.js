// Shared DOM references and lightweight in-memory state.
// Populated on DOMContentLoaded by app.js.

export const refs = {
  chatMessages: null,
  messageInput: null,
  sendBtn: null,
  resultsContent: null,
  resultsPanel: null,
  overlay: null,
};

export const state = {
  currentData: null,
};

export function bindRefs() {
  refs.chatMessages = document.getElementById('chatMessages');
  refs.messageInput = document.getElementById('messageInput');
  refs.sendBtn = document.getElementById('sendBtn');
  refs.resultsContent = document.getElementById('resultsContent');
  refs.resultsPanel = document.getElementById('resultsPanel');
  refs.overlay = document.getElementById('overlay');
}

export function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

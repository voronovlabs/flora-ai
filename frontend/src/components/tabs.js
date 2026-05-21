// Mobile-only tab switcher between Chat and Results.
//
// On desktop the tabs themselves are hidden via CSS; on mobile they
// flip the `.is-active-tab` class on a wrapper, and CSS does the rest.
//
// Does NOT touch the store / ChatEngine / renderer contract.

let wrapper = null;
let buttons = null;

function activate(tab) {
  if (!wrapper) return;
  wrapper.setAttribute('data-active-tab', tab);
  if (!buttons) return;
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i];
    if (b.dataset.tab === tab) b.classList.add('is-active');
    else b.classList.remove('is-active');
  }
}

export function mountTabs(wrapperEl) {
  wrapper = wrapperEl;
  if (!wrapper) return;
  buttons = wrapper.querySelectorAll('[data-action="tab"]');
  activate('chat');
}

export function setTab(tab) {
  if (tab !== 'chat' && tab !== 'results') return;
  activate(tab);
}

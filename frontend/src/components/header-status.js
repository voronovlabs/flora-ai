// Header live-status pill ("Live · Postgres connected" vs "Подключение…").
//
// Subscribes to select.stats — when stats are loaded successfully it
// flips the data-state to "live"; CSS handles colour and the dot.

import { store, select } from '../state/store.js';

function apply(host, stats) {
  if (!host) return;
  const isLive = !!(stats && stats.loaded);
  host.setAttribute('data-state', isLive ? 'live' : 'boot');
  const primary = host.querySelector('.header-status__primary');
  const secondary = host.querySelector('.header-status__secondary');
  if (primary)   primary.textContent   = isLive ? 'Онлайн' : 'Подключение…';
  // Was "База данных подключена" — звучало как инфраструктура. Делаем
  // нейтрально: пользователю интересны источники, а не Postgres.
  if (secondary) secondary.textContent = 'источники данных';
}

export function mountHeaderStatus(host) {
  if (!host) return;
  apply(host, select.stats(store.getState()));
  store.subscribeSlice(select.stats, function (s) { apply(host, s); });
}

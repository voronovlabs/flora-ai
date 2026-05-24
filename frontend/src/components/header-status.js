// Header live-status pill.
//
// Три состояния, на основе select.stats:
//   1. Подключение / нет данных
//        primary:   "Подключение…"
//        secondary: "загружаем данные"
//        data-state="boot"
//   2. Загружено + есть snapshot_date
//        primary:   "Данные актуальны"
//        secondary: "обновлено DD-MM-YYYY"
//        data-state="live"
//   3. Загружено, но snapshot_date отсутствует
//        primary:   "Данные доступны"
//        secondary: "источники подключены"
//        data-state="live"
//
// Никаких новых endpoint'ов, никаких health-индикаторов — только
// существующие поля slice'а `stats`. CSS уже умеет переключать цвет
// точки через [data-state].

import { store, select } from '../state/store.js';
import { fmtDateISO } from '../format.js';

function apply(host, stats) {
  if (!host) return;
  const primary = host.querySelector('.header-status__primary');
  const secondary = host.querySelector('.header-status__secondary');

  if (!stats || !stats.loaded) {
    host.setAttribute('data-state', 'boot');
    if (primary)   primary.textContent   = 'Подключение…';
    if (secondary) secondary.textContent = 'загружаем данные';
    return;
  }

  host.setAttribute('data-state', 'live');
  if (stats.snapshot_date) {
    if (primary)   primary.textContent   = 'Данные актуальны';
    if (secondary) secondary.textContent = 'обновлено ' + fmtDateISO(stats.snapshot_date);
  } else {
    if (primary)   primary.textContent   = 'Данные доступны';
    if (secondary) secondary.textContent = 'источники подключены';
  }
}

export function mountHeaderStatus(host) {
  if (!host) return;
  apply(host, select.stats(store.getState()));
  store.subscribeSlice(select.stats, function (s) { apply(host, s); });
}

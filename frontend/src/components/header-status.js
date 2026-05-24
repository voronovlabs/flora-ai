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

// На узком экране заголовок статуса максимально сжимается, чтобы
// header оставался однострочным и не толкал navbrand вниз. Вторичная
// строка прячется через CSS (`.header-status__secondary { display: none }`).
function isCompactViewport() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(max-width: 768px)').matches;
}

let currentStats = null;

function apply(host, stats) {
  if (!host) return;
  currentStats = stats;
  const primary = host.querySelector('.header-status__primary');
  const secondary = host.querySelector('.header-status__secondary');
  const compact = isCompactViewport();

  if (!stats || !stats.loaded) {
    host.setAttribute('data-state', 'boot');
    if (primary)   primary.textContent   = compact ? 'Подключение…' : 'Подключение…';
    if (secondary) secondary.textContent = 'загружаем данные';
    return;
  }

  host.setAttribute('data-state', 'live');
  if (stats.snapshot_date) {
    if (primary)   primary.textContent   = compact ? 'Актуально' : 'Данные актуальны';
    if (secondary) secondary.textContent = 'обновлено ' + fmtDateISO(stats.snapshot_date);
  } else {
    if (primary)   primary.textContent   = compact ? 'Готово' : 'Данные доступны';
    if (secondary) secondary.textContent = 'источники подключены';
  }
}

export function mountHeaderStatus(host) {
  if (!host) return;
  apply(host, select.stats(store.getState()));
  store.subscribeSlice(select.stats, function (s) { apply(host, s); });

  // Перерисовываем primary-текст при смене viewport (поворот, ресайз),
  // чтобы desktop ↔ mobile copy переключались без перезагрузки.
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = function () { apply(host, currentStats); };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(onChange);
    }
  }
}

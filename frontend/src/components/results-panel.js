// Right-side data table panel: header mapping, column ordering, CSV download.

import { escapeHtml, fmtInt, fmtMoney, normalizeSource } from '../format.js';
import { refs, state } from '../ui.js';

const HEADER_MAP = {
  source: 'Магазин',
  sku_count: 'Позиции',
  min_price: 'Мин. цена',
  avg_price: 'Средняя цена',
  max_price: 'Макс. цена',
  name: 'Название',
  product_key: 'Ссылка/товар',
  old_price: 'Было',
  new_price: 'Стало',
  diff: 'Изменение',
  d: 'Дата',
  last_ts: 'Обновлено',
};

const PREFERRED_ORDER = [
  'source', 'sku_count',
  'min_price', 'avg_price', 'max_price',
  'name', 'product_key',
  'old_price', 'new_price', 'diff',
  'd', 'last_ts',
];

const PRICE_KEYS = new Set([
  'price', 'old_price', 'new_price',
  'min_price', 'avg_price', 'max_price',
]);

function isPriceColumn(key) {
  if (PRICE_KEYS.has(key)) return true;
  return key.endsWith('_price');
}

function isCountColumn(key) {
  return key === 'sku_count' || key === 'cnt' || key.endsWith('_count');
}

export function updateResultsPanel(data) {
  state.currentData = data;
  if (!refs.resultsContent) refs.resultsContent = document.getElementById('resultsContent');

  const cleaned = (Array.isArray(data) ? data : [])
    .map((row) => {
      const r = Object.assign({}, row);
      if ('source' in r) r.source = normalizeSource(r.source);
      return r;
    })
    .filter((r) => {
      if (!('source' in r)) return true;
      const s = String(r.source || '').toLowerCase();
      if (!s) return true;
      return s !== 'unknown';
    });

  if (!cleaned.length) {
    refs.resultsContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">Нет данных для отображения</div>
      </div>
    `;
    return;
  }

  const keysSet = new Set();
  cleaned.forEach((r) => Object.keys(r).forEach((k) => keysSet.add(k)));
  const pref = PREFERRED_ORDER.filter((k) => keysSet.has(k));
  const rest = Array.from(keysSet).filter((k) => !PREFERRED_ORDER.includes(k));
  const keys = [...pref, ...rest];

  const thead = `<thead><tr>${keys.map((k) => `<th>${HEADER_MAP[k] || k}</th>`).join('')}</tr></thead>`;

  const tbody = `<tbody>${cleaned.map((row) => {
    const tds = keys.map((k) => {
      const v = row[k];
      if (isPriceColumn(k)) {
        return `<td class="price-cell">${fmtMoney(v)}</td>`;
      }
      if (isCountColumn(k)) {
        return `<td>${fmtInt(v)}</td>`;
      }
      if (typeof v === 'number') {
        return `<td>${fmtInt(v)}</td>`;
      }
      return `<td>${escapeHtml(String(v ?? ''))}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('')}</tbody>`;

  refs.resultsContent.innerHTML = `
    <div class="data-table-container">
      <table class="data-table">
        ${thead}
        ${tbody}
      </table>
    </div>
    <div style="text-align:center; padding:12px 0; color: var(--text-tertiary); font-size: 14px;">
      Показано ${fmtInt(cleaned.length)} записей
    </div>
  `;
}

export function toggleResultsPanel() {
  if (!refs.resultsPanel) refs.resultsPanel = document.getElementById('resultsPanel');
  if (!refs.overlay) refs.overlay = document.getElementById('overlay');
  refs.resultsPanel.classList.toggle('open');
  refs.overlay.classList.toggle('active');
}

export function openResultsPanelOnMobile() {
  if (window.innerWidth <= 1024 && refs.resultsPanel && refs.overlay) {
    refs.resultsPanel.classList.add('open');
    refs.overlay.classList.add('active');
  }
}

export function downloadResults() {
  const data = state.currentData;
  if (!data || data.length === 0) {
    alert('Нет данных для скачивания');
    return;
  }

  const columns = Object.keys(data[0]);
  const csv = [
    columns.join(';'),
    ...data.map((row) => columns.map((col) => row[col]).join(';')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `results_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

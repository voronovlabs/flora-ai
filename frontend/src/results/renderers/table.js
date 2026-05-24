// Default tabular renderer. This is the only renderer that's
// production-grade today; everything below the table is layout sugar.

import { escapeHtml, fmtInt, fmtMoney, normalizeSource } from '../../format.js';
import { INTRO_HTML } from '../intro.js';

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

const PRICE_KEYS = new Set(['price', 'old_price', 'new_price', 'min_price', 'avg_price', 'max_price']);

function isPriceColumn(key) { return PRICE_KEYS.has(key) || key.endsWith('_price'); }
function isCountColumn(key) { return key === 'sku_count' || key === 'cnt' || key.endsWith('_count'); }

// Если после фильтрации строк не осталось (например, все source ===
// 'unknown') — показываем единое intro вместо стилизованного "Нет
// данных". Это единственный путь, по которому раньше всплывал старый
// плейсхолдер с 📊.
function emptyState(host) {
  host.innerHTML = INTRO_HTML;
}

export const tableRenderer = {
  name: 'table',

  render(host, data) {
    const rows = (Array.isArray(data) ? data : [])
      .map((row) => {
        const r = Object.assign({}, row);
        if ('source' in r) r.source = normalizeSource(r.source);
        return r;
      })
      .filter((r) => {
        if (!('source' in r)) return true;
        const s = String(r.source || '').toLowerCase();
        return !s || s !== 'unknown';
      });

    if (!rows.length) return emptyState(host);

    const keysSet = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => keysSet.add(k)));
    const pref = PREFERRED_ORDER.filter((k) => keysSet.has(k));
    const rest = Array.from(keysSet).filter((k) => !PREFERRED_ORDER.includes(k));
    // Browser-compat: array spread replaced with concat() so the file
    // parses in older engines that don't accept the `...` token.
    const keys = pref.concat(rest);

    // Hide raw columns that are surfaced via friendlier labels:
    //   • brand_name / site_url enrich `source` — мы их не показываем
    //     отдельной колонкой, но используем как displayValue для source.
    const HIDDEN_KEYS = new Set(['brand_name', 'site_url']);
    const visibleKeys = keys.filter(function (k) { return !HIDDEN_KEYS.has(k); });

    const thead = `<thead><tr>${visibleKeys.map((k) => `<th>${HEADER_MAP[k] || k}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map((row) => {
      const tds = visibleKeys.map((k) => {
        const v = row[k];
        if (k === 'source') {
          // Show brand_name when ref.shop_directory has it; raw domain as tooltip.
          const label = row.brand_name ? String(row.brand_name) : String(v ?? '');
          const tooltip = row.brand_name && v ? ' title="' + escapeHtml(String(v)) + '"' : '';
          return '<td' + tooltip + '>' + escapeHtml(label) + '</td>';
        }
        if (isPriceColumn(k)) return `<td class="price-cell">${fmtMoney(v)}</td>`;
        if (isCountColumn(k)) return `<td>${fmtInt(v)}</td>`;
        if (typeof v === 'number') return `<td>${fmtInt(v)}</td>`;
        return `<td>${escapeHtml(String(v ?? ''))}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('')}</tbody>`;

    host.innerHTML = `
      <div class="data-table-container">
        <table class="data-table">${thead}${tbody}</table>
      </div>
      <div style="text-align:center; padding:12px 0; color: var(--text-tertiary); font-size: 14px;">
        Показано ${fmtInt(rows.length)} записей
      </div>
    `;
  },
};

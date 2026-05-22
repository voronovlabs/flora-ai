// Dashboard-top: KPI cards + AI insights (with severity badges + CTA)
// + action cards (split into primary + secondary).
//
// IMPORTANT: talks to the api layer directly (askPreset) so KPI/insight
// bootstrap does NOT show up as a chat message. /stats comes from the
// store — app.js already fetched it once at boot.
//
// Browser-compat: no spread/rest, no optional chaining in expressions.

import { askPreset } from '../api.js';
import { store, select } from '../state/store.js';
import { escapeHtml, fmtInt, fmtMoney, fmtDateISO } from '../format.js';

let host = null;

// ── action cards definitions ────────────────────────────────────────
// Three primary actions reuse existing presets (count_sku / price_stats /
// top_price_changes); three secondary actions either send a pre-built
// smart-question or focus the composer. All routed through the existing
// data-action delegation in app.js.

const PRIMARY_ACTIONS = [
  { icon: '📦', title: 'Ассортимент конкурентов', subtitle: 'Сколько SKU у каждого',
    data: 'data-action="preset" data-preset="count_sku"' },
  { icon: '💰', title: 'Анализ цен', subtitle: 'Min / Avg / Max по рынку',
    data: 'data-action="preset" data-preset="price_stats"' },
  { icon: '📈', title: 'Изменения цен', subtitle: 'Что подорожало / подешевело',
    data: 'data-action="preset" data-preset="top_price_changes"' },
];

const SECONDARY_ACTIONS = [
  { icon: '🏆', title: 'Лидеры рынка', subtitle: 'У кого широкий ассортимент',
    data: 'data-action="smart-question" data-question="Кто лидер рынка по ассортименту?"' },
  { icon: '📉', title: 'Самые дешёвые', subtitle: 'Где минимальные цены',
    data: 'data-action="smart-question" data-question="Покажи 10 самых дешёвых букетов"' },
  { icon: '🤖', title: 'Спросить ИИ', subtitle: 'Свободный вопрос про рынок',
    data: 'data-action="focus-composer"' },
];

// ── card HTML helpers ───────────────────────────────────────────────

function kpiCardHtml(label, value, hint, opts) {
  const tone = (opts && opts.tone) ? opts.tone : '';
  const icon = (opts && opts.icon) ? opts.icon : '';
  return (
    '<div class="kpi-card ' + tone + '">' +
      '<div class="kpi-card__head">' +
        (icon ? '<span class="kpi-card__icon">' + icon + '</span>' : '') +
        '<span class="kpi-card__label">' + escapeHtml(label) + '</span>' +
      '</div>' +
      '<div class="kpi-card__value">' + value + '</div>' +
      (hint ? '<div class="kpi-card__hint">' + hint + '</div>' : '') +
    '</div>'
  );
}

// AI insight: severity-coloured badge + headline + value + CTA arrow.
//   severity ∈ "opportunity" | "risk" | "leader" | "move"
function insightCardHtml(opts) {
  const icon = opts.icon || '✨';
  const title = opts.title || '';
  const value = opts.value || '';
  const hint = opts.hint || '';
  const severity = opts.severity || 'move';
  const sevLabel = opts.sevLabel || '';
  const cta = opts.cta || 'Подробнее';
  const data = opts.data || '';
  return (
    '<button type="button" class="insight-card insight-card--' + severity + '" ' + data + '>' +
      '<div class="insight-card__top">' +
        '<span class="insight-card__icon">' + icon + '</span>' +
        '<span class="insight-card__badge insight-card__badge--' + severity + '">' + escapeHtml(sevLabel) + '</span>' +
      '</div>' +
      '<div class="insight-card__title">' + escapeHtml(title) + '</div>' +
      '<div class="insight-card__value">' + (value || '') + '</div>' +
      (hint ? '<div class="insight-card__hint">' + escapeHtml(hint) + '</div>' : '') +
      '<div class="insight-card__cta">' +
        '<span>' + escapeHtml(cta) + '</span>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<line x1="5" y1="12" x2="19" y2="12"></line>' +
          '<polyline points="13 6 19 12 13 18"></polyline>' +
        '</svg>' +
      '</div>' +
    '</button>'
  );
}

function actionCardHtml(a, variant) {
  return (
    '<button class="action-card action-card--' + variant + '" ' + a.data + '>' +
      '<span class="action-card__icon">' + a.icon + '</span>' +
      '<span class="action-card__title">' + escapeHtml(a.title) + '</span>' +
      '<span class="action-card__subtitle">' + escapeHtml(a.subtitle) + '</span>' +
    '</button>'
  );
}

// ── shell render ────────────────────────────────────────────────────

function renderShell() {
  if (!host) return;
  host.innerHTML =
    '<section class="dashboard-section">' +
      '<header class="section-head">' +
        '<span class="section-dot"></span>' +
        '<h2 class="section-title">Обзор рынка</h2>' +
        '<span class="section-meta" id="kpiMeta">обновляется…</span>' +
      '</header>' +
      '<div class="kpi-grid" id="kpiGrid">' +
        kpiCardHtml('Всего SKU',           '<span class="placeholder">—</span>', '', { icon: '📦' }) +
        kpiCardHtml('Конкурентов',         '<span class="placeholder">—</span>', '', { icon: '🏪' }) +
        kpiCardHtml('Средняя цена рынка',  '<span class="placeholder">—</span>', '', { icon: '💸' }) +
        kpiCardHtml('Самая высокая',       '<span class="placeholder">—</span>', '', { icon: '🚀', tone: 'tone-up' }) +
        kpiCardHtml('Самая низкая',        '<span class="placeholder">—</span>', '', { icon: '🪙', tone: 'tone-down' }) +
        kpiCardHtml('Снимок данных',       '<span class="placeholder">—</span>', '', { icon: '🗓' }) +
      '</div>' +
    '</section>' +

    '<section class="dashboard-section">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--insights"></span>' +
        '<h2 class="section-title">AI Insights</h2>' +
        '<span class="section-meta">сгенерировано из живых данных</span>' +
      '</header>' +
      '<div class="insights-grid" id="insightsGrid">' +
        insightCardHtml({
          icon: '🏆', title: 'Лидер по ассортименту',
          value: '<span class="placeholder">—</span>',
          severity: 'leader', sevLabel: 'Market leader', cta: 'Открыть',
          data: 'data-action="smart-question" data-question="Кто лидер рынка по ассортименту?"',
        }) +
        insightCardHtml({
          icon: '💎', title: 'Самый дорогой букет',
          value: '<span class="placeholder">—</span>',
          severity: 'move', sevLabel: 'Price benchmark', cta: 'Подробнее',
          data: 'data-action="smart-question" data-question="Покажи самый дорогой букет и магазин"',
        }) +
        insightCardHtml({
          icon: '📉', title: 'Максимальное падение',
          value: '<span class="placeholder">—</span>',
          severity: 'opportunity', sevLabel: 'Opportunity', cta: 'Открыть',
          data: 'data-action="preset" data-preset="top_price_changes"',
        }) +
        insightCardHtml({
          icon: '📈', title: 'Максимальный рост',
          value: '<span class="placeholder">—</span>',
          severity: 'risk', sevLabel: 'Risk', cta: 'Открыть',
          data: 'data-action="preset" data-preset="top_price_changes"',
        }) +
      '</div>' +
    '</section>' +

    '<section class="dashboard-section">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--actions"></span>' +
        '<h2 class="section-title">Быстрые действия</h2>' +
        '<span class="section-meta">один клик — один отчёт</span>' +
      '</header>' +
      '<div class="actions-grid actions-grid--primary">' +
        PRIMARY_ACTIONS.map(function (a) { return actionCardHtml(a, 'primary'); }).join('') +
      '</div>' +
      '<div class="actions-grid actions-grid--secondary">' +
        SECONDARY_ACTIONS.map(function (a) { return actionCardHtml(a, 'secondary'); }).join('') +
      '</div>' +
    '</section>';
}

// ── data binding ────────────────────────────────────────────────────

function setKpi(idx, value, hint) {
  const grid = document.getElementById('kpiGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  const valueEl = card.querySelector('.kpi-card__value');
  const hintEl = card.querySelector('.kpi-card__hint');
  if (valueEl) valueEl.innerHTML = value;
  if (hint && hintEl) hintEl.textContent = hint;
  else if (hint && !hintEl) {
    const d = document.createElement('div');
    d.className = 'kpi-card__hint';
    d.textContent = hint;
    card.appendChild(d);
  }
}

function setInsight(idx, value, hint) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  const v = card.querySelector('.insight-card__value');
  if (v) v.innerHTML = value;
  if (hint) {
    const h = card.querySelector('.insight-card__hint');
    if (h) h.textContent = hint;
    else {
      const d = document.createElement('div');
      d.className = 'insight-card__hint';
      d.textContent = hint;
      const cta = card.querySelector('.insight-card__cta');
      if (cta) card.insertBefore(d, cta);
      else card.appendChild(d);
    }
  }
}

function setMeta(text) {
  const m = document.getElementById('kpiMeta');
  if (m) m.textContent = text;
}

function applyStatsSlice(stats) {
  if (!stats || !stats.loaded) {
    setMeta('обновляется…');
    return;
  }
  setKpi(0, fmtInt(stats.total_sku || 0));
  setKpi(1, fmtInt((stats.sources || []).length));
  setKpi(5, stats.snapshot_date ? fmtDateISO(stats.snapshot_date) : '—');
  if (stats.snapshot_date) setMeta('обновлено ' + fmtDateISO(stats.snapshot_date));

  const sources = (stats.sources || []).slice().sort(function (a, b) {
    return (b.sku_count || 0) - (a.sku_count || 0);
  });
  if (sources.length > 0) {
    const leader = sources[0];
    setInsight(0, escapeHtml(String(leader.source)), fmtInt(leader.sku_count) + ' позиций');
  }
}

function bootstrap() {
  // KPI 0/1/5 + leader insight live in the store.
  applyStatsSlice(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStatsSlice);

  // Market-wide pricing.
  askPreset('price_stats').then(function (r) {
    const data = (r && r.payload && Array.isArray(r.payload.data)) ? r.payload.data : [];
    if (!data.length) return;
    let mins = [], avgs = [], maxs = [], topMaxSource = null, topMax = -Infinity;
    data.forEach(function (row) {
      if (typeof row.min_price === 'number') mins.push(row.min_price);
      if (typeof row.avg_price === 'number') avgs.push(row.avg_price);
      if (typeof row.max_price === 'number') {
        maxs.push(row.max_price);
        if (row.max_price > topMax) { topMax = row.max_price; topMaxSource = row.source; }
      }
    });
    if (avgs.length) {
      const avg = avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length;
      setKpi(2, fmtMoney(Math.round(avg)));
    }
    if (maxs.length) setKpi(3, fmtMoney(Math.max.apply(null, maxs)));
    if (mins.length) setKpi(4, fmtMoney(Math.min.apply(null, mins)));
    if (topMaxSource !== null) {
      setInsight(1, fmtMoney(topMax), 'у ' + String(topMaxSource));
    }
  }).catch(function () { /* keep skeleton */ });

  // Top price changes for drop / rise insights.
  askPreset('top_price_changes').then(function (r) {
    const data = (r && r.payload && Array.isArray(r.payload.data)) ? r.payload.data : [];
    if (!data.length) return;
    let drops = data.filter(function (x) { return typeof x.diff === 'number' && x.diff < 0; })
                    .sort(function (a, b) { return a.diff - b.diff; });
    let rises = data.filter(function (x) { return typeof x.diff === 'number' && x.diff > 0; })
                    .sort(function (a, b) { return b.diff - a.diff; });
    if (drops.length) {
      const d = drops[0];
      setInsight(2, fmtMoney(d.diff), (d.name || 'товар') + ' · ' + (d.source || ''));
    }
    if (rises.length) {
      const u = rises[0];
      setInsight(3, '+' + fmtMoney(u.diff).replace(/^\D*/, ''), (u.name || 'товар') + ' · ' + (u.source || ''));
    }
  }).catch(function () { /* keep skeleton */ });
}

export function mountDashboardTop(hostEl) {
  host = hostEl;
  if (!host) return;
  renderShell();
  bootstrap();
}

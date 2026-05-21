// Dashboard-top: KPI cards + AI insights + action cards.
//
// IMPORTANT: this module talks to the API LAYER directly (api.js), NOT
// through the ChatEngine. That's deliberate — KPI bootstrap must not
// emit user/assistant messages into the chat thread.
//
// All other invariants are respected:
//   • no new actions in the store / reducers,
//   • no changes to the renderer contract or ChatEngine,
//   • backend / API shapes are untouched.

// We deliberately do NOT import getStats here — /stats is already
// fetched once by app.js boot and stored under `state.stats`. This
// module subscribes to that slice to avoid a duplicate HTTP request.
import { askPreset } from '../api.js';
import { store, select } from '../state/store.js';
import { escapeHtml, fmtInt, fmtMoney, fmtDateISO } from '../format.js';

let host = null;

// ── Action card definitions (single source of truth) ────────────────
// Each card either:
//   • dispatches a known preset to the ChatEngine (uses existing
//     data-action="preset" wiring in app.js), or
//   • posts a pre-built natural-language question via /smart
//     (data-action="smart-question"), or
//   • focuses the composer (data-action="focus-composer").
const ACTIONS = [
  { icon: '📦', title: 'Ассортимент конкурентов', subtitle: 'Сколько SKU у каждого',
    data: 'data-action="preset" data-preset="count_sku"' },
  { icon: '💰', title: 'Анализ цен',              subtitle: 'Min / Avg / Max по рынку',
    data: 'data-action="preset" data-preset="price_stats"' },
  { icon: '📈', title: 'Изменения цен',           subtitle: 'Что подорожало / подешевело',
    data: 'data-action="preset" data-preset="top_price_changes"' },
  { icon: '🏆', title: 'Лидеры рынка',            subtitle: 'У кого самый широкий ассортимент',
    data: 'data-action="smart-question" data-question="Кто лидер рынка по ассортименту?"' },
  { icon: '📉', title: 'Самые дешёвые',           subtitle: 'Где минимальные цены',
    data: 'data-action="smart-question" data-question="Покажи 10 самых дешёвых букетов"' },
  { icon: '🤖', title: 'Спросить ИИ',             subtitle: 'Свободный вопрос про рынок',
    data: 'data-action="focus-composer"' },
];

// ── KPI skeleton (shown until /stats + /ask price_stats resolve) ────
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

function insightCardHtml(icon, title, value, hint) {
  return (
    '<div class="insight-card">' +
      '<div class="insight-card__icon">' + icon + '</div>' +
      '<div class="insight-card__body">' +
        '<div class="insight-card__title">' + escapeHtml(title) + '</div>' +
        '<div class="insight-card__value">' + (value || '') + '</div>' +
        (hint ? '<div class="insight-card__hint">' + escapeHtml(hint) + '</div>' : '') +
      '</div>' +
    '</div>'
  );
}

function actionCardHtml(a) {
  return (
    '<button class="action-card" ' + a.data + '>' +
      '<span class="action-card__icon">' + a.icon + '</span>' +
      '<span class="action-card__title">' + escapeHtml(a.title) + '</span>' +
      '<span class="action-card__subtitle">' + escapeHtml(a.subtitle) + '</span>' +
    '</button>'
  );
}

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
        insightCardHtml('🌸', 'Лидер по ассортименту', '<span class="placeholder">—</span>', '') +
        insightCardHtml('🏆', 'Самый дорогой букет',    '<span class="placeholder">—</span>', '') +
        insightCardHtml('📉', 'Максимальное падение',   '<span class="placeholder">—</span>', '') +
        insightCardHtml('📈', 'Максимальный рост',      '<span class="placeholder">—</span>', '') +
      '</div>' +
    '</section>' +

    '<section class="dashboard-section">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--actions"></span>' +
        '<h2 class="section-title">Быстрые действия</h2>' +
        '<span class="section-meta">один клик — один отчёт</span>' +
      '</header>' +
      '<div class="actions-grid">' +
        ACTIONS.map(actionCardHtml).join('') +
      '</div>' +
    '</section>';
}

// ── Data loaders ────────────────────────────────────────────────────

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
  const h = card.querySelector('.insight-card__hint');
  if (v) v.innerHTML = value;
  if (hint) {
    if (h) h.textContent = hint;
    else {
      const d = document.createElement('div');
      d.className = 'insight-card__hint';
      d.textContent = hint;
      card.querySelector('.insight-card__body').appendChild(d);
    }
  }
}

function setMeta(text) {
  const m = document.getElementById('kpiMeta');
  if (m) m.textContent = text;
}

// KPI fields that depend on /stats (total SKU / competitors / snapshot
// date / leader insight). Pulled from the store so we make zero extra
// HTTP requests — app.js already fetched /stats once at boot.
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
  // 1. KPI: total SKU + competitors + snapshot + leader insight come
  //    from store.stats. We apply the current snapshot synchronously
  //    (covers the case where mountDashboardTop runs after STATS_LOADED
  //    has already been dispatched) and then subscribe for future
  //    updates.
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

  // Top price changes for max-drop / max-rise insights.
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

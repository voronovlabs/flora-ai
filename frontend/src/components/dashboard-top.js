// Dashboard-top: AI Summary + рекомендации Flora AI + быстрые действия.
//
// This turn:
//   • Insight cards reframed как ВЫВОДЫ аналитика, не KPI:
//       — Лидер рынка по ассортименту       (note: "На N% больше товаров, чем у ближайшего конкурента.")
//       — Самое дорогое предложение на рынке (note: "Обнаружено в {source}.")
//       — Крупнейшее снижение цены          (note: "Вероятно действует акция или сезонная скидка.")
//       — Крупнейший рост цены              (note: "Наиболее заметный рост среди отслеживаемых товаров.")
//     Notes теперь динамические — обновляются вместе со значением.
//   • Перед рекомендациями появилась карточка AI Summary («Выводы Flora AI»).
//     Заполняется из тех же stats + askPreset результатов — никаких новых
//     fetch и никаких изменений в store / chat engine.
//   • Секция действий переименована в «Популярные запросы».
//   • CTA по-прежнему два варианта: "Открыть товар" / "Открыть магазин".
//
// Контракты: askPreset, select.stats, store.subscribeSlice, data-action
// делегирование — не трогаются.

import { askPreset } from '../api.js';
import { store, select } from '../state/store.js';
import { escapeHtml, fmtInt, fmtMoney, fmtDateISO } from '../format.js';

let host = null;

// ── source-name → external URL ───────────────────────────────────────

const KNOWN_SOURCES = {
  'florist':     'https://florist.ru',
  'florist.ru':  'https://florist.ru',
  'florist_ru':  'https://florist.ru',
  'flowwow':     'https://flowwow.com',
  'flowwow.com': 'https://flowwow.com',
  'semicvetic':  'https://semicvetic.com',
  'semicvetik':  'https://semicvetic.com',
  'семицветик': 'https://semicvetic.com',
  'azalia':      'https://azalianow.ru',
  'azalianow':   'https://azalianow.ru',
  'азалия':     'https://azalianow.ru',
  'dostavkatsvetov':    'https://dostavkatsvetov.ru',
  'dostavkatsvetov.ru': 'https://dostavkatsvetov.ru',
};

function sourceDomain(source) {
  if (source === null || source === undefined) return null;
  const raw = String(source).trim();
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (KNOWN_SOURCES[s]) return KNOWN_SOURCES[s];
  if (s.indexOf('://') >= 0) return safeUrl(raw);
  if (s.indexOf('.') > 0) return 'https://' + s;
  return null;
}

function safeUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (/^javascript:/i.test(s)) return null;
  if (s.indexOf('//') === 0) return 'https:' + s;
  if (s.charAt(0) === '/') return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

// Priority-ordered pick of a product URL from a row, per UX spec:
//   product_url > url > product_key (only if any parses as URL).
function pickProductUrl(row) {
  if (!row) return null;
  const candidates = [row.product_url, row.url, row.product_key];
  for (let i = 0; i < candidates.length; i++) {
    const u = safeUrl(candidates[i]);
    if (u) return u;
  }
  return null;
}

// ── HTML helpers ─────────────────────────────────────────────────────

// Insight card structure:
//
//   [icon]
//   Title (вывод аналитика)
//   Value (главный показатель — число / магазин / цена)
//   Hint (метрика + источник)
//   Note (one-line human interpretation)
//   ────────────
//   CTA →
function insightCardHtml(opts) {
  return (
    '<div class="insight-card" data-insight="' + escapeHtml(opts.key || '') + '">' +
      '<button type="button" class="insight-card__main" ' + (opts.mainData || '') + '>' +
        '<div class="insight-card__top">' +
          '<span class="insight-card__icon">' + opts.icon + '</span>' +
        '</div>' +
        '<div class="insight-card__title">' + escapeHtml(opts.title || '') + '</div>' +
        '<div class="insight-card__value">' + (opts.value || '<span class="placeholder">—</span>') + '</div>' +
        '<div class="insight-card__hint">' + (opts.hint ? escapeHtml(opts.hint) : '&nbsp;') + '</div>' +
        '<div class="insight-card__note">' + escapeHtml(opts.note || '') + '</div>' +
      '</button>' +
      '<a class="insight-card__cta" href="#" target="_blank" rel="noopener" aria-disabled="true">' +
        '<span class="insight-card__cta-label">' + escapeHtml(opts.cta || 'Открыть магазин') + '</span>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<line x1="5" y1="12" x2="19" y2="12"></line>' +
          '<polyline points="13 6 19 12 13 18"></polyline>' +
        '</svg>' +
      '</a>' +
    '</div>'
  );
}

const ACTION_PILLS = [
  { icon: '📦', label: 'Ассортимент',     data: 'data-action="preset" data-preset="count_sku"' },
  { icon: '💰', label: 'Цены',           data: 'data-action="preset" data-preset="price_stats"' },
  { icon: '📈', label: 'Изменения цен',   data: 'data-action="preset" data-preset="top_price_changes"' },
  { icon: '🏆', label: 'Лидеры рынка',    data: 'data-action="smart-question" data-question="Кто лидер рынка по ассортименту?"' },
  { icon: '📉', label: 'Самые дешёвые',   data: 'data-action="smart-question" data-question="Покажи 10 самых дешёвых букетов"' },
  { icon: '🤖', label: 'Свой вопрос',     data: 'data-action="focus-composer"' },
];

function actionPillHtml(a) {
  return (
    '<button type="button" class="action-pill" ' + a.data + '>' +
      '<span class="action-pill__icon">' + a.icon + '</span>' +
      '<span class="action-pill__label">' + escapeHtml(a.label) + '</span>' +
    '</button>'
  );
}

// ── shell render ────────────────────────────────────────────────────

function renderShell() {
  if (!host) return;
  host.innerHTML =

    // AI Summary — компактная сводка, рендерится сразу под hero.
    // Содержимое заполняется по мере прихода данных; до этого — скелет.
    '<section class="ai-summary" id="aiSummary" data-state="loading">' +
      '<header class="ai-summary__head">' +
        '<span class="ai-summary__icon">🤖</span>' +
        '<h2 class="ai-summary__title">Выводы Flora AI</h2>' +
      '</header>' +
      '<p class="ai-summary__lead" id="aiSummaryLead">Анализирую рынок…</p>' +
      '<ul class="ai-summary__list" id="aiSummaryList" hidden></ul>' +
    '</section>' +

    '<section class="dashboard-section dashboard-section--insights">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--insights"></span>' +
        '<h2 class="section-title">Рекомендации Flora AI</h2>' +
        '<span class="section-meta" id="insightsMeta">обновляется…</span>' +
      '</header>' +
      '<div class="insights-grid" id="insightsGrid">' +
        insightCardHtml({
          key: 'leader', icon: '🏆',
          title: 'Лидер рынка по ассортименту',
          note: 'Самый широкий ассортимент среди отслеживаемых магазинов.',
          mainData: 'data-action="smart-question" data-question="Расскажи подробнее про лидера рынка"',
          cta: 'Открыть магазин',
        }) +
        insightCardHtml({
          key: 'top-price', icon: '💎',
          title: 'Самое дорогое предложение на рынке',
          note: 'Цена значительно выше среднего уровня рынка.',
          mainData: 'data-action="smart-question" data-question="Покажи самый дорогой букет и магазин"',
          cta: 'Открыть магазин',
        }) +
        insightCardHtml({
          key: 'max-drop', icon: '📉',
          title: 'Крупнейшее снижение цены',
          note: 'Вероятно действует акция или сезонная скидка.',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть магазин',
        }) +
        insightCardHtml({
          key: 'max-rise', icon: '📈',
          title: 'Крупнейший рост цены',
          note: 'Наиболее заметный рост среди отслеживаемых товаров.',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть магазин',
        }) +
      '</div>' +
    '</section>' +

    '<section class="dashboard-section dashboard-section--actions">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--actions"></span>' +
        '<h2 class="section-title">Популярные запросы</h2>' +
      '</header>' +
      '<div class="actions-row">' +
        ACTION_PILLS.map(actionPillHtml).join('') +
      '</div>' +
    '</section>';
}

// ── value/cta/note binders ──────────────────────────────────────────

function setInsightValue(idx, value, hint) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  const v = card.querySelector('.insight-card__value');
  const h = card.querySelector('.insight-card__hint');
  if (v && value !== undefined) v.innerHTML = value;
  if (h && hint !== undefined) h.textContent = hint;
}

function setInsightNote(idx, note) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  const n = card.querySelector('.insight-card__note');
  if (n && note !== undefined && note !== null) n.textContent = note;
}

// Sets href + label. label can only be one of:
//   "Открыть товар" | "Открыть магазин"
function setInsightCta(idx, href, label) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  const cta = card.querySelector('.insight-card__cta');
  if (!cta) return;
  const labelEl = cta.querySelector('.insight-card__cta-label');
  if (labelEl && label) labelEl.textContent = label;
  if (href) {
    cta.setAttribute('href', href);
    cta.setAttribute('aria-disabled', 'false');
  } else {
    cta.setAttribute('href', '#');
    cta.setAttribute('aria-disabled', 'true');
  }
}

// Returns ["Открыть товар", productUrl] if a product URL exists on the
// row, otherwise ["Открыть магазин", sourceDomain(row.source) || null].
function pickCta(row) {
  const productUrl = pickProductUrl(row);
  if (productUrl) return ['Открыть товар', productUrl];
  return ['Открыть магазин', sourceDomain(row && row.source) || null];
}

function setHeroPulse(html) {
  const el = document.getElementById('heroPulse');
  if (!el) return;
  el.innerHTML = html;
  el.hidden = false;
}

function setInsightsMeta(text) {
  const m = document.getElementById('insightsMeta');
  if (m) m.textContent = text;
}

// ── AI Summary state ────────────────────────────────────────────────
//
// summary holds the four facts we surface as bullet points. We rebuild
// the bullet list whenever any of them updates — the order of bullets
// is stable and a missing fact is silently skipped.

const summary = {
  leader:    null, // { source }
  topPrice:  null, // { price }
  maxDrop:   null, // { diff }
  maxRise:   null, // { diff }
};

function renderAiSummary() {
  const root  = document.getElementById('aiSummary');
  const lead  = document.getElementById('aiSummaryLead');
  const list  = document.getElementById('aiSummaryList');
  if (!root || !lead || !list) return;

  const items = [];
  if (summary.leader && summary.leader.source) {
    items.push('Лидер по ассортименту — <strong>' + escapeHtml(String(summary.leader.source)) + '</strong>');
  }
  if (summary.topPrice && typeof summary.topPrice.price === 'number') {
    items.push('Самый дорогой товар — <strong>' + escapeHtml(fmtMoney(summary.topPrice.price)) + '</strong>');
  }
  if (summary.maxDrop && typeof summary.maxDrop.diff === 'number') {
    items.push('Максимальное снижение цены — <strong>' + escapeHtml(fmtMoney(summary.maxDrop.diff)) + '</strong>');
  }
  if (summary.maxRise && typeof summary.maxRise.diff === 'number') {
    const m = fmtMoney(summary.maxRise.diff).replace(/^[\-−]/, '');
    items.push('Максимальный рост цены — <strong>+' + escapeHtml(m) + '</strong>');
  }

  if (items.length === 0) {
    lead.textContent = 'Анализирую рынок…';
    list.hidden = true;
    list.innerHTML = '';
    root.setAttribute('data-state', 'loading');
    return;
  }

  root.setAttribute('data-state', 'ready');
  lead.textContent = 'Flora AI обнаружила ' + items.length + ' ' +
                     plural(items.length, 'значимое изменение', 'значимых изменения', 'значимых изменений') +
                     ' на рынке.';
  list.hidden = false;
  list.innerHTML = items.map(function (html) {
    return '<li>' + html + '</li>';
  }).join('');
}

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// ── bootstrap ───────────────────────────────────────────────────────

function pctOf(num, denom) {
  if (!denom || denom === 0) return null;
  return Math.round((num / denom) * 100);
}

function applyStatsSlice(stats) {
  if (!stats || !stats.loaded) {
    setInsightsMeta('обновляется…');
    return;
  }
  if (stats.snapshot_date) {
    setInsightsMeta('по данным от ' + fmtDateISO(stats.snapshot_date));
  }
  const sources = (stats.sources || []).slice().sort(function (a, b) {
    return (b.sku_count || 0) - (a.sku_count || 0);
  });
  if (sources.length > 0) {
    const leader = sources[0];
    const second = sources.length > 1 ? sources[1] : null;
    const share = pctOf(leader.sku_count || 0, stats.total_sku || 0);
    const hint = share !== null
      ? fmtInt(leader.sku_count) + ' позиций · ' + share + '% рынка'
      : fmtInt(leader.sku_count) + ' позиций';
    setInsightValue(0, escapeHtml(String(leader.source)), hint);
    // Dynamic note: соотношение с ближайшим конкурентом, если он есть.
    let note = 'Самый широкий ассортимент среди отслеживаемых магазинов.';
    if (second && (second.sku_count || 0) > 0) {
      const gap = Math.round((((leader.sku_count || 0) / (second.sku_count || 1)) - 1) * 100);
      if (gap > 0) {
        note = 'На ' + gap + '% больше товаров, чем у ближайшего конкурента.';
      }
    }
    setInsightNote(0, note);
    setInsightCta(0, sourceDomain(leader.source), 'Открыть магазин');

    summary.leader = { source: leader.source };
    renderAiSummary();
  }
}

function bootstrap() {
  applyStatsSlice(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStatsSlice);

  // Market-wide pricing (avg / min / max + benchmark insight)
  askPreset('price_stats').then(function (r) {
    const data = (r && r.payload && Array.isArray(r.payload.data)) ? r.payload.data : [];
    if (!data.length) return;

    let mins = [], avgs = [], maxs = [];
    let topRow = null, topMax = -Infinity;
    data.forEach(function (row) {
      if (typeof row.min_price === 'number') mins.push(row.min_price);
      if (typeof row.avg_price === 'number') avgs.push(row.avg_price);
      if (typeof row.max_price === 'number') {
        maxs.push(row.max_price);
        if (row.max_price > topMax) { topMax = row.max_price; topRow = row; }
      }
    });

    if (avgs.length && mins.length && maxs.length) {
      const avg = Math.round(avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length);
      const lo = Math.min.apply(null, mins);
      const hi = Math.max.apply(null, maxs);
      setHeroPulse(
        '<span class="hero-pulse__lead">Сегодня на рынке</span>' +
        '<span class="hero-pulse__sep">·</span>' +
        '<span>средняя <strong>' + fmtMoney(avg) + '</strong></span>' +
        '<span class="hero-pulse__sep">·</span>' +
        '<span>от <strong>' + fmtMoney(lo) + '</strong> до <strong>' + fmtMoney(hi) + '</strong></span>'
      );
    }
    if (topRow !== null) {
      setInsightValue(1, fmtMoney(topMax), 'у ' + String(topRow.source));
      setInsightNote(1, 'Обнаружено в ' + String(topRow.source) + '.');
      const cta = pickCta(topRow);
      setInsightCta(1, cta[1], cta[0]);

      summary.topPrice = { price: topMax, source: topRow.source };
      renderAiSummary();
    }
  }).catch(function () { /* keep skeleton */ });

  // Drop / Rise insights
  askPreset('top_price_changes').then(function (r) {
    const data = (r && r.payload && Array.isArray(r.payload.data)) ? r.payload.data : [];
    if (!data.length) return;

    const drops = data.filter(function (x) { return typeof x.diff === 'number' && x.diff < 0; })
                      .sort(function (a, b) { return a.diff - b.diff; });
    const rises = data.filter(function (x) { return typeof x.diff === 'number' && x.diff > 0; })
                      .sort(function (a, b) { return b.diff - a.diff; });

    if (drops.length) {
      const d = drops[0];
      const old_p = typeof d.old_price === 'number' ? d.old_price : null;
      const pct = old_p ? Math.round((d.diff / old_p) * 100) : null;
      const hint = (d.name || 'товар') +
                   (pct !== null ? ' · подешевел на ' + Math.abs(pct) + '%' : '') +
                   ' · ' + (d.source || '');
      setInsightValue(2, fmtMoney(d.diff), hint);
      const note = pct !== null && Math.abs(pct) >= 15
        ? 'Снижение на ' + Math.abs(pct) + '% — вероятно акция или распродажа.'
        : 'Вероятно действует акция или сезонная скидка.';
      setInsightNote(2, note);
      const cta = pickCta(d);
      setInsightCta(2, cta[1], cta[0]);

      summary.maxDrop = { diff: d.diff };
      renderAiSummary();
    }
    if (rises.length) {
      const u = rises[0];
      const old_p = typeof u.old_price === 'number' ? u.old_price : null;
      const pct = old_p ? Math.round((u.diff / old_p) * 100) : null;
      const hint = (u.name || 'товар') +
                   (pct !== null ? ' · подорожал на ' + pct + '%' : '') +
                   ' · ' + (u.source || '');
      const moneyTxt = fmtMoney(u.diff).replace(/^[\-−]/, '');
      setInsightValue(3, '+' + moneyTxt, hint);
      const note = pct !== null && pct >= 15
        ? 'Рост на ' + pct + '% — возможный сигнал повышенного спроса.'
        : 'Наиболее заметный рост среди отслеживаемых товаров.';
      setInsightNote(3, note);
      const cta = pickCta(u);
      setInsightCta(3, cta[1], cta[0]);

      summary.maxRise = { diff: u.diff };
      renderAiSummary();
    }
  }).catch(function () { /* keep skeleton */ });
}

export function mountDashboardTop(hostEl) {
  host = hostEl;
  if (!host) return;
  renderShell();
  bootstrap();
}

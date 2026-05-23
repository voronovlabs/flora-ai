// Dashboard-top: AI executive summary + рекомендации Flora AI + быстрые
// действия. Презентация поверх существующих stats / askPreset данных —
// без новых API-вызовов, без изменений в store / chat engine.
//
// This turn:
//   • Insight cards переработаны как ВЫВОДЫ аналитика. Каждая карточка
//     отвечает не "какое число?", а "что произошло?":
//       — Title  = одно предложение-вывод (например "dostavkatsvetov.ru
//                  удерживает лидерство по ассортименту").
//       — Text   = одна строка контекста ("1455 позиций · 23% рынка"
//                  или человеческая интерпретация).
//       — CTA    = "Открыть товар" / "Открыть магазин" (priority order:
//                  product_url > url > product_key → sourceDomain).
//     Big-number value-block убран — он создавал KPI-чувство.
//   • AI Summary: lead и буллеты переписаны человеческим языком:
//       — Lead:  "За последнее обновление обнаружено N заметных сигналов на рынке."
//       — Буллеты: полноценные предложения, а не "metric — value".
//
// Контракты askPreset / select.stats / store.subscribeSlice — не
// трогаются.

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

// Priority-ordered pick of a product URL from a row:
//   product_url > url > product_key (last only if it parses as URL).
function pickProductUrl(row) {
  if (!row) return null;
  const candidates = [row.product_url, row.url, row.product_key];
  for (let i = 0; i < candidates.length; i++) {
    const u = safeUrl(candidates[i]);
    if (u) return u;
  }
  return null;
}

// Returns ["Открыть товар", productUrl] if a product URL exists,
// otherwise ["Открыть магазин", sourceDomain(row.source) || null].
function pickCta(row) {
  const productUrl = pickProductUrl(row);
  if (productUrl) return ['Открыть товар', productUrl];
  return ['Открыть магазин', sourceDomain(row && row.source) || null];
}

// ── plural / formatting helpers ─────────────────────────────────────

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs >= 11 && abs <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

// ── insight card markup ─────────────────────────────────────────────
//
// Новый, компактный layout:
//
//   [icon]
//   Title  ← одно предложение-вывод
//   Text   ← одна строка контекста
//   ────────────
//   CTA →
//
// Все три поля обновляются динамически после прихода данных.

function insightCardHtml(opts) {
  return (
    '<div class="insight-card" data-insight="' + escapeHtml(opts.key || '') + '">' +
      '<button type="button" class="insight-card__main" ' + (opts.mainData || '') + '>' +
        '<span class="insight-card__icon">' + opts.icon + '</span>' +
        '<div class="insight-card__title">' + escapeHtml(opts.title || 'Анализирую…') + '</div>' +
        '<div class="insight-card__text">' + escapeHtml(opts.text || '') + '</div>' +
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
        insightCardHtml({ key: 'leader',    icon: '🏆',
          mainData: 'data-action="smart-question" data-question="Расскажи подробнее про лидера рынка"',
          cta: 'Открыть магазин' }) +
        insightCardHtml({ key: 'top-price', icon: '💎',
          mainData: 'data-action="smart-question" data-question="Покажи самый дорогой букет и магазин"',
          cta: 'Открыть магазин' }) +
        insightCardHtml({ key: 'max-drop',  icon: '📉',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть магазин' }) +
        insightCardHtml({ key: 'max-rise',  icon: '📈',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть магазин' }) +
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

// ── insight binders ─────────────────────────────────────────────────

function setInsight(idx, opts) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  const card = grid.children[idx];
  if (!card) return;
  if (opts.title !== undefined) {
    const t = card.querySelector('.insight-card__title');
    if (t) t.textContent = opts.title;
  }
  if (opts.text !== undefined) {
    const x = card.querySelector('.insight-card__text');
    if (x) x.textContent = opts.text;
  }
  if (opts.href !== undefined || opts.ctaLabel !== undefined) {
    const cta = card.querySelector('.insight-card__cta');
    if (cta) {
      if (opts.ctaLabel) {
        const labelEl = cta.querySelector('.insight-card__cta-label');
        if (labelEl) labelEl.textContent = opts.ctaLabel;
      }
      if (opts.href) {
        cta.setAttribute('href', opts.href);
        cta.setAttribute('aria-disabled', 'false');
      } else if (opts.href === null) {
        cta.setAttribute('href', '#');
        cta.setAttribute('aria-disabled', 'true');
      }
    }
  }
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

const summary = {
  leader:    null, // { source }
  topPrice:  null, // { price, source }
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
    items.push(escapeHtml(String(summary.leader.source)) + ' удерживает лидерство по ассортименту.');
  }
  if (summary.topPrice && typeof summary.topPrice.price === 'number') {
    items.push('Максимальная цена на рынке — <strong>' + escapeHtml(fmtMoney(summary.topPrice.price)) + '</strong>.');
  }
  if (summary.maxDrop && typeof summary.maxDrop.diff === 'number') {
    items.push('Самое сильное снижение цены — <strong>' + escapeHtml(fmtMoney(summary.maxDrop.diff)) + '</strong>.');
  }
  if (summary.maxRise && typeof summary.maxRise.diff === 'number') {
    const m = fmtMoney(summary.maxRise.diff).replace(/^[\-−]/, '');
    items.push('Самый заметный рост цены — <strong>+' + escapeHtml(m) + '</strong>.');
  }

  if (items.length === 0) {
    lead.textContent = 'Анализирую рынок…';
    list.hidden = true;
    list.innerHTML = '';
    root.setAttribute('data-state', 'loading');
    return;
  }

  root.setAttribute('data-state', 'ready');
  lead.textContent = 'За последнее обновление обнаружено ' + items.length + ' ' +
                     plural(items.length, 'заметный сигнал', 'заметных сигнала', 'заметных сигналов') +
                     ' на рынке.';
  list.hidden = false;
  list.innerHTML = items.map(function (html) {
    return '<li>' + html + '</li>';
  }).join('');
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
    const share  = pctOf(leader.sku_count || 0, stats.total_sku || 0);
    const text   = share !== null
      ? fmtInt(leader.sku_count) + ' позиций · ' + share + '% рынка'
      : fmtInt(leader.sku_count) + ' позиций';
    setInsight(0, {
      title: String(leader.source) + ' удерживает лидерство по ассортименту',
      text:  text,
      href:  sourceDomain(leader.source),
      ctaLabel: 'Открыть магазин',
    });
    summary.leader = { source: leader.source };
    renderAiSummary();
  }
}

function bootstrap() {
  applyStatsSlice(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStatsSlice);

  // Market-wide pricing (avg / min / max + top-price insight)
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
      // Title — это вывод, text — поддерживающий контекст.
      const avg = avgs.length
        ? Math.round(avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length)
        : null;
      let text = fmtMoney(topMax);
      if (avg && topMax >= avg * 1.5) {
        text += ' · значительно выше среднего рынка';
      } else if (avg) {
        text += ' · выше среднего рынка';
      }
      const cta = pickCta(topRow);
      setInsight(1, {
        title: 'Самое дорогое предложение найдено у ' + String(topRow.source),
        text:  text,
        href:  cta[1],
        ctaLabel: cta[0],
      });
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
      const noun = (d.name && /букет/i.test(d.name)) ? 'Букет' : 'Товар';
      let text;
      if (pct !== null) {
        const tail = Math.abs(pct) >= 30
          ? ' Возможна акция или сезонная скидка.'
          : ' Вероятно действует временная скидка.';
        text = noun + ' подешевел на ' + Math.abs(pct) + '%.' + tail;
      } else {
        text = noun + ' подешевел на ' + fmtMoney(Math.abs(d.diff)) + '. Возможна акция или сезонная скидка.';
      }
      const cta = pickCta(d);
      setInsight(2, {
        title: 'Самое заметное снижение цены',
        text:  text,
        href:  cta[1],
        ctaLabel: cta[0],
      });
      summary.maxDrop = { diff: d.diff };
      renderAiSummary();
    }
    if (rises.length) {
      const u = rises[0];
      const old_p = typeof u.old_price === 'number' ? u.old_price : null;
      const pct = old_p ? Math.round((u.diff / old_p) * 100) : null;
      let text;
      if (pct !== null) {
        const tail = pct >= 30
          ? ' Сигнал заметного скачка спроса.'
          : ' Возможный сигнал повышенного спроса.';
        text = 'Цена выросла на ' + pct + '%.' + tail;
      } else {
        text = 'Цена выросла на ' + fmtMoney(Math.abs(u.diff)) + '. Возможный сигнал повышенного спроса.';
      }
      const cta = pickCta(u);
      setInsight(3, {
        title: 'Самый заметный рост цены',
        text:  text,
        href:  cta[1],
        ctaLabel: cta[0],
      });
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

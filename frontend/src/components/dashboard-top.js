// Dashboard-top: AI recommendations + compact action pills.
//
// What this turn changed conceptually:
//   • The KPI strip is gone — the three at-a-glance numbers live in the
//     hero chips, and the avg/min/max ones appear inline in the hero
//     "pulse" line (also driven from here).
//   • Insight cards now look like analyst recommendations:
//        [badge] · [title] · [main value] · [hint] · [CTA link]
//     They have TWO actions: the main body is a <button> that dispatches
//     existing data-action (smart-question / preset), and the CTA at the
//     bottom is a real <a target="_blank" rel="noopener"> pointing to the
//     product URL (if data has one) or the source domain.
//   • The 6 action cards become a single row of compact pills.
//
// All actions still flow through the existing data-action delegation in
// app.js — no new event handlers, no store/reducer/ChatEngine changes.

import { askPreset } from '../api.js';
import { store, select } from '../state/store.js';
import { escapeHtml, fmtInt, fmtMoney, fmtDateISO } from '../format.js';

let host = null;

// ── source-name → external URL ───────────────────────────────────────
// We use this to give every insight card a real "Перейти на сайт" link.
// Order matters: most-specific (full host) first, then known short
// names. Anything we can't recognise becomes null so the CTA stays
// disabled instead of pointing at a broken target.

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

// ── HTML helpers ─────────────────────────────────────────────────────

function badgeLabel(severity) {
  if (severity === 'opportunity') return 'Возможность';
  if (severity === 'risk')        return 'Риск';
  if (severity === 'leader')      return 'Лидер рынка';
  if (severity === 'benchmark')   return 'Ценовой ориентир';
  return 'Сигнал';
}

function insightCardHtml(opts) {
  const sev = opts.severity || 'leader';
  return (
    '<div class="insight-card insight-card--' + sev + '" data-insight="' + escapeHtml(opts.key || '') + '">' +
      '<button type="button" class="insight-card__main" ' + (opts.mainData || '') + '>' +
        '<div class="insight-card__top">' +
          '<span class="insight-card__icon">' + opts.icon + '</span>' +
          '<span class="insight-card__badge insight-card__badge--' + sev + '">' +
            escapeHtml(badgeLabel(sev)) +
          '</span>' +
        '</div>' +
        '<div class="insight-card__title">' + escapeHtml(opts.title || '') + '</div>' +
        '<div class="insight-card__value">' + (opts.value || '<span class="placeholder">—</span>') + '</div>' +
        '<div class="insight-card__hint">' + (opts.hint ? escapeHtml(opts.hint) : '&nbsp;') + '</div>' +
      '</button>' +
      '<a class="insight-card__cta" href="#" target="_blank" rel="noopener" aria-disabled="true">' +
        '<span class="insight-card__cta-label">' + escapeHtml(opts.cta || 'Подробнее') + '</span>' +
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
    '<section class="dashboard-section dashboard-section--insights">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--insights"></span>' +
        '<h2 class="section-title">Рекомендации Flora AI</h2>' +
        '<span class="section-meta" id="insightsMeta">обновляется…</span>' +
      '</header>' +
      '<div class="insights-grid" id="insightsGrid">' +
        insightCardHtml({
          key: 'leader', severity: 'leader', icon: '🏆',
          title: 'Самый широкий ассортимент',
          mainData: 'data-action="smart-question" data-question="Расскажи подробнее про лидера рынка"',
          cta: 'Открыть магазин',
        }) +
        insightCardHtml({
          key: 'top-price', severity: 'benchmark', icon: '💎',
          title: 'Максимальная цена рынка',
          mainData: 'data-action="smart-question" data-question="Покажи самый дорогой букет и магазин"',
          cta: 'Перейти на сайт',
        }) +
        insightCardHtml({
          key: 'max-drop', severity: 'opportunity', icon: '📉',
          title: 'Крупнейшее снижение цены',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть детали',
        }) +
        insightCardHtml({
          key: 'max-rise', severity: 'risk', icon: '📈',
          title: 'Крупнейший рост цены',
          mainData: 'data-action="preset" data-preset="top_price_changes"',
          cta: 'Открыть детали',
        }) +
      '</div>' +
    '</section>' +

    '<section class="dashboard-section dashboard-section--actions">' +
      '<header class="section-head">' +
        '<span class="section-dot section-dot--actions"></span>' +
        '<h2 class="section-title">Спросить аналитика</h2>' +
      '</header>' +
      '<div class="actions-row">' +
        ACTION_PILLS.map(actionPillHtml).join('') +
      '</div>' +
    '</section>';
}

// ── insight binders ─────────────────────────────────────────────────

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
    const share = pctOf(leader.sku_count || 0, stats.total_sku || 0);
    const hint = share !== null
      ? fmtInt(leader.sku_count) + ' позиций · ' + share + '% рынка'
      : fmtInt(leader.sku_count) + ' позиций';
    setInsightValue(0, escapeHtml(String(leader.source)), hint);
    setInsightCta(0, sourceDomain(leader.source), 'Открыть магазин');
  }
}

function bootstrap() {
  applyStatsSlice(select.stats(store.getState()));
  store.subscribeSlice(select.stats, applyStatsSlice);

  // Market-wide pricing (avg / min / max + benchmark insight)
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
    if (topMaxSource !== null) {
      setInsightValue(1, fmtMoney(topMax), 'у ' + String(topMaxSource));
      setInsightCta(1, sourceDomain(topMaxSource), 'Перейти на сайт');
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
      const productUrl = safeUrl(d.product_key);
      if (productUrl) {
        setInsightCta(2, productUrl, 'Открыть товар');
      } else {
        setInsightCta(2, sourceDomain(d.source), 'Перейти на сайт');
      }
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
      const productUrl = safeUrl(u.product_key);
      if (productUrl) {
        setInsightCta(3, productUrl, 'Открыть товар');
      } else {
        setInsightCta(3, sourceDomain(u.source), 'Перейти на сайт');
      }
    }
  }).catch(function () { /* keep skeleton */ });
}

export function mountDashboardTop(hostEl) {
  host = hostEl;
  if (!host) return;
  renderShell();
  bootstrap();
}

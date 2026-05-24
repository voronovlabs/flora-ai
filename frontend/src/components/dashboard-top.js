// Dashboard-top: рекомендации Flora AI + быстрые действия.
// Презентация поверх существующих stats / askPreset данных — без новых
// API-вызовов, без изменений в store / chat engine.
//
// This turn:
//   • Подключён brand_name + site_url из ref.shop_directory.
//     KNOWN_SOURCES / sourceDomain удалены — backend теперь сам
//     отдаёт каждой строке `site_url` (либо null, тогда fallback на
//     'https://' + source).
//   • pickCta всё ещё проверяет product_url > url > product_key для
//     товарного линка; если их нет — берёт row.site_url.
//
// Контракты askPreset / select.stats / store.subscribeSlice — не
// трогаются.

import { askPreset } from '../api.js';
import { store, select } from '../state/store.js';
import { escapeHtml, fmtInt, fmtMoney, fmtDateISO } from '../format.js';

let host = null;

// ── URL helpers ─────────────────────────────────────────────────────

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

// Backend uses ref.shop_directory.site_url; if missing, fall back to
// scheme + raw domain.
function shopUrl(row) {
  if (!row) return null;
  const su = safeUrl(row.site_url);
  if (su) return su;
  const src = row.source;
  if (src && String(src).indexOf('.') > 0) {
    return 'https://' + String(src);
  }
  return null;
}

// Brand name fallback: backend `brand_name` || raw `source` || '—'.
function shopLabel(row) {
  if (!row) return '—';
  if (row.brand_name) return String(row.brand_name);
  if (row.source) return String(row.source);
  return '—';
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

// Returns ["Открыть товар", productUrl] if a product URL exists on the
// row, otherwise ["Открыть магазин", shopUrl(row)].
function pickCta(row) {
  const productUrl = pickProductUrl(row);
  if (productUrl) return ['Открыть товар', productUrl];
  return ['Открыть магазин', shopUrl(row)];
}

// ── insight card markup ─────────────────────────────────────────────
//
// Карточка отвечает на три вопроса:
//
//   [icon]
//   Title              ← что произошло (без доменов в заголовке)
//   Text               ← краткое объяснение события
//   Рекомендация Flora AI: <action>   ← что делать (или «Требуется дополнительный анализ»)
//   ────────────
//   CTA →
//
// Все три текстовых поля обновляются динамически. До прихода данных
// показывается мягкий placeholder — без выдуманных действий.

function insightCardHtml(opts) {
  return (
    '<div class="insight-card" data-insight="' + escapeHtml(opts.key || '') + '">' +
      '<button type="button" class="insight-card__main" ' + (opts.mainData || '') + '>' +
        '<span class="insight-card__icon">' + opts.icon + '</span>' +
        '<div class="insight-card__title">' + escapeHtml(opts.title || 'Анализирую…') + '</div>' +
        '<div class="insight-card__text">' + escapeHtml(opts.text || '') + '</div>' +
        '<div class="insight-card__rec">' +
          '<span class="insight-card__rec-label">Рекомендация Flora AI:</span> ' +
          '<span class="insight-card__rec-text">' + escapeHtml(opts.recommendation || '—') + '</span>' +
        '</div>' +
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

    // Блок «Выводы Flora AI» удалён — он дублировал карточки ниже
    // и не нёс дополнительной ценности. Сразу после hero идут
    // карточки рекомендаций.
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
  if (opts.recommendation !== undefined) {
    const r = card.querySelector('.insight-card__rec-text');
    if (r) r.textContent = opts.recommendation;
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

// ── recommendation helpers ──────────────────────────────────────────
//
// Каждая функция возвращает короткий совет, основанный на уже посчи-
// танных метриках. Если уверенности недостаточно (нет percent'а в
// данных) — возвращаем честное «Требуется дополнительный анализ».
// Никаких выдуманных действий.

function recommendLeader(sharePct) {
  if (typeof sharePct === 'number' && sharePct >= 25) {
    return 'Изучить структуру каталога лидера — это ориентир по востребованным категориям.';
  }
  return 'Изучить категории лидера, чтобы найти пробелы в вашем ассортименте.';
}

function recommendPremium(maxPrice, avgPrice) {
  if (typeof avgPrice === 'number' && avgPrice > 0 && maxPrice >= avgPrice * 1.5) {
    return 'Изучить ассортимент премиальных позиций конкурентов и оценить потенциал верхнего ценового сегмента.';
  }
  return 'Премиальный сегмент пока умеренный — продолжайте наблюдать за динамикой.';
}

function recommendDrop(pct) {
  if (pct === null || pct === undefined) return 'Требуется дополнительный анализ.';
  const abs = Math.abs(pct);
  if (abs >= 50) return 'Возможно, это акция, распродажа остатков или разовая корректировка цены. Не реагировать изменением цены и понаблюдать 3–5 дней.';
  if (abs >= 20) return 'Возможна временная акция. Подождать 2–3 дня и проверить, вернётся ли цена.';
  if (abs >= 10) return 'Возможна точечная корректировка цены конкурентом. Сравнить с вашей ценой.';
  return 'Колебание в пределах нормы. Сохранять текущую цену.';
}

function recommendRise(pct) {
  if (pct === null || pct === undefined) return 'Требуется дополнительный анализ.';
  if (pct >= 50) return 'Может указывать на повышенный спрос или изменение себестоимости. Проверить аналогичные позиции в вашем ассортименте и оценить повышение цены.';
  if (pct >= 20) return 'Может указывать на повышенный спрос или изменение себестоимости. Сравнить с вашей текущей ценой и рассмотреть повышение.';
  if (pct >= 10) return 'Возможная коррекция цены конкурентом. Сравнить с вашей ценой.';
  return 'Изменение в пределах нормы. Корректировка цены не требуется.';
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
    const share  = pctOf(leader.sku_count || 0, stats.total_sku || 0);

    let text = 'В каталоге ' + fmtInt(leader.sku_count) + ' позиций';
    if (share !== null) text += ' · доля рынка ' + share + '%';
    if (second && (second.sku_count || 0) > 0) {
      const gap = Math.round((((leader.sku_count || 0) / (second.sku_count || 1)) - 1) * 100);
      if (gap > 0) text += ' · опережает ближайшего конкурента на ' + gap + '%';
    }

    setInsight(0, {
      title: 'Лидер рынка сохраняет преимущество по ассортименту',
      text:  text + '.',
      recommendation: recommendLeader(share),
      href:  shopUrl(leader),
      ctaLabel: 'Открыть магазин',
    });
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
      const avg = avgs.length
        ? Math.round(avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length)
        : null;
      const text = 'Обнаружено предложение стоимостью ' + fmtMoney(topMax) +
                   ' — подтверждает наличие предложений в высоком ценовом сегменте.';
      const cta = pickCta(topRow);
      setInsight(1, {
        title: 'На рынке есть предложения с высоким чеком',
        text:  text,
        recommendation: recommendPremium(topMax, avg),
        href:  cta[1],
        ctaLabel: cta[0],
      });
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
      const new_p = typeof d.new_price === 'number' ? d.new_price : null;
      const pct = old_p ? Math.round((d.diff / old_p) * 100) : null;

      let text;
      if (pct !== null && old_p !== null && new_p !== null) {
        text = 'Снижение составило ' + Math.abs(pct) + '%, цена упала с ' +
               fmtMoney(old_p) + ' до ' + fmtMoney(new_p) + '.';
      } else {
        text = 'Зафиксировано снижение на ' + fmtMoney(Math.abs(d.diff)) + '.';
      }

      const title = (pct !== null && Math.abs(pct) >= 30)
        ? 'Конкурент резко снизил цену на отслеживаемый товар'
        : 'Зафиксировано заметное снижение цены';

      const cta = pickCta(d);
      setInsight(2, {
        title: title,
        text:  text,
        recommendation: recommendDrop(pct),
        href:  cta[1],
        ctaLabel: cta[0],
      });
    }
    if (rises.length) {
      const u = rises[0];
      const old_p = typeof u.old_price === 'number' ? u.old_price : null;
      const new_p = typeof u.new_price === 'number' ? u.new_price : null;
      const pct = old_p ? Math.round((u.diff / old_p) * 100) : null;

      let text;
      if (pct !== null && old_p !== null && new_p !== null) {
        text = 'Рост составил ' + pct + '%, цена поднялась с ' +
               fmtMoney(old_p) + ' до ' + fmtMoney(new_p) + '.';
      } else {
        text = 'Зафиксировано подорожание на ' + fmtMoney(Math.abs(u.diff)) + '.';
      }

      const title = (pct !== null && pct >= 30)
        ? 'На рынке заметно вырос ценник на отслеживаемый товар'
        : 'Зафиксирован заметный рост цены';

      const cta = pickCta(u);
      setInsight(3, {
        title: title,
        text:  text,
        recommendation: recommendRise(pct),
        href:  cta[1],
        ctaLabel: cta[0],
      });
    }
  }).catch(function () { /* keep skeleton */ });
}

export function mountDashboardTop(hostEl) {
  host = hostEl;
  if (!host) return;
  renderShell();
  bootstrap();
}

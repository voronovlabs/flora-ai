// Single source of truth for the "Попробуйте спросить" empty-state.
//
// Это место для разметки empty-state'а правой панели. Любой код, который
// хочет показать «нет данных», должен использовать INTRO_HTML или
// renderIntro(host) отсюда. Разметка совпадает с server-rendered интро
// в index.html, чтобы переключение с одного на другое было незаметно.
//
// Кнопки используют существующий data-action="smart-question" делегатор
// в app.js — никаких новых обработчиков не нужно.

export const INTRO_HTML = (
  '<section class="results-intro">' +
    '<header class="results-intro__head">' +
      '<span class="results-intro__icon">💬</span>' +
      '<h4 class="results-intro__title">Попробуйте спросить</h4>' +
    '</header>' +
    '<ul class="results-intro__list">' +
      '<li><button type="button" class="results-intro__q" ' +
        'data-action="smart-question" data-question="Где самые дорогие букеты?">' +
        'Где самые дорогие букеты?</button></li>' +
      '<li><button type="button" class="results-intro__q" ' +
        'data-action="smart-question" data-question="Какие товары сильнее всего подешевели?">' +
        'Какие товары сильнее всего подешевели?</button></li>' +
      '<li><button type="button" class="results-intro__q" ' +
        'data-action="smart-question" data-question="Кто лидер рынка по ассортименту?">' +
        'Кто лидер рынка по ассортименту?</button></li>' +
      '<li><button type="button" class="results-intro__q" ' +
        'data-action="smart-question" data-question="Где минимальные цены?">' +
        'Где минимальные цены?</button></li>' +
    '</ul>' +
  '</section>'
);

export function renderIntro(host) {
  if (!host) return;
  host.innerHTML = INTRO_HTML;
}

// Оболочка приложения: навигация между разделами (адрес вида #thoughts), меню «⋯» и запуск синхронизации.
import { sections, extras } from './modules/index.js';
import { startAutoSync } from './core/sync.js';
import { setupMenu, applyTheme } from './core/menu.js';
import { h } from './core/ui.js';
import { icon } from './core/icons.js';

const all = [...sections, ...extras];
const main = document.getElementById('main');
const nav = document.getElementById('nav');
let unmount = null;

// адрес вида #tasks или #tasks?done — после «?» вид внутри раздела
function current() {
  const id = location.hash.slice(1).split('?')[0];
  return all.find(m => m.id === id) || sections[0];
}

function renderNav(active) {
  // только иконки; название — для экранного диктора и подсказки
  nav.replaceChildren(...sections.map(m =>
    h('a.nav-item' + (m === active ? '.on' : ''), { href: '#' + m.id, 'aria-current': m === active ? 'page' : null, 'aria-label': m.title, title: m.title },
      icon(m.icon))));
  nav.hidden = sections.length < 2;
}

function show() {
  const m = current();
  unmount?.();
  main.replaceChildren();
  main.dataset.section = m.id;
  document.documentElement.dataset.section = m.id;   // цвет фона раздела — в css/base.css
  unmount = m.mount(main) || null;
  renderNav(m);
  scrollTo(0, 0);
}

addEventListener('hashchange', show);
applyTheme();
setupMenu(document.getElementById('menu-btn'), () => current().menu || []);
show();
startAutoSync();

navigator.storage?.persist?.();   // просим браузер не чистить данные при нехватке места
// обновления: при каждом возвращении в приложение спрашиваем, нет ли новой версии; когда новая версия
// скачалась — перезагружаемся сами (но не посреди набора текста — тогда при следующем возвращении)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;
  let pending = false;
  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.value;
  const reloadIfIdle = () => { if (pending && !typing()) location.reload(); };
  sw.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { reg.update().catch(() => {}); reloadIfIdle(); } });
  });
  sw.addEventListener('controllerchange', () => { if (hadController) { pending = true; reloadIfIdle(); } });
}

// Оболочка приложения: навигация между разделами (адрес вида #thoughts), меню «⋯» и запуск синхронизации.
import { sections, extras } from './modules/index.js';
import { startAutoSync } from './core/sync.js';
import { setupMenu, applyTheme } from './core/menu.js';
import { h } from './core/ui.js';

const all = [...sections, ...extras];
const main = document.getElementById('main');
const nav = document.getElementById('nav');
let unmount = null;

function current() {
  const id = location.hash.slice(1);
  return all.find(m => m.id === id) || sections[0];
}

function renderNav(active) {
  nav.replaceChildren(...sections.map(m =>
    h('a.nav-item' + (m === active ? '.on' : ''), { href: '#' + m.id, 'aria-current': m === active ? 'page' : null },
      h('span.nav-icon', { 'aria-hidden': 'true' }, m.icon), h('span.nav-label', null, m.short || m.title))));
  nav.hidden = sections.length < 2;
}

function show() {
  const m = current();
  unmount?.();
  main.replaceChildren();
  main.dataset.section = m.id;
  unmount = m.mount(main) || null;
  renderNav(m);
  scrollTo(0, 0);
}

addEventListener('hashchange', show);
applyTheme();
setupMenu(document.getElementById('menu-btn'));
show();
startAutoSync();

navigator.storage?.persist?.();   // просим браузер не чистить данные при нехватке места
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

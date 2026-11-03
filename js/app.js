// Оболочка приложения: навигация между разделами (адрес вида #thoughts) и запуск синхронизации.
import { sections, extras } from './modules/index.js';
import { startAutoSync } from './core/sync.js';
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
  // пока раздел один, нижняя навигация не нужна — только кнопка настроек
  nav.replaceChildren(
    ...(sections.length > 1 ? sections.map(m =>
      h('a.nav-item' + (m === active ? '.on' : ''), { href: '#' + m.id, 'aria-current': m === active ? 'page' : null },
        h('span.nav-icon', { 'aria-hidden': 'true' }, m.icon), h('span', null, m.title))) : []),
  );
  nav.hidden = sections.length < 2;
  const gear = document.getElementById('gear');
  gear.href = active.id === 'settings' ? '#' + sections[0].id : '#settings';
  gear.textContent = active.id === 'settings' ? '✕' : '⚙';
  gear.setAttribute('aria-label', active.id === 'settings' ? 'Закрыть настройки' : 'Настройки');
}

function show() {
  const m = current();
  unmount?.();
  main.replaceChildren();
  main.dataset.section = m.id;
  unmount = m.mount(main) || null;
  renderNav(m);
}

addEventListener('hashchange', show);
show();
startAutoSync();

navigator.storage?.persist?.();   // просим браузер не чистить данные при нехватке места
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

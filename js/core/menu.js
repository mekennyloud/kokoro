// Меню «⋯» в правом верхнем углу: всё служебное (тема, синхронизация, копия) — здесь, а не на экранах разделов.
import { pref, setPref } from './prefs.js';
import * as sync from './sync.js';
import { h } from './ui.js';

const THEMES = [['light', 'Day'], ['dark', 'Night'], ['auto', 'System']];

// по умолчанию — дневной жёлтый постер; Night и System выбираются в меню
export function applyTheme(t = pref('theme', 'light')) {
  document.documentElement.dataset.theme = t;
}

export function setupMenu(button) {
  let panel = null;

  function close() {
    panel?.remove(); panel = null;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  }
  const outside = e => { if (!panel?.contains(e.target) && e.target !== button) close(); };

  function open() {
    const theme = pref('theme', 'light');
    panel = h('div.menu', { role: 'menu' },
      h('div.menu-group', null,
        h('span.menu-label', null, 'Theme'),
        h('div.menu-chips', null, THEMES.map(([id, name]) =>
          h('button.chip.small' + (theme === id ? '.on' : ''), {
            onclick: () => { setPref('theme', id); applyTheme(id); close(); open(); },
          }, name)))),
      h('a.menu-item', { href: '#settings', onclick: close }, 'Sync & backup',
        sync.isStale() && h('span.menu-warn', null, ' · not synced for a while')),
    );
    document.body.append(panel);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
  }

  button.addEventListener('click', () => (panel ? close() : open()));
  // точка на «⋯», если давно не было синхронизации: иначе можно не заметить, что записи копятся только здесь
  const mark = () => button.classList.toggle('stale', sync.isStale());
  sync.onState(mark); mark(); setInterval(mark, 600000);
  addEventListener('hashchange', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

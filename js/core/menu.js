// Меню «⋯» в правом верхнем углу: всё служебное (тема, синхронизация, копия) — здесь, а не на экранах разделов.
import { pref, setPref } from './prefs.js';
import { h } from './ui.js';

const THEMES = [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']];

export function applyTheme(t = pref('theme', 'auto')) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
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
    const theme = pref('theme', 'auto');
    panel = h('div.menu', { role: 'menu' },
      h('div.menu-group', null,
        h('span.menu-label', null, 'Тема'),
        h('div.menu-chips', null, THEMES.map(([id, name]) =>
          h('button.chip.small' + (theme === id ? '.on' : ''), {
            onclick: () => { setPref('theme', id); applyTheme(id); close(); open(); },
          }, name)))),
      h('a.menu-item', { href: '#settings', onclick: close }, 'Синхронизация и копия'),
    );
    document.body.append(panel);
    button.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
  }

  button.addEventListener('click', () => (panel ? close() : open()));
  addEventListener('hashchange', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

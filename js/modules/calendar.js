// Календарь: пока просто видеть даты. Точкой отмечены дни, на которые что-то записано в «Не хочу помнить, но надо»;
// нажми на день — увидишь, что там, и сможешь добавить на этот день.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h } from '../core/ui.js';

export default {
  id: 'calendar',
  title: 'Календарь',
  icon: '▦',

  mount(root) {
    const now = new Date();
    let month = new Date(now.getFullYear(), now.getMonth(), 1);
    let selected = dates.today();
    let later = [];

    const titleEl = h('h2.cal-title');
    const gridEl = h('div.cal-grid', { role: 'grid' });
    const dayEl = h('section.cal-day');
    const shift = n => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); render(); };

    root.append(
      h('header.page-head', null, h('h1', null, 'Календарь')),
      h('section.card.cal', null,
        h('div.cal-head', null,
          h('button.icon-btn', { onclick: () => shift(-1), 'aria-label': 'Предыдущий месяц' }, '‹'),
          titleEl,
          h('button.icon-btn', { onclick: () => shift(1), 'aria-label': 'Следующий месяц' }, '›')),
        gridEl,
        h('button.link.cal-today', { onclick: () => { month = new Date(now.getFullYear(), now.getMonth(), 1); selected = dates.today(); render(); } }, 'Сегодня')),
      dayEl,
    );

    function render() {
      titleEl.textContent = dates.monthTitle(month);
      const t = dates.today();
      const marked = new Set(later.filter(l => !l.done).map(l => l.date));
      const first = (month.getDay() + 6) % 7;   // понедельник — первый
      const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < first; i++) cells.push(h('span.cal-cell.blank'));
      for (let d = 1; d <= count; d++) {
        const s = dates.ymd(new Date(month.getFullYear(), month.getMonth(), d));
        const cls = (s === t ? '.today' : '') + (s === selected ? '.sel' : '') + (marked.has(s) ? '.marked' : '')
          + ((first + d - 1) % 7 >= 5 ? '.weekend' : '');
        cells.push(h('button.cal-cell' + cls, { onclick: () => { selected = s; render(); }, 'aria-label': dates.long(s) }, String(d)));
      }
      gridEl.replaceChildren(...dates.WEEKDAYS.map(w => h('span.cal-wd', null, w)), ...cells);
      renderDay();
    }

    function renderDay() {
      const items = later.filter(l => l.date === selected);
      const input = h('input.field', { placeholder: 'Добавить на этот день', autocomplete: 'off', enterKeyHint: 'done' });
      dayEl.replaceChildren(
        h('h2', null, `${dates.long(selected)} · ${dates.relative(selected)}`),
        items.length ? h('ul.cal-items', null, items.map(l => h('li' + (l.done ? '.done' : ''), null, h('a', { href: '#later' }, l.text))))
          : h('p.hint', null, 'Ничего не записано.'),
        h('form.cal-add', { onsubmit: async e => {
          e.preventDefault();
          const text = input.value.trim();
          if (text) await db.save({ type: 'later', text, date: selected, done: false });
        } }, input, h('button.btn', { type: 'submit' }, 'Добавить')),
      );
    }

    async function load() {
      later = await db.list('later');
      render();
    }

    load();
    return db.onChange(load);
  },
};

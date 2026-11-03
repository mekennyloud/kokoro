// Календарь: свои планы на даты. Не связан с «Don't want to remember» — там то, что хочется забыть до срока,
// а здесь то, что планируешь. Нажми на название месяца — можно сразу перейти к любому месяцу и году.
// Ниже — планы за выбранный день, неделю, месяц, следующий месяц или все сразу.
// Записи: event { text, date: 'ГГГГ-ММ-ДД' }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { pref, setPref } from '../core/prefs.js';
import { h, removeWithUndo, plusIcon } from '../core/ui.js';

const RANGES = [['day', 'This day'], ['week', 'This week'], ['month', 'This month'], ['next', 'Next month'], ['all', 'All plans']];

/** [с, по] включительно; null — без границы */
function bounds(range, selected) {
  const t = dates.today();
  if (range === 'day') return [selected, selected];
  if (range === 'week') { const a = dates.startOfWeek(t); return [a, dates.addDays(a, 6)]; }
  if (range === 'month') return [dates.startOfMonth(t), dates.endOfMonth(t)];
  if (range === 'next') { const a = dates.addMonths(dates.startOfMonth(t), 1); return [a, dates.endOfMonth(a)]; }
  return [null, null];
}

export default {
  id: 'calendar',
  title: 'Calendar',
  icon: 'calendar',

  mount(root) {
    const now = new Date();
    let month = new Date(now.getFullYear(), now.getMonth(), 1);
    let selected = dates.today();
    let range = pref('calendar:range', 'day');
    let jumping = false, editId = null, adding = false;
    let events = [];

    const titleEl = h('button.cal-title', { onclick: () => { jumping = !jumping; render(); }, 'aria-expanded': 'false' });
    const jumpEl = h('div');
    const gridEl = h('div.cal-grid', { role: 'grid' });
    const dayEl = h('section.cal-day');
    const rangesEl = h('div.cal-ranges', { role: 'group', 'aria-label': 'Show plans for' });
    const listEl = h('div.cal-list');
    const shift = n => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); render(); };

    // ── выбранный день; поле «добавить план» — только по кнопке «+» ──
    const fab = h('button.fab', { type: 'button', 'aria-label': 'Add a plan for the selected day', 'aria-expanded': 'false', onclick: () => {
      adding = !adding;
      renderDay();
      if (adding) { const i = dayEl.querySelector('input'); i.focus({ preventScroll: true }); dayEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    } }, plusIcon());

    root.append(
      h('header.page-head', null, h('h1', null, 'Calendar')),
      h('section.card.cal', null,
        h('div.cal-head', null,
          h('button.icon-btn', { onclick: () => shift(-1), 'aria-label': 'Previous month' }, '‹'),
          titleEl,
          h('button.icon-btn', { onclick: () => shift(1), 'aria-label': 'Next month' }, '›')),
        jumpEl,
        gridEl,
        h('button.link.cal-today', { onclick: () => { month = new Date(now.getFullYear(), now.getMonth(), 1); selected = dates.today(); jumping = false; render(); } }, 'Today')),
      dayEl, rangesEl, listEl, fab,
    );

    // ── переход к месяцу и году ──
    function renderJump() {
      titleEl.setAttribute('aria-expanded', jumping ? 'true' : 'false');
      if (!jumping) return jumpEl.replaceChildren();
      const m = h('select', { 'aria-label': 'Month' }, dates.MONTHS.map((name, i) => h('option', { value: i, selected: i === month.getMonth() }, name)));
      const y = h('input', { type: 'number', inputMode: 'numeric', min: 1900, max: 2200, value: month.getFullYear(), 'aria-label': 'Year' });
      const go = e => {
        e?.preventDefault();
        const year = parseInt(y.value, 10);
        if (!(year >= 1900 && year <= 2200)) return y.focus();
        month = new Date(year, +m.value, 1);
        selected = dates.ymd(month);
        jumping = false;
        render();
      };
      jumpEl.replaceChildren(h('form.cal-jump', { onsubmit: go }, m, y, h('button.btn.primary', { type: 'submit' }, 'Go')));
    }

    // ── сетка месяца ──
    function renderGrid() {
      titleEl.textContent = dates.monthTitle(month);
      const t = dates.today();
      const marked = new Set(events.map(e => e.date));
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
    }

    // ── выбранный день: добавить план ──
    function renderDay() {
      fab.classList.toggle('on', adding); fab.setAttribute('aria-expanded', adding ? 'true' : 'false');
      const input = h('input.field', { placeholder: 'Add a plan for this day', autocomplete: 'off', enterKeyHint: 'done' });
      dayEl.replaceChildren(...[
        h('h2', null, `${dates.long(selected)} · ${dates.relative(selected)}`),
        adding && h('form.cal-add', { onsubmit: async e => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return input.focus();
          adding = false;
          await db.save({ type: 'event', text, date: selected });
          renderDay();
        } }, input, h('button.btn.primary', { type: 'submit' }, 'Add')),
      ].filter(Boolean));
    }

    // ── список планов за период ──
    function event(e) {
      if (editId === e.id) {
        const text = h('input.field', { value: e.text });
        const date = h('input.date-input', { type: 'date', value: e.date });
        const save = async () => { editId = null; const v = text.value.trim(); if (v) await db.save({ ...e, text: v, date: date.value || e.date }); else render(); };
        queueMicrotask(() => text.focus());
        return h('li.event.editing', null, text, date, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Save'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Cancel'),
          h('button.btn.danger', { onclick: () => { editId = null; removeWithUndo(db, e); } }, 'Delete')));
      }
      return h('li.event', null, h('button.event-text', { onclick: () => { editId = e.id; render(); } }, e.text));
    }

    function renderList() {
      rangesEl.replaceChildren(...RANGES.map(([id, name]) => h('button.chip.small' + (range === id ? '.on' : ''), {
        onclick: () => { range = id; setPref('calendar:range', id); editId = null; render(); }, 'aria-pressed': range === id ? 'true' : 'false',
      }, name)));
      const [from, to] = bounds(range, selected);
      const items = events.filter(e => (!from || e.date >= from) && (!to || e.date <= to));
      if (!items.length) {
        const empty = { day: 'Nothing planned for this day.', week: 'Nothing planned this week.', month: 'Nothing planned this month.',
          next: 'Nothing planned next month yet.', all: 'No plans yet. Pick a day above and add one.' }[range];
        return listEl.replaceChildren(h('p.hint', null, empty));
      }
      if (range === 'day') return listEl.replaceChildren(h('ul.events', null, items.map(event)));
      const byDate = Map.groupBy ? Map.groupBy(items, e => e.date) : items.reduce((m, e) => m.set(e.date, [...(m.get(e.date) || []), e]), new Map());
      const t = dates.today();
      listEl.replaceChildren(...[...byDate].map(([date, list]) => h('section.cal-group' + (date < t ? '.past' : ''), null,
        h('h3', null, `${dates.long(date)} · ${dates.relative(date)}`),
        h('ul.events', null, list.map(event)))));
    }

    function render() {
      renderJump(); renderGrid(); renderDay(); renderList();
    }

    async function load() {
      events = (await db.list('event')).sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
      renderGrid();   // поле «добавить» не перерисовываем — вдруг в нём недописанный текст
      if (!editId) renderList();
    }

    render();
    load();
    return db.onChange(load);
  },
};

// Календарь в духе бумажного постера: огромный месяц, «персонажи месяца», сегодня обведено маркером.
// Свои планы на даты. Не связан с «Don't want to remember» — там то, что хочется забыть до срока,
// а здесь то, что планируешь. Нажми на название месяца — можно сразу перейти к любому месяцу и году.
// Ниже — планы за выбранный день, неделю, месяц, следующий месяц или все сразу.
// Записи: event { text, date: 'ГГГГ-ММ-ДД' }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { pref, setPref } from '../core/prefs.js';
import { h, removeWithUndo, plusIcon } from '../core/ui.js';

// сегодня — обведено красным, будто маркером от руки; дни с планами — цветной штрих
const MARKER = '<svg class="cal-marker" viewBox="0 0 50 46" aria-hidden="true"><path d="M8 24c0-12 12-19 22-18 12 1 17 10 15 19-2 10-12 16-22 15C12 39 5 31 9 19c3-8 12-12 20-11" fill="none" stroke="#f0461f" stroke-width="2.6" stroke-linecap="round"/></svg>';
const DOTS = ['#8fe3c2', '#f6a0b8', '#ffc61a', '#9db0ff', '#f0461f', '#b9a7ff'];

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

    const titleEl = h('button.cal-title', { onclick: () => { jumping = !jumping; render(); }, 'aria-expanded': 'false', 'aria-label': 'Pick month and year' });
    const prevEl = h('button.cal-shift', { onclick: () => shift(-1) });
    const nextEl = h('button.cal-shift', { onclick: () => shift(1) });
    // «персонажи месяца» — картинка из слота calendar-hero (tools/art.py)
    const poster = h('div.cal-poster', null, titleEl);
    db.get('art-calendar-hero').then(a => {
      if (a && !a.deleted && a.image) poster.append(h('img.cal-art', { src: a.image, alt: '' }), h('span.cal-motm', null, 'Characters of the month'));
    });
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
      h('div.cal-top', null, prevEl, nextEl,
        h('button.cal-shift', { onclick: () => { month = new Date(now.getFullYear(), now.getMonth(), 1); selected = dates.today(); jumping = false; render(); } }, 'Today')),
      poster, jumpEl,
      h('section.cal', null, gridEl),
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
      const name = m => m.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase().replace('.', '');
      // длинный месяц — в две строки, как на постере: NOVEM / BER
      const full = month.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase();
      const parts = full.length >= 8 ? [full.slice(0, -3), h('br'), full.slice(-3)] : [full];
      titleEl.replaceChildren(h('b' + (full.length === 7 ? '.mid' : ''), null, ...parts), h('span', null, String(month.getFullYear())));
      prevEl.textContent = '‹ ' + name(new Date(month.getFullYear(), month.getMonth() - 1, 1));
      nextEl.textContent = name(new Date(month.getFullYear(), month.getMonth() + 1, 1)) + ' ›';
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
        const cell = h('button.cal-cell' + cls, { onclick: () => { selected = s; render(); }, 'aria-label': dates.long(s) }, h('span', null, String(d)));
        if (s === t) cell.insertAdjacentHTML('beforeend', MARKER);
        if (marked.has(s)) cell.append(h('i.cal-dot', { style: `background: ${DOTS[d % DOTS.length]}` }));
        cells.push(cell);
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
      const d = dates.parse(e.date);
      return h('li.event' + (e.date < dates.today() ? '.past' : ''), null, h('button.event-text', { onclick: () => { editId = e.id; render(); } },
        h('span.event-date', null, h('b', null, String(d.getDate())), h('span', null, d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase())),
        h('span', null, e.text)));
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
      listEl.replaceChildren(h('ul.events', null, items.map(event)));   // у каждого плана — своя дата-«корешок»
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

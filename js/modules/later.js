// «Не хочу помнить, но надо»: дела с датой где-то впереди — стоматолог через месяц, продлить страховку.
// Записал и выкинул из головы; за неделю до даты оно само покажется на главной. Без уведомлений.
// Записи: later { text, date: 'ГГГГ-ММ-ДД', done, doneAt }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h, composer, removeWithUndo, toast } from '../core/ui.js';

const PRESETS = [['In a week', d => dates.addDays(d, 7)], ['In a month', d => dates.addMonths(d, 1)],
  ['In 3 months', d => dates.addMonths(d, 3)], ['In 6 months', d => dates.addMonths(d, 6)]];

/** выбор даты: готовые варианты + своя дата. Возвращает { el, value() } */
export function datePicker(initial) {
  let value = initial || dates.addMonths(dates.today(), 1);
  const el = h('div.date-picker');
  const input = h('input.date-input', { type: 'date', value, onchange: () => { if (input.value) { value = input.value; render(); } } });
  function render() {
    const t = dates.today();
    el.replaceChildren(
      ...PRESETS.map(([name, f]) => h('button.chip.small' + (f(t) === value ? '.on' : ''), { type: 'button', onclick: () => { value = f(t); input.value = value; render(); } }, name)),
      h('label.date-own', null, input),
      h('span.date-hint', null, `${dates.short(value)} · ${dates.relative(value)}`));
  }
  render();
  return { el, value: () => value, reset: () => { value = dates.addMonths(dates.today(), 1); input.value = value; render(); } };
}

export default {
  id: 'later',
  title: 'Don’t want to remember, but have to',
  short: 'Later',
  icon: '⏳',

  mount(root) {
    let items = [], openId = null, editId = null, showDone = false;

    const picker = datePicker();
    const { el: capture } = composer({
      placeholder: 'e.g. dentist appointment', button: 'Remember', multiline: false, extra: picker.el,
      onSubmit: async text => {
        const date = picker.value();
        await db.save({ type: 'later', text, date, done: false });
        toast(`Saved for ${dates.short(date)}`);
        picker.reset();
      },
    });
    capture.classList.add('with-picker');
    const listEl = h('ul.later');
    const doneEl = h('section.done-block');

    root.append(h('header.page-head', null, h('h1', null, 'Don’t want to remember, but have to')), capture, listEl, doneEl);

    function row(l) {
      if (editId === l.id) {
        const input = h('input.field', { value: l.text });
        const p = datePicker(l.date);
        const save = async () => { editId = null; const v = input.value.trim(); if (v) await db.save({ ...l, text: v, date: p.value() }); else render(); };
        queueMicrotask(() => input.focus());
        return h('li.later-item.editing', null, input, p.el, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Save'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Cancel')));
      }
      const open = openId === l.id, n = dates.daysFrom(l.date);
      return h('li.later-item' + (open ? '.open' : '') + (l.done ? '.done' : ''), null,
        h('button.later-main', { onclick: () => { openId = open ? null : l.id; render(); } },
          h('span.later-date', null, h('b', null, dates.short(l.date)), h('span' + (n < 0 && !l.done ? '.past' : ''), null, dates.relative(l.date))),
          h('span.later-text', null, l.text)),
        open && h('div.buttons', null,
          h('button.btn', { onclick: () => { openId = null; db.save({ ...l, done: !l.done, doneAt: l.done ? null : Date.now() }); } }, l.done ? 'Not done' : 'Done'),
          h('button.btn', { onclick: () => { editId = l.id; openId = null; render(); } }, 'Edit'),
          h('button.btn.danger', { onclick: () => { openId = null; removeWithUndo(db, l); } }, 'Delete')));
    }

    function render() {
      const open = items.filter(l => !l.done), done = items.filter(l => l.done).sort((a, b) => b.doneAt - a.doneAt);
      listEl.replaceChildren(...(open.length ? open.map(row) : [h('li.empty', null, 'Nothing to remember. Nice.')]));
      doneEl.replaceChildren(...(done.length ? [
        h('div.done-head', null, h('button.link', { onclick: () => { showDone = !showDone; render(); } }, `${showDone ? '▾' : '▸'} Done · ${done.length}`)),
        showDone && h('ul.later', null, done.map(row)),
      ].filter(Boolean) : []));
    }

    async function load() {
      items = (await db.list('later')).sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
      if (!editId) render();
    }

    load();
    return db.onChange(load);
  },
};

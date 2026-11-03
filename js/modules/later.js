// «Не хочу помнить, но надо»: дела с датой где-то впереди — стоматолог через месяц, продлить страховку.
// Записал и выкинул из головы; за неделю до даты оно само покажется на главной. Без уведомлений.
// Записи: later { text, date: 'ГГГГ-ММ-ДД', done, doneAt }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h, composer, removeWithUndo, toast } from '../core/ui.js';

const PRESETS = [['Через неделю', d => dates.addDays(d, 7)], ['Через месяц', d => dates.addMonths(d, 1)],
  ['Через 3 месяца', d => dates.addMonths(d, 3)], ['Через полгода', d => dates.addMonths(d, 6)]];

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
  title: 'Не хочу помнить, но надо',
  short: 'Потом',
  icon: '⏳',

  mount(root) {
    let items = [], openId = null, editId = null, showDone = false;

    const picker = datePicker();
    const { el: capture } = composer({
      placeholder: 'Например: сходить к стоматологу', button: 'Запомнить', multiline: false, extra: picker.el,
      onSubmit: async text => {
        const date = picker.value();
        await db.save({ type: 'later', text, date, done: false });
        toast(`Записано на ${dates.short(date)}`);
        picker.reset();
      },
    });
    capture.classList.add('with-picker');
    const listEl = h('ul.later');
    const doneEl = h('section.done-block');

    root.append(h('header.page-head', null, h('h1', null, 'Не хочу помнить, но надо')), capture, listEl, doneEl);

    function row(l) {
      if (editId === l.id) {
        const input = h('input.field', { value: l.text });
        const p = datePicker(l.date);
        const save = async () => { editId = null; const v = input.value.trim(); if (v) await db.save({ ...l, text: v, date: p.value() }); else render(); };
        queueMicrotask(() => input.focus());
        return h('li.later-item.editing', null, input, p.el, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Сохранить'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Отмена')));
      }
      const open = openId === l.id, n = dates.daysFrom(l.date);
      return h('li.later-item' + (open ? '.open' : '') + (l.done ? '.done' : ''), null,
        h('button.later-main', { onclick: () => { openId = open ? null : l.id; render(); } },
          h('span.later-date', null, h('b', null, dates.short(l.date)), h('span' + (n < 0 && !l.done ? '.past' : ''), null, dates.relative(l.date))),
          h('span.later-text', null, l.text)),
        open && h('div.buttons', null,
          h('button.btn', { onclick: () => { openId = null; db.save({ ...l, done: !l.done, doneAt: l.done ? null : Date.now() }); } }, l.done ? 'Вернуть' : 'Сделано'),
          h('button.btn', { onclick: () => { editId = l.id; openId = null; render(); } }, 'Изменить'),
          h('button.btn.danger', { onclick: () => { openId = null; removeWithUndo(db, l); } }, 'Удалить')));
    }

    function render() {
      const open = items.filter(l => !l.done), done = items.filter(l => l.done).sort((a, b) => b.doneAt - a.doneAt);
      listEl.replaceChildren(...(open.length ? open.map(row) : [h('li.empty', null, 'Можно ни о чём не помнить.')]));
      doneEl.replaceChildren(...(done.length ? [
        h('div.done-head', null, h('button.link', { onclick: () => { showDone = !showDone; render(); } }, `${showDone ? '▾' : '▸'} Сделано · ${done.length}`)),
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

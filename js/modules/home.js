// Главная: место, где говоришь сама с собой — крупно и капсом: «УТРОМ ПЬЁМ ЖЕЛЕЗО!», «ЗАВТРА С УТРА ЗУМБА».
// Ниже — то, что скоро подойдёт из «Не хочу помнить, но надо».
// Записи: note { text }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h, composer, removeWithUndo } from '../core/ui.js';

const SOON_DAYS = 7;

export default {
  id: 'home',
  title: 'Главная',
  icon: '⌂',

  mount(root) {
    let notes = [], soon = [], openId = null, editId = null;

    const { el: capture } = composer({
      placeholder: 'Напиши себе…', button: 'Сказать',
      onSubmit: text => db.save({ type: 'note', text }),
    });
    const notesEl = h('div.notes');
    const soonEl = h('section.soon');

    root.append(
      h('header.page-head', null, h('h1.date-title', null, dates.long(dates.today()))),
      capture, notesEl, soonEl,
    );

    function note(n) {
      if (editId === n.id) {
        const ta = h('textarea.edit-input.note-edit', { value: n.text, rows: 3 });
        const save = async () => { editId = null; const t = ta.value.trim(); if (t && t !== n.text) await db.save({ ...n, text: t }); else render(); };
        queueMicrotask(() => ta.focus());
        return h('div.note.editing', null, ta, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Сохранить'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Отмена')));
      }
      const open = openId === n.id;
      return h('div.note' + (open ? '.open' : ''), null,
        h('button.note-text', { onclick: () => { openId = open ? null : n.id; render(); } }, n.text),
        open && h('div.buttons', null,
          h('button.btn', { onclick: () => { editId = n.id; openId = null; render(); } }, 'Изменить'),
          h('button.btn', { onclick: () => { openId = null; removeWithUndo(db, n, 'Убрано'); } }, 'Убрать')));
    }

    function render() {
      notesEl.replaceChildren(...notes.map(note));
      soonEl.replaceChildren(...(soon.length ? [
        h('h2', null, 'Скоро'),
        h('ul.soon-list', null, soon.map(l => h('li', null,
          h('a.soon-item', { href: '#later' },
            h('span', null, l.text),
            h('span.soon-when' + (dates.daysFrom(l.date) < 0 ? '.past' : ''), null, dates.relative(l.date)))))),
      ] : []));
    }

    async function load() {
      const all = await db.allRaw();
      notes = all.filter(r => r.type === 'note' && !r.deleted).sort((a, b) => b.created - a.created);
      soon = all.filter(r => r.type === 'later' && !r.deleted && !r.done && dates.daysFrom(r.date) <= SOON_DAYS)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!editId) render();
    }

    load();
    return db.onChange(load);
  },
};

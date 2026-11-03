// «Некомфортные мысли»: выписать то, что крутится и мешает. Когда отпустило — «Отпустить»,
// и мысль уходит из списка (но не пропадает — её можно найти в «Отпущенном»).
// Записи: uneasy { text, released, releasedAt }.
import * as db from '../core/db.js';
import { h, composer, removeWithUndo, when, toast } from '../core/ui.js';

export default {
  id: 'uneasy',
  title: 'Некомфортные мысли',
  short: 'Некомфорт',
  icon: '☁',

  mount(root) {
    let items = [], openId = null, editId = null, showReleased = false;

    const { el: capture } = composer({
      placeholder: 'Что не даёт покоя?', button: 'Выписать',
      onSubmit: text => db.save({ type: 'uneasy', text, released: false }),
    });
    const listEl = h('ul.thoughts');
    const relEl = h('section.done-block');

    root.append(h('header.page-head', null, h('h1', null, 'Некомфортные мысли')), capture, listEl, relEl);

    function row(u) {
      if (editId === u.id) {
        const ta = h('textarea.edit-input', { value: u.text, rows: Math.min(10, u.text.split('\n').length + 1) });
        const save = async () => { editId = null; const v = ta.value.trim(); if (v && v !== u.text) await db.save({ ...u, text: v }); else render(); };
        queueMicrotask(() => ta.focus());
        return h('li.thought.editing', null, ta, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Сохранить'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Отмена')));
      }
      const open = openId === u.id;
      return h('li.thought' + (open ? '.open' : '') + (u.released ? '.done' : ''), null,
        h('button.thought-text', { onclick: () => { openId = open ? null : u.id; render(); } }, u.text),
        h('div.thought-meta', null, h('span', null, when(u.created))),
        open && h('div.thought-actions', null, h('div.buttons', null,
          h('button.btn', { onclick: async () => {
            openId = null;
            await db.save({ ...u, released: !u.released, releasedAt: u.released ? null : Date.now() });
            if (!u.released) toast('Отпущено');
          } }, u.released ? 'Вернуть' : 'Отпустить'),
          h('button.btn', { onclick: () => { editId = u.id; openId = null; render(); } }, 'Изменить'),
          h('button.btn.danger', { onclick: () => { openId = null; removeWithUndo(db, u); } }, 'Удалить'))));
    }

    function render() {
      const open = items.filter(u => !u.released), rel = items.filter(u => u.released).sort((a, b) => b.releasedAt - a.releasedAt);
      listEl.replaceChildren(...(open.length ? open.map(row) : [h('li.empty', null, 'Сейчас здесь пусто — и это хорошо.')]));
      relEl.replaceChildren(...(rel.length ? [
        h('div.done-head', null, h('button.link', { onclick: () => { showReleased = !showReleased; render(); } }, `${showReleased ? '▾' : '▸'} Отпущенное · ${rel.length}`)),
        showReleased && h('ul.thoughts', null, rel.map(row)),
      ].filter(Boolean) : []));
    }

    async function load() {
      items = (await db.list('uneasy')).sort((a, b) => b.created - a.created);
      if (!editId) render();
    }

    load();
    return db.onChange(load);
  },
};

// «Надо сделать»: быстрые дела. Записал — отметил — забыл.
// Записи: task { text, done, doneAt }.
import * as db from '../core/db.js';
import { h, composer, removeWithUndo } from '../core/ui.js';

export default {
  id: 'tasks',
  title: 'Надо сделать',
  short: 'Дела',
  icon: '☐',

  mount(root) {
    let tasks = [], showDone = false, editId = null;

    const { el: capture } = composer({
      placeholder: 'Что сделать?', button: 'Добавить', multiline: false,
      onSubmit: text => db.save({ type: 'task', text, done: false }),
    });
    const listEl = h('ul.tasks');
    const doneEl = h('section.done-block');

    root.append(h('header.page-head', null, h('h1', null, 'Надо сделать')), capture, listEl, doneEl);

    const toggle = t => db.save({ ...t, done: !t.done, doneAt: t.done ? null : Date.now() });

    function row(t) {
      if (editId === t.id) {
        const input = h('input.field', { value: t.text });
        const save = async () => { editId = null; const v = input.value.trim(); if (v && v !== t.text) await db.save({ ...t, text: v }); else render(); };
        queueMicrotask(() => input.focus());
        return h('li.task.editing', null, h('form', { onsubmit: e => { e.preventDefault(); save(); } }, input),
          h('div.buttons', null, h('button.btn.primary', { onclick: save }, 'Сохранить'),
            h('button.btn', { onclick: () => { editId = null; render(); } }, 'Отмена')));
      }
      return h('li.task' + (t.done ? '.done' : ''), null,
        h('button.check', { onclick: () => toggle(t), 'aria-label': t.done ? 'Вернуть' : 'Сделано', 'aria-pressed': t.done ? 'true' : 'false' }, t.done ? '✓' : ''),
        h('button.task-text', { onclick: () => { editId = t.id; render(); } }, t.text),
        h('button.icon-btn', { onclick: () => removeWithUndo(db, t), 'aria-label': 'Удалить' }, '✕'));
    }

    function render() {
      const open = tasks.filter(t => !t.done), done = tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
      listEl.replaceChildren(...(open.length ? open.map(row) : [h('li.empty', null, 'Пока ничего не надо.')]));
      doneEl.replaceChildren(...(done.length ? [
        h('div.done-head', null,
          h('button.link', { onclick: () => { showDone = !showDone; render(); } }, `${showDone ? '▾' : '▸'} Сделано · ${done.length}`),
          showDone && h('button.link', { onclick: async () => { for (const t of done) await db.remove(t.id); } }, 'Очистить')),
        showDone && h('ul.tasks', null, done.map(row)),
      ].filter(Boolean) : []));
    }

    async function load() {
      tasks = (await db.list('task')).sort((a, b) => a.created - b.created);
      if (!editId) render();
    }

    load();
    return db.onChange(load);
  },
};

// «To do»: быстрые дела. Записал — отметил — забыл.
// Вместо сроков — два режима: 🔥 Urgent и 🌿 Can wait. Стикер показывает сферу жизни,
// к делу можно добавить заметку и картинку. Сделанное — отдельным видом (⋯ → Done tasks, адрес #tasks?done):
// удалить дело можно только оттуда, чтобы в основном списке не было лишних крестиков.
// Записи: task { text, done, doneAt, urgent, causes: [id], note, image: data:…|null }.
import * as db from '../core/db.js';
import { h, removeWithUndo, addFlow } from '../core/ui.js';
import { causePicker, imageField, stickers, noteField } from '../core/bits.js';

/** переключатель «срочно / подождёт»; state.urgent меняется на месте */
function urgencyToggle(state) {
  const el = h('div.urgency', { role: 'group', 'aria-label': 'How urgent?' });
  const render = () => el.replaceChildren(
    ...[[true, '🔥 Urgent'], [false, '🌿 Can wait']].map(([v, name]) =>
      h('button.chip.small' + (state.urgent === v ? '.on' : ''), { type: 'button', 'aria-pressed': state.urgent === v ? 'true' : 'false',
        onclick: () => { state.urgent = v; render(); } }, name)));
  render();
  return el;
}

/** все поля дела: сфера, срочность, заметка, картинка */
function details(state) {
  return h('div.task-details', null, causePicker(state.causes, undefined, 'Which part of life?'),
    h('div.task-options', null, urgencyToggle(state), imageField(state)), noteField(state));
}

export default {
  id: 'tasks',
  title: 'To do',
  icon: 'tasks',
  menu: [{ label: 'Done tasks', href: '#tasks?done' }],

  mount(root) {
    let tasks = [], editId = null;
    const doneView = location.hash.endsWith('?done');

    // ── новое дело ──
    let draft;
    const input = h('input.capture-input.single', { placeholder: 'What needs doing?', autocomplete: 'off', enterKeyHint: 'done' });
    const detailsHolder = h('div');
    const resetDraft = () => {
      draft = { causes: new Set(), urgent: false, note: '', image: null };
      detailsHolder.replaceChildren(details(draft));
    };
    resetDraft();
    const capture = h('form.capture.task-capture', { onsubmit: e => { e.preventDefault(); add(); } },
      input, detailsHolder, h('div.capture-row', null, h('span'), h('button.btn.primary', { type: 'submit' }, 'Add')));

    async function add() {
      const text = input.value.trim();
      if (!text) return input.focus();
      await db.save({ type: 'task', text, done: false, urgent: draft.urgent, causes: [...draft.causes], note: draft.note.trim(), image: draft.image });
      input.value = '';
      resetDraft();
      flow.close();
    }

    const listEl = h('div.task-groups');
    const flow = addFlow(capture, input, 'New task');
    if (doneView) root.append(h('header.page-head.with-back', null, h('a.back', { href: '#tasks' }, '← To do'), h('h1', null, 'Done')), listEl);
    else root.append(h('header.page-head', null, h('h1', null, 'To do')), capture, flow.fab, listEl);

    const toggle = t => db.save({ ...t, done: !t.done, doneAt: t.done ? null : Date.now() });

    function editor(t) {
      const state = { causes: new Set(t.causes || []), urgent: !!t.urgent, note: t.note || '', image: t.image || null };
      const text = h('input.field', { value: t.text });
      const save = async () => {
        editId = null;
        const v = text.value.trim();
        if (v) await db.save({ ...t, text: v, urgent: state.urgent, causes: [...state.causes], note: state.note.trim(), image: state.image });
        else render();
      };
      queueMicrotask(() => text.focus());
      return h('li.task.editing', null, h('form', { onsubmit: e => { e.preventDefault(); save(); } }, text), details(state),
        h('div.buttons', null, h('button.btn.primary', { onclick: save }, 'Save'),
          h('button.btn', { onclick: () => { editId = null; render(); } }, 'Cancel')));
    }

    function row(t) {
      if (editId === t.id) return editor(t);
      return h('li.task' + (t.done ? '.done' : '') + (t.urgent && !t.done ? '.urgent' : '') + ((t.causes || []).length ? '.has-stickers' : ''), null,
        stickers(t.causes),
        h('button.check', { onclick: () => toggle(t), 'aria-label': t.done ? 'Not done' : 'Done', 'aria-pressed': t.done ? 'true' : 'false' }, t.done ? '✓' : ''),
        h('button.task-body', { onclick: () => { editId = t.id; render(); } },
          h('span.task-text', null, t.text),
          t.note && h('span.task-note', null, t.note),
          t.image && h('img.task-image', { src: t.image, alt: '' })),
        t.done && h('button.icon-btn', { onclick: () => removeWithUndo(db, t), 'aria-label': 'Delete' }, '✕'));
    }

    function render() {
      if (doneView) {
        const done = tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
        return listEl.replaceChildren(done.length ? h('ul.tasks', null, done.map(row)) : h('p.empty', null, 'Nothing done yet — that’s fine.'));
      }
      const open = tasks.filter(t => !t.done);
      const urgent = open.filter(t => t.urgent), wait = open.filter(t => !t.urgent);
      const group = (title, list) => h('section.task-group', null, title && h('h2.task-group-title', null, title), h('ul.tasks', null, list.map(row)));
      listEl.replaceChildren(...(!open.length ? [h('p.empty', null, 'Nothing to do. Enjoy.')]
        : urgent.length ? [group('🔥 Urgent', urgent), wait.length && group('🌿 Can wait', wait)].filter(Boolean)
        : [group(null, wait)]));
    }

    async function load() {
      tasks = (await db.list('task')).sort((a, b) => a.created - b.created);
      if (!editId) render();
    }

    load();
    return db.onChange(load);
  },
};

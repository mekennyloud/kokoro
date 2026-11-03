// «Not happy about this»: выписать, кто или что расстроило. Стикер показывает, откуда переживание
// (работа, учёба, семья…), можно приложить картинку-мем и подумать над записью.
// «Let go» — запись улетает с праздником, а наверху растёт счётчик отпущенного.
// Записи: uneasy { text, causes: [id], image: data:…|null, reflection, released, releasedAt }.
import * as db from '../core/db.js';
import { h, removeWithUndo, when } from '../core/ui.js';
import { pickImage } from '../core/images.js';

export const CAUSES = [
  ['work', '💼', 'Work'], ['personal', '💗', 'Personal'], ['study', '📚', 'Study'],
  ['emigration', '✈️', 'Emigration'], ['family', '🏠', 'Family'], ['health', '🩺', 'Health'],
];
const PRAISE = ['Well done!', 'Nice, let it go!', 'Proud of you!', 'Gone. Breathe out.', 'That’s the spirit!', 'Lighter already!'];
const SPARKS = ['✨', '🎉', '💫', '🌟', '🫧', '💖'];

/** ряд стикеров-причин; selected — Set id, меняется на месте */
function causePicker(selected, onChange = () => {}) {
  const el = h('div.cause-picker', { role: 'group', 'aria-label': 'What is it about?' });
  const render = () => el.replaceChildren(...CAUSES.map(([id, emoji, name]) =>
    h('button.cause' + (selected.has(id) ? '.on' : ''), {
      type: 'button', 'aria-pressed': selected.has(id) ? 'true' : 'false',
      onclick: () => { selected.has(id) ? selected.delete(id) : selected.add(id); render(); onChange(); },
    }, h('span.cause-emoji', { 'aria-hidden': 'true' }, emoji), h('span.cause-name', null, name))));
  render();
  return el;
}

/** кнопка «картинка» с превью; state.image меняется на месте */
function imageField(state, onChange = () => {}) {
  const el = h('div.image-field');
  const render = () => el.replaceChildren(state.image
    ? h('div.image-preview', null, h('img', { src: state.image, alt: '' }),
        h('button.icon-btn.image-remove', { type: 'button', 'aria-label': 'Remove picture', onclick: () => { state.image = null; render(); onChange(); } }, '✕'))
    : h('button.btn.small', { type: 'button', onclick: async () => { const img = await pickImage(); if (img) { state.image = img; render(); onChange(); } } }, '🖼 Picture'));
  render();
  return el;
}

function celebrate() {
  const el = h('div.celebrate', { role: 'status' },
    h('div.celebrate-text', null, PRAISE[Math.floor(Math.random() * PRAISE.length)]),
    Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2, r = 90 + Math.random() * 70;
      return h('span.spark', { style: `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;--r:${Math.random() * 360}deg` },
        SPARKS[i % SPARKS.length]);
    }));
  document.body.append(el);
  setTimeout(() => el.remove(), 1900);
}

export default {
  id: 'uneasy',
  title: 'Not happy about this',
  short: 'Not happy',
  icon: '☁',

  mount(root) {
    let items = [], openId = null, editId = null, reflectId = null, showReleased = false, bump = false;

    // ── новая запись ──
    const draft = { causes: new Set(), image: null };
    const text = h('textarea.capture-input', {
      placeholder: 'Who upset you? Come on, tell me!', rows: 2,
      oninput: () => { text.style.height = 'auto'; text.style.height = text.scrollHeight + 'px'; },
      onkeydown: e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } },
    });
    const pickerHolder = h('div');
    const imageHolder = h('div');
    const resetDraft = () => {
      draft.causes.clear(); draft.image = null;
      pickerHolder.replaceChildren(causePicker(draft.causes));
      imageHolder.replaceChildren(imageField(draft));
    };
    resetDraft();
    const capture = h('form.capture.uneasy-capture', { onsubmit: e => { e.preventDefault(); add(); } },
      text, pickerHolder, h('div.capture-row', null, imageHolder, h('button.btn.primary', { type: 'submit' }, 'Spill it')));

    async function add() {
      const t = text.value.trim();
      if (!t && !draft.image) return text.focus();
      await db.save({ type: 'uneasy', text: t, causes: [...draft.causes], image: draft.image, reflection: '', released: false });
      text.value = ''; text.style.height = '';
      resetDraft();
    }

    const counterEl = h('div.letgo-holder');
    const listEl = h('ul.thoughts.uneasy-list');
    const relEl = h('section.done-block');

    root.append(h('header.page-head', null, h('h1', null, 'Not happy about this')), counterEl, capture, listEl, relEl);

    // ── отпустить ──
    async function letGo(u, li) {
      openId = null;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (li && !reduce) { li.classList.add('letting-go'); await new Promise(r => setTimeout(r, 450)); }
      celebrate();
      bump = true;   // счётчик подпрыгнет при следующей отрисовке
      await db.save({ ...u, released: true, releasedAt: Date.now() });
    }

    // ── одна запись ──
    const stickers = u => (u.causes || []).length
      ? h('div.stickers', { 'aria-label': u.causes.map(c => CAUSES.find(x => x[0] === c)?.[2]).join(', ') },
          u.causes.map((c, i) => h('span.sticker', { style: `--tilt:${(i % 2 ? 8 : -10) + i * 3}deg`, 'aria-hidden': 'true' },
            CAUSES.find(x => x[0] === c)?.[1] || '')))
      : null;

    function editor(u) {
      const state = { causes: new Set(u.causes || []), image: u.image || null };
      const ta = h('textarea.edit-input', { value: u.text, rows: Math.min(10, u.text.split('\n').length + 1) });
      const save = async () => {
        editId = null;
        await db.save({ ...u, text: ta.value.trim(), causes: [...state.causes], image: state.image });
      };
      queueMicrotask(() => ta.focus());
      return h('li.thought.editing', null, ta, causePicker(state.causes), imageField(state), h('div.buttons', null,
        h('button.btn.primary', { onclick: save }, 'Save'),
        h('button.btn', { onclick: () => { editId = null; render(); } }, 'Cancel')));
    }

    function reflection(u) {
      if (reflectId === u.id) {
        const ta = h('textarea.edit-input.reflect-input', { value: u.reflection || '', rows: 4,
          placeholder: 'Why does it bother you? What would help? What would you tell a friend?' });
        const save = async () => { reflectId = null; await db.save({ ...u, reflection: ta.value.trim() }); };
        queueMicrotask(() => ta.focus());
        return h('div.reflect.editing', null, ta, h('div.buttons', null,
          h('button.btn.primary', { onclick: save }, 'Save'),
          h('button.btn', { onclick: () => { reflectId = null; render(); } }, 'Cancel')));
      }
      return u.reflection ? h('div.reflect', null, h('span.reflect-label', null, 'Thinking about it'), u.reflection) : null;
    }

    function row(u) {
      if (editId === u.id) return editor(u);
      const open = openId === u.id;
      const li = h('li.thought.uneasy-item' + (open ? '.open' : '') + (u.released ? '.done' : ''), null,
        stickers(u),
        u.text && h('button.thought-text', { onclick: () => { openId = open ? null : u.id; render(); } }, u.text),
        u.image && h('button.uneasy-image', { onclick: () => { openId = open ? null : u.id; render(); }, 'aria-label': 'Picture' }, h('img', { src: u.image, alt: '' })),
        reflection(u),
        h('div.thought-meta', null, h('span', null, when(u.created))),
        open && h('div.thought-actions', null, h('div.buttons', null,
          !u.released && h('button.btn', { onclick: () => { reflectId = u.id; openId = null; render(); } }, '💭 Think about it'),
          u.released
            ? h('button.btn', { onclick: () => { openId = null; db.save({ ...u, released: false, releasedAt: null }); } }, 'Bring back')
            : h('button.btn.primary', { onclick: () => letGo(u, li) }, '🎈 Let go'),
          h('button.btn', { onclick: () => { editId = u.id; openId = null; render(); } }, 'Edit'),
          h('button.btn.danger', { onclick: () => { openId = null; removeWithUndo(db, u); } }, 'Delete'))));
      return li;
    }

    function render() {
      const open = items.filter(u => !u.released), rel = items.filter(u => u.released).sort((a, b) => b.releasedAt - a.releasedAt);
      counterEl.replaceChildren(...(rel.length ? [h('button.letgo' + (bump ? '.bump' : ''), { onclick: () => { showReleased = !showReleased; render(); }, 'aria-expanded': showReleased ? 'true' : 'false' },
        h('span.letgo-emoji', { 'aria-hidden': 'true' }, '🎈'), 'Already let go: ', h('b', null, String(rel.length)))] : []));
      bump = false;
      listEl.replaceChildren(...(open.length ? open.map(row) : [h('li.empty', null, 'Nothing bothering you right now. Nice.')]));
      relEl.replaceChildren(...(showReleased && rel.length ? [h('h2', null, 'Let go'), h('ul.thoughts.uneasy-list', null, rel.map(row))] : []));
    }

    async function load() {
      items = (await db.list('uneasy')).sort((a, b) => b.created - a.created);
      if (!editId && !reflectId) render();
    }

    load();
    return db.onChange(load);
  },
};

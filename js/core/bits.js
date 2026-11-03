// Общие кусочки для разделов: стикеры сфер жизни (работа, учёба, семья…) и картинка в записи.
import { h } from './ui.js';
import { pickImage } from './images.js';
import * as db from './db.js';

export const CAUSES = [
  ['work', '💼', 'Work'], ['personal', '💗', 'Personal'], ['study', '📚', 'Study'],
  ['emigration', '✈️', 'Emigration'], ['family', '🏠', 'Family'], ['health', '🩺', 'Health'],
];
const cause = id => CAUSES.find(x => x[0] === id);

/** ряд стикеров для выбора; selected — Set id, меняется на месте */
export function causePicker(selected, onChange = () => {}, label = 'What is it about?') {
  const el = h('div.cause-picker', { role: 'group', 'aria-label': label });
  const render = () => el.replaceChildren(...CAUSES.map(([id, emoji, name]) =>
    h('button.cause' + (selected.has(id) ? '.on' : ''), {
      type: 'button', 'aria-pressed': selected.has(id) ? 'true' : 'false',
      onclick: () => { selected.has(id) ? selected.delete(id) : selected.add(id); render(); onChange(); },
    }, h('span.cause-emoji', { 'aria-hidden': 'true' }, emoji), h('span.cause-name', null, name))));
  render();
  return el;
}

/** наклонённые стикеры в углу карточки; null, если сфера не выбрана */
export function stickers(causes = []) {
  if (!causes.length) return null;
  return h('div.stickers', { 'aria-label': causes.map(c => cause(c)?.[2]).join(', ') },
    causes.map((c, i) => h('span.sticker', { style: `--tilt:${(i % 2 ? 8 : -10) + i * 3}deg`, 'aria-hidden': 'true' }, cause(c)?.[1] || '')));
}

/** кнопка «картинка» с превью; state.image меняется на месте */
export function imageField(state, onChange = () => {}) {
  const el = h('div.image-field');
  const render = () => el.replaceChildren(state.image
    ? h('div.image-preview', null, h('img', { src: state.image, alt: '' }),
        h('button.icon-btn.image-remove', { type: 'button', 'aria-label': 'Remove picture', onclick: () => { state.image = null; render(); onChange(); } }, '✕'))
    : h('button.btn.small', { type: 'button', onclick: async () => { const img = await pickImage(); if (img) { state.image = img; render(); onChange(); } } }, '🖼 Picture'));
  render();
  return el;
}

/** заметка: кнопка «📝 Note» раскрывает поле; state.note меняется на месте */
export function noteField(state) {
  const el = h('div.note-field');
  let open = !!state.note;
  const render = () => {
    if (!open) return el.replaceChildren(h('button.btn.small', { type: 'button', onclick: () => { open = true; render(); el.querySelector('textarea').focus(); } }, '📝 Note'));
    const ta = h('textarea.task-note-input', { value: state.note || '', rows: 3, placeholder: 'Details, links, anything…', oninput: () => { state.note = ta.value; } });
    el.replaceChildren(ta);
  };
  render();
  return el;
}

/** шапка раздела — цветная панель с заголовком, строкой-подписью и персонажем из слота art (tools/art.py).
 *  Возвращает { el, setSub(text) }. Без картинки в слоте — просто панель с заголовком. */
export function hero(title, slot, sub = '') {
  const subEl = h('span.hero-sub', null, sub);
  const el = h('header.hero' + (title.length > 12 ? '.long' : ''), null, h('h1', null, title), subEl);
  db.get('art-' + slot).then(a => {
    if (a && !a.deleted && a.image) el.append(h('img.hero-art', { src: a.image, alt: '' }));
  });
  return { el, setSub: text => { subEl.textContent = text; } };
}

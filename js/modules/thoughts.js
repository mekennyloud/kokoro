// Раздел «Мысли»: быстро записать, что крутится в голове, а потом, когда захочется, разложить по полкам.
// Записи: thought { text, shelf: id|null, done, doneAt } и shelf { name, order }.
import * as db from '../core/db.js';
import { pref, setPref } from '../core/prefs.js';
import { h, toast, when } from '../core/ui.js';

const INBOX = 'inbox', ALL = 'all', DONE = 'done';

// полки по умолчанию; id постоянные, чтобы iPhone и iPad при первом запуске не создали по своей копии
const DEFAULT_SHELVES = [
  { id: 'shelf-forget', name: 'Don’t forget' },
  { id: 'shelf-work', name: 'Work' },
  { id: 'shelf-sport', name: 'Sport' },
  { id: 'shelf-ideas', name: 'Ideas' },
];

async function seedShelves() {
  if (pref('thoughts:seeded')) return;
  setPref('thoughts:seeded', true);
  const have = new Set((await db.allRaw()).map(r => r.id));
  for (const [i, s] of DEFAULT_SHELVES.entries())
    if (!have.has(s.id)) await db.save({ ...s, type: 'shelf', order: i, updated: 1 });
}

// интерфейс стал английским: полки по умолчанию со старыми русскими названиями переименовываем,
// а те, что переименованы вручную, не трогаем
const OLD_NAMES = { 'shelf-forget': 'Не забыть', 'shelf-work': 'Работа', 'shelf-sport': 'Спорт', 'shelf-ideas': 'Идеи' };
async function translateShelves() {
  for (const s of DEFAULT_SHELVES) {
    const r = await db.get(s.id);
    if (r && r.name === OLD_NAMES[s.id]) await db.save({ ...r, name: s.name });
  }
}

export default {
  id: 'thoughts',
  title: 'Thoughts',
  icon: '✎',

  mount(root) {
    let view = pref('thoughts:view', INBOX);
    let query = '';
    let openId = null, editId = null, addingShelf = false, renamingShelf = false;
    let shelves = [], thoughts = [];

    const shelfName = id => shelves.find(s => s.id === id)?.name;
    const inShelf = t => (t.shelf && shelfName(t.shelf) ? t.shelf : null);   // полки нет — значит во «Входящих»
    const viewName = () => view === INBOX ? 'Inbox' : view === ALL ? 'All' : view === DONE ? 'Done' : shelfName(view);
    // куда попадёт новая мысль: в открытую полку, иначе во «Входящие»
    const target = () => (shelfName(view) ? view : null);

    // ── запись ──
    const cap = h('textarea.capture-input', {
      placeholder: 'What’s on your mind?', rows: 2, enterKeyHint: 'enter',
      oninput: () => { cap.style.height = 'auto'; cap.style.height = cap.scrollHeight + 'px'; },
      onkeydown: e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } },
    });
    const capWhere = h('span.capture-where');
    const capture = h('form.capture', { onsubmit: e => { e.preventDefault(); add(); } },
      cap, h('div.capture-row', null, capWhere, h('button.btn.primary', { type: 'submit' }, 'Save')));

    async function add() {
      const text = cap.value.trim();
      if (!text) return cap.focus();
      cap.value = ''; cap.style.height = '';
      await db.save({ type: 'thought', text, shelf: target(), done: false });
      cap.focus();
    }

    // ── поиск ──
    const search = h('input.search', {
      type: 'search', placeholder: 'Search all thoughts', enterKeyHint: 'search',
      oninput: () => { query = search.value.trim().toLowerCase(); renderList(); },
    });

    const shelvesEl = h('nav.shelves', { 'aria-label': 'Shelves' });
    const headEl = h('div.list-head');
    const listEl = h('ul.thoughts');

    root.append(
      h('header.page-head', null, h('h1', null, 'Thoughts')),
      capture,
      h('div.thoughts-layout', null, shelvesEl, h('section.thoughts-main', null, search, headEl, listEl)),
    );

    function go(v) {
      view = v; setPref('thoughts:view', v);
      openId = editId = null; renamingShelf = false;
      render();
    }

    // ── полки ──
    function renderShelves() {
      const chip = (id, name, cls = '') =>
        h('button.chip' + cls + (view === id ? '.on' : ''), { onclick: () => go(id), 'aria-current': view === id ? 'true' : null }, name);
      const adder = addingShelf
        ? h('form.chip-form', { onsubmit: e => { e.preventDefault(); createShelf(e.target.elements.name.value); } },
            h('input.chip-input', { name: 'name', placeholder: 'Name', autocomplete: 'off',
              onblur: e => { if (!e.target.value.trim()) { addingShelf = false; renderShelves(); } } }))
        : h('button.chip.ghost', { onclick: () => { addingShelf = true; renderShelves(); shelvesEl.querySelector('input').focus(); } }, '+ shelf');
      shelvesEl.replaceChildren(
        chip(INBOX, 'Inbox'),
        ...shelves.map(s => chip(s.id, s.name)),
        adder,
        h('span.shelves-gap'),
        chip(ALL, 'All', '.quiet'),
        chip(DONE, 'Done', '.quiet'),
      );
    }

    async function createShelf(name) {
      name = name.trim();
      addingShelf = false;
      if (!name) return renderShelves();
      const s = await db.save({ type: 'shelf', name, order: Math.max(-1, ...shelves.map(s => s.order ?? 0)) + 1 });
      if (!shelves.some(x => x.id === s.id)) shelves.push(s);   // список полок перечитается чуть позже
      go(s.id);
    }

    async function renameShelf(name) {
      renamingShelf = false;
      const s = shelves.find(s => s.id === view);
      if (s && name.trim() && name.trim() !== s.name) await db.save({ ...s, name: name.trim() });
      else render();
    }

    async function deleteShelf() {
      const s = shelves.find(s => s.id === view);
      if (!s) return;
      const inside = thoughts.filter(t => t.shelf === s.id);
      const msg = inside.length ? `Delete shelf “${s.name}”? Its thoughts (${inside.length}) will go back to Inbox.` : `Delete shelf “${s.name}”?`;
      if (!confirm(msg)) return;
      for (const t of inside) await db.save({ ...t, shelf: null });
      await db.remove(s.id);
      go(INBOX);
    }

    // ── заголовок над списком ──
    function renderHead() {
      const isShelf = !!shelfName(view);
      if (query) return headEl.replaceChildren(h('h2', null, 'Found'));
      if (isShelf && renamingShelf) {
        const commit = () => { if (renamingShelf) renameShelf(input.value); };
        const input = h('input.rename', { name: 'name', value: shelfName(view), autocomplete: 'off', onblur: commit,
          onkeydown: e => { if (e.key === 'Escape') { renamingShelf = false; renderHead(); } } });
        headEl.replaceChildren(h('form', { onsubmit: e => { e.preventDefault(); commit(); } }, input));
        return input.focus();
      }
      headEl.replaceChildren(
        h('h2', null, viewName()),
        ...(isShelf ? [h('div.head-tools', null,
          h('button.link', { onclick: () => { renamingShelf = true; renderHead(); } }, 'Rename'),
          h('button.link.danger', { onclick: deleteShelf }, 'Delete shelf'))] : []),
      );
    }

    // ── список ──
    function visible() {
      if (query) return thoughts.filter(t => t.text.toLowerCase().includes(query));
      if (view === ALL) return thoughts.filter(t => !t.done);
      if (view === DONE) return thoughts.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      return thoughts.filter(t => !t.done && inShelf(t) === (view === INBOX ? null : view));
    }

    function renderList() {
      renderHead();
      const items = visible();
      if (!items.length) {
        const empty = query ? 'Nothing found.' : view === DONE ? 'Finished thoughts will show up here.' : 'Quiet here for now.';
        return listEl.replaceChildren(h('li.empty', null, empty));
      }
      const showShelf = query || view === ALL || view === DONE;
      listEl.replaceChildren(...items.map(t => item(t, showShelf)));
    }

    function item(t, showShelf) {
      const open = openId === t.id;
      if (editId === t.id) return editor(t);
      return h('li.thought' + (open ? '.open' : '') + (t.done ? '.done' : ''), { dataset: { id: t.id } },
        h('button.thought-text', { onclick: () => { openId = open ? null : t.id; renderList(); }, 'aria-expanded': open }, t.text),
        h('div.thought-meta', null,
          h('span', null, when(t.created)),
          showShelf && h('span.tag', null, shelfName(inShelf(t)) || 'Inbox')),
        open && h('div.thought-actions', null,
          !t.done && h('div.move', null, h('span.move-label', null, 'Move to'),
            [{ id: null, name: 'Inbox' }, ...shelves].map(s =>
              h('button.chip.small' + (inShelf(t) === s.id ? '.on' : ''), { onclick: () => move(t, s.id) }, s.name))),
          h('div.buttons', null,
            h('button.btn', { onclick: () => toggleDone(t) }, t.done ? 'Not done' : 'Done'),
            h('button.btn', { onclick: () => { editId = t.id; renderList(); } }, 'Edit'),
            h('button.btn.danger', { onclick: () => del(t) }, 'Delete'))),
      );
    }

    function editor(t) {
      const ta = h('textarea.edit-input', {
        value: t.text, rows: Math.min(10, t.text.split('\n').length + 1),
        onkeydown: e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); done(); }
          if (e.key === 'Escape') { editId = null; renderList(); }
        },
      });
      const done = async () => {
        const text = ta.value.trim();
        editId = null;
        if (text && text !== t.text) await db.save({ ...t, text }); else renderList();
      };
      const li = h('li.thought.editing', null, ta, h('div.buttons', null,
        h('button.btn.primary', { onclick: done }, 'Save'),
        h('button.btn', { onclick: () => { editId = null; renderList(); } }, 'Cancel')));
      queueMicrotask(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
      return li;
    }

    async function move(t, shelf) {
      openId = null;
      await db.save({ ...t, shelf });
      toast(`→ ${shelfName(shelf) || 'Inbox'}`);
    }

    async function toggleDone(t) {
      openId = null;
      await db.save({ ...t, done: !t.done, doneAt: t.done ? null : Date.now() });
      if (!t.done) toast('Marked as done', { label: 'Undo', run: () => db.save({ ...t, done: false, doneAt: null }) });
    }

    async function del(t) {
      openId = null;
      await db.remove(t.id);
      toast('Deleted', { label: 'Undo', run: async () => db.save({ ...(await db.get(t.id)), deleted: false }) });
    }

    // ── всё вместе ──
    function render() {
      capWhere.textContent = '→ ' + (shelfName(target()) || 'Inbox');
      renderShelves();
      renderList();
    }

    async function load() {
      const all = await db.allRaw();
      shelves = all.filter(r => r.type === 'shelf' && !r.deleted).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.created - b.created);
      thoughts = all.filter(r => r.type === 'thought' && !r.deleted).sort((a, b) => b.created - a.created);
      if (!shelfName(view) && ![INBOX, ALL, DONE].includes(view)) view = INBOX;   // полку удалили на другом устройстве
      if (editId) renderShelves(); else render();   // не сбиваем открытый редактор
    }

    const off = db.onChange(load);
    seedShelves().then(translateShelves).then(load);
    return off;
  },
};

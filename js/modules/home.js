// Главная в стиле комикс-постера: огромная дата, сразу под ней — бегущие строки (самое важное),
// панели (цикл, маникюр, зумба, сессия) с персонажами, записки себе со звёздочкой.
// Бегущая строка или обычная записка — выбирается галочкой при записи, потом можно поменять.
// Внизу — «SOON»: то, что подойдёт за неделю из «Don't want to remember».
// Записи: note { text, ticker }.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h, composer, removeWithUndo } from '../core/ui.js';
import { mountWidgets } from './widgets.js';

const SOON_DAYS = 7;

function dateBlock() {
  const t = dates.today(), d = dates.parse(t);
  const dayOfYear = dates.daysFrom(t) - dates.daysFrom(`${d.getFullYear()}-01-01`) + 1;
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase().replace('.', '');
  return h('div.home-date', null,
    h('small', null, `${weekday} · NO. ${dayOfYear}`),
    h('b', null, `${d.getDate()} ${month}`),
    h('b', null, String(d.getFullYear())));
}

export default {
  id: 'home',
  title: 'Home',
  icon: 'home',

  mount(root) {
    let notes = [], soon = [], openId = null, editId = null;

    const tickerBox = h('input', { type: 'checkbox', checked: true });
    const tickerToggle = h('label.ticker-toggle', null, tickerBox, h('span', null, 'Running line'));
    const { el: capture } = composer({
      placeholder: 'Write to yourself…', button: 'Say it!', className: 'home-capture', extra: tickerToggle,
      onSubmit: text => db.save({ type: 'note', text, ticker: tickerBox.checked }),
    });
    const tickersEl = h('div.home-tickers');
    const notesEl = h('div.home-notes');
    const soonEl = h('section.home-soon');
    const widgetsEl = h('section.widgets-holder');

    root.append(
      h('header.page-head.home-head', null, dateBlock()),
      tickersEl,
      h('div.home-grid', null,
        h('div.home-col', null, widgetsEl),
        h('div.home-col', null, capture, notesEl, soonEl)),
    );
    const offWidgets = mountWidgets(widgetsEl);

    function actions(n) {
      return openId === n.id && h('div.buttons.note-actions', null,
        h('button.btn', { onclick: () => { openId = null; db.save({ ...n, ticker: !n.ticker }); } }, n.ticker ? 'Make it a note' : 'Make it a running line'),
        h('button.btn', { onclick: () => { editId = n.id; openId = null; render(); } }, 'Edit'),
        h('button.btn', { onclick: () => { openId = null; removeWithUndo(db, n, 'Removed'); } }, 'Remove'));
    }
    const toggle = n => { openId = openId === n.id ? null : n.id; render(); };

    function editor(n) {
      const ta = h('textarea.edit-input.note-edit', { value: n.text, rows: 3 });
      const save = async () => { editId = null; const t = ta.value.trim(); if (t && t !== n.text) await db.save({ ...n, text: t }); else render(); };
      queueMicrotask(() => ta.focus());
      return h('div.note.editing', null, ta, h('div.buttons', null,
        h('button.btn.primary', { onclick: save }, 'Save'),
        h('button.btn', { onclick: () => { editId = null; render(); } }, 'Cancel')));
    }

    /** бегущая строка — две встречные строки, как FAYA!FAYA! */
    function shout(n) {
      const row = Array(6).fill(n.text.toUpperCase().replace(/[.!]*$/, '!')).join(' ');
      return h('div.note.shout' + (openId === n.id ? '.open' : ''), null,
        h('button.shout-text', { onclick: () => toggle(n), 'aria-label': n.text },
          h('span.shout-row', { 'aria-hidden': 'true' }, h('span', null, row + ' '), h('span', null, row + ' ')),
          h('span.shout-row.back', { 'aria-hidden': 'true' }, h('span', null, row + ' '), h('span', null, row + ' '))),
        actions(n));
    }

    function star(n) {
      return h('div.note.star' + (openId === n.id ? '.open' : ''), null,
        h('button.note-text', { onclick: () => toggle(n) }, h('i', { 'aria-hidden': 'true' }, '★'), h('span', null, n.text)),
        actions(n));
    }

    function render() {
      const tickers = notes.filter(n => n.ticker), plain = notes.filter(n => !n.ticker);
      tickersEl.replaceChildren(...tickers.map(n => editId === n.id ? editor(n) : shout(n)));
      notesEl.replaceChildren(...plain.map(n => editId === n.id ? editor(n) : star(n)));
      soonEl.replaceChildren(...soon.map(l => h('a.soon-strip', { href: '#later' },
        h('b', null, 'SOON'),
        h('span', null, l.text, h('small' + (dates.daysFrom(l.date) < 0 ? '.past' : ''), null,
          `${dates.relative(l.date)} · ${dates.short(l.date)}`.toUpperCase())))));
    }

    async function load() {
      const all = await db.allRaw();
      notes = all.filter(r => r.type === 'note' && !r.deleted).sort((a, b) => b.created - a.created);
      soon = all.filter(r => r.type === 'later' && !r.deleted && !r.done && dates.daysFrom(r.date) <= SOON_DAYS)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!editId) render();
    }

    load();
    const off = db.onChange(load);
    return () => { off(); offWidgets(); };
  },
};

// Плитки-панели на главной: день цикла, счётчик зумбы, сколько до маникюра и до сессии.
// Картинки персонажей — записи art { slot, image } (кладутся с Mac: tools/art.py).
// Нажми на плитку — откроются её настройки. «+1» у зумбы — сразу плюс одно занятие.
//
// Записи:
//   widget { id: 'w-cycle', kind: 'cycle', startDay, length, starts: ['ГГГГ-ММ-ДД'] } — starts: когда реально начались
//   widget { id: 'w-zumba', kind: 'tally', base }  + tally { tally: 'zumba', date } — по записи на каждое занятие,
//          чтобы тыки с телефона и айпада не перезатирали друг друга
//   widget { id: 'w-manicure' | 'w-session', kind: 'countdown', date, every? }
// id постоянные: настройки одни на все устройства.
import * as db from '../core/db.js';
import * as dates from '../core/dates.js';
import { h, toast } from '../core/ui.js';

const DEFAULTS = {
  'w-cycle': { kind: 'cycle', startDay: 28, length: 3, starts: [] },
  'w-zumba': { kind: 'tally', base: 0 },
  'w-manicure': { kind: 'countdown', date: null, every: 21 },
  'w-session': { kind: 'countdown', date: null },
};

// ── цикл ──
/** обычный день начала в месяце (28-е; в коротком месяце — последний день) */
function ruleDate(year, month, day) {
  return dates.ymd(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate())));
}
function ruleOnOrBefore(s, day) {
  const d = dates.parse(s);
  const r = ruleDate(d.getFullYear(), d.getMonth(), day);
  return r <= s ? r : ruleDate(d.getFullYear(), d.getMonth() - 1, day);
}
const between = (a, b) => Math.round((dates.parse(b) - dates.parse(a)) / 864e5);

export function cycleState(w, today = dates.today()) {
  const r = ruleOnOrBefore(today, w.startDay);
  const logged = (w.starts || []).filter(s => s <= today).sort().pop();
  // отмеченное начало важнее правила, если оно позже или всего на несколько дней раньше «обычного» числа
  const start = logged && (logged > r || between(logged, r) <= 10) ? logged : r;
  let next = ruleOnOrBefore(dates.addMonths(start, 1), w.startDay);
  if (between(start, next) < 15) next = ruleOnOrBefore(dates.addMonths(start, 2), w.startDay);
  const day = between(start, today) + 1;
  return { start, next, day, inPeriod: day <= w.length, logged };
}

// ── отсчёт ──
function countdown(date) {
  if (!date) return { big: '—', small: 'Tap to set the date' };
  const n = dates.daysFrom(date);
  if (n === 0) return { big: 'Today', small: dates.short(date) };
  if (n === 1) return { big: 'Tomorrow', small: dates.short(date) };
  if (n < 0) return { big: `${-n} ${-n === 1 ? 'day' : 'days'} ago`, small: dates.short(date), late: true };
  return { big: `${n} days`, small: dates.short(date) };
}

export function mountWidgets(root) {
  let w = {}, zumba = [], arts = {}, editing = null;
  const grid = h('div.panels');
  const panel = h('div');
  root.append(grid, panel);

  const save = (id, patch) => db.save({ id, type: 'widget', ...w[id], ...patch });
  const open = id => { editing = editing === id ? null : id; render(); };

  /** панель комикса; art — картинка персонажа из слота: 'duo' — чёрно-белая печать на цвете панели, 'sticker' — стикер */
  function tile(id, cls, title, big, small, { art, extra } = {}) {
    const img = art && arts[art.slot];
    return h('div.panel' + cls + (editing === id ? '.editing' : '') + (img ? '.has-art' : ''), null,
      img && art.mode === 'duo' && h('div.duo' + (art.dots ? '.dots' : ''), { style: art.style || '' }, h('img', { src: img, alt: '', style: art.img || '' })),
      img && art.mode === 'sticker' && h('img.panel-sticker', { src: img, alt: '', style: art.style || '' }),
      h('button.panel-main', { onclick: () => open(id), 'aria-expanded': editing === id ? 'true' : 'false' },
        h('span.panel-label', null, title),
        h('span.panel-big', null, big),
        small && h('span.panel-sub', null, small)),
      extra);
  }

  function tiles() {
    const c = cycleState(w['w-cycle']);
    const cycleArt = { art: { slot: 'home-cycle', mode: 'duo', dots: true, img: 'object-position: 70% 35%' } };
    const cycle = c.inPeriod
      ? tile('w-cycle', '.cycle.period', 'Cycle', `Period · ${c.day}`, `day ${c.day} of ${w['w-cycle'].length}`, cycleArt)
      : tile('w-cycle', '.cycle', 'Cycle', `Day ${c.day}`, `starts ${dates.short(c.next)}`, cycleArt);

    const m = countdown(w['w-manicure'].date);
    const mani = tile('w-manicure', '.manicure' + (m.late ? '.late' : ''), 'Manicure', m.big, w['w-manicure'].date ? null : m.small,
      { art: { slot: 'home-manicure', mode: 'duo', img: 'object-position: 30% 60%' } });

    const total = (w['w-zumba'].base || 0) + zumba.length;
    const plus = h('button.panel-plus', { 'aria-label': 'Add a Zumba class', onclick: async e => {
      e.currentTarget.classList.remove('pop'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('pop');
      const rec = await db.save({ type: 'tally', tally: 'zumba', date: dates.today() });
      toast(`Zumba #${total + 1} 💃`, { label: 'Undo', run: () => db.remove(rec.id) });
    } }, '+1');
    const z = tile('w-zumba', '.zumba.wide', 'Zumba', String(total), total === 1 ? 'class in total' : 'classes in total',
      { art: { slot: 'home-zumba', mode: 'sticker' }, extra: plus });

    const s = countdown(w['w-session'].date);
    const session = tile('w-session', '.session.wide' + (s.late ? '.late' : ''), 'Exam session', s.big, s.small,
      { art: { slot: 'home-exam', mode: 'duo', dots: true, img: 'object-position: 50% 30%' } });
    return [cycle, mani, z, session];
  }

  // ── настройки плиток ──
  const num = (label, value, min, max, onchange) => h('label.widget-field', null, h('span', null, label),
    h('input', { type: 'number', inputMode: 'numeric', min, max, value, onchange: e => { const v = parseInt(e.target.value, 10); if (v >= min && v <= max) onchange(v); } }));
  const dateField = (label, value, onchange) => h('label.widget-field', null, h('span', null, label),
    h('input', { type: 'date', value: value || '', onchange: e => onchange(e.target.value || null) }));

  function editor() {
    if (!editing) return [];
    const x = w[editing];
    let body;
    if (editing === 'w-cycle') {
      const c = cycleState(x);
      body = [
        h('h3', null, 'Cycle'),
        num('Usually starts on day', x.startDay, 1, 31, v => save('w-cycle', { startDay: v })),
        num('Lasts, days', x.length, 1, 10, v => save('w-cycle', { length: v })),
        h('div.buttons', null,
          h('button.btn.primary', { onclick: () => save('w-cycle', { starts: [...new Set([...(x.starts || []), dates.today()])].sort().slice(-24) }) }, 'Started today'),
          c.logged && h('button.btn', { onclick: () => save('w-cycle', { starts: (x.starts || []).filter(s => s !== c.logged) }) }, `Remove mark ${dates.short(c.logged)}`)),
        h('p.hint', null, `This cycle started ${dates.short(c.start)}. Next period expected ${dates.short(c.next)}. If it starts on another day, tap “Started today” — the count will follow.`),
      ];
    } else if (editing === 'w-zumba') {
      body = [
        h('h3', null, 'Zumba'),
        num('Classes before the app', x.base || 0, 0, 9999, v => save('w-zumba', { base: v })),
        h('div.buttons', null, zumba.length > 0 && h('button.btn', { onclick: () => db.remove(zumba.at(-1).id) }, '−1 (remove last)')),
        h('p.hint', null, `Tracked here: ${zumba.length}. Last: ${zumba.length ? dates.short(zumba.at(-1).date) : '—'}.`),
      ];
    } else if (editing === 'w-manicure') {
      body = [
        h('h3', null, 'Manicure'),
        dateField('Next manicure', x.date, v => save('w-manicure', { date: v })),
        num('Every, days', x.every || 21, 1, 120, v => save('w-manicure', { every: v })),
        h('div.buttons', null, h('button.btn.primary', { onclick: () => save('w-manicure', { date: dates.addDays(dates.today(), x.every || 21) }) }, 'Done today')),
        h('p.hint', null, `“Done today” sets the next one in ${x.every || 21} days.`),
      ];
    } else {
      body = [h('h3', null, 'Exam session'), dateField('Starts on', x.date, v => save('w-session', { date: v }))];
    }
    return [h('section.card.panel-editor', null, ...body.filter(Boolean),
      h('button.link', { onclick: () => { editing = null; render(); } }, 'Close'))];
  }

  function render() {
    grid.replaceChildren(...tiles());
    panel.replaceChildren(...editor());
  }

  async function load() {
    const all = await db.allRaw();
    w = {};
    for (const [id, d] of Object.entries(DEFAULTS)) w[id] = { ...d, ...(all.find(r => r.id === id && !r.deleted) || {}) };
    zumba = all.filter(r => r.type === 'tally' && r.tally === 'zumba' && !r.deleted).sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
    arts = Object.fromEntries(all.filter(r => r.type === 'art' && !r.deleted && r.image).map(r => [r.slot, r.image]));
    // поле, в котором сейчас печатают, не перерисовываем
    if (panel.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') grid.replaceChildren(...tiles());
    else render();
  }

  load();
  return db.onChange(load);
}

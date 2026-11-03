// Маленькие помощники для интерфейса, общие для всех разделов.

/** h('button.chip.on', { onclick }, 'текст', ...) — создать элемент */
export function h(tag, props, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

let toastTimer;
/** короткое сообщение внизу; action — { label, run } для кнопки вроде «Вернуть» */
export function toast(text, action) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = h('div.toast', { role: 'status' }, h('span', null, text),
    action && h('button', { onclick: () => { el.remove(); action.run(); } }, action.label));
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), 5000);
}

/** «сегодня 14:05», «вчера 09:12», «3 ноя», «3 ноя 2025» */
export function when(ms) {
  const d = new Date(ms), now = new Date();
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return 'сегодня ' + time;
  if (diff === 1) return 'вчера ' + time;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }).replace('.', '');
}

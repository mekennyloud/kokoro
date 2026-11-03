// Иконки нижнего меню — жирный «нарисованный» контур в духе комикса; у активного раздела появляется заливка.
// Рисуются цветом текста (currentColor), заливка — классом .fill (красная у активного пункта).
const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  home: svg(`<path class="fill" d="M3.5 10.8 12 3.6l8.5 7.2V20a1 1 0 0 1-1 1H15v-6.2H9V21H4.5a1 1 0 0 1-1-1z"/>`),
  thoughts: svg(`<path class="fill" d="M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H11l-5 4v-4H4.5A1.5 1.5 0 0 1 3 15.5V6a1.5 1.5 0 0 1 1.5-1.5z"/>
    <path d="M8 10.8h.01M12 10.8h.01M16 10.8h.01" stroke-width="3"/>`),
  tasks: svg(`<rect class="fill" x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="m7.8 12.4 3 3 5.6-6.6" stroke-width="2.6"/>`),
  later: svg(`<path d="M6 3h12M6 21h12"/><path class="fill" d="M7.5 3v2.6c0 2.2 4.5 4.2 4.5 6.4 0 2.2-4.5 4.2-4.5 6.4V21h9v-2.6c0-2.2-4.5-4.2-4.5-6.4 0-2.2 4.5-4.2 4.5-6.4V3z"/>`),
  calendar: svg(`<rect class="fill" x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" stroke-width="2.8"/>`),
  unhappy: svg(`<path class="fill" d="M7 15.5a4.2 4.2 0 0 1-.6-8.36A6.2 6.2 0 0 1 18 6.7a4.4 4.4 0 0 1-.6 8.8z"/><path d="m12.6 15.5-2.1 3.3h3.2L11.6 22" stroke-width="2.4"/>`),
  settings: svg(`<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`),
};

/** <span> с иконкой по имени */
export function icon(name) {
  const el = document.createElement('span');
  el.className = 'nav-icon';
  el.innerHTML = ICONS[name] || '';
  return el;
}

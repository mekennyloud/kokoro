// Даты без времени — строкой «2026-11-03», чтобы не зависеть от часовых поясов при синхронизации.

const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => ymd(new Date());

export function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
export function addMonths(s, n) {
  const d = parse(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));   // 31 янв + 1 мес = 28/29 фев
  return ymd(d);
}

/** понедельник недели, в которую попадает дата */
export function startOfWeek(s) { const d = parse(s); return addDays(s, -((d.getDay() + 6) % 7)); }
export function startOfMonth(s) { return s.slice(0, 8) + '01'; }
export function endOfMonth(s) { return addDays(addMonths(startOfMonth(s), 1), -1); }
export const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-GB', { month: 'long' }));

/** сколько дней от сегодня (отрицательное — уже прошло) */
export const daysFrom = s => Math.round((parse(s) - parse(today())) / 864e5);

const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;

/** «today», «tomorrow», «in 12 days», «3 days ago» */
export function relative(s) {
  const n = daysFrom(s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? 'in ' + days(n) : days(-n) + ' ago';
}

/** «12 Dec», «12 Dec 2027», «Tuesday 3 November» */
export const short = s => {
  const d = parse(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
export const long = s => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthTitle = d => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

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

/** сколько дней от сегодня (отрицательное — уже прошло) */
export const daysFrom = s => Math.round((parse(s) - parse(today())) / 864e5);

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
const days = n => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

/** «сегодня», «завтра», «через 12 дней», «3 дня назад» */
export function relative(s) {
  const n = daysFrom(s);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  return n > 0 ? 'через ' + days(n) : days(-n) + ' назад';
}

/** «12 дек», «12 дек 2027», «вторник, 3 ноября» */
export const short = s => {
  const d = parse(s);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).replace('.', '');
};
export const long = s => parse(s).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
export const monthTitle = d => d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
export const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

// Синхронизация с Mac. Всё работает и без неё: записи живут на устройстве,
// а когда Mac доступен — уходят туда и забирают изменения с других устройств.
// Запускается сама: при открытии, после правок (с паузой), при возврате в приложение и раз в минуту.
import * as db from './db.js';
import { pref, setPref } from './prefs.js';

export const macAddr = () => (pref('macAddr', '') || '').trim().replace(/\/+$/, '');
export function setMacAddr(v) {
  setPref('macAddr', v.trim());
  setPref('cursor', 0);   // новый Mac — забираем с него всё заново
  syncSoon(0);
}

/** состояние для экрана настроек */
export const state = { busy: false, lastOk: pref('lastSync', 0), error: '' };
const listeners = new Set();
export const onState = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(fn => fn(state));

const strip = ({ _dirty, ...r }) => r;

let running = null;
export function syncNow() {
  running ??= run().finally(() => { running = null; });
  return running;
}

async function run() {
  const addr = macAddr();
  if (!addr || !navigator.onLine) return;
  state.busy = true; emit();
  try {
    const sent = (await db.allRaw()).filter(r => r._dirty);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(addr + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: pref('cursor', 0), changes: sent.map(strip) }),
      cache: 'no-store',
      signal: ctl.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new Error('Mac ответил ' + res.status);
    const { cursor, changes } = await res.json();

    // отправленное больше не «грязное» — если его не успели поменять, пока шёл запрос
    const local = new Map((await db.allRaw()).map(r => [r.id, r]));
    const clean = [];
    for (const r of sent) {
      const cur = local.get(r.id);
      if (cur && cur.updated === r.updated) { const c = { ...cur }; delete c._dirty; clean.push(c); local.set(r.id, c); }
    }
    // пришедшее с Mac: берём, если у нас нет неотправленной правки новее
    const incoming = changes.filter(r => {
      const cur = local.get(r.id);
      return !cur || !cur._dirty || r.updated >= cur.updated;
    });
    await db.putMany(clean, { silent: true });
    await db.putMany(incoming, { silent: true });
    if (incoming.length) db.notify();

    setPref('cursor', cursor);
    state.lastOk = Date.now(); setPref('lastSync', state.lastOk);
    state.error = '';
  } catch (e) {
    state.error = e.name === 'AbortError' ? 'Mac не ответил' : (e.message === 'Failed to fetch' || e.name === 'TypeError') ? 'Mac недоступен' : e.message;
  } finally {
    state.busy = false; emit();
  }
}

let soon;
export function syncSoon(delay = 2000) {
  clearTimeout(soon);
  soon = setTimeout(syncNow, delay);
}

export function startAutoSync() {
  db.onChange(source => { if (source === 'local') syncSoon(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(300); });
  addEventListener('online', () => syncSoon(300));
  setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  syncSoon(300);
}

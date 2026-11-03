// Синхронизация с Mac. Всё работает и без неё: записи живут на устройстве,
// а когда Mac доступен — уходят туда и забирают изменения с других устройств.
// Запускается сама: при открытии, после правок (с паузой), при возврате в приложение и раз в минуту.
// Большие объёмы (картинки) идут порциями: отправляем по ~3 МБ, Mac отдаёт по ~4 МБ.
import * as db from './db.js';
import { pref, setPref } from './prefs.js';

const CHUNK = 3 * 1024 * 1024;
const TIMEOUT = 60000;
export const STALE_AFTER = 24 * 3600 * 1000;   // дольше без синхронизации — показываем точку на «⋯»

export const macAddr = () => (pref('macAddr', '') || '').trim().replace(/\/+$/, '');
export const macKey = () => (pref('macKey', '') || '').trim();
export function setMacAddr(v) {
  setPref('macAddr', v.trim());
  setPref('cursor', 0);   // новый Mac — забираем с него всё заново
  syncSoon(0);
}
export function setMacKey(v) { setPref('macKey', v.trim()); syncSoon(0); }

/** состояние для экрана настроек и точки на «⋯» */
export const state = { busy: false, lastOk: pref('lastSync', 0), error: '' };
export const isStale = () => !!macAddr() && Date.now() - (state.lastOk || 0) > STALE_AFTER;
const listeners = new Set();
export const onState = fn => (listeners.add(fn), () => listeners.delete(fn));
const emit = () => listeners.forEach(fn => fn(state));

const strip = ({ _dirty, ...r }) => r;

let running = null, again = false;
export function syncNow() {
  if (running) { again = true; return running; }   // правка во время синхронизации — сразу ещё один круг после неё
  running = run().finally(() => {
    running = null;
    if (again) { again = false; syncSoon(300); }
  });
  return running;
}

/** первые записи до ~CHUNK байт (хотя бы одна) */
function takeChunk(dirty) {
  const out = [];
  let size = 0;
  for (const r of dirty) {
    const n = JSON.stringify(r).length;
    if (out.length && size + n > CHUNK) break;
    out.push(r); size += n;
  }
  return out;
}

async function request(addr, body) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(addr + '/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + macKey() },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: ctl.signal,
    });
    if (res.status === 401) throw new Error('The Mac needs the key — add it in Sync & backup');
    if (!res.ok) throw new Error('Mac replied ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  const addr = macAddr();
  if (!addr || !navigator.onLine) return;
  state.busy = true; emit();
  try {
    // отправляем порциями, пока есть что отправлять и пока Mac отдаёт изменения
    for (let round = 0; round < 200; round++) {
      const dirty = (await db.allRaw()).filter(r => r._dirty);
      const sent = takeChunk(dirty).map(strip);
      const res = await request(addr, { since: pref('cursor', 0), changes: sent });

      // база на Mac новая для этого устройства (первое знакомство, база пропала или восстановлена из копии) —
      // один раз полностью сверяемся: отправляем всё своё и забираем всё с Mac. Mac оставит то, что новее.
      const known = pref('dbId', null);
      if (res.db && res.db !== known) {
        setPref('dbId', res.db);
        setPref('cursor', 0);
        await db.markAllDirty();
        continue;
      }

      await db.applySync(sent, res.changes);
      setPref('cursor', res.cursor);
      if (!res.more && sent.length >= dirty.length) break;
    }
    state.lastOk = Date.now(); setPref('lastSync', state.lastOk);
    state.error = '';
  } catch (e) {
    state.error = e.name === 'AbortError' ? 'Mac did not respond' : (e.message === 'Failed to fetch' || e.name === 'TypeError') ? 'Mac is unreachable' : e.message;
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

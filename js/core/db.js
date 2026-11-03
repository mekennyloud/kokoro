// Хранилище на устройстве (IndexedDB). Все данные приложения — «записи»:
// { id, type, created, updated, deleted?, ...поля раздела }. Новый раздел = новый type, схема не меняется.
// Удаление — пометка deleted (чтобы удаление дошло до других устройств), а не стирание.
// _dirty — запись изменена здесь и ещё не отправлена на Mac.

const DB_NAME = 'kokoro';   // у плеера тот же адрес сайта, поэтому имя своё
let dbp;

function open() {
  dbp ??= new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('records', { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', mode);
    const out = fn(t.objectStore('records'));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

const listeners = new Set();
/** подписка на любые изменения записей (свои и пришедшие с Mac) */
export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));
// fn(source): 'local' — правка на этом устройстве, 'remote' — пришло с Mac
const emit = source => listeners.forEach(fn => fn(source));

export const allRaw = () => tx('readonly', s => s.getAll());
export const get = id => tx('readonly', s => s.get(id));

/** живые записи одного типа */
export async function list(type) {
  return (await allRaw()).filter(r => r.type === type && !r.deleted);
}

export const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

/** создать или изменить запись: сама ставит updated и помечает к отправке.
 *  asDefault — запись «по умолчанию» (updated = 1): любая настоящая версия с Mac её перекроет */
export async function save(rec, { asDefault = false } = {}) {
  const now = Date.now();
  const r = { created: now, ...rec, id: rec.id || uid(), updated: asDefault ? 1 : Math.max(now, (rec.updated || 0) + 1), _dirty: 1 };
  await tx('readwrite', s => s.put(r));
  emit('local');
  return r;
}

export async function remove(id) {
  const r = await get(id);
  if (r) await save({ ...r, deleted: true });
}

/** итог синхронизации — одной транзакцией, чтобы правка, сделанная в эту же секунду, не затёрлась:
 *  отправленное снимаем с отправки, если его не меняли, пока шёл запрос;
 *  пришедшее с Mac берём, если здесь нет неотправленной правки новее. Возвращает, сколько пришло нового. */
export async function applySync(sent, incoming) {
  const sentById = new Map(sent.map(r => [r.id, r]));
  const inById = new Map(incoming.map(r => [r.id, r]));
  const ids = new Set([...sentById.keys(), ...inById.keys()]);
  let applied = 0;
  await tx('readwrite', s => ids.forEach(id => {
    const req = s.get(id);
    req.onsuccess = () => {
      let cur = req.result, changed = false;
      const out = sentById.get(id), inc = inById.get(id);
      if (cur && out && cur._dirty && cur.updated === out.updated) { cur = { ...cur }; delete cur._dirty; changed = true; }
      if (inc && (!cur || !cur._dirty || inc.updated >= cur.updated)) {
        if (!cur || cur.updated !== inc.updated) applied++;   // своё же, вернувшееся с Mac, — не новость
        cur = inc; changed = true;
      }
      if (changed) s.put(cur);
    };
  }));
  if (applied) emit('remote');
  return applied;
}

/** пометить все записи к отправке — когда база на Mac оказалась новой (пропала или восстановлена из копии) */
export async function markAllDirty() {
  await tx('readwrite', s => {
    const req = s.getAll();
    req.onsuccess = () => req.result.forEach(r => { if (!r._dirty) s.put({ ...r, _dirty: 1 }); });
  });
}

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

/** создать или изменить запись: сама ставит updated и помечает к отправке */
export async function save(rec) {
  const now = Date.now();
  const r = { created: now, ...rec, id: rec.id || uid(), updated: Math.max(now, (rec.updated || 0) + 1), _dirty: 1 };
  await tx('readwrite', s => s.put(r));
  emit('local');
  return r;
}

export async function remove(id) {
  const r = await get(id);
  if (r) await save({ ...r, deleted: true });
}

/** записать как есть, без отметки к отправке (для пришедшего с Mac) */
export async function putMany(recs, { silent } = {}) {
  if (!recs.length) return;
  await tx('readwrite', s => recs.forEach(r => s.put(r)));
  if (!silent) emit('remote');
}

export const notify = () => emit('remote');

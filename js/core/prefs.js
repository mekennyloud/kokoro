// Мелкие настройки этого устройства. У плеера тот же адрес сайта и общий localStorage,
// поэтому все ключи — с приставкой kokoro:
const P = 'kokoro:';

export function pref(key, fallback = null) {
  try {
    const v = localStorage.getItem(P + key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function setPref(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(P + key);
    else localStorage.setItem(P + key, JSON.stringify(value));
  } catch { /* приватный режим — просто не запоминаем */ }
}

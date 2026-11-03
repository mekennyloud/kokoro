// Кэширует само приложение, чтобы оно открывалось без интернета.
// При обновлении приложения увеличь номер версии.
const CACHE = 'kokoro-v14';
const FONTS = 'kokoro-fonts';   // шрифты Google — живут между версиями приложения
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/base.css',
  'js/app.js', 'js/core/db.js', 'js/core/prefs.js', 'js/core/sync.js', 'js/core/ui.js', 'js/core/dates.js', 'js/core/menu.js', 'js/core/images.js', 'js/core/bits.js', 'js/core/icons.js',
  'js/modules/index.js', 'js/modules/home.js', 'js/modules/widgets.js', 'js/modules/thoughts.js', 'js/modules/tasks.js', 'js/modules/later.js',
  'js/modules/calendar.js', 'js/modules/uneasy.js', 'js/modules/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

// cache: 'reload' — берём файлы прямо с сервера, мимо HTTP-кэша браузера,
// иначе новая версия может закэшировать старую страницу
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

// у плеера тот же адрес сайта — чистим только свои старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('kokoro-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// сначала из кэша (мгновенно и офлайн), в фоне — свежая версия из сети
self.addEventListener('fetch', e => {
  const req = e.request;
  const host = new URL(req.url).hostname;
  // шрифты: один раз скачали — дальше всегда из кэша, и без интернета тоже
  if (req.method === 'GET' && (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com')) {
    e.respondWith(caches.open(FONTS).then(async cache =>
      (await cache.match(req)) || fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })));
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req.url, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});

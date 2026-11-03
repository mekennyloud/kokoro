# Kokoro

Личное веб-приложение для iPhone и iPad: мысли, а потом — траты, планы, утренний журнал, вечернее саммари, спорт, работа.
Работает без сети; когда Mac доступен через Tailscale — синхронизируется с ним и между устройствами.

## Как устроено

- `index.html`, `js/app.js` — оболочка и навигация между разделами.
- `js/modules/` — разделы. Новый раздел = новый файл `{ id, title, icon, mount(root) }` + строка в `js/modules/index.js`.
- `js/core/db.js` — хранилище на устройстве. Все данные — записи `{ id, type, updated, ... }`, новый раздел просто заводит свой `type`.
- `js/core/sync.js` — синхронизация с Mac (сама, в фоне).
- `server/server.py` — сервер на Mac: `~/Кокоро/kokoro.db`, ключ `~/Кокоро/key`, копии в `~/Кокоро/Копии` и iCloud Drive → Kokoro backups.
- `server/restore.py` — список копий и восстановление из копии.
- `css/base.css` — временный нейтральный вид; дизайн — последним этапом, см. `design/NOTES.md`.

## Команды

- Посмотреть локально: `python3 -m http.server 8766` в папке проекта → http://127.0.0.1:8766
- Включить сервер на Mac насовсем: `zsh server/install.sh` (выключить: `zsh server/install.sh off`)
- Показать ключ для настроек приложения: `zsh server/install.sh key`
- Копии и восстановление: `python3 server/restore.py` (список), `python3 server/restore.py <файл>`
- Опубликовать приложение: `zsh tools/publish.sh` → https://mekennyloud.github.io/kokoro/
- При изменении файлов приложения — поднять `CACHE` в `sw.js` и дописать новые файлы в `FILES`.

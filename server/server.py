#!/usr/bin/env python3
"""Сервер Kokoro на Mac: хранит записи и синхронизирует их между iPhone и iPad.

Слушает только localhost; наружу (только для твоих устройств в Tailscale) его отдаёт `tailscale serve`.
Данные — ~/Кокоро/kokoro.db (SQLite). Копии — ~/Кокоро/Копии и iCloud Drive/Kokoro backups:
файл за сегодня обновляется не чаще раза в час (копия с меньшим числом записей его не затирает),
хранятся 14 последних дней и по одному за неделю до 4 месяцев.

Синхронизация: устройство присылает свои изменённые записи и номер, до которого оно уже всё знает;
сервер сохраняет то, что новее (по полю updated), и отдаёт изменения после этого номера порциями.
Записи сервер не разбирает — это любые JSON-объекты с id, type и updated, поэтому новые разделы
приложения (траты, журнал…) работают без правок сервера.

У базы есть свой id: если база пропала или восстановлена из копии, id другой — устройства видят это
и отправляют всё, что у них есть, заново. Запросы — только с ключом из ~/Кокоро/key.
"""
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
import uuid
from datetime import date, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("KOKORO_PORT", 8788))   # другой порт — только для проверок
HOME = Path.home() / "Кокоро"   # не «Kokoro»: диск Mac не различает регистр, это была бы папка с кодом ~/kokoro
DB = HOME / "kokoro.db"
KEY_FILE = HOME / "key"
BACKUPS = [HOME / "Копии", Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/Kokoro backups"]
KEEP_DAILY, KEEP_WEEKLY_DAYS = 14, 120
BACKUP_EVERY = 3600
MAX_BODY = 20 * 1024 * 1024
PAGE_BYTES = 4 * 1024 * 1024   # столько отдаём за один ответ, остальное — следующим запросом

ALLOWED_ORIGINS = {"https://mekennyloud.github.io", "http://127.0.0.1:8766", "http://localhost:8766"}

lock = threading.Lock()


def connect(path=DB):
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, check_same_thread=False)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, updated INTEGER NOT NULL,
        seq INTEGER NOT NULL, body TEXT NOT NULL)""")
    db.execute("CREATE INDEX IF NOT EXISTS records_seq ON records(seq)")
    db.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    db.execute("INSERT OR IGNORE INTO meta VALUES ('db_id', ?)", (uuid.uuid4().hex,))
    db.commit()
    return db


def load_key():
    if not KEY_FILE.exists():
        KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        KEY_FILE.write_text(secrets.token_urlsafe(18))
        KEY_FILE.chmod(0o600)
    return KEY_FILE.read_text().strip()


db = connect()
DB_ID = db.execute("SELECT value FROM meta WHERE key = 'db_id'").fetchone()[0]
KEY = load_key()


def valid(r):
    return (isinstance(r, dict)
            and isinstance(r.get("id"), str) and 0 < len(r["id"]) <= 64
            and isinstance(r.get("type"), str) and 0 < len(r["type"]) <= 32
            and isinstance(r.get("updated"), (int, float)))


# ── копии ──
backup_state = {"at": 0.0, "changed": True, "count": 0}


def keep(name, today):
    """14 последних дней — все, дальше до 4 месяцев — только понедельники"""
    try:
        d = date.fromisoformat(name[len("kokoro-"):len("kokoro-") + 10])
    except ValueError:
        return True
    age = (today - d).days
    return age < KEEP_DAILY or (age < KEEP_WEEKLY_DAYS and d.weekday() == 0)


def count_in(path):
    try:
        data = json.loads(path.read_text())
        return len(data["records"] if isinstance(data, dict) else data)
    except (OSError, ValueError, KeyError):
        return 0


def backup():
    """Полная копия всех записей в JSON — за сегодня, не чаще раза в час и только если что-то менялось.
    Читается под тем же замком, что и запись, поэтому копия всегда целая.
    Копия, в которой записей меньше, чем в уже сохранённой за сегодня, её не затирает, а ложится рядом
    с временем в имени: если база на Mac вдруг опустела, вчерашняя и сегодняшняя хорошие копии останутся."""
    today = date.today()
    name = f"kokoro-{today.isoformat()}.json"
    fresh = all((d / name).exists() for d in BACKUPS if d.parent.exists())
    n = db.execute("SELECT COUNT(*) FROM records").fetchone()[0]
    # раньше часа обновляем, только если записей стало больше (например, устройства вернули опустевшей базе всё)
    if fresh and (not backup_state["changed"] or (time.time() - backup_state["at"] < BACKUP_EVERY and n <= backup_state["count"])):
        return
    rows = [json.loads(b) for (b,) in db.execute("SELECT body FROM records ORDER BY seq")]
    data = json.dumps({"db_id": DB_ID, "saved": int(time.time() * 1000), "records": rows}, ensure_ascii=False)
    for folder in BACKUPS:
        if not folder.parent.exists():   # iCloud Drive выключен — пропускаем
            continue
        try:
            folder.mkdir(exist_ok=True)
            target = folder / name
            if target.exists() and count_in(target) > len(rows):
                target = folder / f"kokoro-{today.isoformat()}-{time.strftime('%H%M%S')}.json"
            tmp = folder / (target.name + ".tmp")
            tmp.write_text(data)
            tmp.replace(target)
            for old in folder.glob("kokoro-*.json"):
                if not keep(old.name, today):
                    old.unlink()
        except OSError as e:
            print(f"Не удалось сохранить копию в {folder}: {e}", flush=True)
    backup_state.update(at=time.time(), changed=False, count=len(rows))


def sync(since, changes):
    with lock:
        seq = db.execute("SELECT COALESCE(MAX(seq), 0) FROM records").fetchone()[0]
        for r in changes:
            if not valid(r):
                continue
            row = db.execute("SELECT updated FROM records WHERE id = ?", (r["id"],)).fetchone()
            if row and row[0] >= r["updated"]:
                continue   # на сервере уже есть версия новее или та же
            seq += 1
            db.execute("INSERT OR REPLACE INTO records (id, type, updated, seq, body) VALUES (?, ?, ?, ?, ?)",
                       (r["id"], r["type"], int(r["updated"]), seq, json.dumps(r, ensure_ascii=False)))
            backup_state["changed"] = True
        db.commit()

        out, size, cursor, more = [], 0, since, False
        for s, b in db.execute("SELECT seq, body FROM records WHERE seq > ? ORDER BY seq", (since,)):
            if out and size + len(b) > PAGE_BYTES:
                more = True
                break
            out.append(json.loads(b)); size += len(b); cursor = s
        if not more:
            cursor = max(cursor, seq)
        try:
            backup()
        except Exception as e:   # копия не должна ломать синхронизацию
            print("Не удалось сделать копию:", e, flush=True)
        return {"db": DB_ID, "cursor": cursor, "more": more, "changes": out}


class Handler(BaseHTTPRequestHandler):
    server_version = "Kokoro/2"

    def log_message(self, fmt, *args):
        pass

    def cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        got = self.headers.get("Authorization", "")
        return got.startswith("Bearer ") and hmac.compare_digest(got[7:].strip(), KEY)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/ping":
            return self.send_json({"ok": True, "app": "kokoro", "key": self.authorized()})
        self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/sync":
            return self.send_json({"error": "not found"}, 404)
        if not self.authorized():
            return self.send_json({"error": "key"}, 401)
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send_json({"error": "json only"}, 415)
        size = int(self.headers.get("Content-Length") or 0)
        if size > MAX_BODY:
            return self.send_json({"error": "too big"}, 413)
        try:
            data = json.loads(self.rfile.read(size) or b"{}")
            since = int(data.get("since") or 0)
            changes = data.get("changes") or []
            if not isinstance(changes, list):
                raise ValueError
        except (ValueError, TypeError, AttributeError):
            return self.send_json({"error": "bad request"}, 400)
        self.send_json(sync(since, changes))


if __name__ == "__main__":
    print(f"Kokoro: http://127.0.0.1:{PORT}, данные — {HOME}, база {DB_ID[:8]}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

#!/usr/bin/env python3
"""Сервер Kokoro на Mac: хранит записи и синхронизирует их между iPhone и iPad.

Слушает только localhost; наружу (только для твоих устройств в Tailscale) его отдаёт `tailscale serve`.
Данные — ~/Кокоро/kokoro.db (SQLite), раз в день — копия в ~/Кокоро/Копии (последние 60 дней).

Синхронизация: устройство присылает свои изменённые записи и номер, до которого оно уже всё знает;
сервер сохраняет то, что новее (по полю updated), и отдаёт всё, что изменилось после этого номера.
Записи сервер не разбирает — это любые JSON-объекты с id, type и updated, поэтому новые разделы
приложения (траты, журнал…) работают без правок сервера.
"""
import json
import os
import sqlite3
import threading
import time
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("KOKORO_PORT", 8788))   # другой порт — только для проверок
HOME = Path.home() / "Кокоро"   # не «Kokoro»: диск Mac не различает регистр, это была бы папка с кодом ~/kokoro
DB = HOME / "kokoro.db"
BACKUPS = HOME / "Копии"
KEEP_BACKUPS = 60
MAX_BODY = 20 * 1024 * 1024

ALLOWED_ORIGINS = {"https://mekennyloud.github.io", "http://127.0.0.1:8766", "http://localhost:8766"}

lock = threading.Lock()


def connect():
    HOME.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB, check_same_thread=False)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, updated INTEGER NOT NULL,
        seq INTEGER NOT NULL, body TEXT NOT NULL)""")
    db.execute("CREATE INDEX IF NOT EXISTS records_seq ON records(seq)")
    db.commit()
    return db


db = connect()


def valid(r):
    return (isinstance(r, dict)
            and isinstance(r.get("id"), str) and 0 < len(r["id"]) <= 64
            and isinstance(r.get("type"), str) and 0 < len(r["type"]) <= 32
            and isinstance(r.get("updated"), (int, float)))


def backup_daily():
    """Раз в день — полная копия всех записей в JSON; старые копии сверх KEEP_BACKUPS удаляются."""
    BACKUPS.mkdir(parents=True, exist_ok=True)
    target = BACKUPS / f"kokoro-{date.today().isoformat()}.json"
    if target.exists():
        return
    rows = [json.loads(b) for (b,) in db.execute("SELECT body FROM records ORDER BY seq")]
    tmp = target.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    tmp.replace(target)
    for old in sorted(BACKUPS.glob("kokoro-*.json"))[:-KEEP_BACKUPS]:
        old.unlink()


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
        db.commit()
        out = [json.loads(b) for (b,) in db.execute("SELECT body FROM records WHERE seq > ? ORDER BY seq", (since,))]
        try:
            backup_daily()
        except OSError as e:
            print("Не удалось сделать копию:", e, flush=True)
        return {"cursor": seq, "changes": out}


class Handler(BaseHTTPRequestHandler):
    server_version = "Kokoro/1"

    def log_message(self, fmt, *args):
        pass

    def cors(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/ping":
            return self.send_json({"ok": True, "app": "kokoro", "time": int(time.time() * 1000)})
        self.send_json({"error": "not found"}, 404)

    def do_POST(self):
        if self.path.split("?")[0] != "/api/sync":
            return self.send_json({"error": "not found"}, 404)
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
    print(f"Kokoro: http://127.0.0.1:{PORT}, данные — {HOME}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

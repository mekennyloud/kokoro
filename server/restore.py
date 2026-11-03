#!/usr/bin/env python3
"""Восстановить базу Kokoro из копии.

    python3 ~/kokoro/server/restore.py                  — показать, какие копии есть
    python3 ~/kokoro/server/restore.py <файл копии>     — восстановить из неё

Текущая база не удаляется: она переименовывается в kokoro.db.до-восстановления-<время>.
У восстановленной базы новый id, поэтому iPhone и iPad при следующей синхронизации
сами отправят на Mac всё, что у них есть, — записи, которых не было в копии, не потеряются.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
HOME = Path.home() / "Кокоро"
DB = HOME / "kokoro.db"
FOLDERS = [HOME / "Копии", Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/Kokoro backups"]
LABEL = os.environ.get("KOKORO_LABEL", "me.kokoro.server")   # другое имя — только для проверок
PLIST = Path.home() / f"Library/LaunchAgents/{LABEL}.plist"


def records(path):
    data = json.loads(Path(path).read_text())
    return data["records"] if isinstance(data, dict) else data   # первые копии были просто списком


def listing():
    for folder in FOLDERS:
        files = sorted(folder.glob("kokoro-*.json")) if folder.exists() else []
        print(f"{folder}:" + ("" if files else " копий нет"))
        for f in files:
            try:
                n = len(records(f))
            except (OSError, ValueError, KeyError) as e:
                n = f"не читается ({e})"
            print(f"  {f.name}  записей: {n}")


def launchctl(*args):
    subprocess.run(["launchctl", *args], check=False, capture_output=True)


def restore(path):
    recs = records(path)
    print(f"В копии {len(recs)} записей.")
    if input("Восстановить? Текущая база будет отложена в сторону. [y/N] ").strip().lower() != "y":
        return print("Отменено.")
    uid = subprocess.run(["id", "-u"], capture_output=True, text=True).stdout.strip()
    launchctl("bootout", f"gui/{uid}/{LABEL}")
    time.sleep(1)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    for suffix in ("", "-wal", "-shm"):
        p = Path(str(DB) + suffix)
        if p.exists():
            p.rename(Path(f"{DB}.до-восстановления-{stamp}{suffix}"))
    import server   # создаёт новую пустую базу с новым id
    for seq, r in enumerate((r for r in recs if server.valid(r)), 1):
        server.db.execute("INSERT OR REPLACE INTO records (id, type, updated, seq, body) VALUES (?, ?, ?, ?, ?)",
                          (r["id"], r["type"], int(r["updated"]), seq, json.dumps(r, ensure_ascii=False)))
    server.db.commit()
    server.db.close()
    print(f"Готово. Старая база: {DB}.до-восстановления-{stamp}.")
    if PLIST.exists():
        launchctl("bootstrap", f"gui/{uid}", str(PLIST))
        print("Сервер снова запущен.")


if __name__ == "__main__":
    restore(sys.argv[1]) if len(sys.argv) > 1 else listing()

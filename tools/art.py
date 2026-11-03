#!/usr/bin/env python3
"""Картинки персонажей для оформления приложения — живут не в публичном GitHub, а в твоих данных:
кладёшь картинку в «слот» на Mac, и она синхронизируется на iPhone и iPad, как обычная запись.

    python3 tools/art.py                       — какие слоты есть и что в них лежит
    python3 tools/art.py <слот> <картинка>     — положить картинку в слот (лучше PNG с прозрачным фоном,
                                                  его делает tools/cutout.swift)
    python3 tools/art.py <слот> --clear        — убрать картинку из слота

Картинка уменьшается до 560 px по длинной стороне. Слоты: home-cycle, home-manicure, home-zumba, home-exam, uneasy-letgo.
GIF до 1,5 МБ кладётся как есть — остаётся живой.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

SERVER = f"http://127.0.0.1:{os.environ.get('KOKORO_PORT', 8788)}/api/sync"   # другой порт — только для проверок
KEY = (Path.home() / "Кокоро" / "key").read_text().strip()
SLOTS = {
    "home-cycle": "главная · цикл (печать на розовом)",
    "home-manicure": "главная · маникюр (печать на жёлтом)",
    "home-zumba": "главная · зумба (стикер)",
    "home-exam": "главная · сессия (печать на красном)",
    "uneasy-letgo": "Not happy · счётчик Let go (можно GIF)",
}
MAX = 560


def call(changes, since=0):
    req = urllib.request.Request(SERVER, data=json.dumps({"since": since, "changes": changes}).encode(),
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def current():
    out, since = {}, 0
    while True:
        res = call([], since)
        for r in res["changes"]:
            if r.get("type") == "art":
                out[r["slot"]] = r
        since = res["cursor"]
        if not res["more"]:
            return out


def put(slot, image):
    now = int(time.time() * 1000)
    call([{"id": f"art-{slot}", "type": "art", "slot": slot, "image": image,
           "created": now, "updated": now, "deleted": image is None}])


def encode(path):
    src = Path(path)
    if src.suffix.lower() == ".gif" and src.stat().st_size <= 1_500_000:   # живая гифка — как есть, без пересжатия
        data = src.read_bytes()
        return "data:image/gif;base64," + base64.b64encode(data).decode(), len(data)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / (src.stem + ".png")
        subprocess.run(["sips", "-s", "format", "png", "-Z", str(MAX), str(src), "--out", str(out)],
                       check=True, capture_output=True)
        data = out.read_bytes()
    return "data:image/png;base64," + base64.b64encode(data).decode(), len(data)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        have = current()
        for slot, what in SLOTS.items():
            r = have.get(slot)
            state = "пусто" if not r or r.get("deleted") else f"{len(r['image']) // 1024} КБ"
            print(f"  {slot:15} {what:40} {state}")
    elif len(args) == 2 and args[1] == "--clear":
        put(args[0], None)
        print(f"{args[0]}: убрано")
    elif len(args) == 2:
        if args[0] not in SLOTS:
            print(f"Нет такого слота. Есть: {', '.join(SLOTS)}"); sys.exit(1)
        image, size = encode(args[1])
        put(args[0], image)
        print(f"{args[0]}: {size // 1024} КБ — появится на устройствах при следующей синхронизации")
    else:
        print(__doc__)

#!/bin/zsh
# Включает сервер Kokoro на Mac насовсем: он запускается сам при входе в систему и работает в фоне,
# а Tailscale отдаёт его твоим устройствам по адресу https://<mac>.<сеть>.ts.net:8443
# (порт 8443 — чтобы не мешать Медиатеке на обычном 443).
# Выключить: zsh server/install.sh off
set -e
cd "${0:A:h}"
TS=$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)
LABEL=me.kokoro.server
PLIST=~/Library/LaunchAgents/$LABEL.plist
PY=$(command -v python3)

if [[ "$1" == off ]]; then
  launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
  rm -f $PLIST
  "$TS" serve --https=8443 off 2>/dev/null || true
  echo "Сервер Kokoro выключен. Данные остались в ~/Кокоро."
  exit
fi

mkdir -p ~/Library/LaunchAgents ~/Кокоро
cat > $PLIST <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>$PWD/server.py</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Кокоро/server.log</string>
  <key>StandardErrorPath</key><string>$HOME/Кокоро/server.log</string>
</dict>
</plist>
EOF

launchctl bootout gui/$(id -u)/$LABEL 2>/dev/null || true
launchctl bootstrap gui/$(id -u) $PLIST
"$TS" serve --bg --https=8443 http://127.0.0.1:8788 >/dev/null

ADDR=$("$TS" status --json | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
echo "Сервер Kokoro работает в фоне."
echo "Адрес для настроек приложения: https://$ADDR:8443"

#!/bin/zsh
# Публикует приложение в личный GitHub (mekennyloud/kokoro) и включает GitHub Pages.
# В репозиторий попадает только код — записи живут на устройствах и на Mac.
# В конце возвращает Терминал на рабочий аккаунт.
set -e
cd "${0:A:h}/.."

gh auth switch --hostname github.com --user mekennyloud
trap 'gh auth switch --hostname github.com --user kpokas-adguard >/dev/null 2>&1 && echo "Терминал снова на рабочем аккаунте kpokas-adguard"' EXIT

if ! gh repo view mekennyloud/kokoro >/dev/null 2>&1; then
  gh repo create mekennyloud/kokoro --public \
    --description "Kokoro — мысли, планы и всё, что не хочется забыть" \
    --source . --remote origin --push
else
  git push -u origin main
fi

gh api -X POST repos/mekennyloud/kokoro/pages -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true
echo
echo "Готово! Через 1–2 минуты приложение будет по адресу: https://mekennyloud.github.io/kokoro/"

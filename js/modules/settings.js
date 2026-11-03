// Настройки: адрес Mac для синхронизации и копия всех данных файлом.
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import { h, when } from '../core/ui.js';

export default {
  id: 'settings',
  title: 'Настройки',
  icon: '⚙',

  mount(root) {
    const addr = h('input.field', {
      type: 'url', value: sync.macAddr(), placeholder: 'https://твой-mac.xxxx.ts.net:8443',
      autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
      onchange: () => sync.setMacAddr(addr.value),
    });
    const status = h('p.status');
    const now = h('button.btn', { onclick: () => sync.syncNow() }, 'Синхронизировать сейчас');

    function renderStatus(s) {
      now.disabled = s.busy || !sync.macAddr();
      status.textContent = !sync.macAddr() ? 'Mac не подключён — всё хранится только на этом устройстве.'
        : s.busy ? 'Синхронизирую…'
        : s.error ? `${s.error}. Записи сохранены здесь и уйдут на Mac, когда он будет доступен.`
        : s.lastOk ? 'Синхронизировано ' + when(s.lastOk)
        : 'Ещё не синхронизировалось.';
      status.classList.toggle('warn', !!s.error && !s.busy);
    }

    async function exportAll() {
      const recs = (await db.allRaw()).filter(r => !r.deleted).map(({ _dirty, ...r }) => r);
      const blob = new Blob([JSON.stringify(recs, null, 1)], { type: 'application/json' });
      const name = `kokoro-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try { return await navigator.share({ files: [file] }); } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = h('a', { href: URL.createObjectURL(blob), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    root.append(
      h('header.page-head', null, h('h1', null, 'Настройки')),
      h('section.card', null,
        h('h2', null, 'Синхронизация с Mac'),
        h('p.hint', null, 'Адрес Mac в Tailscale. Записи хранятся на устройстве и работают без сети, а когда Mac включён — синхронизируются с ним и с другими устройствами.'),
        addr, status, now),
      h('section.card', null,
        h('h2', null, 'Копия'),
        h('p.hint', null, 'Все записи одним файлом. Mac и так каждый день сохраняет копию в папку Кокоро/Копии.'),
        h('button.btn', { onclick: exportAll }, 'Сохранить файл')),
    );
    renderStatus(sync.state);
    return sync.onState(renderStatus);
  },
};

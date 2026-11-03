// Настройки: адрес Mac и ключ для синхронизации, копия всех данных файлом.
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import { h, when } from '../core/ui.js';

export default {
  id: 'settings',
  title: 'Settings',
  icon: 'settings',

  mount(root) {
    const addr = h('input.field', {
      type: 'url', value: sync.macAddr(), placeholder: 'https://your-mac.xxxx.ts.net:8443',
      autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
      onchange: () => sync.setMacAddr(addr.value),
    });
    const key = h('input.field', {
      type: 'password', value: sync.macKey(), placeholder: 'Key from the Mac',
      autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
      onchange: () => sync.setMacKey(key.value),
    });
    const status = h('p.status');
    const now = h('button.btn', { onclick: () => sync.syncNow() }, 'Sync now');

    function renderStatus(s) {
      now.disabled = s.busy || !sync.macAddr();
      status.textContent = !sync.macAddr() ? 'No Mac connected — everything stays on this device.'
        : s.busy ? 'Syncing…'
        : s.error ? `${s.error}. Your entries are saved here and will reach the Mac once it is available.`
        : s.lastOk ? 'Synced ' + when(s.lastOk) + (sync.isStale() ? ' — over a day ago. Is the Mac on and Tailscale connected?' : '')
        : 'Not synced yet.';
      status.classList.toggle('warn', (!!s.error || sync.isStale()) && !s.busy);
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
      h('header.page-head', null, h('h1', null, 'Settings')),
      h('section.card', null,
        h('h2', null, 'Sync with Mac'),
        h('p.hint', null, 'Your Mac’s Tailscale address and key. Entries live on this device and work offline; when the Mac is on, they sync with it and with your other devices.'),
        addr, key,
        h('p.hint', null, 'To see the key, run on the Mac: zsh ~/kokoro/server/install.sh key'),
        status, now),
      h('section.card', null,
        h('h2', null, 'Backup'),
        h('p.hint', null, 'All entries in one file. The Mac also keeps daily copies in Кокоро/Копии and in iCloud Drive → Kokoro backups.'),
        h('button.btn', { onclick: exportAll }, 'Save file')),
    );
    renderStatus(sync.state);
    return sync.onState(renderStatus);
  },
};

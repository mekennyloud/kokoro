// Настройки: адрес Mac для синхронизации и копия всех данных файлом.
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import { h, when } from '../core/ui.js';

export default {
  id: 'settings',
  title: 'Settings',
  icon: '⚙',

  mount(root) {
    const addr = h('input.field', {
      type: 'url', value: sync.macAddr(), placeholder: 'https://your-mac.xxxx.ts.net:8443',
      autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
      onchange: () => sync.setMacAddr(addr.value),
    });
    const status = h('p.status');
    const now = h('button.btn', { onclick: () => sync.syncNow() }, 'Sync now');

    function renderStatus(s) {
      now.disabled = s.busy || !sync.macAddr();
      status.textContent = !sync.macAddr() ? 'No Mac connected — everything stays on this device.'
        : s.busy ? 'Syncing…'
        : s.error ? `${s.error}. Your entries are saved here and will reach the Mac once it is available.`
        : s.lastOk ? 'Synced ' + when(s.lastOk)
        : 'Not synced yet.';
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
      h('header.page-head', null, h('h1', null, 'Settings')),
      h('section.card', null,
        h('h2', null, 'Sync with Mac'),
        h('p.hint', null, 'Your Mac’s Tailscale address. Entries live on this device and work offline; when the Mac is on, they sync with it and with your other devices.'),
        addr, status, now),
      h('section.card', null,
        h('h2', null, 'Backup'),
        h('p.hint', null, 'All entries in one file. The Mac also keeps a daily copy in the Кокоро/Копии folder.'),
        h('button.btn', { onclick: exportAll }, 'Save file')),
    );
    renderStatus(sync.state);
    return sync.onState(renderStatus);
  },
};

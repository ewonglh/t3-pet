const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['display', 'cursor', 'status', 'paused', 'command', 'pet', 'cards'];

contextBridge.exposeInMainWorld('petAPI', {
  on(channel, cb) {
    if (!CHANNELS.includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => cb(data));
  },
  setClickable: (on) => ipcRenderer.send('clickable', !!on),
  setAsleep: (asleep) => ipcRenderer.send('asleep', !!asleep),
  openThread: () => ipcRenderer.send('open-thread'),
  openApp: () => ipcRenderer.send('open-app'),
  openMenu: () => ipcRenderer.send('open-menu'),
  openCard: (id) => ipcRenderer.send('card-open', String(id)),
  dismissCard: (id) => ipcRenderer.send('card-dismiss', String(id)),
  ready: () => ipcRenderer.send('ready'),
});

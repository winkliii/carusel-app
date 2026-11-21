// Bridge for the in-app updater (see checkUpdate in carusel-studio.html).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('caruselDesktop', {
  started: () => ipcRenderer.send('started'),              // this copy of the app came up fine
  install: html => ipcRenderer.invoke('install', html),    // keep a newer copy and restart into it
});

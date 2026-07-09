// preload.js - expose safe IPC to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFdb: () => ipcRenderer.invoke('select-fdb'),
  selectOutput: () => ipcRenderer.invoke('select-output'),
  runConversion: (fdbPath, outPath) => ipcRenderer.invoke('run-conversion', fdbPath, outPath),
});

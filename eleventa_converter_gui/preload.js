// preload.js - expose safe IPC to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFdb: () => ipcRenderer.invoke('select-fdb'),
  selectExcel: (title) => ipcRenderer.invoke('select-excel', title),
  selectOutput: () => ipcRenderer.invoke('select-output'),
  selectSicarOutput: () => ipcRenderer.invoke('select-sicar-output'),
  runConversion: (fdbPath, outPath) => ipcRenderer.invoke('run-conversion', fdbPath, outPath),
  runSicarConversion: (productsPath, clientsPath, outPath) => ipcRenderer.invoke('run-sicar-conversion', productsPath, clientsPath, outPath),
});

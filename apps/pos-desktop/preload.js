const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura APIs específicas al contexto de React
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoca el canal de impresión nativo de Electron
  printTicket: (ticketData) => ipcRenderer.invoke('print-ticket', ticketData),
  
  // Información de versión de la app
  getAppVersion: () => '1.0.0'
});

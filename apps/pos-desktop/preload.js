const { contextBridge, ipcRenderer } = require('electron');

// Exponer de forma segura APIs específicas al contexto de React
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoca el canal de impresión nativo de Electron
  printTicket: (ticketData) => ipcRenderer.invoke('print-ticket', ticketData),
  
  // Obtener lista de impresoras instaladas en el sistema
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  
  // Información de versión de la app
  getAppVersion: () => '2.0.0',

  // Licenciamiento y Dongles
  getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),
  checkSuperAdminDongle: () => ipcRenderer.invoke('check-superadmin-dongle'),
  checkLicenseDongle: () => ipcRenderer.invoke('check-license-dongle')
});

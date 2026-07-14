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
  checkLicenseDongle: () => ipcRenderer.invoke('check-license-dongle'),
  backupSqliteDb: (params) => ipcRenderer.invoke('backup-sqlite-db', params),
  
  // Actualizaciones automáticas (autoUpdater)
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-available', listener);
    return () => ipcRenderer.removeListener('update-available', listener);
  },
  onUpdateNotAvailable: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-not-available', listener);
    return () => ipcRenderer.removeListener('update-not-available', listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (event, progress) => callback(progress);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', listener);
    return () => ipcRenderer.removeListener('update-downloaded', listener);
  },
  onUpdateError: (callback) => {
    const listener = (event, err) => callback(err);
    ipcRenderer.on('update-error', listener);
    return () => ipcRenderer.removeListener('update-error', listener);
  }
});

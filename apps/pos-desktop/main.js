const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Apex POS',
    backgroundColor: '#0d0e12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Si estamos en desarrollo, cargar desde el servidor local de Vite
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools(); // Descomentar para depurar
  } else {
    // En producción, cargar el archivo HTML compilado
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler inicial para recibir peticiones nativas del frontend
ipcMain.handle('print-ticket', async (event, ticketData) => {
  console.log('[ELECTRON-MAIN] Recibida orden de impresión para ticket:', ticketData);
  // Aquí es donde se conectará el driver de la impresora térmica esc-pos.
  // Por ahora, simulamos una impresión exitosa en la terminal de Node de Electron.
  return { success: true, message: 'Ticket enviado a cola de impresión nativa' };
});

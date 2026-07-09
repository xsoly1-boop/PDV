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

// IPC Handler para recibir peticiones nativas del frontend con enrutamiento de impresoras
ipcMain.handle('print-ticket', async (event, ticketData) => {
  const target = (ticketData.printerTarget || 'caja').toUpperCase();
  console.log(`[ELECTRON-MAIN] [Printer: ${target}] Recibida orden de impresión para ticket ${ticketData.ticketId}:`);
  console.log(`- Cajero/Cliente: ${ticketData.cajero}`);
  console.log(`- Total: $${Number(ticketData.total).toFixed(2)}`);
  console.log(`- Artículos:`, ticketData.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', '));
  
  // Aquí se enviaría el búfer ESC/POS al puerto correspondiente de la impresora (Caja, Bodega o Mostrador)
  return { 
    success: true, 
    message: `Ticket enviado con éxito a la impresora de ${target}` 
  };
});

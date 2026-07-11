const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 600,
    resizable: false,
    maximizable: false,
    title: 'Vante POS - Generador de Licencias',
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  
  // Ocultar la barra de menú estándar en Windows y macOS
  win.setMenu(null);
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'vante_logo.png'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

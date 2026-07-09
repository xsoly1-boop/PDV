// main.js - Electron main process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'dist-frontend', 'index.html'));
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

// IPC handlers
ipcMain.handle('select-fdb', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Firebird DB', extensions: ['fdb'] }],
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('select-output', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'apex_import_eleventa.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled) return null;
  return filePath;
});

ipcMain.handle('run-conversion', async (event, fdbPath, outPath) => {
  const { execFile } = require('child_process');
  const scriptPath = path.join(__dirname, 'scripts', 'run_converter.py').replace('app.asar', 'app.asar.unpacked');
  return new Promise((resolve, reject) => {
    execFile('arch', ['-x86_64', 'python3', scriptPath, fdbPath, outPath], (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

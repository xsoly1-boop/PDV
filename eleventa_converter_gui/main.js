// main.js - Electron main process
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 680,
    height: 480,
    title: 'Conversor Eleventa/SICAR → Vante POS',
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

ipcMain.handle('select-excel', async (event, title) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    title: title || 'Seleccionar archivo Excel',
    filters: [{ name: 'Archivos de Excel', extensions: ['xlsx', 'xls'] }],
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('select-output', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Selecciona carpeta de destino',
    buttonLabel: 'Guardar aquí',
  });
  if (canceled || !filePaths || filePaths.length === 0) return null;
  return path.join(filePaths[0], 'vante_import_eleventa.json');
});

ipcMain.handle('select-sicar-output', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Selecciona carpeta de destino',
    buttonLabel: 'Guardar aquí',
  });
  if (canceled || !filePaths || filePaths.length === 0) return null;
  return path.join(filePaths[0], 'vante_import_sicar.json');
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

ipcMain.handle('run-sicar-conversion', async (event, productsPath, clientsPath, outPath) => {
  const { execFile } = require('child_process');
  const scriptPath = path.join(__dirname, 'scripts', 'sicar_to_vante.py').replace('app.asar', 'app.asar.unpacked');
  const pPath = productsPath || "";
  const cPath = clientsPath || "";
  return new Promise((resolve, reject) => {
    execFile('python3', [scriptPath, pPath, cPath, outPath], (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout.trim());
      }
    });
  });
});

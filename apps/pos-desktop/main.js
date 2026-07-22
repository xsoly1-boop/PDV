const { app, BrowserWindow, ipcMain, utilityProcess } = require('electron');
const { autoUpdater } = require('electron-updater');

// Configuración básica de autoUpdater
autoUpdater.autoDownload = true;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

let mainWindow;
let apiProcess = null;
let ollamaProcess = null;

// ─── Arranque del runtime de Ollama bundleado ───────────────────────────────
function startOllama() {
  // Solo en la variante Server
  const isServer = app.name.toLowerCase().includes('server') ||
                   app.getName().toLowerCase().includes('server') ||
                   app.getPath('exe').toLowerCase().includes('server');
  if (!isServer) return;

  // Ruta del binario: en producción viene en extraResources; en dev usamos el del sistema
  let ollamaBin;
  if (app.isPackaged) {
    ollamaBin = path.join(process.resourcesPath, 'ollama', 'ollama');
  } else {
    // Desarrollo: buscar binario local primero, luego fallback al sistema
    const localBin = path.join(__dirname, 'resources', 'ollama', 'darwin-arm64', 'ollama');
    ollamaBin = fs.existsSync(localBin) ? localBin : 'ollama';
  }

  // Asegurar permisos de ejecución (macOS)
  try {
    if (fs.existsSync(ollamaBin)) {
      fs.chmodSync(ollamaBin, 0o755);
    }
  } catch (e) {
    console.warn('[ELECTRON-MAIN] No se pudo aplicar chmod al binario de Ollama:', e.message);
  }

  let logStream = null;
  try {
    // Carpeta donde Ollama guardará los modelos (dentro de userData de Vante)
    const modelsDir = path.join(app.getPath('userData'), 'ollama-models');
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

    const userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'local-ollama.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n\n=== OLLAMA INICIADO: ${new Date().toISOString()} (bin: ${ollamaBin}) ===\n`);

    console.log('[ELECTRON-MAIN] Iniciando Vante AI Engine desde:', ollamaBin);
    console.log('[ELECTRON-MAIN] Carpeta de modelos:', modelsDir);

    // Directorio del binario (las dylibs están junto al ejecutable)
    const ollamaDir = path.dirname(ollamaBin);

    ollamaProcess = spawn(ollamaBin, ['serve'], {
      env: {
        ...process.env,
        OLLAMA_MODELS: modelsDir,
        OLLAMA_HOST: '127.0.0.1:11434',
        // macOS necesita saber dónde están las dylibs bundleadas
        DYLD_LIBRARY_PATH: `${ollamaDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
      },
      stdio: 'pipe',
    });
  } catch (e) {
    console.warn('[ELECTRON-MAIN] Error al inicializar Ollama AI Engine:', e.message);
    return;
  }

  if (ollamaProcess) {
    ollamaProcess.stdout.on('data', (d) => {
      const msg = d.toString();
      console.log('[OLLAMA]', msg.trim());
      if (logStream) logStream.write(`[STDOUT] ${msg}`);
    });

    ollamaProcess.stderr.on('data', (d) => {
      const msg = d.toString();
      console.warn('[OLLAMA-WARN]', msg.trim());
      if (logStream) logStream.write(`[STDERR] ${msg}`);
    });

    ollamaProcess.on('exit', (code) => {
      console.log(`[ELECTRON-MAIN] Vante AI Engine terminó con código: ${code}`);
      if (logStream) logStream.write(`[EXIT] Código: ${code}\n`);
      ollamaProcess = null;
    });

    ollamaProcess.on('error', (err) => {
      console.error('[ELECTRON-MAIN] Error al iniciar Vante AI Engine:', err.message);
      if (logStream) logStream.write(`[ERROR] ${err.message}\n`);
      // Si el binario no existe o falló, la IA simplemente no estará disponible
      ollamaProcess = null;
    });
  }
}


function startLocalAPI() {
  const isServer = app.name.toLowerCase().includes('server') || 
                   app.getName().toLowerCase().includes('server') ||
                   app.getPath('exe').toLowerCase().includes('server');
  if (!isServer) return;

  const apiPath = app.isPackaged
    ? path.join(process.resourcesPath, 'api/dist/index.js')
    : path.join(__dirname, '../api/dist/index.js');

  console.log('[ELECTRON-MAIN] Iniciando backend API local en modo Server desde:', apiPath);
  try {
    const userDataPath = app.getPath('userData');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    const logPath = path.join(userDataPath, 'local-api.log');
    console.log('[ELECTRON-MAIN] Escribiendo logs del backend en:', logPath);
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n\n=== LOG INICIALIZADO: ${new Date().toISOString()} ===\n`);

    apiProcess = utilityProcess.fork(apiPath, {
      stdio: 'pipe',
      env: {
        ...process.env,
        PORT: '3001',
        DATABASE_URL: `file:${path.join(userDataPath, 'dev.db')}`
      }
    });

    if (apiProcess.stdout) {
      apiProcess.stdout.on('data', (data) => {
        console.log(`[LOCAL-API] ${data}`);
        logStream.write(`[STDOUT] ${data}`);
      });
    }

    if (apiProcess.stderr) {
      apiProcess.stderr.on('data', (data) => {
        console.error(`[LOCAL-API-ERROR] ${data}`);
        logStream.write(`[STDERR] ${data}`);
      });
    }

    apiProcess.on('exit', (code) => {
      console.log(`[ELECTRON-MAIN] El proceso local-api terminó con código: ${code}`);
      logStream.write(`[EXIT] El proceso local-api terminó con código: ${code}\n`);
    });
  } catch (e) {
    console.error('[ELECTRON-MAIN] Error al levantar el proceso local-api:', e);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Vante POS',
    backgroundColor: '#0d0e12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.maximize();

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
  startLocalAPI();
  startOllama();
  createWindow();

  // Buscar actualizaciones al iniciar de forma silenciosa en producción
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler para obtener la lista de impresoras instaladas en el sistema
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    console.log('[ELECTRON-MAIN] Impresoras detectadas en el sistema:', printers.map(p => ({ name: p.name, displayName: p.displayName })));
    return printers;
  } catch (error) {
    console.error('[ELECTRON-MAIN] Error al obtener impresoras:', error);
    return [];
  }
});

// IPC Handler para recibir peticiones nativas del frontend con enrutamiento de impresoras
ipcMain.handle('print-ticket', async (event, ticketData) => {
  const target = (ticketData.printerTarget || 'caja').toUpperCase();
  const printerName = ticketData.printerName;
  
  console.log(`[ELECTRON-MAIN] [Printer: ${target}] [Dispositivo: ${printerName || 'Default'}] Iniciando impresión...`);

  // Crear archivo temporal local para el ticket HTML ( Chromium confía en archivos file:// locales y no los bloquea como las Data URLs )
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `ticket-${Date.now()}.html`);

  try {
    const isThermal58 = ticketData.printerType === 'thermal_58';
    const paperWidth = isThermal58 ? '180px' : '260px'; // Anchura estimativa en pixeles para visor HTML

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              margin: 0;
              padding: 10px;
              width: ${paperWidth};
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .subtitle { font-size: 9px; margin-bottom: 2px; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .info-table { width: 100%; font-size: 10px; margin-bottom: 8px; }
            .items-table { width: 100%; border-collapse: collapse; font-size: 10px; }
            .items-table th { border-bottom: 1px dashed #000; text-align: left; padding-bottom: 4px; }
            .items-table td { padding: 4px 0; vertical-align: top; }
            .total-section { margin-top: 10px; font-size: 12px; }
            .footer { margin-top: 15px; font-size: 9px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="title">${ticketData.businessName || 'VANTE POS'}</div>
            ${ticketData.address ? `<div class="subtitle">${ticketData.address}</div>` : ''}
            ${ticketData.phone ? `<div class="subtitle">Tel: ${ticketData.phone}</div>` : ''}
          </div>
          
          <div class="divider"></div>
          
          <table class="info-table">
            <tr>
              <td><strong>Folio:</strong> ${ticketData.ticketId}</td>
            </tr>
            <tr>
              <td><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</td>
            </tr>
            <tr>
              <td><strong>Cajero:</strong> ${ticketData.cajero}</td>
            </tr>
            <tr>
              <td><strong>Terminal:</strong> ${target}</td>
            </tr>
          </table>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 70%;">Descripción</th>
                <th style="width: 30%; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${ticketData.items.map(item => `
                <tr>
                  <td>
                    ${item.cantidad} x ${item.nombre}
                    <br><span style="font-size: 8px; color: #555;">SKU: ${item.sku}</span>
                  </td>
                  <td class="text-right">$${(Number(item.precio) * Number(item.cantidad)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <table class="info-table total-section">
            <tr class="bold">
              <td>TOTAL:</td>
              <td class="text-right">$${Number(ticketData.total).toFixed(2)}</td>
            </tr>
          </table>
          
          ${ticketData.ticketMessage ? `
            <div class="divider"></div>
            <div class="text-center footer">
              ${ticketData.ticketMessage}
            </div>
          ` : ''}
        </body>
      </html>
    `;

    // Escribir archivo temporal físico
    fs.writeFileSync(tempFilePath, htmlContent, 'utf8');

    // Ventana fuera de la pantalla para obligar al sistema a inicializar el motor de renderizado (backing store)
    const printWindow = new BrowserWindow({
      width: 340,
      height: 600,
      x: -2000,
      y: -2000,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Cargar archivo local en la ventana de impresión
    printWindow.loadFile(tempFilePath);

    // Retornar una promesa que se resuelva cuando termine la impresión
    return new Promise((resolve) => {
      printWindow.once('ready-to-show', async () => {
        try {
          const pdfOptions = {
            printBackground: true
          };

          // Renderizar a PDF buffer nativamente en memoria
          const pdfBuffer = await printWindow.webContents.printToPDF(pdfOptions);
          
          // Escribir archivo temporal PDF
          const tempPdfPath = path.join(tempDir, `ticket-${Date.now()}.pdf`);
          fs.writeFileSync(tempPdfPath, pdfBuffer);

          printWindow.close();

          // Ejecutar comando lpr para imprimir el PDF de forma directa y limpia
          const { exec } = require('child_process');
          let cmd = `lpr `;
          if (printerName) {
            cmd += `-P "${printerName}" `;
          }
          cmd += `"${tempPdfPath}"`;

          console.log(`[ELECTRON-MAIN] Ejecutando comando de impresión nativo: ${cmd}`);

          exec(cmd, (execErr, stdout, stderr) => {
            // Eliminar archivos temporales creados
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
            try { fs.unlinkSync(tempPdfPath); } catch (e) {}

            if (execErr) {
              console.error('[ELECTRON-MAIN] Error al ejecutar lpr:', execErr, stderr);
              resolve({
                success: false,
                message: `Error al imprimir por comando nativo: ${execErr.message}`
              });
            } else {
              console.log('[ELECTRON-MAIN] Comando lpr ejecutado con éxito.');
              resolve({
                success: true,
                message: `Ticket enviado a la cola de impresión nativa.`
              });
            }
          });

        } catch (pdfErr) {
          console.error('[ELECTRON-MAIN] Error al generar PDF:', pdfErr);
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
          printWindow.close();
          resolve({
            success: false,
            message: `Error al generar PDF: ${pdfErr.message}`
          });
        }
      });
    });

  } catch (err) {
    console.error('[ELECTRON-MAIN] Error en proceso de impresión:', err);
    // Eliminar archivo temporal en caso de excepción
    try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch (e) {}
    return {
      success: false,
      message: `Error interno de impresión: ${err.message}`
    };
  }
});

// --- REQUERIMIENTOS DE LICENCIAMIENTO Y SEGURIDAD DONGLE ---
const crypto = require('crypto');

function getHardwareId() {
  let mac = 'unknown-mac';
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac;
          break;
        }
      }
      if (mac !== 'unknown-mac') break;
    }
  } catch (e) {}
  const info = `${os.hostname()}-${os.platform()}-${os.arch()}-${mac}`;
  return crypto.createHash('sha256').update(info).digest('hex').substring(0, 24).toUpperCase();
}

function checkUsbDongle(filename) {
  try {
    if (process.platform === 'darwin') {
      const volumesDir = '/Volumes';
      if (fs.existsSync(volumesDir)) {
        const volumes = fs.readdirSync(volumesDir);
        for (const vol of volumes) {
          const keyPath = path.join(volumesDir, vol, filename);
          if (fs.existsSync(keyPath)) {
            return { found: true, path: keyPath, content: fs.readFileSync(keyPath, 'utf8') };
          }
        }
      }
    } else if (process.platform === 'win32') {
      for (let charCode = 68; charCode <= 90; charCode++) {
        const drive = String.fromCharCode(charCode) + ':\\';
        const keyPath = path.join(drive, filename);
        if (fs.existsSync(keyPath)) {
          return { found: true, path: keyPath, content: fs.readFileSync(keyPath, 'utf8') };
        }
      }
    }
  } catch (err) {
    console.error('[ELECTRON-MAIN] Error al buscar dongle USB:', err);
  }
  return { found: false };
}

ipcMain.handle('get-hardware-id', () => {
  return getHardwareId();
});

ipcMain.handle('check-superadmin-dongle', () => {
  return checkUsbDongle('vante_superadmin.key');
});

ipcMain.handle('check-license-dongle', () => {
  return checkUsbDongle('vante_license.key');
});
// --- AUTO UPDATER IPC HANDLERS & EVENTS ---
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
    return { success: true, message: 'Verificando actualizaciones...' };
  }
  return { success: false, message: 'Modo desarrollo: verificación omitida.' };
});

ipcMain.handle('quit-and-install-update', () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});

autoUpdater.on('checking-for-update', () => {
  console.log('[ELECTRON-MAIN] [Updater] Buscando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[ELECTRON-MAIN] [Updater] Actualización disponible:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[ELECTRON-MAIN] [Updater] No hay actualizaciones disponibles.');
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[ELECTRON-MAIN] [Updater] Progreso de descarga: ${progressObj.percent}%`);
  if (mainWindow) {
    mainWindow.webContents.send('update-download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[ELECTRON-MAIN] [Updater] Actualización descargada con éxito y lista para instalar:', info.version);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

autoUpdater.on('error', (err) => {
  console.error('[ELECTRON-MAIN] [Updater] Error en el actualizador:', err);
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message || err.toString());
  }
});

app.on('will-quit', () => {
  if (apiProcess) {
    console.log('[ELECTRON-MAIN] Finalizando proceso del backend API local...');
    apiProcess.kill();
  }
  if (ollamaProcess) {
    console.log('[ELECTRON-MAIN] Finalizando Vante AI Engine...');
    ollamaProcess.kill();
  }
});

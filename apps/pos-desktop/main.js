const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
            <div class="title">${ticketData.businessName || 'APEX POS'}</div>
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

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../../local_pos.db');

function initDb() {
  console.log(`[SQLITE] Inicializando base de datos local en: ${DB_PATH}`);
  const db = new Database(DB_PATH);

  // Habilitar llaves foráneas
  db.pragma('foreign_keys = ON');

  // Transacción para creación de tablas
  db.transaction(() => {
    // 1. Tabla Producto
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "Producto" (
        "id" TEXT PRIMARY KEY,
        "sku" TEXT UNIQUE NOT NULL,
        "nombre" TEXT NOT NULL,
        "descripcion" TEXT,
        "costo" REAL NOT NULL,
        "precio" REAL NOT NULL,
        "permiteFracciones" INTEGER DEFAULT 0,
        "categoriaId" TEXT,
        "proveedorId" TEXT,
        "metadatos" TEXT,
        "sincronizado_en" TEXT,
        "estado_sync" TEXT DEFAULT 'synced',
        "actualizado_en" TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. Tabla Cliente
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "Cliente" (
        "id" TEXT PRIMARY KEY,
        "nombre" TEXT NOT NULL,
        "telefono" TEXT,
        "direccion" TEXT,
        "limiteCredito" REAL DEFAULT 0,
        "saldoDeudor" REAL DEFAULT 0,
        "rfc" TEXT,
        "razonSocial" TEXT,
        "regimenFiscal" TEXT,
        "codigoPostal" TEXT,
        "direccionFiscal" TEXT,
        "creadoAt" TEXT DEFAULT CURRENT_TIMESTAMP,
        "sincronizado_en" TEXT,
        "estado_sync" TEXT DEFAULT 'synced',
        "actualizado_en" TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 3. Tabla Venta
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "Venta" (
        "id" TEXT PRIMARY KEY,
        "folio" TEXT UNIQUE NOT NULL,
        "sucursalId" TEXT NOT NULL,
        "usuarioId" TEXT NOT NULL,
        "clienteId" TEXT,
        "total" REAL NOT NULL,
        "subtotal" REAL NOT NULL,
        "descuento" REAL DEFAULT 0,
        "esOffline" INTEGER DEFAULT 1,
        "offlineCreadoAt" TEXT,
        "creadoAt" TEXT DEFAULT CURRENT_TIMESTAMP,
        "sincronizado_en" TEXT,
        "estado_sync" TEXT DEFAULT 'pending',
        "actualizado_en" TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 4. Tabla DetalleVenta
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "DetalleVenta" (
        "id" TEXT PRIMARY KEY,
        "ventaId" TEXT NOT NULL,
        "productoId" TEXT NOT NULL,
        "cantidad" REAL NOT NULL,
        "precioUnitario" REAL NOT NULL,
        "subtotal" REAL NOT NULL,
        "sincronizado_en" TEXT,
        "estado_sync" TEXT DEFAULT 'pending',
        FOREIGN KEY("ventaId") REFERENCES "Venta"("id") ON DELETE CASCADE,
        FOREIGN KEY("productoId") REFERENCES "Producto"("id")
      )
    `).run();

    // 5. Tabla KardexMovimiento
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "KardexMovimiento" (
        "id" TEXT PRIMARY KEY,
        "sucursalId" TEXT NOT NULL,
        "productoId" TEXT NOT NULL,
        "usuarioId" TEXT NOT NULL,
        "tipo" TEXT NOT NULL,
        "cantidad" REAL NOT NULL,
        "referencia" TEXT,
        "observacion" TEXT,
        "creadoAt" TEXT DEFAULT CURRENT_TIMESTAMP,
        "sincronizado_en" TEXT,
        "estado_sync" TEXT DEFAULT 'pending'
      )
    `).run();
  })();

  console.log('[SQLITE] Base de datos local verificada y lista.');
  return db;
}

module.exports = { initDb };

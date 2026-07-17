-- Vante POS SQLite Schema DDL

CREATE TABLE "ConfiguracionEmpresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreEmpresa" TEXT NOT NULL,
    "giro" TEXT NOT NULL DEFAULT 'ABARROTES',
    "rfc" TEXT,
    "logoUrl" TEXT,
    "formatoTicket" TEXT,
    "habilitarIA" BOOLEAN NOT NULL DEFAULT 0,
    "modeloIA" TEXT NOT NULL DEFAULT 'gemma2:2b',
    "limiteRamIA" INTEGER NOT NULL DEFAULT 4,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoAt" DATETIME NOT NULL
);

CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT
);

CREATE TABLE "Producto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "costo" DECIMAL NOT NULL,
    "precio" DECIMAL NOT NULL,
    "permiteFracciones" BOOLEAN NOT NULL DEFAULT false,
    "categoriaId" TEXT,
    "proveedorId" TEXT,
    "metadatos" TEXT,
    CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Producto_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CodigoBarras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    CONSTRAINT "CodigoBarras_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InventarioBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sucursalId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "stockReal" DECIMAL NOT NULL DEFAULT 0,
    "reservado" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "InventarioBalance_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventarioBalance_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "KardexMovimiento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sucursalId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "referencia" TEXT,
    "observacion" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KardexMovimiento_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KardexMovimiento_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KardexMovimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ReservaTemporal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sucursalId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "expiraAt" DATETIME NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cotizacionId" TEXT,
    CONSTRAINT "ReservaTemporal_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReservaTemporal_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReservaTemporal_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Venta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT,
    "total" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "descuento" DECIMAL NOT NULL DEFAULT 0,
    "esOffline" BOOLEAN NOT NULL DEFAULT false,
    "offlineCreadoAt" DATETIME,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Venta_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DetalleVenta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ventaId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folio" TEXT NOT NULL,
    "codigoCorto" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteNombre" TEXT,
    "clienteId" TEXT,
    "total" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "expiraAt" DATETIME NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cotizacion_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Cotizacion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cotizacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "DetalleCotizacion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cotizacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL NOT NULL,
    "precioUnitario" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "DetalleCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleCotizacion_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TraspasoMercancia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origenSucursalId" TEXT NOT NULL,
    "destinoSucursalId" TEXT NOT NULL,
    "usuarioEnviaId" TEXT NOT NULL,
    "usuarioRecibeId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EN_TRANSITO',
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recibidoAt" DATETIME,
    CONSTRAINT "TraspasoMercancia_origenSucursalId_fkey" FOREIGN KEY ("origenSucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraspasoMercancia_destinoSucursalId_fkey" FOREIGN KEY ("destinoSucursalId") REFERENCES "Sucursal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraspasoMercancia_usuarioEnviaId_fkey" FOREIGN KEY ("usuarioEnviaId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TraspasoMercancia_usuarioRecibeId_fkey" FOREIGN KEY ("usuarioRecibeId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DetalleTraspaso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traspasoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadEnviada" DECIMAL NOT NULL,
    "cantidadRecibida" DECIMAL,
    CONSTRAINT "DetalleTraspaso_traspasoId_fkey" FOREIGN KEY ("traspasoId") REFERENCES "TraspasoMercancia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleTraspaso_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FacturaCFDI" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ventaId" TEXT NOT NULL,
    "uuidSat" TEXT,
    "rfcReceptor" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "usoCFDI" TEXT NOT NULL,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "errorPac" TEXT,
    "timbradaAt" DATETIME,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacturaCFDI_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "limiteCredito" DECIMAL NOT NULL DEFAULT 0,
    "saldoDeudor" DECIMAL NOT NULL DEFAULT 0,
    "rfc" TEXT,
    "razonSocial" TEXT,
    "regimenFiscal" TEXT,
    "codigoPostal" TEXT,
    "direccionFiscal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "CreditoTransaccion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "concepto" TEXT NOT NULL,
    "ventaId" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditoTransaccion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "representante" TEXT,
    "telefonos" TEXT,
    "correos" TEXT,
    "paginaWeb" TEXT,
    "notas" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GastoGeneral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "categoria" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorId" TEXT,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GastoGeneral_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TurnoCaja" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "fondoInicial" DECIMAL NOT NULL,
    "efectivoCierre" DECIMAL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "observaciones" TEXT,
    "abiertoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoAt" DATETIME,
    CONSTRAINT "TurnoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FlujoEfectivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turnoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlujoEfectivo_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCaja" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BitacoraAuditoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "tabla" TEXT,
    "registroId" TEXT,
    "detalles" TEXT NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BitacoraAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "LoteStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lote" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "stock" DECIMAL NOT NULL DEFAULT 0,
    "fechaCaducidad" DATETIME,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoteStock_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LoteStock_sucursalId_fkey" FOREIGN KEY ("sucursalId") REFERENCES "Sucursal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");

CREATE UNIQUE INDEX "CodigoBarras_codigo_key" ON "CodigoBarras"("codigo");

CREATE UNIQUE INDEX "InventarioBalance_sucursalId_productoId_key" ON "InventarioBalance"("sucursalId", "productoId");

CREATE INDEX "KardexMovimiento_sucursalId_productoId_idx" ON "KardexMovimiento"("sucursalId", "productoId");

CREATE INDEX "KardexMovimiento_creadoAt_idx" ON "KardexMovimiento"("creadoAt");

CREATE INDEX "ReservaTemporal_expiraAt_estado_idx" ON "ReservaTemporal"("expiraAt", "estado");

CREATE UNIQUE INDEX "Venta_folio_key" ON "Venta"("folio");

CREATE UNIQUE INDEX "Cotizacion_folio_key" ON "Cotizacion"("folio");

CREATE INDEX "Cotizacion_codigoCorto_estado_idx" ON "Cotizacion"("codigoCorto", "estado");

CREATE UNIQUE INDEX "FacturaCFDI_ventaId_key" ON "FacturaCFDI"("ventaId");

CREATE UNIQUE INDEX "FacturaCFDI_uuidSat_key" ON "FacturaCFDI"("uuidSat");

CREATE INDEX "CreditoTransaccion_clienteId_idx" ON "CreditoTransaccion"("clienteId");

CREATE INDEX "CreditoTransaccion_creadoAt_idx" ON "CreditoTransaccion"("creadoAt");

CREATE INDEX "GastoGeneral_fecha_idx" ON "GastoGeneral"("fecha");

CREATE INDEX "GastoGeneral_proveedorId_idx" ON "GastoGeneral"("proveedorId");

CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");

CREATE INDEX "BitacoraAuditoria_creadoAt_idx" ON "BitacoraAuditoria"("creadoAt");

CREATE INDEX "BitacoraAuditoria_usuarioId_idx" ON "BitacoraAuditoria"("usuarioId");

CREATE UNIQUE INDEX "LoteStock_sucursalId_productoId_lote_key" ON "LoteStock"("sucursalId", "productoId", "lote");

CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tabla" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "creadoAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../db/local_pos.db');

class SyncManager {
  constructor(supabaseUrl, supabaseKey) {
    this.db = new Database(DB_PATH);
    this.client = axios.create({
      baseURL: supabaseUrl,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
    });
  }

  async startSync() {
    console.log('[SYNC] Iniciando ciclo de sincronización...');
    try {
      await this.pushLocalSales();
      await this.pushLocalKardex();
      await this.pullProducts();
      await this.pullClients();
      console.log('[SYNC] Ciclo completado con éxito.');
    } catch (error) {
      console.error('[SYNC ERROR] Ocurrió un error en el ciclo:', error.message);
    }
  }

  async pushLocalSales() {
    const pendingSales = this.db.prepare(`
      SELECT * FROM "Venta" WHERE "estado_sync" = 'pending'
    `).all();

    if (pendingSales.length === 0) return;
    console.log(`[SYNC] Subiendo ${pendingSales.length} ventas locales...`);

    for (const venta of pendingSales) {
      const detalles = this.db.prepare(`
        SELECT id, productoId, cantidad, precioUnitario, subtotal 
        FROM "DetalleVenta" 
        WHERE "ventaId" = ?
      `).all(venta.id);

      try {
        await this.client.post('/Venta', {
          id: venta.id,
          folio: venta.folio,
          sucursalId: venta.sucursalId,
          usuarioId: venta.usuarioId,
          clienteId: venta.clienteId,
          total: venta.total,
          subtotal: venta.subtotal,
          descuento: venta.descuento,
          esOffline: true,
          offlineCreadoAt: venta.offlineCreadoAt || venta.creadoAt,
          creadoAt: venta.creadoAt,
          estado_sync: 'synced',
          sincronizado_en: new Date().toISOString()
        });

        if (detalles.length > 0) {
          const payloadDetalles = detalles.map(d => ({
            id: d.id,
            ventaId: venta.id,
            productoId: d.productoId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            subtotal: d.subtotal,
            estado_sync: 'synced',
            sincronizado_en: new Date().toISOString()
          }));
          await this.client.post('/DetalleVenta', payloadDetalles);
        }

        this.db.transaction(() => {
          this.db.prepare(`
            UPDATE "Venta" 
            SET "estado_sync" = 'synced', "sincronizado_en" = ? 
            WHERE "id" = ?
          `).run(new Date().toISOString(), venta.id);

          this.db.prepare(`
            UPDATE "DetalleVenta" 
            SET "estado_sync" = 'synced', "sincronizado_en" = ? 
            WHERE "ventaId" = ?
          `).run(new Date().toISOString(), venta.id);
        })();

        console.log(`[SYNC] Venta ${venta.folio} subida y marcada con éxito.`);
      } catch (err) {
        console.error(`[SYNC ERROR] Falló la carga de venta ${venta.folio}:`, err.message);
      }
    }
  }

  async pushLocalKardex() {
    const pendingMovs = this.db.prepare(`
      SELECT * FROM "KardexMovimiento" WHERE "estado_sync" = 'pending'
    `).all();

    if (pendingMovs.length === 0) return;
    console.log(`[SYNC] Subiendo ${pendingMovs.length} movimientos de Kardex...`);

    const payload = pendingMovs.map(m => ({
      id: m.id,
      sucursalId: m.sucursalId,
      productoId: m.productoId,
      usuarioId: m.usuarioId,
      tipo: m.tipo,
      cantidad: m.cantidad,
      referencia: m.referencia,
      observacion: m.observacion,
      creadoAt: m.creadoAt,
      estado_sync: 'synced',
      sincronizado_en: new Date().toISOString()
    }));

    try {
      await this.client.post('/KardexMovimiento', payload);

      const ids = pendingMovs.map(m => m.id);
      const updateStmt = this.db.prepare(`
        UPDATE "KardexMovimiento" 
        SET "estado_sync" = 'synced', "sincronizado_en" = ? 
        WHERE "id" = ?
      `);

      const trx = this.db.transaction((syncedIds) => {
        const now = new Date().toISOString();
        for (const id of syncedIds) {
          updateStmt.run(now, id);
        }
      });
      trx(ids);

      console.log(`[SYNC] Sincronizados ${pendingMovs.length} registros del Kardex.`);
    } catch (err) {
      console.error('[SYNC ERROR] Error al subir Kardex:', err.message);
    }
  }

  async pullProducts() {
    const lastUpdateRow = this.db.prepare(`
      SELECT MAX(actualizado_en) as max_date FROM "Producto"
    `).get();
    
    const lastUpdate = lastUpdateRow.max_date || '1970-01-01T00:00:00.000Z';

    console.log(`[SYNC] Buscando productos actualizados desde ${lastUpdate}...`);

    try {
      const response = await this.client.get(`/Producto?actualizado_en=gt.${lastUpdate}`);
      const remoteProducts = response.data;

      if (remoteProducts.length === 0) {
        console.log('[SYNC] Catálogo de productos local al día.');
        return;
      }

      console.log(`[SYNC] Descargando ${remoteProducts.length} productos nuevos/editados...`);

      const insertStmt = this.db.prepare(`
        INSERT INTO "Producto" (
          id, sku, nombre, descripcion, costo, precio, 
          permiteFracciones, categoriaId, proveedorId, 
          metadatos, estado_sync, sincronizado_en, actualizado_en
        ) VALUES (
          @id, @sku, @nombre, @descripcion, @costo, @precio,
          @permiteFracciones, @categoriaId, @proveedorId,
          @metadatos, 'synced', @sincronizado_en, @actualizado_en
        ) ON CONFLICT(id) DO UPDATE SET
          sku=excluded.sku,
          nombre=excluded.nombre,
          descripcion=excluded.descripcion,
          costo=excluded.costo,
          precio=excluded.precio,
          permiteFracciones=excluded.permiteFracciones,
          categoriaId=excluded.categoriaId,
          proveedorId=excluded.proveedorId,
          metadatos=excluded.metadatos,
          estado_sync='synced',
          sincronizado_en=excluded.sincronizado_en,
          actualizado_en=excluded.actualizado_en
      `);

      const trx = this.db.transaction((items) => {
        for (const item of items) {
          const raw = {
            ...item,
            permiteFracciones: item.permiteFracciones ? 1 : 0,
            metadatos: item.metadatos ? JSON.stringify(item.metadatos) : null
          };
          insertStmt.run(raw);
        }
      });

      trx(remoteProducts);
      console.log(`[SYNC] Catálogo local actualizado con ${remoteProducts.length} productos.`);
    } catch (err) {
      console.error('[SYNC ERROR] Falló el pull de productos:', err.message);
    }
  }

  async pullClients() {
    const lastUpdateRow = this.db.prepare(`
      SELECT MAX(actualizado_en) as max_date FROM "Cliente"
    `).get();
    
    const lastUpdate = lastUpdateRow.max_date || '1970-01-01T00:00:00.000Z';

    try {
      const response = await this.client.get(`/Cliente?actualizado_en=gt.${lastUpdate}`);
      const remoteClients = response.data;

      if (remoteClients.length === 0) return;

      console.log(`[SYNC] Descargando ${remoteClients.length} clientes actualizados...`);

      const insertStmt = this.db.prepare(`
        INSERT INTO "Cliente" (
          id, nombre, telefono, direccion, limiteCredito, saldoDeudor,
          rfc, razonSocial, regimenFiscal, codigoPostal, direccionFiscal,
          creadoAt, estado_sync, sincronizado_en, actualizado_en
        ) VALUES (
          @id, @nombre, @telefono, @direccion, @limiteCredito, @saldoDeudor,
          @rfc, @razonSocial, @regimenFiscal, @codigoPostal, @direccionFiscal,
          @creadoAt, 'synced', @sincronizado_en, @actualizado_en
        ) ON CONFLICT(id) DO UPDATE SET
          nombre=excluded.nombre,
          telefono=excluded.telefono,
          direccion=excluded.direccion,
          limiteCredito=excluded.limiteCredito,
          saldoDeudor=excluded.saldoDeudor,
          rfc=excluded.rfc,
          razonSocial=excluded.razonSocial,
          regimenFiscal=excluded.regimenFiscal,
          codigoPostal=excluded.codigoPostal,
          direccionFiscal=excluded.direccionFiscal,
          estado_sync='synced',
          sincronizado_en=excluded.sincronizado_en,
          actualizado_en=excluded.actualizado_en
      `);

      const trx = this.db.transaction((clients) => {
        for (const c of clients) {
          insertStmt.run(c);
        }
      });

      trx(remoteClients);
    } catch (err) {
      console.error('[SYNC ERROR] Falló el pull de clientes:', err.message);
    }
  }
}

module.exports = SyncManager;

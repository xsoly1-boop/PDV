import fs from 'fs';
import path from 'path';

// Intentar cargar .env de forma síncrona antes de instanciar PrismaClient
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const firstEquals = trimmed.indexOf('=');
        if (firstEquals !== -1) {
          const key = trimmed.substring(0, firstEquals).trim();
          let val = trimmed.substring(firstEquals + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    });
  }
} catch (e) {
  console.error('[API-ENV] Error al cargar .env:', e);
}

import express from 'express';
import cors from 'cors';
import { prisma } from './prisma.js';
import { TipoMovimiento, EstadoReserva, EstadoTraspaso, EstadoCFDI, Rol } from './types.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 3001;
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ==========================================
// 1. Módulo de Catálogo e Inventario
// ==========================================

// GET /api/v1/productos/buscar?q={termino}
app.get('/api/v1/productos/buscar', async (req, res) => {
  const { q } = req.query;
  const term = q ? String(q).trim() : '';

  try {
    const productos = await prisma.producto.findMany({
      where: term ? {
        OR: [
          { nombre: { contains: term } },
          { sku: { contains: term } },
          {
            codigos: {
              some: { codigo: { contains: term } }
            }
          }
        ]
      } : {},
      include: {
        codigos: true,
        balances: true,
        categoria: true
      },
      take: 20
    });

    res.json(productos);
  } catch (error: any) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ error: 'Error interno del servidor al buscar productos' });
  }
});

// POST /api/v1/productos/inicializar-codigos-sku
app.post('/api/v1/productos/inicializar-codigos-sku', async (req, res) => {
  try {
    const products = await prisma.producto.findMany({
      include: { codigos: true }
    });

    const withoutBarcode = products.filter(p => p.codigos.length === 0);
    const dataToInsert = withoutBarcode.map(p => ({
      codigo: p.sku,
      productoId: p.id
    }));

    if (dataToInsert.length === 0) {
      return res.json({ success: true, processed: 0, message: 'Todos los productos ya tienen códigos de barras.' });
    }

    let insertedCount = 0;
    const chunkSize = 1000;
    for (let i = 0; i < dataToInsert.length; i += chunkSize) {
      const chunk = dataToInsert.slice(i, i + chunkSize);
      const result = await (prisma.codigoBarras as any).createMany({
        data: chunk,
        skipDuplicates: true
      });
      insertedCount += result.count;
    }

    res.json({
      success: true,
      processed: insertedCount,
      message: `Se copiaron ${insertedCount} SKUs como códigos de barras con éxito.`
    });
  } catch (error: any) {
    console.error('Error al inicializar códigos SKU:', error);
    res.status(500).json({ error: error.message || 'Error interno al inicializar códigos SKU' });
  }
});

// POST /api/v1/productos/revertir-codigos-sku
app.post('/api/v1/productos/revertir-codigos-sku', async (req, res) => {
  try {
    const deletedCount = await prisma.$executeRawUnsafe(`
      DELETE FROM "CodigoBarras" 
      WHERE "id" IN (
        SELECT c."id" 
        FROM "CodigoBarras" c 
        JOIN "Producto" p ON c."productoId" = p."id" 
        WHERE c."codigo" = p."sku"
      )
    `);

    res.json({
      success: true,
      processed: deletedCount,
      message: `Se revirtió la migración. Se eliminaron ${deletedCount} códigos de barras que coincidían con el SKU del producto.`
    });
  } catch (error: any) {
    console.error('Error al revertir códigos SKU:', error);
    res.status(500).json({ error: error.message || 'Error interno al revertir códigos SKU' });
  }
});

// GET /api/v1/productos/escanear/:codigo
app.get('/api/v1/productos/escanear/:codigo', async (req, res) => {
  const { codigo } = req.params;
  const sucursalId = req.query.sucursalId ? String(req.query.sucursalId) : req.headers['x-sucursal-id'] ? String(req.headers['x-sucursal-id']) : null;

  try {
    // Buscar en tabla relacional CodigoBarras
    const codigoRel = await prisma.codigoBarras.findUnique({
      where: { codigo },
      include: {
        producto: {
          include: {
            codigos: true,
            balances: sucursalId ? {
              where: { sucursalId }
            } : true
          }
        }
      }
    });

    if (!codigoRel) {
      // Intentar buscar también por SKU directamente si no coincide código de barras
      const productoPorSku = await prisma.producto.findUnique({
        where: { sku: codigo },
        include: {
          codigos: true,
          balances: sucursalId ? {
            where: { sucursalId }
          } : true
        }
      });

      if (!productoPorSku) {
        return res.status(404).json({ error: 'Producto no encontrado con el código especificado' });
      }
      return res.json(productoPorSku);
    }

    res.json(codigoRel.producto);
  } catch (error: any) {
    console.error('Error al escanear código:', error);
    res.status(500).json({ error: 'Error interno del servidor al escanear producto' });
  }
});

// GET /api/v1/productos (listar todos)
app.get('/api/v1/productos', async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      include: { codigos: true, balances: true, categoria: true, proveedor: true },
      orderBy: { nombre: 'asc' }
    });
    res.json(productos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/productos (crear)
app.post('/api/v1/productos', async (req, res) => {
  const { sku, nombre, descripcion, costo, precio, categoriaId, proveedorId, codigoBarras, stock, unidad, permiteFracciones, metadatos } = req.body;
  try {
    const finalMetadata = {
      ...(metadatos || {}),
      unidad: unidad || metadatos?.unidad || 'pieza'
    };
    
    const producto = await prisma.producto.create({
      data: {
        sku: sku || `SKU-${Date.now()}`,
        nombre,
        descripcion: descripcion || '',
        costo: costo || 0,
        precio: precio || 0,
        permiteFracciones: permiteFracciones || false,
        categoriaId: categoriaId || null,
        proveedorId: proveedorId || null,
        metadatos: finalMetadata,
        codigos: codigoBarras ? { create: { codigo: codigoBarras } } : undefined,
      },
      include: { codigos: true, balances: true }
    });

    // Crear balance de inventario si se proporcionó stock
    if (stock && stock > 0) {
      const sucursal = await prisma.sucursal.findFirst();
      if (sucursal) {
        await prisma.inventarioBalance.create({
          data: { productoId: producto.id, sucursalId: sucursal.id, stockReal: stock }
        });
      }
    }

    res.status(201).json(producto);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/productos/:id/stock (sumar stock)
app.post('/api/v1/productos/:id/stock', async (req, res) => {
  const { id } = req.params;
  const { cantidad, sucursalId } = req.body;

  if (cantidad === undefined || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
    return res.status(400).json({ error: 'Cantidad inválida para agregar al stock' });
  }

  try {
    let targetSucursalId = sucursalId;
    if (!targetSucursalId) {
      const defaultSucursal = await prisma.sucursal.findFirst();
      targetSucursalId = defaultSucursal?.id || 'suc-norte';
    }

    const balance = await prisma.inventarioBalance.upsert({
      where: {
        sucursalId_productoId: {
          sucursalId: targetSucursalId,
          productoId: id
        }
      },
      update: {
        stockReal: { increment: Number(cantidad) }
      },
      create: {
        sucursalId: targetSucursalId,
        productoId: id,
        stockReal: Number(cantidad)
      }
    });

    res.json({ success: true, balance });
  } catch (error: any) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/productos/:id (actualizar)
app.put('/api/v1/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { sku, nombre, descripcion, costo, precio, categoriaId, proveedorId, codigoBarras, stock, unidad, permiteFracciones, metadatos } = req.body;
  try {
    const finalMetadata = {
      ...(metadatos || {}),
      unidad: unidad || metadatos?.unidad || 'pieza'
    };

    const producto = await prisma.producto.update({
      where: { id },
      data: {
        sku, nombre, descripcion,
        costo: costo || 0,
        precio: precio || 0,
        permiteFracciones: permiteFracciones || false,
        categoriaId: categoriaId || null,
        proveedorId: proveedorId || null,
        metadatos: finalMetadata,
      },
      include: { codigos: true, balances: true }
    });

    // Actualizar balance de inventario si se proporcionó stock
    if (stock !== undefined) {
      const sucursal = await prisma.sucursal.findFirst();
      if (sucursal) {
        await prisma.inventarioBalance.upsert({
          where: {
            sucursalId_productoId: {
              sucursalId: sucursal.id,
              productoId: id
            }
          },
          update: {
            stockReal: Number(stock) || 0
          },
          create: {
            sucursalId: sucursal.id,
            productoId: id,
            stockReal: Number(stock) || 0
          }
        });
      }
    }

    res.json(producto);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/productos/:id
app.delete('/api/v1/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.codigoBarras.deleteMany({ where: { productoId: id } });
    await prisma.inventarioBalance.deleteMany({ where: { productoId: id } });
    await prisma.producto.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// CRUD Usuarios (Empleados)
// ==========================================

// GET /api/v1/usuarios
app.get('/api/v1/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } });
    res.json(usuarios);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/usuarios
app.post('/api/v1/usuarios', async (req, res) => {
  const { nombre, pin, rol } = req.body;
  try {
    const usuario = await prisma.usuario.create({
      data: { nombre, pin, rol: rol === 'Administrador' ? Rol.ADMINISTRADOR : rol === 'Agente Ventas' ? Rol.VENDEDOR_MOVIL : Rol.CAJERO, activo: true }
    });
    res.status(201).json(usuario);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/usuarios/:id
app.put('/api/v1/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, pin, rol, activo } = req.body;
  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nombre, pin,
        rol: rol === 'Administrador' ? Rol.ADMINISTRADOR : rol === 'Agente Ventas' ? Rol.VENDEDOR_MOVIL : Rol.CAJERO,
        activo: activo !== undefined ? activo : true
      }
    });
    res.json(usuario);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/usuarios/:id
app.delete('/api/v1/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. Módulo de Cotizaciones y Reservas (Soft-Allocation)
// ==========================================

// POST /api/v1/cotizaciones
app.post('/api/v1/cotizaciones', async (req, res) => {
  const { sucursalId, usuarioId, clienteNombre, items } = req.body;

  if (!sucursalId || !usuarioId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos. Se requiere sucursalId, usuarioId e items' });
  }

  try {
    // Resolver usuarioId (id de base de datos) a partir de un ID o del Nombre enviado por el cliente
    let finalUsuarioId = usuarioId;
    const userExist = await prisma.usuario.findFirst({
      where: {
        OR: [
          { id: usuarioId },
          { nombre: usuarioId }
        ]
      }
    });
    if (userExist) {
      finalUsuarioId = userExist.id;
    } else {
      const firstUser = await prisma.usuario.findFirst();
      finalUsuarioId = firstUser?.id || usuarioId;
    }

    // Generar un código de 4 dígitos aleatorio para la importación rápida en caja
    const codigoCorto = Math.floor(1000 + Math.random() * 9000).toString();
    const folio = `COT-${Date.now()}-${codigoCorto}`;
    
    // Cargar expiración personalizada desde configuracion-empresa
    const companyConfig = await prisma.configuracionEmpresa.findFirst();
    const expiracionMins = Number((companyConfig?.formatoTicket as any)?.cotizacionExpiracionMins) || 1440;

    const expiraAt = new Date();
    expiraAt.setMinutes(expiraAt.getMinutes() + expiracionMins);

    // Obtener los productos involucrados para calcular costos/totales (buscando por ID o por SKU)
    const productoIds = items.map(item => item.productoId);
    const dbProductos = await prisma.producto.findMany({
      where: {
        OR: [
          { id: { in: productoIds } },
          { sku: { in: productoIds } }
        ]
      }
    });

    const productosMap = new Map<string, any>();
    dbProductos.forEach(p => {
      productosMap.set(p.id, p);
      productosMap.set(p.sku, p);
    });

    let subtotal = 0;
    const detallesData: Array<{
      productoId: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
    }> = [];
    const reservasData: Array<{
      sucursalId: string;
      productoId: string;
      cantidad: number;
      estado: EstadoReserva;
      expiraAt: Date;
    }> = [];


    for (const item of items) {
      const producto = productosMap.get(item.productoId);
      if (!producto) {
        return res.status(404).json({ error: `Producto con ID o SKU "${item.productoId}" no existe` });
      }

      const precioUnitario = Number(producto.precio);
      const itemSubtotal = precioUnitario * item.cantidad;
      subtotal += itemSubtotal;

      detallesData.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: precioUnitario,
        subtotal: itemSubtotal
      });

      reservasData.push({
        sucursalId,
        productoId: item.productoId,
        cantidad: item.cantidad,
        estado: EstadoReserva.ACTIVA,
        expiraAt
      });
    }

    // Ejecutar creación en transacción ACID
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Cotización
      const cotizacion = await tx.cotizacion.create({
        data: {
          folio,
          codigoCorto,
          sucursalId,
          usuarioId: finalUsuarioId,
          clienteNombre,
          subtotal,
          total: subtotal,
          estado: EstadoReserva.ACTIVA,
          expiraAt,
          detalles: {
            createMany: {
              data: detallesData
            }
          }
        },
        include: {
          detalles: true
        }
      });

      // 2. Crear Reservas Temporales y actualizar saldos de reserva
      for (const reserva of reservasData) {
        await tx.reservaTemporal.create({
          data: {
            ...reserva,
            cotizacionId: cotizacion.id
          }
        });

        // Actualizar InventarioBalance incrementando el campo 'reservado'
        await tx.inventarioBalance.upsert({
          where: {
            sucursalId_productoId: {
              sucursalId,
              productoId: reserva.productoId
            }
          },
          update: {
            reservado: { increment: reserva.cantidad }
          },
          create: {
            sucursalId,
            productoId: reserva.productoId,
            stockReal: 0,
            reservado: reserva.cantidad
          }
        });
      }

      return cotizacion;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error al crear cotización:', error);
    res.status(500).json({ error: 'Error transaccional al registrar la cotización' });
  }
});

// GET /api/v1/cotizaciones/:id/qr
app.get('/api/v1/cotizaciones/:id/qr', async (req, res) => {
  const { id } = req.params;

  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        detalles: {
          include: {
            producto: true
          }
        }
      }
    });

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    // Retorna payload que el lector QR interpretará en caja física
    res.json({
      qrData: JSON.stringify({
        id: cotizacion.id,
        folio: cotizacion.folio,
        codigoCorto: cotizacion.codigoCorto,
        total: cotizacion.total
      }),
      cotizacion
    });
  } catch (error: any) {
    console.error('Error al generar QR de cotización:', error);
    res.status(500).json({ error: 'Error al recuperar información para código QR' });
  }
});

// Listar cotizaciones (con opción de ver todas para el dashboard)
app.get('/api/v1/cotizaciones', async (req, res) => {
  const { all } = req.query;
  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      where: all === 'true' ? {} : { estado: 'ACTIVA' },
      orderBy: { creadoAt: 'desc' },
      take: all === 'true' ? 100 : undefined,
      include: {
        detalles: {
          include: {
            producto: true
          }
        },
        usuario: {
          select: { nombre: true }
        },
        cliente: true
      }
    });
    res.json(cotizaciones);
  } catch (error) {
    console.error('Error al listar cotizaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/v1/cotizaciones/:id/estado (actualizar estado manualmente)
app.put('/api/v1/cotizaciones/:id/estado', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado || !['ACTIVA', 'COMPLETADA', 'EXPIRADA', 'CANCELADA'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const updated = await prisma.cotizacion.update({
      where: { id },
      data: { estado }
    });
    res.json({ success: true, cotizacion: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v1/cotizaciones/:id (eliminar cotización y liberar stock reservado)
app.delete('/api/v1/cotizaciones/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: { reservas: true }
    });

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restaurar stock reservado en el balance para todas sus reservas activas
      for (const reserva of cotizacion.reservas) {
        if (reserva.estado === 'ACTIVA') {
          await tx.inventarioBalance.update({
            where: {
              sucursalId_productoId: {
                sucursalId: reserva.sucursalId,
                productoId: reserva.productoId
              }
            },
            data: {
              reservado: { decrement: Number(reserva.cantidad) }
            }
          });
        }
      }

      // 2. Eliminar reservas temporales asociadas
      await tx.reservaTemporal.deleteMany({
        where: { cotizacionId: id }
      });

      // 3. Eliminar la cotización físicamente
      await tx.cotizacion.delete({
        where: { id }
      });
    });

    res.json({ success: true, message: 'Cotización eliminada y stock liberado correctamente.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar cotización por código corto de 4 dígitos
app.get('/api/v1/cotizaciones/buscar/:codigoCorto', async (req, res) => {
  const { codigoCorto } = req.params;
  try {
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { 
        codigoCorto,
        estado: 'ACTIVA'
      },
      include: {
        detalles: {
          include: {
            producto: true
          }
        }
      }
    });

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada o expirada' });
    }

    res.json(cotizacion);
  } catch (error) {
    console.error('Error al buscar cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// 3. Módulo de Sincronización (Offline-First)
// ==========================================

// POST /api/v1/sync/movimientos
app.post('/api/v1/sync/movimientos', async (req, res) => {
  const { movimientos } = req.body;

  if (!movimientos || !Array.isArray(movimientos) || movimientos.length === 0) {
    return res.status(400).json({ error: 'Payload de sincronización vacío' });
  }

  try {
    // Procesar en orden cronológico estricto
    const ordenados = [...movimientos].sort((a, b) => new Date(a.creadoAt).getTime() - new Date(b.creadoAt).getTime());
    const resultados = [];

    // Ejecutar transaccionalidad individual por movimiento de la cola
    for (const mov of ordenados) {
      const isEntrada = mov.tipo.startsWith('ENTRADA_');
      const factor = isEntrada ? 1 : -1;
      const delta = mov.cantidad * factor;

      const syncResult = await prisma.$transaction(async (tx) => {
        // 1. Guardar el movimiento en Kardex
        const nuevoMov = await tx.kardexMovimiento.create({
          data: {
            id: mov.id, // Respetar UUID del cliente
            sucursalId: mov.sucursalId,
            productoId: mov.productoId,
            usuarioId: mov.usuarioId,
            tipo: mov.tipo,
            cantidad: mov.cantidad,
            referencia: mov.referencia,
            observacion: mov.observacion,
            creadoAt: new Date(mov.creadoAt)
          }
        });

        // 2. Actualizar el Balance de Stock
        const balance = await tx.inventarioBalance.upsert({
          where: {
            sucursalId_productoId: {
              sucursalId: mov.sucursalId,
              productoId: mov.productoId
            }
          },
          update: {
            stockReal: { increment: delta }
          },
          create: {
            sucursalId: mov.sucursalId,
            productoId: mov.productoId,
            stockReal: delta,
            reservado: 0
          }
        });

        return { nuevoMov, balance };
      });

      // 3. Kardex Negativo Alerta
      if (Number(syncResult.balance.stockReal) < 0) {
        console.warn(`[ALERTA INVENTARIO NEGATIVO] Sucursal ${mov.sucursalId}, Producto ${mov.productoId} llegó a ${syncResult.balance.stockReal} unidades.`);
        // Aquí se dispararía un Webhook o se guardaría en una cola de notificaciones
      }

      resultados.push(syncResult);
    }

    res.json({
      status: 'success',
      processed: resultados.length,
      detalles: resultados
    });
  } catch (error: any) {
    console.error('Error al procesar lote de sincronización:', error);
    res.status(500).json({ error: 'Fallo al procesar lote de movimientos' });
  }
});

// ==========================================
// 3. Módulos Corporativos: CFDI, RBAC, Traspasos
// ==========================================

// GET /api/v1/sucursales
app.get('/api/v1/sucursales', async (req, res) => {
  try {
    const sucursales = await prisma.sucursal.findMany();
    res.json(sucursales);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar sucursales' });
  }
});

// GET /api/v1/inventario/balance-global
app.get('/api/v1/inventario/balance-global', async (req, res) => {
  try {
    const balances = await prisma.inventarioBalance.findMany({
      include: {
        producto: true,
        sucursal: true
      }
    });
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar balances de inventario' });
  }
});

// GET /api/v1/versiones — Consulta versiones disponibles para actualizaciones
app.get('/api/v1/versiones', (req, res) => {
  res.json({
    desktop: '2.0.0',
    mobile: '1.1.2',
    mobileUrl: 'https://pdventa.onrender.com/downloads/vante_pos_movil.apk'
  });
});

// POST /api/v1/auth/login — Autenticación general por PIN (cualquier usuario activo)
app.post('/api/v1/auth/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'Se requiere PIN.' });
  }
  try {
    const usuario = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });
    if (!usuario) {
      return res.status(401).json({ error: 'PIN incorrecto.' });
    }

    // Consultar configuraciones de seguridad
    const configRow = await prisma.configuracionEmpresa.findFirst();
    const formatoTicket = configRow?.formatoTicket as any;

    // 1. Validar restricción de acceso por rol
    if (usuario.rol === 'GERENTE' && formatoTicket?.allowGerenteLogin === false) {
      return res.status(403).json({ error: 'Acceso denegado. El inicio de sesión para Gerentes ha sido deshabilitado temporalmente por el Administrador.' });
    }
    if (usuario.rol === 'CAJERO' && formatoTicket?.allowCajeroLogin === false) {
      return res.status(403).json({ error: 'Acceso denegado. El inicio de sesión para Cajeros ha sido deshabilitado temporalmente por el Administrador.' });
    }
    if (usuario.rol === 'VENDEDOR_MOVIL' && formatoTicket?.allowVendedorMovilLogin === false) {
      return res.status(403).json({ error: 'Acceso denegado. El inicio de sesión para Vendedores Móviles ha sido deshabilitado temporalmente por el Administrador.' });
    }

    // 2. Validar horario laboral por cada rol registrado
    let shouldCheckSchedule = false;
    if (usuario.rol === 'GERENTE' && formatoTicket?.restrictGerenteSchedule === true) {
      shouldCheckSchedule = true;
    } else if (usuario.rol === 'CAJERO' && formatoTicket?.restrictCajeroSchedule === true) {
      shouldCheckSchedule = true;
    } else if (usuario.rol === 'VENDEDOR_MOVIL' && formatoTicket?.restrictVendedorMovilSchedule !== false) {
      shouldCheckSchedule = true;
    }

    if (shouldCheckSchedule) {
      const startHour = formatoTicket?.businessStartHour || '08:00';
      const endHour = formatoTicket?.businessEndHour || '20:00';
      
      const now = new Date();
      const currentHourStr = now.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false,
        timeZone: 'America/Mexico_City'
      });

      if (currentHourStr < startHour || currentHourStr > endHour) {
        return res.status(403).json({ 
          error: `Acceso denegado. El inicio de sesión para el rol "${usuario.rol}" está restringido fuera de la jornada laboral (${startHour} a ${endHour}).` 
        });
      }
    }

    res.json({ usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) {
    res.status(500).json({ error: 'Error al validar PIN.' });
  }
});

// POST /api/v1/auth/autorizar-accion
app.post('/api/v1/auth/autorizar-accion', async (req, res) => {
  const { pin, accion } = req.body;

  if (!pin) {
    return res.status(400).json({ error: 'Se requiere el PIN de seguridad.' });
  }

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { pin, activo: true }
    });

    if (!usuario) {
      return res.status(404).json({ autorizado: false, error: 'Usuario no encontrado o PIN inválido.' });
    }

    const tienePermiso = usuario.rol === Rol.ADMINISTRADOR || usuario.rol === Rol.GERENTE;

    if (tienePermiso) {
      res.json({ autorizado: true, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
    } else {
      res.status(403).json({ autorizado: false, error: `El rol ${usuario.rol} no está autorizado para realizar la acción: ${accion}` });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al validar autorización' });
  }
});

// GET /api/v1/inventario/kardex — Listar movimientos de Kardex
app.get('/api/v1/inventario/kardex', async (req, res) => {
  try {
    const { desde, hasta, productoId } = req.query;
    const inicio = desde ? new Date(String(desde)) : undefined;
    const fin = hasta ? new Date(String(hasta)) : undefined;
    if (fin) fin.setHours(23, 59, 59, 999);

    const movimientos = await prisma.kardexMovimiento.findMany({
      where: {
        ...(productoId ? { productoId: String(productoId) } : {}),
        creadoAt: {
          ...(inicio ? { gte: inicio } : {}),
          ...(fin ? { lte: fin } : {})
        }
      },
      include: {
        producto: { select: { nombre: true, sku: true } },
        sucursal: { select: { nombre: true } },
        usuario: { select: { nombre: true } }
      },
      orderBy: { creadoAt: 'desc' }
    });
    res.json(movimientos);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/v1/inventario/traspaso
app.post('/api/v1/inventario/traspaso', async (req, res) => {
  const { origenSucursalId, destinoSucursalId, usuarioEnviaId, items } = req.body;

  if (!origenSucursalId || !destinoSucursalId || !usuarioEnviaId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos. Se requieren origenSucursalId, destinoSucursalId, usuarioEnviaId e items.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const traspaso = await tx.traspasoMercancia.create({
        data: {
          origenSucursalId,
          destinoSucursalId,
          usuarioEnviaId,
          estado: EstadoTraspaso.COMPLETADO,
          recibidoAt: new Date()
        }
      });

      const detalles = [];

      for (const item of items) {
        const { productoId, cantidad } = item;
        const cantNum = Number(cantidad);

        const balanceOrigen = await tx.inventarioBalance.findUnique({
          where: { sucursalId_productoId: { sucursalId: origenSucursalId, productoId } }
        });

        if (!balanceOrigen || Number(balanceOrigen.stockReal) < cantNum) {
          throw new Error(`Stock insuficiente para el producto ${productoId} en la sucursal de origen.`);
        }

        await tx.inventarioBalance.update({
          where: { id: balanceOrigen.id },
          data: { stockReal: { decrement: cantNum } }
        });

        const balanceDestino = await tx.inventarioBalance.upsert({
          where: { sucursalId_productoId: { sucursalId: destinoSucursalId, productoId } },
          update: { stockReal: { increment: cantNum } },
          create: {
            sucursalId: destinoSucursalId,
            productoId,
            stockReal: cantNum,
            reservado: 0
          }
        });

        const det = await tx.detalleTraspaso.create({
          data: {
            traspasoId: traspaso.id,
            productoId,
            cantidadEnviada: cantNum,
            cantidadRecibida: cantNum
          }
        });

        await tx.kardexMovimiento.create({
          data: {
            sucursalId: origenSucursalId,
            productoId,
            usuarioId: usuarioEnviaId,
            tipo: TipoMovimiento.SALIDA_TRASPASO,
            cantidad: cantNum,
            referencia: traspaso.id,
            observacion: `Envío de stock a sucursal ${destinoSucursalId}`
          }
        });

        await tx.kardexMovimiento.create({
          data: {
            sucursalId: destinoSucursalId,
            productoId,
            usuarioId: usuarioEnviaId,
            tipo: TipoMovimiento.ENTRADA_TRASPASO,
            cantidad: cantNum,
            referencia: traspaso.id,
            observacion: `Recepción de stock de sucursal ${origenSucursalId}`
          }
        });

        detalles.push(det);
      }

      return { traspaso, detalles };
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error en traspaso de inventario:', error);
    res.status(500).json({ error: error.message || 'Error al procesar el traspaso en la base de datos.' });
  }
});

// POST /api/v1/cfdi/timbrar
app.post('/api/v1/cfdi/timbrar', async (req, res) => {
  const { ventaId, rfcReceptor, razonSocial, usoCFDI } = req.body;

  if (!ventaId || !rfcReceptor || !razonSocial || !usoCFDI) {
    return res.status(400).json({ error: 'Datos incompletos para timbrar la factura CFDI.' });
  }

  try {
    const facturaExistente = await prisma.facturaCFDI.findUnique({
      where: { ventaId }
    });

    if (facturaExistente && facturaExistente.estado === EstadoCFDI.TIMBRADA) {
      return res.status(400).json({ error: 'Esta venta ya cuenta con una factura timbrada asociada.' });
    }

    const venta = await prisma.venta.findUnique({
      where: { id: ventaId }
    });

    if (!venta) {
      return res.status(404).json({ error: 'No se encontró la venta especificada.' });
    }

    const uuidSat = Math.random().toString(36).substring(2, 10).toUpperCase() + '-' +
                    Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
                    Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
                    Math.random().toString(36).substring(2, 18).toUpperCase();

    const factura = await prisma.facturaCFDI.upsert({
      where: { ventaId },
      update: {
        uuidSat,
        rfcReceptor,
        razonSocial,
        usoCFDI,
        estado: EstadoCFDI.TIMBRADA,
        xmlUrl: `https://cfdi-storage.s3.amazonaws.com/xmls/${uuidSat}.xml`,
        pdfUrl: `https://cfdi-storage.s3.amazonaws.com/pdfs/${uuidSat}.pdf`,
        timbradaAt: new Date(),
        errorPac: null
      },
      create: {
        ventaId,
        uuidSat,
        rfcReceptor,
        razonSocial,
        usoCFDI,
        estado: EstadoCFDI.TIMBRADA,
        xmlUrl: `https://cfdi-storage.s3.amazonaws.com/xmls/${uuidSat}.xml`,
        pdfUrl: `https://cfdi-storage.s3.amazonaws.com/pdfs/${uuidSat}.pdf`,
        timbradaAt: new Date()
      }
    });

    res.json({ success: true, factura });
  } catch (error: any) {
    console.error('Error al timbrar factura:', error);
    res.status(500).json({ error: error.message || 'Error interno al timbrar la factura.' });
  }
});

// ==========================================
// 4. Cron Job - Liberación de Reservas Expiradas
// ==========================================
async function liberarReservasExpiradas() {
  console.log('[CRON WORKER] Buscando reservas temporales expiradas...');
  const ahora = new Date();

  try {
    // Buscar reservas activas y cuya fecha de expiración sea menor o igual a la actual
    const reservasExpiradas = await prisma.reservaTemporal.findMany({
      where: {
        estado: EstadoReserva.ACTIVA,
        expiraAt: { lte: ahora }
      }
    });

    if (reservasExpiradas.length === 0) {
      return;
    }

    console.log(`[CRON WORKER] Se encontraron ${reservasExpiradas.length} reservas expiradas. Procesando liberación...`);

    for (const reserva of reservasExpiradas) {
      await prisma.$transaction(async (tx) => {
        // 1. Cambiar estado a EXPIRADA
        await tx.reservaTemporal.update({
          where: { id: reserva.id },
          data: { estado: EstadoReserva.EXPIRADA }
        });

        // 2. Si estaba vinculada a una cotización, cambiar estado de cotización
        if (reserva.cotizacionId) {
          await tx.cotizacion.update({
            where: { id: reserva.cotizacionId },
            data: { estado: EstadoReserva.EXPIRADA }
          });
        }

        // 3. Decrementar stock reservado en balance
        await tx.inventarioBalance.update({
          where: {
            sucursalId_productoId: {
              sucursalId: reserva.sucursalId,
              productoId: reserva.productoId
            }
          },
          data: {
            reservado: { decrement: reserva.cantidad }
          }
        });
      });
      console.log(`[CRON WORKER] Reserva ${reserva.id} del producto ${reserva.productoId} liberada.`);
    }
  } catch (error) {
    console.error('[CRON WORKER] Error al liberar reservas expiradas:', error);
  }
}

// ==========================================
// Inicializar servidor — solo infraestructura mínima (sin datos demo)
// ==========================================
async function seedDatabase() {
  console.log('[SEED] Verificando infraestructura mínima del sistema...');
  try {
    // Solo garantiza que exista la sucursal raíz para que el sistema pueda operar.
    // NO inserta usuarios, productos ni datos demo.
    // El Onboarding Wizard del frontend guiará al administrador en el primer arranque.
    await prisma.sucursal.upsert({
      where: { id: 'suc-norte' },
      update: {},
      create: {
        id: 'suc-norte',
        nombre: 'Sucursal Principal',
        direccion: ''
      }
    });

    // Garantizar administrador maestro inicial para el primer ingreso
    const adminUser = await prisma.usuario.findFirst({ where: { id: 'ADMIN' } });
    if (!adminUser) {
      await prisma.usuario.create({
        data: {
          id: 'ADMIN',
          nombre: 'Administrador Principal',
          pin: '8888',
          rol: Rol.ADMINISTRADOR,
          activo: true
        }
      });
      console.log('[SEED] Usuario Administrador Principal creado con éxito (PIN: 8888).');
    }

    console.log('[SEED] Infraestructura base lista. El negocio se configura desde el panel de administración.');
  } catch (error) {
    console.error('[SEED] Error al inicializar infraestructura:', error);
  }
}

// Iniciar simulación de Cron Job cada 1 minuto (para demo) en producción sería cada 5 min
setInterval(liberarReservasExpiradas, 60 * 1000);

// --- ENDPOINTS DE CLIENTES Y FINANZAS ---

// Listar todos los clientes
app.get('/api/v1/clientes', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(clientes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo cliente
app.post('/api/v1/clientes', async (req, res) => {
  const { nombre, telefono, direccion, limiteCredito, saldoDeudor } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  try {
    const nuevo = await prisma.cliente.create({
      data: {
        nombre,
        telefono: telefono || null,
        direccion: direccion || null,
        limiteCredito: Number(limiteCredito) || 0,
        saldoDeudor: Number(saldoDeudor) || 0
      }
    });
    res.json(nuevo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar un cliente
app.put('/api/v1/clientes/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, direccion, limiteCredito, saldoDeudor } = req.body;
  try {
    const actualizado = await prisma.cliente.update({
      where: { id },
      data: {
        nombre,
        telefono: telefono || null,
        direccion: direccion || null,
        limiteCredito: limiteCredito !== undefined ? Number(limiteCredito) : undefined,
        saldoDeudor: saldoDeudor !== undefined ? Number(saldoDeudor) : undefined
      }
    });
    res.json(actualizado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un cliente
app.delete('/api/v1/clientes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cliente.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar abono
app.post('/api/v1/clientes/:id/abono', async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;
  const montoNum = Number(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ error: 'Monto de abono inválido' });
  }
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const nuevoSaldo = Math.max(0, Number(cliente.saldoDeudor) - montoNum);
    const actualizado = await prisma.cliente.update({
      where: { id },
      data: { saldoDeudor: nuevoSaldo }
    });
    res.json(actualizado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CRUD CATEGORIAS ---
app.get('/api/v1/categorias', async (req, res) => {
  try {
    const list = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/categorias', async (req, res) => {
  const { nombre } = req.body;
  try {
    const nuevo = await prisma.categoria.create({ data: { nombre } });
    res.status(201).json(nuevo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/categorias/:id', async (req, res) => {
  const { nombre } = req.body;
  try {
    const up = await prisma.categoria.update({
      where: { id: req.params.id },
      data: { nombre }
    });
    res.json(up);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/v1/categorias/:id', async (req, res) => {
  try {
    await prisma.categoria.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CRUD PROVEEDORES ---
app.get('/api/v1/proveedores', async (req, res) => {
  try {
    const list = await prisma.proveedor.findMany({ orderBy: { nombre: 'asc' } });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/proveedores', async (req, res) => {
  const { nombre, representante, telefonos, correos, paginaWeb, notas } = req.body;
  try {
    const nuevo = await prisma.proveedor.create({
      data: { nombre, representante, telefonos, correos, paginaWeb, notas }
    });
    res.status(201).json(nuevo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/proveedores/:id', async (req, res) => {
  const { nombre, representante, telefonos, correos, paginaWeb, notas } = req.body;
  try {
    const up = await prisma.proveedor.update({
      where: { id: req.params.id },
      data: { nombre, representante, telefonos, correos, paginaWeb, notas }
    });
    res.json(up);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/v1/proveedores/:id', async (req, res) => {
  try {
    await prisma.proveedor.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CRUD GASTOS GENERALES ---
app.get('/api/v1/gastos', async (req, res) => {
  const { startDate, endDate, category } = req.query;
  try {
    const filter: any = {};
    if (category) {
      filter.categoria = String(category);
    }
    if (startDate || endDate) {
      filter.fecha = {};
      if (startDate) {
        filter.fecha.gte = new Date(String(startDate));
      }
      if (endDate) {
        filter.fecha.lte = new Date(String(endDate));
      }
    }
    const list = await prisma.gastoGeneral.findMany({
      where: filter,
      include: { proveedor: true },
      orderBy: { fecha: 'desc' }
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/gastos', async (req, res) => {
  const { descripcion, monto, categoria, fecha, proveedorId } = req.body;
  try {
    const nuevo = await prisma.gastoGeneral.create({
      data: {
        descripcion,
        monto: Number(monto),
        categoria,
        fecha: fecha ? new Date(String(fecha)) : new Date(),
        proveedorId: proveedorId || null
      },
      include: { proveedor: true }
    });
    res.status(201).json(nuevo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/gastos/:id', async (req, res) => {
  const { descripcion, monto, categoria, fecha, proveedorId } = req.body;
  try {
    const up = await prisma.gastoGeneral.update({
      where: { id: req.params.id },
      data: {
        descripcion,
        monto: Number(monto),
        categoria,
        fecha: fecha ? new Date(String(fecha)) : undefined,
        proveedorId: proveedorId || null
      },
      include: { proveedor: true }
    });
    res.json(up);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/v1/gastos/:id', async (req, res) => {
  try {
    await prisma.gastoGeneral.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINTS MIGRACION ---

// Migrar categorías
app.post('/api/v1/categorias/migrar', async (req, res) => {
  const { categorias } = req.body;
  if (!categorias || !Array.isArray(categorias)) {
    return res.status(400).json({ error: 'Formato de categorías inválido' });
  }
  try {
    const importados = [];
    for (const cat of categorias) {
      const nombre = (cat.nombre || '').trim();
      if (!nombre) continue;
      
      const existente = await prisma.categoria.findUnique({
        where: { nombre }
      });
      
      if (!existente) {
        const nuevo = await prisma.categoria.create({
          data: { nombre }
        });
        importados.push(nuevo);
      } else {
        importados.push(existente);
      }
    }
    res.json({ success: true, count: importados.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migrar proveedores
app.post('/api/v1/proveedores/migrar', async (req, res) => {
  const { proveedores } = req.body;
  if (!proveedores || !Array.isArray(proveedores)) {
    return res.status(400).json({ error: 'Formato de proveedores inválido' });
  }
  try {
    const importados = [];
    for (const p of proveedores) {
      const nombre = (p.nombre || '').trim();
      if (!nombre) continue;
      
      const existente = await prisma.proveedor.findFirst({
        where: { nombre }
      });
      
      if (existente) {
        const up = await prisma.proveedor.update({
          where: { id: existente.id },
          data: {
            representante: p.representante || existente.representante,
            telefonos: p.telefonos || existente.telefonos,
            correos: p.correos || existente.correos,
            paginaWeb: p.pagina_web || existente.paginaWeb,
            notas: p.notas || existente.notas
          }
        });
        importados.push(up);
      } else {
        const nuevo = await prisma.proveedor.create({
          data: {
            nombre,
            representante: p.representante || null,
            telefonos: p.telefonos || null,
            correos: p.correos || null,
            paginaWeb: p.pagina_web || null,
            notas: p.notas || null
          }
        });
        importados.push(nuevo);
      }
    }
    res.json({ success: true, count: importados.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migrar productos
app.post('/api/v1/productos/migrar', async (req, res) => {
  const { productos } = req.body;
  if (!productos || !Array.isArray(productos)) {
    return res.status(400).json({ error: 'Formato de productos inválido' });
  }
  try {
    // Fetch category and supplier maps for linking
    const allCats = await prisma.categoria.findMany();
    const allProvs = await prisma.proveedor.findMany();
    const catMap = new Map(allCats.map((c: any) => [c.nombre.toLowerCase().trim(), c.id]));
    const provMap = new Map(allProvs.map((p: any) => [p.nombre.toLowerCase().trim(), p.id]));

    // Get default branch
    const sucursal = await prisma.sucursal.findFirst();
    const sucursalId = sucursal?.id || 'suc-norte';

    // Prepare product records (without stock — stock goes to InventarioBalance)
    const registros = productos
      .map((p: any) => {
        const sku = (p.sku || '').trim();
        const nombre = (p.nombre || '').trim();
        if (!sku || !nombre) return null;
        const categoriaId = p.categoria ? (catMap.get(String(p.categoria).toLowerCase().trim()) || null) : null;
        const proveedorId = p.proveedor_nombre ? (provMap.get(p.proveedor_nombre.toLowerCase().trim()) || null) : null;
        return {
          id: sku,
          sku,
          nombre,
          costo: Number(p.costo) || 0,
          precio: Number(p.precio) || 0,
          permiteFracciones: !!p.permiteFracciones,
          categoriaId,
          proveedorId,
          metadatos: { procedencia: 'Eleventa', categoria_original: p.categoria || null }
        };
      })
      .filter(Boolean) as any[];

    // Batch insert products — skip duplicates
    const resultado = await (prisma.producto as any).createMany({
      data: registros,
      skipDuplicates: true
    });

    // Create InventarioBalance records for initial stock
    const balances = productos
      .map((p: any) => {
        const sku = (p.sku || '').trim();
        const stock = Number(p.stock) || 0;
        if (!sku || stock <= 0) return null;
        return { productoId: sku, sucursalId, stockReal: stock };
      })
      .filter(Boolean) as any[];

    let stockCount = 0;
    if (balances.length > 0) {
      const balResult = await (prisma.inventarioBalance as any).createMany({
        data: balances,
        skipDuplicates: true
      });
      stockCount = balResult.count;
    }

    res.json({ success: true, count: resultado.count, total_enviados: registros.length, stock_registros: stockCount });
  } catch (error: any) {
    console.error('[MIGRAR-PRODUCTOS] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Migrar clientes desde Eleventa (masivo con campos fiscales SAT)
app.post('/api/v1/clientes/migrar', async (req, res) => {
  const { clientes } = req.body;
  if (!clientes || !Array.isArray(clientes)) {
    return res.status(400).json({ error: 'Formato de datos de migración inválido' });
  }
  try {
    const importados = [];
    for (const c of clientes) {
      const nombre = (c.nombre || 'Sin Nombre').trim();
      const telefono = c.telefono || null;
      const limite = Number(c.limite_credito) || 0;
      const saldo = Number(c.saldo_deudor) || 0;
      const rfc = c.rfc || null;
      const razonSocial = c.razon_social || null;
      const regimenFiscal = c.regimen_fiscal || null;
      const codigoPostal = c.codigo_postal || null;
      const direccionFiscal = c.direccion_fiscal || null;
      
      const existente = await prisma.cliente.findFirst({
        where: { nombre }
      });
      
      if (existente) {
        const up = await prisma.cliente.update({
          where: { id: existente.id },
          data: {
            telefono: telefono || existente.telefono,
            limiteCredito: limite,
            saldoDeudor: saldo,
            rfc: rfc || existente.rfc,
            razonSocial: razonSocial || existente.razonSocial,
            regimenFiscal: regimenFiscal || existente.regimenFiscal,
            codigoPostal: codigoPostal || existente.codigoPostal,
            direccionFiscal: direccionFiscal || existente.direccionFiscal
          }
        });
        importados.push(up);
      } else {
        const nuevo = await prisma.cliente.create({
          data: {
            nombre,
            telefono,
            limiteCredito: limite,
            saldoDeudor: saldo,
            rfc,
            razonSocial,
            regimenFiscal,
            codigoPostal,
            direccionFiscal
          }
        });
        importados.push(nuevo);
      }
    }
    res.json({ success: true, count: importados.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migrar inventario físico (stock) en lote
app.post('/api/v1/inventario/migrar', async (req, res) => {
  const { inventario } = req.body;
  if (!inventario || !Array.isArray(inventario)) {
    return res.status(400).json({ error: 'Formato de inventario inválido' });
  }
  try {
    const sucursal = await prisma.sucursal.findFirst();
    const sucursalId = sucursal?.id || 'suc-norte';

    const dbProducts = await prisma.producto.findMany({ select: { sku: true } });
    const existingSkus = new Set(dbProducts.map(p => p.sku));

    // Clear previous balances
    await prisma.inventarioBalance.deleteMany({});

    const balances = inventario
      .map((item: any) => {
        const sku = String(item.sku).trim();
        const stock = Number(item.stock) || 0;
        if (!sku || !existingSkus.has(sku)) return null;
        return {
          productoId: sku,
          sucursalId,
          stockReal: stock
        };
      })
      .filter(Boolean) as any[];

    let count = 0;
    if (balances.length > 0) {
      const result = await (prisma.inventarioBalance as any).createMany({
        data: balances,
        skipDuplicates: true
      });
      count = result.count;
    }

    res.json({ success: true, count });
  } catch (error: any) {
    console.error('[MIGRAR-INVENTARIO] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Migrar ventas históricas y detalles en lote
app.post('/api/v1/ventas/migrar', async (req, res) => {
  const { ventas } = req.body;
  if (!ventas || !Array.isArray(ventas)) {
    return res.status(400).json({ error: 'Formato de ventas inválido' });
  }
  try {
    const sucursal = await prisma.sucursal.findFirst();
    const sucursalId = sucursal?.id || 'suc-norte';

    // Map clients
    const dbClients = await prisma.cliente.findMany({ select: { id: true, nombre: true } });
    const clientMap = new Map(dbClients.map(c => [c.nombre.toLowerCase().trim(), c.id]));

    // Map products to make sure they exist
    const dbProducts = await prisma.producto.findMany({ select: { sku: true } });
    const existingSkus = new Set(dbProducts.map(p => p.sku));

    // Ensure ADMIN user exists
    const adminUser = await prisma.usuario.findFirst({ where: { id: 'ADMIN' } });
    const usuarioId = adminUser?.id || 'ADMIN';
    if (!adminUser) {
      await prisma.usuario.create({
        data: {
          id: 'ADMIN',
          nombre: 'Admin',
          pin: '8888',
          rol: 'ADMINISTRADOR',
          activo: true
        }
      });
    }

    const batchSize = 1000;
    let salesCount = 0;
    let detailsCount = 0;

    for (let i = 0; i < ventas.length; i += batchSize) {
      const chunk = ventas.slice(i, i + batchSize);
      const salesToInsert: any[] = [];
      const detailsToInsert: any[] = [];

      for (const v of chunk) {
        let clienteId: string | null = null;
        if (v.clienteNombre) {
          clienteId = clientMap.get(v.clienteNombre.toLowerCase().trim()) || null;
        }

        salesToInsert.push({
          id: v.id,
          folio: v.folio,
          sucursalId,
          usuarioId,
          clienteId,
          total: v.total,
          subtotal: v.subtotal,
          descuento: v.descuento || 0,
          esOffline: false,
          creadoAt: new Date(v.creadoAt)
        });

        if (v.detalles && Array.isArray(v.detalles)) {
          for (const d of v.detalles) {
            if (existingSkus.has(d.productoId)) {
              detailsToInsert.push({
                ventaId: v.id,
                productoId: d.productoId,
                cantidad: d.cantidad,
                precioUnitario: d.precioUnitario,
                subtotal: d.subtotal
              });
            }
          }
        }
      }

      await prisma.$transaction(async (tx) => {
        const sRes = await (tx.venta as any).createMany({
          data: salesToInsert,
          skipDuplicates: true
        });
        salesCount += sRes.count;

        if (detailsToInsert.length > 0) {
          const dRes = await (tx.detalleVenta as any).createMany({
            data: detailsToInsert,
            skipDuplicates: true
          });
          detailsCount += dRes.count;
        }
      });
    }

    res.json({ success: true, sales_count: salesCount, details_count: detailsCount });
  } catch (error: any) {
    console.error('[MIGRAR-VENTAS] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Limpiar base de datos (Datos Demo)
app.post('/api/v1/mantenimiento/limpiar-datos-demo', async (req, res) => {
  const { pin } = req.body;

  // 1. Verificar PIN maestro
  if (pin !== '8888') {
    return res.status(403).json({ error: 'PIN maestro inválido. Se requiere PIN 8888 para limpiar la base de datos.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ── TRANSACCIONALES ──
      await tx.facturaCFDI.deleteMany({});
      await tx.detalleVenta.deleteMany({});
      await tx.venta.deleteMany({});
      await tx.detalleCotizacion.deleteMany({});
      await tx.reservaTemporal.deleteMany({});
      await tx.cotizacion.deleteMany({});
      await tx.detalleTraspaso.deleteMany({});
      await tx.traspasoMercancia.deleteMany({});
      await tx.kardexMovimiento.deleteMany({});
      await tx.inventarioBalance.deleteMany({});

      // ── CATÁLOGOS ──
      await tx.codigoBarras.deleteMany({});
      await tx.producto.deleteMany({});
      await tx.cliente.deleteMany({});
      await tx.proveedor.deleteMany({});
      await tx.categoria.deleteMany({});

      // ── USUARIOS (borrar todos) ──
      await tx.usuario.deleteMany({});

      // ── CONFIGURACIÓN DE EMPRESA (resetear) ──
      await tx.configuracionEmpresa.deleteMany({});

      // Crear admin maestro único con ID fijo
      const adminUser = await tx.usuario.create({
        data: {
          id: 'ADMIN',
          nombre: 'Admin',
          pin: '8888',
          rol: Rol.ADMINISTRADOR,
          activo: true,
        },
      });

      return {
        adminPreservado: adminUser.nombre,
      };
    });

    res.json({
      success: true,
      message: `Base de datos limpiada al 100%. Solo se conservó la cuenta de: ${result.adminPreservado}`,
      adminPreservado: result.adminPreservado,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/negocio/reiniciar-desde-cero — Inicializar nuevo negocio desde cero (Borrado total + Configuración limpia)
app.post('/api/v1/negocio/reiniciar-desde-cero', async (req, res) => {
  const { pin } = req.body;

  if (pin !== '8888') {
    return res.status(403).json({ error: 'PIN de autorización inválido. Se requiere PIN 8888 para reiniciar el negocio.' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Eliminar datos transaccionales
      await tx.facturaCFDI.deleteMany({});
      await tx.detalleVenta.deleteMany({});
      await tx.venta.deleteMany({});
      await tx.detalleCotizacion.deleteMany({});
      await tx.reservaTemporal.deleteMany({});
      await tx.cotizacion.deleteMany({});
      await tx.detalleTraspaso.deleteMany({});
      await tx.traspasoMercancia.deleteMany({});
      await tx.kardexMovimiento.deleteMany({});
      await tx.inventarioBalance.deleteMany({});

      // 2. Eliminar catálogos
      await tx.codigoBarras.deleteMany({});
      await tx.producto.deleteMany({});
      await tx.cliente.deleteMany({});
      await tx.proveedor.deleteMany({});
      await tx.categoria.deleteMany({});

      // 3. Resetear usuarios (conservar solo admin maestro)
      await tx.usuario.deleteMany({});
      const adminUser = await tx.usuario.create({
        data: {
          id: 'ADMIN',
          nombre: 'Administrador Principal',
          pin: '8888',
          rol: Rol.ADMINISTRADOR,
          activo: true,
        },
      });

      // 4. Limpiar configuración de empresa por completo (para forzar carga limpia)
      await tx.configuracionEmpresa.deleteMany({});

      return {
        adminPreservado: adminUser.nombre,
      };
    });

    res.json({
      success: true,
      message: 'Base de datos inicializada desde cero con éxito. Configuraciones limpias y cuenta de Administrador creada.',
      adminUser: result.adminPreservado,
      nextStep: 'Acceder con PIN 8888 y configurar los datos del nuevo negocio en el panel de administración.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reporte de Finanzas (Hoy, Semana, Mes, Año)
app.get('/api/v1/reportes/finanzas', async (req, res) => {
  try {
    
    // Fetch all sales with details to compute statistics
    const sales = await prisma.venta.findMany({
      include: {
        detalles: {
          include: {
            producto: true
          }
        }
      },
      orderBy: { creadoAt: 'asc' }
    });
    
    // Aggregate by day, week, month, year
    const now = new Date();
    const reports = {
      hoy: { ventas: 0, costo: 0, ganancia: 0, count: 0 },
      semana: { ventas: 0, costo: 0, ganancia: 0, count: 0 },
      mes: { ventas: 0, costo: 0, ganancia: 0, count: 0 },
      anio: { ventas: 0, costo: 0, ganancia: 0, count: 0 }
    };
    
    // Helper time frames
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * oneDayMs);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    for (const sale of sales) {
      const saleDate = new Date(sale.creadoAt);
      const total = Number(sale.total);
      
      // Calculate cost
      let cost = 0;
      for (const d of sale.detalles) {
        cost += Number(d.producto.costo) * Number(d.cantidad);
      }
      const profit = total - cost;
      
      // Hoy
      if (saleDate >= startOfToday) {
        reports.hoy.ventas += total;
        reports.hoy.costo += cost;
        reports.hoy.ganancia += profit;
        reports.hoy.count++;
      }
      // Semana (últimos 7 días)
      if (saleDate >= startOfWeek) {
        reports.semana.ventas += total;
        reports.semana.costo += cost;
        reports.semana.ganancia += profit;
        reports.semana.count++;
      }
      // Mes
      if (saleDate >= startOfMonth) {
        reports.mes.ventas += total;
        reports.mes.costo += cost;
        reports.mes.ganancia += profit;
        reports.mes.count++;
      }
      // Año
      if (saleDate >= startOfYear) {
        reports.anio.ventas += total;
        reports.anio.costo += cost;
        reports.anio.ganancia += profit;
        reports.anio.count++;
      }
    }
    
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- CONFIGURACIÓN DE EMPRESA ---

// GET /api/v1/configuracion-empresa — Obtener configuración actual
app.get('/api/v1/configuracion-empresa', async (req, res) => {
  try {
    const config = await prisma.configuracionEmpresa.findFirst();
    res.json(config || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/configuracion-empresa — Crear o actualizar configuración
app.post('/api/v1/configuracion-empresa', async (req, res) => {
  const { 
    nombre, rfc, telefono, direccion, ciudad, giro,
    ticketMessage, printerType,
    allowCash, allowCard, allowTransfer,
    allowDrawer, drawerCommand,
    allowScale, scalePort, scaleBaudRate, scaleModel,
    sessionTimeout, businessStartHour, businessEndHour,
    allowGerenteLogin, allowCajeroLogin, allowVendedorMovilLogin,
    restrictGerenteSchedule, restrictCajeroSchedule, restrictVendedorMovilSchedule,
    printerCaja, printerCliente, printerMovil, printerBodega,
    cotizacionExpiracionMins
  } = req.body;

  let mappedGiro: any = 'ABARROTES';
  if (giro === 'farmacia') mappedGiro = 'FARMACIA';
  else if (giro === 'ferreteria') mappedGiro = 'FERRETERIA';
  else if (giro === 'refaccionaria') mappedGiro = 'REFACCIONARIA';
  else if (giro === 'cafeteria') mappedGiro = 'CAFETERIA';
  else if (giro === 'tienda') mappedGiro = 'ABARROTES';
  // También aceptar en mayúsculas por si viene así
  else if (giro?.toUpperCase() === 'CAFETERIA') mappedGiro = 'CAFETERIA';
  else if (giro?.toUpperCase() === 'FARMACIA') mappedGiro = 'FARMACIA';
  else if (giro?.toUpperCase() === 'FERRETERIA') mappedGiro = 'FERRETERIA';
  else if (giro?.toUpperCase() === 'REFACCIONARIA') mappedGiro = 'REFACCIONARIA';

  try {
    const existing = await prisma.configuracionEmpresa.findFirst();
    const data = {
      nombreEmpresa: nombre,
      giro: mappedGiro,
      rfc: rfc || null,
      formatoTicket: {
        telefono: telefono || '',
        direccion: direccion || '',
        ciudad: ciudad || '',
        ticketMessage: ticketMessage || '',
        printerType: printerType || 'thermal_80',
        allowCash: allowCash !== false,
        allowCard: allowCard !== false,
        allowTransfer: allowTransfer !== false,
        allowDrawer: allowDrawer !== false,
        drawerCommand: drawerCommand || '',
        allowScale: allowScale || false,
        scalePort: scalePort || '',
        scaleBaudRate: Number(scaleBaudRate) || 9600,
        scaleModel: scaleModel || '',
        sessionTimeout: Number(sessionTimeout) || 0,
        businessStartHour: businessStartHour || '08:00',
        businessEndHour: businessEndHour || '20:00',
        allowGerenteLogin: allowGerenteLogin !== false,
        allowCajeroLogin: allowCajeroLogin !== false,
        allowVendedorMovilLogin: allowVendedorMovilLogin !== false,
        restrictGerenteSchedule: restrictGerenteSchedule || false,
        restrictCajeroSchedule: restrictCajeroSchedule || false,
        restrictVendedorMovilSchedule: restrictVendedorMovilSchedule !== false,
        printerCaja: printerCaja || '',
        printerCliente: printerCliente || '',
        printerMovil: printerMovil || '',
        printerBodega: printerBodega || '',
        cotizacionExpiracionMins: Number(cotizacionExpiracionMins) || 1440,
        showWhatsAppPostSale: req.body.showWhatsAppPostSale === true,
        enableCloudBackups: req.body.enableCloudBackups === true,
        enableIntegratedPayments: req.body.enableIntegratedPayments === true,
        paymentTerminalProvider: req.body.paymentTerminalProvider || 'none',
        paymentTerminalDeviceId: req.body.paymentTerminalDeviceId || '',
        enableAutoUpdates: req.body.enableAutoUpdates === true,
        enableAdvancedInventory: req.body.enableAdvancedInventory === true
      } as any,
    };

    const formatoTicketJson = JSON.stringify(data.formatoTicket);
    const nombreEmpresa = data.nombreEmpresa || '';
    const rfc2 = data.rfc || null;

    if (existing) {
      const updated = await prisma.configuracionEmpresa.update({
        where: { id: existing.id },
        data: {
          nombreEmpresa,
          giro: mappedGiro,
          rfc: rfc2,
          formatoTicket: data.formatoTicket
        }
      });
      res.json(updated);
    } else {
      // Obtener la sucursal raíz
      const sucursal = await prisma.sucursal.findFirst();
      if (!sucursal) return res.status(500).json({ error: 'No existe sucursal raíz. Reinicia la app.' });
      const created = await prisma.configuracionEmpresa.create({
        data: {
          nombreEmpresa,
          giro: mappedGiro,
          rfc: rfc2,
          formatoTicket: data.formatoTicket
        }
      });
      res.json(created);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/business/reset — Inicializar la configuración de un nuevo negocio desde cero (Borra transacciones, productos e inventarios y restablece configuración)
app.post('/api/v1/business/reset', async (req, res) => {
  const { confirmReset } = req.body;
  if (confirmReset !== 'RESET_ALL_DATA') {
    return res.status(400).json({ error: 'Confirmación inválida para restablecer el negocio.' });
  }

  try {
    console.log('[API-RESET] Restableciendo base de datos a valores de fábrica...');
    await prisma.$transaction([
      prisma.reservaTemporal.deleteMany(),
      prisma.detalleCotizacion.deleteMany(),
      prisma.cotizacion.deleteMany(),
      prisma.facturaCFDI.deleteMany(),
      prisma.detalleVenta.deleteMany(),
      prisma.venta.deleteMany(),
      prisma.kardexMovimiento.deleteMany(),
      prisma.detalleTraspaso.deleteMany(),
      prisma.traspasoMercancia.deleteMany(),
      prisma.inventarioBalance.deleteMany(),
      prisma.codigoBarras.deleteMany(),
      prisma.producto.deleteMany(),
      prisma.cliente.deleteMany(),
      prisma.proveedor.deleteMany(),
      prisma.categoria.deleteMany(),
      prisma.configuracionEmpresa.deleteMany(),
    ]);

    // Crear configuración por defecto inicial
    const defaultInit = await prisma.configuracionEmpresa.create({
      data: {
        nombreEmpresa: 'Mi Nuevo Negocio',
        giro: 'ABARROTES',
        formatoTicket: {
          telefono: '',
          direccion: '',
          ciudad: '',
          ticketMessage: '¡Gracias por su compra!',
          printerType: 'thermal_80',
          allowCash: true,
          allowCard: true,
          allowTransfer: true,
          allowDrawer: true,
          drawerCommand: '',
          allowScale: false,
          scalePort: '',
          scaleBaudRate: 9600,
          scaleModel: '',
          sessionTimeout: 0,
          businessStartHour: '08:00',
          businessEndHour: '20:00',
          allowGerenteLogin: true,
          allowCajeroLogin: true,
          allowVendedorMovilLogin: true,
          restrictGerenteSchedule: false,
          restrictCajeroSchedule: false,
          restrictVendedorMovilSchedule: true,
          allowGerenteCheckout: true,
          allowCajeroCheckout: true,
          allowVendedorMovilCheckout: false
        } as any
      }
    });

    res.json({ 
      success: true, 
      message: 'Base de datos del negocio inicializada desde cero con éxito.',
      config: defaultInit
    });
  } catch (error: any) {
    console.error('[API-RESET] Error durante el reset:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINTS DE VENTAS ---

// GET /api/v1/ventas — Listar todas las ventas mapeadas
app.get('/api/v1/ventas', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const ventas = await prisma.venta.findMany({
      take: limit,
      skip: offset,
      include: {
        detalles: {
          include: {
            producto: true
          }
        },
        usuario: true,
        cliente: true,
        sucursal: true,
        factura: true
      },
      orderBy: { creadoAt: 'desc' }
    });

    const mapped = ventas.map(v => {
      const itemsCount = v.detalles.reduce((acc, d) => acc + Number(d.cantidad), 0);
      const parts = v.folio.split('|');
      const folioReal = parts[0] || v.folio;
      const metodo = parts[1] || 'Efectivo';

      return {
        id: folioReal,
        dbId: v.id,
        folio: v.folio,
        fecha: new Date(v.creadoAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
        cliente: v.cliente?.nombre || 'Público General',
        clienteObj: v.cliente,
        factura: v.factura,
        total: Number(v.total),
        items: itemsCount,
        metodo: metodo,
        sucursal: v.sucursal?.nombre || 'Suc. Norte'
      };
    });

    res.json(mapped);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/ventas — Crear/Registrar una nueva venta
app.post('/api/v1/ventas', async (req, res) => {
  const { folio, sucursalId, usuarioId, clienteId, total, subtotal, descuento, metodo, detalles, cotizacionId } = req.body;

  if (!folio || !usuarioId || !detalles || !Array.isArray(detalles)) {
    return res.status(400).json({ error: 'Datos de venta incompletos' });
  }

  try {
    let finalSucursalId = sucursalId;
    if (!finalSucursalId) {
      const defaultSucursal = await prisma.sucursal.findFirst();
      finalSucursalId = defaultSucursal?.id || 'suc-norte';
    }

    let finalUsuarioId = usuarioId;
    const userExist = await prisma.usuario.findFirst({
      where: {
        OR: [
          { id: usuarioId },
          { nombre: usuarioId }
        ]
      }
    });
    if (userExist) {
      finalUsuarioId = userExist.id;
    } else {
      finalUsuarioId = 'ADMIN';
    }

    const folioConMetodo = `${folio}|${metodo}`;

    const venta = await prisma.$transaction(async (tx) => {
      const newVenta = await tx.venta.create({
        data: {
          folio: folioConMetodo,
          sucursalId: finalSucursalId,
          usuarioId: finalUsuarioId,
          clienteId: clienteId || null,
          total: Number(total),
          subtotal: Number(subtotal),
          descuento: Number(descuento) || 0,
        }
      });

      for (const d of detalles) {
        const prod = await tx.producto.findFirst({
          where: {
            OR: [
              { id: d.productoId },
              { sku: d.productoId }
            ]
          }
        });

        if (prod) {
          await tx.detalleVenta.create({
            data: {
              ventaId: newVenta.id,
              productoId: prod.id,
              cantidad: Number(d.cantidad),
              precioUnitario: Number(d.precioUnitario),
              subtotal: Number(d.subtotal)
            }
          });
        }
      }

      if (cotizacionId) {
        // 1. Marcar la cotización como COMPLETADA
        await tx.cotizacion.update({
          where: { id: cotizacionId },
          data: { estado: 'COMPLETADA' }
        });

        // 2. Marcar las reservas temporales asociadas como COMPLETADAS
        await tx.reservaTemporal.updateMany({
          where: { cotizacionId: cotizacionId },
          data: { estado: 'COMPLETADA' }
        });

        // 3. Decrementar el campo 'reservado' en InventarioBalance
        const reservas = await tx.reservaTemporal.findMany({
          where: { cotizacionId: cotizacionId }
        });

        for (const resItem of reservas) {
          await tx.inventarioBalance.updateMany({
            where: {
              sucursalId: resItem.sucursalId,
              productoId: resItem.productoId
            },
            data: {
              reservado: { decrement: resItem.cantidad }
            }
          });
        }
      }

      if (metodo === 'CREDITO') {
        if (!clienteId) {
          throw new Error('Debe seleccionar un cliente para cobro a crédito');
        }
        const cliente = await tx.cliente.findUnique({ where: { id: clienteId } });
        if (!cliente) {
          throw new Error('Cliente no encontrado para cobro a crédito');
        }
        const nuevoSaldo = Number(cliente.saldoDeudor) + Number(total);
        if (nuevoSaldo > Number(cliente.limiteCredito)) {
          throw new Error(`Límite de crédito excedido. Disponible: ${Number(cliente.limiteCredito) - Number(cliente.saldoDeudor)}`);
        }
        await tx.cliente.update({
          where: { id: clienteId },
          data: { saldoDeudor: nuevoSaldo }
        });
        await tx.creditoTransaccion.create({
          data: {
            clienteId,
            tipo: 'CARGO',
            monto: Number(total),
            concepto: `Cargo por venta folio ${folio}`,
            ventaId: newVenta.id
          }
        });
      }

      return newVenta;
    });

    res.json({ success: true, ventaId: venta.id });
  } catch (error: any) {
    if (error.code === 'P2002' && (error.meta?.target?.includes('folio') || error.message?.includes('Unique constraint failed'))) {
      console.log(`[Sync Warning] Folio duplicado detectado. Venta ya existía: ${folio}`);
      return res.json({ success: true, message: 'La venta ya estaba registrada en el servidor.', yaExistia: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/ventas/detalles/:dbId — Obtener los detalles de una venta
app.get('/api/v1/ventas/detalles/:dbId', async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: req.params.dbId },
      include: { detalles: { include: { producto: true } } }
    });
    res.json(venta);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/ventas/cancelar — Cancelar/Reversar una venta y devolver stock
app.post('/api/v1/ventas/cancelar', async (req, res) => {
  const { ventaId } = req.body;
  
  if (!ventaId) {
    return res.status(400).json({ error: 'Falta el ID de la venta a cancelar' });
  }

  try {
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: { detalles: true }
    });

    if (!venta) {
      return res.status(404).json({ error: 'La venta no existe' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Devolver el inventario de cada artículo y registrar Kardex
      for (const d of venta.detalles) {
        await tx.inventarioBalance.upsert({
          where: {
            sucursalId_productoId: {
              sucursalId: venta.sucursalId,
              productoId: d.productoId
            }
          },
          update: {
            stockReal: { increment: Number(d.cantidad) }
          },
          create: {
            sucursalId: venta.sucursalId,
            productoId: d.productoId,
            stockReal: Number(d.cantidad),
            reservado: 0
          }
        });

        // Registrar movimiento de devolución en el Kardex
        await tx.kardexMovimiento.create({
          data: {
            sucursalId: venta.sucursalId,
            productoId: d.productoId,
            usuarioId: venta.usuarioId,
            tipo: 'ENTRADA_DEVOLUCION',
            cantidad: Number(d.cantidad),
            referencia: venta.folio.split('|')[0],
            observacion: 'Devolución por cancelación de venta'
          }
        });
      }

      // Si la venta fue a crédito, revertir saldo del cliente y eliminar transacciones asociadas
      if (venta.clienteId && (venta.folio.endsWith('|CREDITO') || venta.folio.includes('|CREDITO'))) {
        const cl = await tx.cliente.findUnique({ where: { id: venta.clienteId } });
        if (cl) {
          const nuevoSaldo = Math.max(0, Number(cl.saldoDeudor) - Number(venta.total));
          await tx.cliente.update({
            where: { id: venta.clienteId },
            data: { saldoDeudor: nuevoSaldo }
          });
        }
        await tx.creditoTransaccion.deleteMany({
          where: { ventaId: venta.id }
        });
      }

      // 2. Eliminar la venta físicamente
      await tx.venta.delete({
        where: { id: venta.id }
      });
    });

    res.json({ success: true, message: 'Venta cancelada y stock restaurado en sucursal' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- ENPOINTS DE CONTROL DE TURNO Y CAJA ---

// Obtener turno activo
app.get('/api/v1/turnos/activo/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const turno = await prisma.turnoCaja.findFirst({
      where: { usuarioId, estado: 'ABIERTO' },
      include: { flujos: true }
    });
    res.json(turno);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Abrir turno
app.post('/api/v1/turnos/abrir', async (req, res) => {
  try {
    const { usuarioId, fondoInicial } = req.body;
    
    // Verificar si ya tiene un turno abierto
    const existente = await prisma.turnoCaja.findFirst({
      where: { usuarioId, estado: 'ABIERTO' }
    });
    if (existente) {
      return res.status(400).json({ error: 'Ya tienes un turno abierto en esta caja.' });
    }

    const turno = await prisma.turnoCaja.create({
      data: {
        usuarioId,
        fondoInicial: Number(fondoInicial)
      }
    });
    res.json(turno);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Registrar movimiento de flujo (ingreso o egreso de caja)
app.post('/api/v1/turnos/flujo', async (req, res) => {
  try {
    const { turnoId, tipo, monto, motivo } = req.body;
    const flujo = await prisma.flujoEfectivo.create({
      data: {
        turnoId,
        tipo, // 'INGRESO' | 'EGRESO'
        monto: Number(monto),
        motivo
      }
    });
    res.json(flujo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cerrar turno y calcular arqueo
app.post('/api/v1/turnos/cerrar', async (req, res) => {
  try {
    const { turnoId, efectivoCierre, observaciones } = req.body;
    
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: turnoId },
      include: { flujos: true }
    });

    if (!turno) {
      return res.status(404).json({ error: 'Turno no encontrado.' });
    }

    // Buscar ventas registradas por este usuario desde la apertura del turno
    const ventas = await prisma.venta.findMany({
      where: {
        usuarioId: turno.usuarioId,
        creadoAt: {
          gte: turno.abiertoAt
        }
      }
    });

    let totalVentasEfectivo = 0;
    let totalVentasTarjeta = 0;
    let totalVentasTransferencia = 0;

    ventas.forEach((v: any) => {
      const m = v.metodo.toUpperCase();
      if (m.includes('EFECTIVO')) {
        totalVentasEfectivo += Number(v.total);
      } else if (m.includes('TARJETA')) {
        totalVentasTarjeta += Number(v.total);
      } else if (m.includes('TRANSFERENCIA')) {
        totalVentasTransferencia += Number(v.total);
      } else if (m.includes('MIXTO')) {
        const cashMatch = v.metodo.match(/Efectivo:\s*\$(\d+\.?\d*)/i);
        if (cashMatch) totalVentasEfectivo += Number(cashMatch[1]);
        
        const cardMatch = v.metodo.match(/Tarjeta:\s*\$(\d+\.?\d*)/i);
        if (cardMatch) totalVentasTarjeta += Number(cardMatch[1]);

        const transMatch = v.metodo.match(/Transferencia:\s*\$(\d+\.?\d*)/i);
        if (transMatch) totalVentasTransferencia += Number(transMatch[1]);
      }
    });

    let totalIngresosFlujo = 0;
    let totalEgresosFlujo = 0;

    turno.flujos.forEach((f) => {
      if (f.tipo === 'INGRESO') {
        totalIngresosFlujo += Number(f.monto);
      } else {
        totalEgresosFlujo += Number(f.monto);
      }
    });

    const efectivoTeorico = Number(turno.fondoInicial) + totalVentasEfectivo + totalIngresosFlujo - totalEgresosFlujo;

    const turnoCerrado = await prisma.turnoCaja.update({
      where: { id: turnoId },
      data: {
        efectivoCierre: Number(efectivoCierre),
        estado: 'CERRADO',
        observaciones,
        cerradoAt: new Date()
      }
    });

    res.json({
      success: true,
      turno: turnoCerrado,
      reporte: {
        fondoInicial: Number(turno.fondoInicial),
        ventasEfectivo: totalVentasEfectivo,
        ventasTarjeta: totalVentasTarjeta,
        ventasTransferencia: totalVentasTransferencia,
        ingresosCaja: totalIngresosFlujo,
        egresosCaja: totalEgresosFlujo,
        efectivoTeorico,
        efectivoDeclarado: Number(efectivoCierre),
        diferencia: Number(efectivoCierre) - efectivoTeorico
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ==========================================
// MÓDULO CRM — Clientes y Crédito
// ==========================================

// GET /api/v1/clientes — Listar todos los clientes
app.get('/api/v1/clientes', async (req, res) => {
  try {
    const { q } = req.query;
    const clientes = await prisma.cliente.findMany({
      where: {
        activo: true,
        ...(q ? {
          OR: [
            { nombre: { contains: String(q) } },
            { telefono: { contains: String(q) } },
            { rfc: { contains: String(q) } },
          ]
        } : {})
      },
      orderBy: { nombre: 'asc' }
    });
    res.json(clientes);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/v1/clientes — Crear cliente
app.post('/api/v1/clientes', async (req, res) => {
  try {
    const { nombre, telefono, email, direccion, rfc, razonSocial, regimenFiscal, codigoPostal, direccionFiscal, limiteCredito } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    const cliente = await prisma.cliente.create({
      data: { nombre, telefono, email, direccion, rfc, razonSocial, regimenFiscal, codigoPostal, direccionFiscal, limiteCredito: Number(limiteCredito || 0) }
    });
    res.json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/v1/clientes/:id — Actualizar cliente
app.put('/api/v1/clientes/:id', async (req, res) => {
  try {
    const { nombre, telefono, email, direccion, rfc, razonSocial, regimenFiscal, codigoPostal, direccionFiscal, limiteCredito, activo } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id },
      data: { nombre, telefono, email, direccion, rfc, razonSocial, regimenFiscal, codigoPostal, direccionFiscal, limiteCredito: limiteCredito !== undefined ? Number(limiteCredito) : undefined, activo }
    });
    res.json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/v1/clientes/:id — Desactivar cliente (soft delete)
app.delete('/api/v1/clientes/:id', async (req, res) => {
  try {
    await prisma.cliente.update({ where: { id: req.params.id }, data: { activo: false } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/clientes/:id — Detalle de cliente
app.get('/api/v1/clientes/:id', async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(cliente);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/clientes/:id/historial — Historial de ventas y transacciones de crédito
app.get('/api/v1/clientes/:id/historial', async (req, res) => {
  try {
    const { limit = '20' } = req.query;
    const [ventas, transacciones, cliente] = await Promise.all([
      prisma.venta.findMany({
        where: { clienteId: req.params.id },
        include: { detalles: { include: { producto: { select: { nombre: true, sku: true } } } } },
        orderBy: { creadoAt: 'desc' },
        take: Number(limit)
      }),
      prisma.creditoTransaccion.findMany({
        where: { clienteId: req.params.id },
        orderBy: { creadoAt: 'desc' },
        take: Number(limit)
      }),
      prisma.cliente.findUnique({ where: { id: req.params.id } })
    ]);
    res.json({ cliente, ventas, transacciones });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/v1/clientes/:id/abono — Registrar abono al saldo del cliente
app.post('/api/v1/clientes/:id/abono', async (req, res) => {
  try {
    const { monto, concepto } = req.body;
    if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'Monto inválido' });
    const result = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({ where: { id: req.params.id } });
      if (!cliente) throw new Error('Cliente no encontrado');
      const nuevoSaldo = Math.max(0, Number(cliente.saldoDeudor) - Number(monto));
      const [clienteActualizado, transaccion] = await Promise.all([
        tx.cliente.update({ where: { id: req.params.id }, data: { saldoDeudor: nuevoSaldo } }),
        tx.creditoTransaccion.create({
          data: { clienteId: req.params.id, tipo: 'ABONO', monto: Number(monto), concepto: concepto || 'Abono en efectivo' }
        })
      ]);
      return { cliente: clienteActualizado, transaccion };
    });
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// MÓDULO REPORTES
// ==========================================

// GET /api/v1/reportes/ventas-dia — Ventas del día agrupadas por hora
app.get('/api/v1/reportes/ventas-dia', async (req, res) => {
  try {
    const { fecha } = req.query;
    const dia = fecha ? new Date(String(fecha)) : new Date();
    const inicio = new Date(dia); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(dia); fin.setHours(23, 59, 59, 999);
    const ventas = await prisma.venta.findMany({
      where: { creadoAt: { gte: inicio, lte: fin } },
      select: { total: true, creadoAt: true, id: true }
    });
    // Agrupar por hora
    const porHora: Record<number, { total: number; tickets: number }> = {};
    for (let h = 6; h <= 22; h++) porHora[h] = { total: 0, tickets: 0 };
    ventas.forEach(v => {
      const hora = new Date(v.creadoAt).getHours();
      if (porHora[hora]) { porHora[hora].total += Number(v.total); porHora[hora].tickets += 1; }
    });
    const totalDia = ventas.reduce((s, v) => s + Number(v.total), 0);
    res.json({ porHora, totalDia, tickets: ventas.length, ticketPromedio: ventas.length > 0 ? totalDia / ventas.length : 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/reportes/ventas-periodo — Ventas por rango de fechas
app.get('/api/v1/reportes/ventas-periodo', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const inicio = desde ? new Date(String(desde)) : new Date(new Date().setDate(new Date().getDate() - 30));
    const fin = hasta ? new Date(String(hasta)) : new Date();
    fin.setHours(23, 59, 59, 999);
    const ventas = await prisma.venta.findMany({
      where: { creadoAt: { gte: inicio, lte: fin } },
      select: { total: true, subtotal: true, descuento: true, creadoAt: true, folio: true, id: true, usuario: { select: { nombre: true } } },
      orderBy: { creadoAt: 'desc' }
    });
    // Agrupar por día
    const porDia: Record<string, { total: number; tickets: number }> = {};
    ventas.forEach(v => {
      const dia = new Date(v.creadoAt).toISOString().split('T')[0];
      if (!porDia[dia]) porDia[dia] = { total: 0, tickets: 0 };
      porDia[dia].total += Number(v.total);
      porDia[dia].tickets += 1;
    });
    const totalPeriodo = ventas.reduce((s, v) => s + Number(v.total), 0);
    res.json({ ventas, porDia, totalPeriodo, tickets: ventas.length, ticketPromedio: ventas.length > 0 ? totalPeriodo / ventas.length : 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/reportes/top-productos — Top productos más vendidos
app.get('/api/v1/reportes/top-productos', async (req, res) => {
  try {
    const { desde, hasta, limit = '10' } = req.query;
    const inicio = desde ? new Date(String(desde)) : new Date(new Date().setDate(new Date().getDate() - 30));
    const fin = hasta ? new Date(String(hasta)) : new Date();
    fin.setHours(23, 59, 59, 999);
    const detalles = await prisma.detalleVenta.findMany({
      where: { venta: { creadoAt: { gte: inicio, lte: fin } } },
      include: { producto: { select: { nombre: true, sku: true, precio: true } } }
    });
    // Agrupar por producto
    const agrupado: Record<string, { nombre: string; sku: string; unidades: number; ingresos: number }> = {};
    detalles.forEach(d => {
      const id = d.productoId;
      if (!agrupado[id]) agrupado[id] = { nombre: d.producto.nombre, sku: d.producto.sku, unidades: 0, ingresos: 0 };
      agrupado[id].unidades += Number(d.cantidad);
      agrupado[id].ingresos += Number(d.subtotal);
    });
    const top = Object.entries(agrupado)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, Number(limit));
    res.json(top);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/reportes/por-cajero — Ventas agrupadas por cajero
app.get('/api/v1/reportes/por-cajero', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const inicio = desde ? new Date(String(desde)) : new Date(new Date().setDate(new Date().getDate() - 30));
    const fin = hasta ? new Date(String(hasta)) : new Date();
    fin.setHours(23, 59, 59, 999);
    const ventas = await prisma.venta.findMany({
      where: { creadoAt: { gte: inicio, lte: fin } },
      select: { total: true, usuarioId: true, usuario: { select: { nombre: true, rol: true } } }
    });
    const porCajero: Record<string, { nombre: string; rol: string; tickets: number; total: number }> = {};
    ventas.forEach(v => {
      const id = v.usuarioId;
      if (!porCajero[id]) porCajero[id] = { nombre: v.usuario.nombre, rol: v.usuario.rol, tickets: 0, total: 0 };
      porCajero[id].tickets += 1;
      porCajero[id].total += Number(v.total);
    });
    res.json(Object.entries(porCajero).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/reportes/corte-caja/:turnoId — Resumen detallado de turno
app.get('/api/v1/reportes/corte-caja/:turnoId', async (req, res) => {
  try {
    const turno = await prisma.turnoCaja.findUnique({
      where: { id: req.params.turnoId },
      include: { flujos: true, usuario: { select: { nombre: true } } }
    });
    if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
    const ventas = await prisma.venta.findMany({
      where: { usuarioId: turno.usuarioId, creadoAt: { gte: turno.abiertoAt, ...(turno.cerradoAt ? { lte: turno.cerradoAt } : {}) } },
      select: { total: true, folio: true, creadoAt: true }
    });
    const totalVentas = ventas.reduce((s, v) => s + Number(v.total), 0);
    const ingresosFlujo = turno.flujos.filter(f => f.tipo === 'INGRESO').reduce((s, f) => s + Number(f.monto), 0);
    const egresosFlujo = turno.flujos.filter(f => f.tipo === 'EGRESO').reduce((s, f) => s + Number(f.monto), 0);
    const efectivoTeorico = Number(turno.fondoInicial) + totalVentas + ingresosFlujo - egresosFlujo;
    res.json({ turno, ventas, totalVentas, tickets: ventas.length, ticketPromedio: ventas.length > 0 ? totalVentas / ventas.length : 0, flujos: turno.flujos, ingresosFlujo, egresosFlujo, fondoInicial: Number(turno.fondoInicial), efectivoTeorico, efectivoDeclarado: turno.efectivoCierre ? Number(turno.efectivoCierre) : null, diferencia: turno.efectivoCierre ? Number(turno.efectivoCierre) - efectivoTeorico : null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/reportes/cuentas-por-cobrar — Total de crédito pendiente
app.get('/api/v1/reportes/cuentas-por-cobrar', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true, saldoDeudor: { gt: 0 } },
      orderBy: { saldoDeudor: 'desc' }
    });
    const total = clientes.reduce((s, c) => s + Number(c.saldoDeudor), 0);
    res.json({ clientes, total, count: clientes.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==========================================
// 8. Facturación CFDI (Simulada)
// ==========================================
app.post('/api/v1/ventas/:id/facturar', async (req, res) => {
  const { id } = req.params;
  const { rfc, razonSocial, usoCFDI } = req.body;
  if (!rfc || !razonSocial || !usoCFDI) {
    return res.status(400).json({ error: 'Faltan datos fiscales requeridos para facturar' });
  }
  try {
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: { factura: true }
    });
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    if (venta.factura) return res.status(400).json({ error: 'Esta venta ya se encuentra facturada' });

    const mockUuid = `CFDI40-${Math.random().toString(36).substring(2, 10).toUpperCase()}-4D2F-A5C1-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const factura = await prisma.facturaCFDI.create({
      data: {
        ventaId: id,
        rfcReceptor: rfc,
        razonSocial,
        usoCFDI,
        uuidSat: mockUuid,
        estado: 'TIMBRADA',
        xmlUrl: `/facturas/xml/${mockUuid}.xml`,
        pdfUrl: `/facturas/pdf/${mockUuid}.pdf`,
        timbradaAt: new Date()
      }
    });
    res.json({ success: true, factura });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/facturas', async (req, res) => {
  try {
    const facturas = await prisma.facturaCFDI.findMany({
      include: { venta: { include: { cliente: true, usuario: { select: { nombre: true } } } } },
      orderBy: { creadoAt: 'desc' }
    });
    res.json(facturas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. Lotes e Inventario de Caducidad
// ==========================================
app.get('/api/v1/lotes', async (req, res) => {
  try {
    const lotes = await prisma.loteStock.findMany({
      include: { producto: true, sucursal: true },
      orderBy: { fechaCaducidad: 'asc' }
    });
    res.json(lotes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/lotes', async (req, res) => {
  const { lote, productoId, sucursalId, stock, fechaCaducidad } = req.body;
  if (!lote || !productoId || !sucursalId || stock === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar el lote' });
  }
  try {
    const loteStock = await prisma.loteStock.upsert({
      where: {
        sucursalId_productoId_lote: { sucursalId, productoId, lote }
      },
      update: {
        stock: Number(stock),
        fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null
      },
      create: {
        lote,
        productoId,
        sucursalId,
        stock: Number(stock),
        fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null
      }
    });
    res.json(loteStock);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10. Antigüedad de Saldos (Cuentas por Cobrar)
// ==========================================
app.get('/api/v1/clientes/reportes/antiguedad', async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true, saldoDeudor: { gt: 0 } }
    });
    
    const report = [];
    const hoy = new Date();
    
    for (const c of clientes) {
      const txs = await prisma.creditoTransaccion.findMany({
        where: { clienteId: c.id, tipo: 'CARGO' },
        orderBy: { creadoAt: 'desc' }
      });
      
      let saldoRestante = Number(c.saldoDeudor);
      let alCorriente = 0; // 0-7 días
      let de1a30 = 0;      // 8-30 días
      let de31a60 = 0;     // 31-60 días
      let de61a90 = 0;     // 61-90 días
      let masDe90 = 0;     // 90+ días
      
      for (const tx of txs) {
        if (saldoRestante <= 0) break;
        const montoTx = Number(tx.monto);
        const afectacion = Math.min(saldoRestante, montoTx);
        saldoRestante -= afectacion;
        
        const diffMs = hoy.getTime() - new Date(tx.creadoAt).getTime();
        const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (dias <= 7) alCorriente += afectacion;
        else if (dias <= 30) de1a30 += afectacion;
        else if (dias <= 60) de31a60 += afectacion;
        else if (dias <= 90) de61a90 += afectacion;
        else masDe90 += afectacion;
      }
      
      if (saldoRestante > 0) {
        masDe90 += saldoRestante;
      }
      
      report.push({
        id: c.id,
        cliente: c.nombre,
        limiteCredito: Number(c.limiteCredito),
        saldoTotal: Number(c.saldoDeudor),
        alCorriente,
        de1a30,
        de31a60,
        de61a90,
        masDe90
      });
    }
    
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 11. Bitácora de Auditoría
// ==========================================
app.post('/api/v1/auditoria', async (req, res) => {
  const { usuarioId, accion, tabla, registroId, detalles } = req.body;
  if (!usuarioId || !accion || !detalles) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar la auditoría' });
  }
  try {
    const log = await prisma.bitacoraAuditoria.create({
      data: {
        usuarioId,
        accion,
        tabla,
        registroId,
        detalles
      },
      include: { usuario: { select: { nombre: true, rol: true } } }
    });
    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/auditoria', async (req, res) => {
  try {
    const logs = await prisma.bitacoraAuditoria.findMany({
      include: { usuario: { select: { nombre: true, rol: true } } },
      orderBy: { creadoAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/system/reset', async (req: any, res: any) => {
  try {
    await prisma.kardexMovimiento.deleteMany({});
    await prisma.reservaTemporal.deleteMany({});
    await prisma.detalleVenta.deleteMany({});
    await prisma.detalleCotizacion.deleteMany({});
    await prisma.detalleTraspaso.deleteMany({});
    await prisma.inventarioBalance.deleteMany({});
    await prisma.loteStock.deleteMany({});
    await prisma.codigoBarras.deleteMany({});
    await prisma.producto.deleteMany({});
    await prisma.venta.deleteMany({});
    await prisma.cotizacion.deleteMany({});
    await prisma.traspasoMercancia.deleteMany({});
    await prisma.turnoCaja.deleteMany({});
    await prisma.bitacoraAuditoria.deleteMany({});
    await prisma.cliente.deleteMany({});
    await prisma.proveedor.deleteMany({});
    await prisma.usuario.deleteMany({});
    await prisma.configuracionEmpresa.deleteMany({});
    await prisma.sucursal.deleteMany({});
    
    // Volver a sembrar la sucursal raíz y el admin por defecto
    const rootSucursal = await prisma.sucursal.create({
      data: {
        id: 'suc-norte',
        nombre: 'Sucursal Norte'
      }
    });

    await prisma.usuario.create({
      data: {
        id: 'ADMIN',
        nombre: 'Administrador',
        rol: 'ADMINISTRADOR',
        pin: '8888'
      }
    });

    res.json({ success: true, message: 'Base de datos limpia de fábrica con éxito' });
  } catch (error: any) {
    console.error('Error al reiniciar base de datos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 12. Cargar Catálogos Precargados por Giro
// ==========================================
app.post('/api/v1/presets/load', async (req: any, res: any) => {
  const { giro, limpiarExistentes } = req.body;
  
  if (!giro) {
    return res.status(400).json({ error: 'El giro es obligatorio' });
  }
  
  try {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    let normalizedGiro = giro.toUpperCase();
    if (normalizedGiro === 'TIENDA') {
      normalizedGiro = 'ABARROTES';
    }
    
    const validGiros = ['ABARROTES', 'FARMACIA', 'FERRETERIA', 'REFACCIONARIA', 'CAFETERIA'];
    if (!validGiros.includes(normalizedGiro)) {
      return res.status(400).json({ error: `Giro no válido. Debe ser uno de: ${validGiros.join(', ')}` });
    }
    
    let presetPath = path.join(__dirname, 'presets', `${normalizedGiro.toLowerCase()}.json`);
    if (!fs.existsSync(presetPath)) {
      presetPath = path.join(__dirname, '..', 'src', 'presets', `${normalizedGiro.toLowerCase()}.json`);
    }
    
    if (!fs.existsSync(presetPath)) {
      return res.status(404).json({ error: `No se encontró el preset para el giro ${normalizedGiro}` });
    }
    
    const rawData = fs.readFileSync(presetPath, 'utf-8');
    const products = JSON.parse(rawData);
    
    // Resolver el token __PRESET_IMG__ a la ruta absoluta real de las imágenes empaquetadas
    const presetImagesDir = path.join(path.dirname(presetPath), 'images');
    for (const p of products) {
      const imgUrl: string = p?.metadatos?.imagenUrl || '';
      if (imgUrl.startsWith('__PRESET_IMG__/')) {
        const imgFile = imgUrl.replace('__PRESET_IMG__/', '');
        const absPath = path.join(presetImagesDir, imgFile);
        if (fs.existsSync(absPath)) {
          // Convertir a data URL base64 para embeber directamente (funciona sin servidor de archivos)
          const imgBuffer = fs.readFileSync(absPath);
          const ext = path.extname(imgFile).replace('.', '');
          const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
          p.metadatos.imagenUrl = `data:${mimeType};base64,${imgBuffer.toString('base64')}`;
        } else {
          p.metadatos.imagenUrl = null;
        }
      }
    }
    
    // Opcional: Limpiar inventario y catálogo existente para evitar duplicaciones
    if (limpiarExistentes === true) {
      // Borrar registros asociados primero para evitar violación de llave foránea
      await prisma.kardexMovimiento.deleteMany({});
      await prisma.reservaTemporal.deleteMany({});
      await prisma.detalleVenta.deleteMany({});
      await prisma.detalleCotizacion.deleteMany({});
      await prisma.detalleTraspaso.deleteMany({});
      await prisma.inventarioBalance.deleteMany({});
      await prisma.loteStock.deleteMany({});
      await prisma.codigoBarras.deleteMany({});
      await prisma.producto.deleteMany({});
    }
    
    // 1. Obtener o crear todas las categorías únicas en la base de datos
    const uniqueCategories = [...new Set(products.map((p: any) => p.categoria))] as string[];
    const categoriesMap = new Map<string, string>();
    
    for (const catName of uniqueCategories) {
      if (!catName) continue;
      let cat = await prisma.categoria.findUnique({ where: { nombre: catName } });
      if (!cat) {
        cat = await prisma.categoria.create({ data: { nombre: catName } });
      }
      categoriesMap.set(catName, cat.id);
    }
    
    // Garantizar que exista una sucursal raíz
    let rootSucursal = await prisma.sucursal.findFirst();
    if (!rootSucursal) {
      rootSucursal = await prisma.sucursal.create({
        data: {
          id: 'suc-norte',
          nombre: 'Sucursal Norte'
        }
      });
    }

    const isCafeteria = normalizedGiro === 'CAFETERIA';
    const productsToProcess = products;

    // 2. Insertar los productos secuencialmente uno por uno con sus códigos de barra relacionados y stock
    for (const p of productsToProcess) {
      const catId = categoriesMap.get(p.categoria) || null;
      const barcodes = Array.isArray(p.codigos) ? p.codigos.map((code: string) => ({ codigo: code })) : [];
      
      const finalMetadata = p.metadatos || {};
      if (isCafeteria) {
        finalMetadata.enMenuRapido = true;
      }
      
      const createdProduct = await prisma.producto.create({
        data: {
          sku: p.sku,
          nombre: p.nombre,
          costo: Number(p.costo) || 0,
          precio: Number(p.precio) || 0,
          permiteFracciones: p.permiteFracciones || false,
          categoriaId: catId,
          metadatos: finalMetadata,
          codigos: {
            create: barcodes
          }
        }
      });

      // Si es cafetería, agregar stock inicial de 10 unidades
      if (isCafeteria) {
        await prisma.inventarioBalance.create({
          data: {
            sucursalId: rootSucursal.id,
            productoId: createdProduct.id,
            stockReal: 10,
            reservado: 0
          }
        });

        // Registrar el movimiento en Kardex para auditoría
        await prisma.kardexMovimiento.create({
          data: {
            sucursalId: rootSucursal.id,
            productoId: createdProduct.id,
            usuarioId: 'ADMIN',
            tipo: 'ENTRADA_AJUSTE',
            cantidad: 10,
            observacion: 'Carga inicial de stock preconfigurado de demostración'
          }
        });
      }
    }

    const companyConfig = await prisma.configuracionEmpresa.findFirst();
    if (!companyConfig) {
      await prisma.configuracionEmpresa.create({
        data: {
          nombreEmpresa: `Vante POS ${giro.charAt(0) + giro.slice(1).toLowerCase()}`,
          giro: normalizedGiro as any
        }
      });
    } else {
      await prisma.configuracionEmpresa.update({
        where: { id: companyConfig.id },
        data: {
          giro: normalizedGiro as any
        }
      });
    }

    await prisma.usuario.upsert({
      where: { id: 'ADMIN' },
      update: { pin: '8888' },
      create: {
        id: 'ADMIN',
        nombre: 'Administrador',
        rol: 'ADMINISTRADOR',
        pin: '8888'
      }
    });
    
    res.json({
      success: true,
      message: `Catálogo de ${giro} precargado con éxito. Se insertaron ${products.length} productos.`
    });
  } catch (error: any) {
    console.error('Error al precargar catálogo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// Auto-migración al arranque (prisma db push)
// Garantiza que la BD local esté siempre sincronizada
// con el schema actual (nuevos enums, columnas, etc.)
// ==========================================
async function applySchema() {
  try {
    console.log('[SCHEMA] Verificando compatibilidad del schema de base de datos...');
    
    // SQLite: verify if schema.sql needs to be loaded (first boot)
    const tableInfo = await prisma.$queryRawUnsafe<any[]>(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='ConfiguracionEmpresa'`
    );
    
    if (tableInfo.length === 0) {
      console.log('[SCHEMA] Base de datos vacía detectada. Inicializando tablas desde schema.sql...');
      const schemaSqlPath = path.resolve(__dirname, './presets/schema.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const ddl = fs.readFileSync(schemaSqlPath, 'utf8');
        // Split DDL by semicolon and execute each statement
        const statements = ddl.split(';');
        for (const sql of statements) {
          const trimmed = sql.trim();
          if (trimmed && !trimmed.startsWith('--')) {
            await prisma.$executeRawUnsafe(trimmed);
          }
        }
        console.log('[SCHEMA] Inicialización de tablas completada con éxito.');
      } else {
        console.warn('[SCHEMA] ADVERTENCIA: No se encontró el archivo presets/schema.sql!');
      }
    } else {
      console.log('[SCHEMA] Las tablas ya existen. Verificando compatibilidad de Giro...');
      const tableInfo = await prisma.$queryRawUnsafe<any[]>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='ConfiguracionEmpresa'`
      );
      if (tableInfo.length > 0) {
        const ddl: string = tableInfo[0].sql || '';
        if (ddl.includes('CHECK') && !ddl.includes('CAFETERIA')) {
          console.log('[SCHEMA] Detectado enum Giro desactualizado — aplicando actualización de schema...');
          await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
          await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "ConfiguracionEmpresa_new" (
              "id"            TEXT NOT NULL PRIMARY KEY,
              "nombreEmpresa" TEXT NOT NULL,
              "rfc"           TEXT,
              "telefono"      TEXT,
              "direccion"     TEXT,
              "ciudad"        TEXT,
              "logo"          TEXT,
              "giro"          TEXT NOT NULL DEFAULT 'ABARROTES',
              "moneda"        TEXT NOT NULL DEFAULT 'MXN',
              "sucursalId"    TEXT NOT NULL,
              "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT "ConfiguracionEmpresa_sucursalId_fkey"
                FOREIGN KEY ("sucursalId") REFERENCES "Sucursal"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            )
          `);
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ConfiguracionEmpresa_new" SELECT * FROM "ConfiguracionEmpresa"
          `);
          await prisma.$executeRawUnsafe(`DROP TABLE "ConfiguracionEmpresa"`);
          await prisma.$executeRawUnsafe(`ALTER TABLE "ConfiguracionEmpresa_new" RENAME TO "ConfiguracionEmpresa"`);
          await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
          console.log('[SCHEMA] Schema de Giro actualizado correctamente.');
        } else {
          console.log('[SCHEMA] Schema compatible. No se requiere actualización.');
        }
      }
    }
  } catch (err: any) {
    console.error('[SCHEMA] Error al verificar/actualizar schema:', err.message);
  }
}

applySchema().then(() => seedDatabase()).then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor POS backend corriendo en el puerto ${PORT}`);
  });
});

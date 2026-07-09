import express from 'express';
import cors from 'cors';
import { prisma } from './prisma.js';
import { TipoMovimiento, EstadoReserva } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

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
          { nombre: { contains: term, mode: 'insensitive' } },
          { descripcion: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          {
            codigos: {
              some: { codigo: { contains: term, mode: 'insensitive' } }
            }
          }
        ]
      } : {},
      include: {
        codigos: true,
        balances: true
      },
      take: 20
    });

    res.json(productos);
  } catch (error: any) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ error: 'Error interno del servidor al buscar productos' });
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
    // Generar un código de 4 dígitos aleatorio para la importación rápida en caja
    const codigoCorto = Math.floor(1000 + Math.random() * 9000).toString();
    const folio = `COT-${Date.now()}-${codigoCorto}`;
    
    // La cotización expira en 30 minutos
    const expiraAt = new Date();
    expiraAt.setMinutes(expiraAt.getMinutes() + 30);

    // Obtener los productos involucrados para calcular costos/totales
    const productoIds = items.map(item => item.productoId);
    const dbProductos = await prisma.producto.findMany({
      where: { id: { in: productoIds } }
    });

    const productosMap = new Map(dbProductos.map(p => [p.id, p]));

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
        return res.status(404).json({ error: `Producto con ID ${item.productoId} no existe` });
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
          usuarioId,
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

// Listar cotizaciones activas
app.get('/api/v1/cotizaciones', async (req, res) => {
  try {
    const cotizaciones = await prisma.cotizacion.findMany({
      where: { estado: 'ACTIVA' },
      orderBy: { createdAt: 'desc' },
      include: {
        detalles: {
          include: {
            producto: true
          }
        }
      }
    });
    res.json(cotizaciones);
  } catch (error) {
    console.error('Error al listar cotizaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
// Inicializar servidor y seed data
// ==========================================
async function seedDatabase() {
  console.log('[SEED] Iniciando poblado de datos base en Supabase...');
  try {
    // 1. Seed Sucursal
    await prisma.sucursal.upsert({
      where: { id: 'suc-norte' },
      update: {},
      create: {
        id: 'suc-norte',
        nombre: 'Sucursal Norte',
        direccion: 'Calle Falsa 123'
      }
    });

    // 2. Seed Usuarios
    const users = [
      { id: 'Dorian', nombre: 'Dorian', rol: 'CAJERO', pin: '1234' },
      { id: 'Carlos M.', nombre: 'Carlos M.', rol: 'ADMINISTRADOR', pin: '9999' },
      { id: 'Ana G.', nombre: 'Ana G.', rol: 'VENDEDOR_MOVIL', pin: '5555' },
      { id: 'usr-dorian', nombre: 'Dorian', rol: 'CAJERO', pin: '1234' },
      { id: 'usr-desconocido', nombre: 'Desconocido', rol: 'CAJERO', pin: '0000' }
    ];

    for (const u of users) {
      await prisma.usuario.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          nombre: u.nombre,
          rol: u.rol as any,
          pin: u.pin
        }
      });
    }

    // 3. Seed Productos
    const products = [
      {
        id: 'AUT-881',
        sku: 'AUT-881',
        nombre: 'Balatas Delanteras Cerámicas de Alto Rendimiento',
        costo: 280.00,
        precio: 340.00,
        permiteFracciones: false,
        metadatos: { oem: 'D-1092', compatible: 'Vento 250 / Honda CGL', garantia: '6 Meses' }
      },
      {
        id: 'FER-092',
        sku: 'FER-092',
        nombre: 'Cable de Cobre Calibre 12 THW Aislamiento Extra',
        costo: 12.00,
        precio: 18.00,
        permiteFracciones: true,
        metadatos: { marca: 'Condumex', ubicacion: 'Pasillo 4, Anaquel B', amperaje_max: '25A' }
      },
      {
        id: 'FER-114',
        sku: 'FER-114',
        nombre: 'Disco Abrasivo Corte Metal 4.5" Extra Fino',
        costo: 30.00,
        precio: 45.50,
        permiteFracciones: false,
        metadatos: { marca: 'Dewalt', rpm_max: '13300', uso: 'Industrial' }
      }
    ];

    for (const p of products) {
      await prisma.producto.upsert({
        where: { id: p.id },
        update: {},
        create: {
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          costo: p.costo,
          precio: p.precio,
          permiteFracciones: p.permiteFracciones,
          metadatos: p.metadatos
        }
      });
    }

    console.log('[SEED] Poblado de datos base completado con éxito.');
  } catch (error) {
    console.error('[SEED] Error al poblar base de datos:', error);
  }
}

// Iniciar simulación de Cron Job cada 1 minuto (para demo) en producción sería cada 5 min
setInterval(liberarReservasExpiradas, 60 * 1000);

seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor POS backend corriendo en el puerto ${PORT}`);
  });
});

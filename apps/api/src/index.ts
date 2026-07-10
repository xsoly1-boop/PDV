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
          { nombre: { contains: term, mode: 'insensitive' } },
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
  const { sku, nombre, descripcion, costo, precio, categoriaId, proveedorId, codigoBarras, stock, unidad, permiteFracciones } = req.body;
  try {
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
        metadatos: unidad ? { unidad } : undefined,
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
  const { sku, nombre, descripcion, costo, precio, categoriaId, proveedorId, codigoBarras, stock, unidad, permiteFracciones } = req.body;
  try {
    const producto = await prisma.producto.update({
      where: { id },
      data: {
        sku, nombre, descripcion,
        costo: costo || 0,
        precio: precio || 0,
        permiteFracciones: permiteFracciones || false,
        categoriaId: categoriaId || null,
        proveedorId: proveedorId || null,
        metadatos: unidad ? { unidad } : undefined,
      },
      include: { codigos: true, balances: true }
    });
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
      orderBy: { creadoAt: 'desc' },
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
    const resultado = await prisma.producto.createMany({
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
      const balResult = await prisma.inventarioBalance.createMany({
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
      const result = await prisma.inventarioBalance.createMany({
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
        const sRes = await tx.venta.createMany({
          data: salesToInsert,
          skipDuplicates: true
        });
        salesCount += sRes.count;

        if (detailsToInsert.length > 0) {
          const dRes = await tx.detalleVenta.createMany({
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
    printerCaja, printerCliente, printerMovil, printerBodega
  } = req.body;

  let mappedGiro: any = 'ABARROTES';
  if (giro === 'farmacia') mappedGiro = 'FARMACIA';
  else if (giro === 'ferreteria') mappedGiro = 'FERRETERIA';
  else if (giro === 'refaccionaria') mappedGiro = 'REFACCIONARIA';
  else if (giro === 'tienda') mappedGiro = 'ABARROTES';

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
        printerBodega: printerBodega || ''
      } as any,
    };

    if (existing) {
      const updated = await prisma.configuracionEmpresa.update({
        where: { id: existing.id },
        data,
      });
      res.json(updated);
    } else {
      const created = await prisma.configuracionEmpresa.create({
        data,
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
        sucursal: true
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
        fecha: new Date(v.creadoAt).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
        cliente: v.cliente?.nombre || 'Público General',
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
  const { folio, sucursalId, usuarioId, clienteId, total, subtotal, descuento, metodo, detalles } = req.body;

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

      return newVenta;
    });

    res.json({ success: true, ventaId: venta.id });
  } catch (error: any) {
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

seedDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor POS backend corriendo en el puerto ${PORT}`);
  });
});

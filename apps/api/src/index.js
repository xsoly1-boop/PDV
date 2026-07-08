"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const prisma_js_1 = require("./prisma.js");
const shared_types_1 = require("@punto-de-venta/shared-types");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 3001;
// ==========================================
// 1. Módulo de Catálogo e Inventario
// ==========================================
// GET /api/v1/productos/buscar?q={termino}
app.get('/api/v1/productos/buscar', async (req, res) => {
    const { q } = req.query;
    const term = q ? String(q).trim() : '';
    try {
        const productos = await prisma_js_1.prisma.producto.findMany({
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
    }
    catch (error) {
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
        const codigoRel = await prisma_js_1.prisma.codigoBarras.findUnique({
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
            const productoPorSku = await prisma_js_1.prisma.producto.findUnique({
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
    }
    catch (error) {
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
        const dbProductos = await prisma_js_1.prisma.producto.findMany({
            where: { id: { in: productoIds } }
        });
        const productosMap = new Map(dbProductos.map(p => [p.id, p]));
        let subtotal = 0;
        const detallesData = [];
        const reservasData = [];
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
                estado: shared_types_1.EstadoReserva.ACTIVA,
                expiraAt
            });
        }
        // Ejecutar creación en transacción ACID
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
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
                    estado: shared_types_1.EstadoReserva.ACTIVA,
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
    }
    catch (error) {
        console.error('Error al crear cotización:', error);
        res.status(500).json({ error: 'Error transaccional al registrar la cotización' });
    }
});
// GET /api/v1/cotizaciones/:id/qr
app.get('/api/v1/cotizaciones/:id/qr', async (req, res) => {
    const { id } = req.params;
    try {
        const cotizacion = await prisma_js_1.prisma.cotizacion.findUnique({
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
    }
    catch (error) {
        console.error('Error al generar QR de cotización:', error);
        res.status(500).json({ error: 'Error al recuperar información para código QR' });
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
            const syncResult = await prisma_js_1.prisma.$transaction(async (tx) => {
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
    }
    catch (error) {
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
        const reservasExpiradas = await prisma_js_1.prisma.reservaTemporal.findMany({
            where: {
                estado: shared_types_1.EstadoReserva.ACTIVA,
                expiraAt: { lte: ahora }
            }
        });
        if (reservasExpiradas.length === 0) {
            return;
        }
        console.log(`[CRON WORKER] Se encontraron ${reservasExpiradas.length} reservas expiradas. Procesando liberación...`);
        for (const reserva of reservasExpiradas) {
            await prisma_js_1.prisma.$transaction(async (tx) => {
                // 1. Cambiar estado a EXPIRADA
                await tx.reservaTemporal.update({
                    where: { id: reserva.id },
                    data: { estado: shared_types_1.EstadoReserva.EXPIRADA }
                });
                // 2. Si estaba vinculada a una cotización, cambiar estado de cotización
                if (reserva.cotizacionId) {
                    await tx.cotizacion.update({
                        where: { id: reserva.cotizacionId },
                        data: { estado: shared_types_1.EstadoReserva.EXPIRADA }
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
    }
    catch (error) {
        console.error('[CRON WORKER] Error al liberar reservas expiradas:', error);
    }
}
// Iniciar simulación de Cron Job cada 1 minuto (para demo) en producción sería cada 5 min
setInterval(liberarReservasExpiradas, 60 * 1000);
// ==========================================
// Inicializar servidor
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor POS backend corriendo en el puerto ${PORT}`);
});
//# sourceMappingURL=index.js.map
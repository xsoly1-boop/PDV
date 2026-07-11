import Dexie, { type Table } from 'dexie';

export interface LocalProducto {
  id: string;
  nombre: string;
  sku: string;
  codigoBarras?: string;
  precio: number;
  costo: number;
  stock: number;
  unidad: string;
  categoria: string;
  descripcion?: string;
  codigoCorto?: string;
}

export interface OfflineVenta {
  id: string; // UUID temporal de la venta offline
  folio: string;
  usuarioId: string;
  total: number;
  subtotal: number;
  descuento: number;
  metodo: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';
  detalles: Array<{
    productoId: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  creadoAt: string;
}

export interface OfflineTurnoFlujo {
  id: string;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  motivo: string;
  creadoAt: string;
}

export interface OfflineTurno {
  id: string;
  usuarioId: string;
  fondoInicial: number;
  efectivoCierre?: number;
  estado: 'ABIERTO' | 'CERRADO';
  observaciones?: string;
  abiertoAt: string;
  cerradoAt?: string;
  flujos: OfflineTurnoFlujo[];
  reporteFinal?: {
    fondoInicial: number;
    ventasEfectivo: number;
    ventasTarjeta: number;
    ventasTransferencia: number;
    ingresosCaja: number;
    egresosCaja: number;
    efectivoTeorico: number;
    efectivoDeclarado: number;
    diferencia: number;
  };
}

class ApexOfflineDatabase extends Dexie {
  productos!: Table<LocalProducto>;
  ventasQueue!: Table<OfflineVenta>;
  turnosQueue!: Table<OfflineTurno>;

  constructor() {
    super('ApexOfflineDatabase');
    // Actualizado a versión 2 para incorporar soporte offline de turnos y caja
    this.version(2).stores({
      productos: 'id, nombre, sku, precio, stock',
      ventasQueue: 'id, folio, creadoAt',
      turnosQueue: 'id, estado, abiertoAt, cerradoAt'
    });
  }
}

export const db = new ApexOfflineDatabase();

export const offlineStore = {
  // --- MÉTODOS DE PRODUCTOS ---
  
  async guardarCatalogo(productos: LocalProducto[]): Promise<void> {
    await db.productos.clear();
    await db.productos.bulkPut(productos);
  },

  async obtenerCatalogo(): Promise<LocalProducto[]> {
    return await db.productos.toArray();
  },

  async buscarProductos(query: string): Promise<LocalProducto[]> {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return [];

    return await db.productos
      .filter((p) => 
        p.nombre.toLowerCase().includes(cleanQuery) || 
        p.sku.toLowerCase().includes(cleanQuery)
      )
      .toArray();
  },

  // --- MÉTODOS DE COLA DE VENTAS ---

  async encolarVenta(venta: Omit<OfflineVenta, 'id' | 'creadoAt'>): Promise<OfflineVenta> {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const nuevaVenta: OfflineVenta = {
      ...venta,
      id: uuid,
      creadoAt: new Date().toISOString()
    };

    await db.ventasQueue.add(nuevaVenta);
    return nuevaVenta;
  },

  async obtenerVentasEncoladas(): Promise<OfflineVenta[]> {
    return await db.ventasQueue.orderBy('creadoAt').toArray();
  },

  async desencolarVenta(id: string): Promise<void> {
    await db.ventasQueue.delete(id);
  },

  async obtenerTamanoCola(): Promise<number> {
    return await db.ventasQueue.count();
  },

  // --- MÉTODOS DE COLA DE TURNOS / CAJA ---

  // Obtener turno abierto local para un usuario
  async obtenerTurnoActivoLocal(usuarioId: string): Promise<OfflineTurno | null> {
    const active = await db.turnosQueue
      .where({ usuarioId, estado: 'ABIERTO' })
      .first();
    return active || null;
  },

  // Abrir turno local
  async abrirTurnoLocal(usuarioId: string, fondoInicial: number): Promise<OfflineTurno> {
    const uuid = 'local-shift-' + Math.random().toString(36).substring(2, 15);
    const nuevoTurno: OfflineTurno = {
      id: uuid,
      usuarioId,
      fondoInicial,
      estado: 'ABIERTO',
      abiertoAt: new Date().toISOString(),
      flujos: []
    };
    await db.turnosQueue.add(nuevoTurno);
    return nuevoTurno;
  },

  // Agregar flujo a turno local
  async agregarFlujoLocal(turnoId: string, tipo: 'INGRESO' | 'EGRESO', monto: number, motivo: string): Promise<OfflineTurnoFlujo> {
    const turno = await db.turnosQueue.get(turnoId);
    if (!turno) throw new Error('Turno local no encontrado');

    const nuevoFlujo: OfflineTurnoFlujo = {
      id: 'local-flow-' + Math.random().toString(36).substring(2, 15),
      tipo,
      monto,
      motivo,
      creadoAt: new Date().toISOString()
    };

    turno.flujos.push(nuevoFlujo);
    await db.turnosQueue.put(turno);
    return nuevoFlujo;
  },

  // Cerrar turno local
  async cerrarTurnoLocal(turnoId: string, efectivoCierre: number, observaciones: string, reporte: any): Promise<OfflineTurno> {
    const turno = await db.turnosQueue.get(turnoId);
    if (!turno) throw new Error('Turno local no encontrado');

    turno.efectivoCierre = efectivoCierre;
    turno.observaciones = observaciones;
    turno.estado = 'CERRADO';
    turno.cerradoAt = new Date().toISOString();
    turno.reporteFinal = reporte;

    await db.turnosQueue.put(turno);
    return turno;
  },

  // Obtener todos los turnos cerrados locales para sincronización
  async obtenerTurnosCerradosLocales(): Promise<OfflineTurno[]> {
    return await db.turnosQueue
      .where({ estado: 'CERRADO' })
      .toArray();
  },

  // Eliminar un turno local encolado tras sincronizarse con el servidor central
  async desencolarTurno(id: string): Promise<void> {
    await db.turnosQueue.delete(id);
  }
};

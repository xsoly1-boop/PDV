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

class ApexOfflineDatabase extends Dexie {
  productos!: Table<LocalProducto>;
  ventasQueue!: Table<OfflineVenta>;

  constructor() {
    super('ApexOfflineDatabase');
    this.version(1).stores({
      productos: 'id, nombre, sku, precio, stock',
      ventasQueue: 'id, folio, creadoAt'
    });
  }
}

export const db = new ApexOfflineDatabase();

export const offlineStore = {
  // --- MÉTODOS DE PRODUCTOS ---
  
  // Guardar todo el catálogo localmente en lote
  async guardarCatalogo(productos: LocalProducto[]): Promise<void> {
    await db.productos.clear();
    await db.productos.bulkPut(productos);
  },

  // Obtener catálogo completo
  async obtenerCatalogo(): Promise<LocalProducto[]> {
    return await db.productos.toArray();
  },

  // Buscar productos localmente por coincidencia (nombre o sku)
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

  // Encolar venta offline
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

  // Leer todas las ventas encoladas
  async obtenerVentasEncoladas(): Promise<OfflineVenta[]> {
    return await db.ventasQueue.orderBy('creadoAt').toArray();
  },

  // Eliminar venta encolada (después de sincronizar)
  async desencolarVenta(id: string): Promise<void> {
    await db.ventasQueue.delete(id);
  },

  // Obtener tamaño de la cola
  async obtenerTamanoCola(): Promise<number> {
    return await db.ventasQueue.count();
  }
};

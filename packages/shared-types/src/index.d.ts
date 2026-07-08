export declare enum Rol {
    ADMINISTRADOR = "ADMINISTRADOR",
    GERENTE = "GERENTE",
    CAJERO = "CAJERO",
    VENDEDOR_MOVIL = "VENDEDOR_MOVIL"
}
export declare enum TipoMovimiento {
    ENTRADA_COMPRA = "ENTRADA_COMPRA",
    ENTRADA_TRASPASO = "ENTRADA_TRASPASO",
    ENTRADA_DEVOLUCION = "ENTRADA_DEVOLUCION",
    ENTRADA_AJUSTE = "ENTRADA_AJUSTE",
    SALIDA_VENTA = "SALIDA_VENTA",
    SALIDA_TRASPASO = "SALIDA_TRASPASO",
    SALIDA_MERMA = "SALIDA_MERMA",
    SALIDA_AJUSTE = "SALIDA_AJUSTE"
}
export declare enum EstadoReserva {
    ACTIVA = "ACTIVA",
    COMPLETADA = "COMPLETADA",
    EXPIRADA = "EXPIRADA",
    CANCELADA = "CANCELADA"
}
export declare enum EstadoTraspaso {
    EN_TRANSITO = "EN_TRANSITO",
    COMPLETADO = "COMPLETADO",
    COMPLETADO_PARCIAL = "COMPLETADO_PARCIAL",
    CANCELADO = "CANCELADO"
}
export interface UsuarioDTO {
    id: string;
    nombre: string;
    rol: Rol;
    activo: boolean;
}
export interface CodigoBarrasDTO {
    id: string;
    codigo: string;
    productoId: string;
}
export interface ProductoDTO {
    id: string;
    sku: string;
    nombre: string;
    descripcion?: string | null;
    costo: number;
    precio: number;
    permiteFracciones: boolean;
    metadatos?: any;
    codigos?: CodigoBarrasDTO[];
}
export interface InventarioBalanceDTO {
    id: string;
    sucursalId: string;
    productoId: string;
    stockReal: number;
    reservado: number;
}
export interface KardexMovimientoDTO {
    id: string;
    sucursalId: string;
    productoId: string;
    usuarioId: string;
    tipo: TipoMovimiento;
    cantidad: number;
    referencia?: string | null;
    observacion?: string | null;
    creadoAt: string;
}
export interface ReservaTemporalDTO {
    id: string;
    sucursalId: string;
    productoId: string;
    cantidad: number;
    estado: EstadoReserva;
    expiraAt: string;
    creadoAt: string;
    cotizacionId?: string | null;
}
export interface TraspasoMercanciaDTO {
    id: string;
    origenSucursalId: string;
    destinoSucursalId: string;
    usuarioEnviaId: string;
    usuarioRecibeId?: string | null;
    estado: EstadoTraspaso;
    creadoAt: string;
    recibidoAt?: string | null;
}
//# sourceMappingURL=index.d.ts.map
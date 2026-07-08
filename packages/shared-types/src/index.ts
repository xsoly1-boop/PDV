export enum Rol {
  ADMINISTRADOR = 'ADMINISTRADOR',
  GERENTE = 'GERENTE',
  CAJERO = 'CAJERO',
  VENDEDOR_MOVIL = 'VENDEDOR_MOVIL'
}

export enum TipoMovimiento {
  ENTRADA_COMPRA = 'ENTRADA_COMPRA',
  ENTRADA_TRASPASO = 'ENTRADA_TRASPASO',
  ENTRADA_DEVOLUCION = 'ENTRADA_DEVOLUCION',
  ENTRADA_AJUSTE = 'ENTRADA_AJUSTE',
  SALIDA_VENTA = 'SALIDA_VENTA',
  SALIDA_TRASPASO = 'SALIDA_TRASPASO',
  SALIDA_MERMA = 'SALIDA_MERMA',
  SALIDA_AJUSTE = 'SALIDA_AJUSTE'
}

export enum EstadoReserva {
  ACTIVA = 'ACTIVA',
  COMPLETADA = 'COMPLETADA',
  EXPIRADA = 'EXPIRADA',
  CANCELADA = 'CANCELADA'
}

export enum EstadoTraspaso {
  EN_TRANSITO = 'EN_TRANSITO',
  COMPLETADO = 'COMPLETADO',
  COMPLETADO_PARCIAL = 'COMPLETADO_PARCIAL',
  CANCELADO = 'CANCELADO'
}

// Interfaces básicas para transferencias de datos (DTO)
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

export enum Giro {
  ABARROTES = 'ABARROTES',
  FARMACIA = 'FARMACIA',
  FERRETERIA = 'FERRETERIA',
  REFACCIONARIA = 'REFACCIONARIA'
}

export interface ConfiguracionEmpresaDTO {
  id: string;
  nombreEmpresa: string;
  giro: Giro;
  rfc?: string | null;
  logoUrl?: string | null;
  formatoTicket?: any | null;
  creadoAt: string;
  actualizadoAt: string;
}

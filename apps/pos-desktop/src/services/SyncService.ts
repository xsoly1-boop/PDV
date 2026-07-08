import { LocalDb, LocalKardexMovimiento } from '../db/localDb';

import { API_V1 } from '../config.js';

const CENTRAL_API_URL = API_V1;


export const SyncService = {
  // Envía los movimientos no sincronizados al servidor central
  async syncPendingMovimientos(): Promise<{ success: boolean; processed: number; error?: string }> {
    const pending = LocalDb.getUnsynced();
    if (pending.length === 0) {
      return { success: true, processed: 0 };
    }

    try {
      const response = await fetch(`${CENTRAL_API_URL}/sync/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ movimientos: pending })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al sincronizar con el servidor central');
      }

      const result = await response.json();
      
      // Marcar los movimientos como sincronizados localmente
      const syncedIds = pending.map(item => item.id);
      LocalDb.markAsSynced(syncedIds);
      
      // Opcional: Limpiar de la cola local los ya sincronizados para liberar espacio
      LocalDb.clearSynced();

      return {
        success: true,
        processed: result.processed || pending.length
      };
    } catch (error: any) {
      console.error('Fallo en sincronización:', error);
      return {
        success: false,
        processed: 0,
        error: error.message || 'Error de red'
      };
    }
  },

  // Agrega una nueva venta / movimiento al Kardex local
  registrarMovimientoLocal(movimiento: {
    sucursalId: string;
    productoId: string;
    usuarioId: string;
    tipo: string;
    cantidad: number;
    referencia: string;
    observacion: string;
  }): LocalKardexMovimiento {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    const nuevoMov = {
      id,
      ...movimiento,
      creadoAt: new Date().toISOString()
    };
    
    LocalDb.addToQueue(nuevoMov);
    return {
      ...nuevoMov,
      sincronizado: false
    };
  }
};

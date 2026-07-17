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
  },

  // Sincroniza la cola local de SQLite hacia Supabase
  async syncSQLiteToSupabase(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const supabaseUrl = localStorage.getItem('supabase_url');
    const supabaseAnonKey = localStorage.getItem('supabase_anon_key');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: true, syncedCount: 0 };
    }

    try {
      const response = await fetch(`${CENTRAL_API_URL}/sync/pendientes`);
      if (!response.ok) {
        throw new Error('Fallo al conectar con el servidor local para obtener pendientes.');
      }
      const pendientes = await response.json();
      if (!pendientes || pendientes.length === 0) {
        return { success: true, syncedCount: 0 };
      }

      const headers: Record<string, string> = {
        'apikey': supabaseAnonKey.trim(),
        'Authorization': `Bearer ${supabaseAnonKey.trim()}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      };

      const cleanSupabaseUrl = supabaseUrl.trim().replace(/\/$/, '');
      const syncedIds: string[] = [];

      const stripRelations = (obj: any) => {
        if (!obj) return obj;
        const cleaned: any = {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val === null || val === undefined) {
            cleaned[key] = null;
          } else if (Array.isArray(val)) {
            // ignore
          } else if (typeof val === 'object') {
            if (val.d && Array.isArray(val.d) && typeof val.e === 'number') {
              cleaned[key] = Number(val);
            }
          } else {
            cleaned[key] = val;
          }
        }
        return cleaned;
      };

      for (const log of pendientes) {
        const endpoint = `${cleanSupabaseUrl}/rest/v1/${log.tabla}`;
        
        if (log.accion === 'DELETE') {
          // DELETE en Supabase
          const delRes = await fetch(`${endpoint}?id=eq.${log.registroId}`, {
            method: 'DELETE',
            headers: {
              'apikey': supabaseAnonKey.trim(),
              'Authorization': `Bearer ${supabaseAnonKey.trim()}`
            }
          });
          if (!delRes.ok) {
            console.error(`[SYNC] Error deleting ${log.tabla} id ${log.registroId} in Supabase`);
            continue;
          }
        } else {
          // INSERT / UPDATE en Supabase
          if (!log.datos) {
            syncedIds.push(log.id);
            continue;
          }

          const recordData = stripRelations(log.datos);
          
          // Subir el registro principal
          const postRes = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(recordData)
          });

          if (!postRes.ok) {
            const errBody = await postRes.text();
            console.error(`[SYNC] Error upserting ${log.tabla} id ${log.registroId} to Supabase:`, errBody);
            continue;
          }

          // Subir relaciones hijas si aplican
          if (log.tabla === 'Producto' && log.datos.codigos && Array.isArray(log.datos.codigos)) {
            for (const cod of log.datos.codigos) {
              await fetch(`${cleanSupabaseUrl}/rest/v1/CodigoBarras`, {
                method: 'POST',
                headers,
                body: JSON.stringify(stripRelations(cod))
              });
            }
          }

          if (log.tabla === 'Venta' && log.datos.detalles && Array.isArray(log.datos.detalles)) {
            for (const det of log.datos.detalles) {
              await fetch(`${cleanSupabaseUrl}/rest/v1/DetalleVenta`, {
                method: 'POST',
                headers,
                body: JSON.stringify(stripRelations(det))
              });
            }
          }
        }

        syncedIds.push(log.id);
      }

      // Notificar al backend local que estos IDs ya se sincronizaron con éxito
      if (syncedIds.length > 0) {
        const clearRes = await fetch(`${CENTRAL_API_URL}/sync/completado`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ids: syncedIds })
        });
        if (!clearRes.ok) {
          console.error('[SYNC] Fallo al limpiar la cola local de SyncLog');
        }
      }

      return {
        success: true,
        syncedCount: syncedIds.length
      };
    } catch (err: any) {
      console.error('[SYNC-SUPABASE] Fallo crítico:', err);
      return {
        success: false,
        syncedCount: 0,
        error: err.message || 'Error desconocido'
      };
    }
  }
};


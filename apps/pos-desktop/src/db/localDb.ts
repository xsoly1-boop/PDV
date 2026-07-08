export interface LocalKardexMovimiento {
  id: string;
  sucursalId: string;
  productoId: string;
  usuarioId: string;
  tipo: string;
  cantidad: number;
  referencia: string;
  observacion: string;
  creadoAt: string;
  sincronizado: boolean;
}

export const LocalDb = {
  getQueue(): LocalKardexMovimiento[] {
    const data = localStorage.getItem('apex_pos_sync_queue');
    return data ? JSON.parse(data) : [];
  },

  saveQueue(queue: LocalKardexMovimiento[]) {
    localStorage.setItem('apex_pos_sync_queue', JSON.stringify(queue));
  },

  addToQueue(movimiento: Omit<LocalKardexMovimiento, 'sincronizado'>) {
    const queue = this.getQueue();
    queue.push({
      ...movimiento,
      sincronizado: false
    });
    this.saveQueue(queue);
  },

  markAsSynced(ids: string[]) {
    const queue = this.getQueue();
    const updated = queue.map(item => 
      ids.includes(item.id) ? { ...item, sincronizado: true } : item
    );
    this.saveQueue(updated);
  },

  getUnsynced(): LocalKardexMovimiento[] {
    return this.getQueue().filter(item => !item.sincronizado);
  },

  clearSynced() {
    const queue = this.getQueue();
    const filtered = queue.filter(item => !item.sincronizado);
    this.saveQueue(filtered);
  }
};

import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingDown, Clock, 
  CheckCircle2, X, AlertTriangle, Printer 
} from 'lucide-react';
import { API_V1 } from './config';

interface TurnoManagerProps {
  theme: 'dark' | 'light';
  currentUser: any;
  activeTurno: any;
  onTurnoChange: (turno: any) => void;
  onClose: () => void;
}

export default function TurnoManager({ 
  theme, currentUser, activeTurno, onTurnoChange, onClose 
}: TurnoManagerProps) {
  const [mode, setMode] = useState<'status' | 'open' | 'flow' | 'close' | 'report'>('status');
  
  // Abrir Turno
  const [fondoInicial, setFondoInicial] = useState('500.00');

  // Flujo de Caja
  const [flowTipo, setFlowTipo] = useState<'INGRESO' | 'EGRESO'>('EGRESO');
  const [flowMonto, setFlowMonto] = useState('');
  const [flowMotivo, setFlowMotivo] = useState('');

  // Cerrar Turno
  const [efectivoCierre, setEfectivoCierre] = useState('');
  const [observacionesCierre, setObservacionesCierre] = useState('');

  // Reporte Final
  const [reporte, setReporte] = useState<any | null>(null);

  useEffect(() => {
    if (!activeTurno) {
      setMode('open');
    } else {
      setMode('status');
    }
  }, [activeTurno]);

  const handleOpenTurno = async () => {
    if (!fondoInicial.trim() || isNaN(Number(fondoInicial)) || Number(fondoInicial) < 0) {
      alert('Ingresa un monto de fondo inicial válido.');
      return;
    }

    try {
      const response = await fetch(`${API_V1}/turnos/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: currentUser.id,
          fondoInicial: Number(fondoInicial)
        })
      });
      const data = await response.json();
      if (response.ok) {
        onTurnoChange(data);
        alert('Caja abierta exitosamente.');
        onClose();
      } else {
        alert(data.error || 'No se pudo abrir la caja.');
      }
    } catch (e) {
      alert('Error de red al abrir caja.');
    }
  };

  const handleRegisterFlow = async () => {
    if (!flowMonto.trim() || isNaN(Number(flowMonto)) || Number(flowMonto) <= 0) {
      alert('Ingresa un monto válido.');
      return;
    }
    if (!flowMotivo.trim()) {
      alert('Especifica el motivo del flujo.');
      return;
    }

    try {
      const response = await fetch(`${API_V1}/turnos/flujo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnoId: activeTurno.id,
          tipo: flowTipo,
          monto: Number(flowMonto),
          motivo: flowMotivo.trim()
        })
      });
      if (response.ok) {
        // Recargar datos de turno activo para refrescar flujos
        const resActivo = await fetch(`${API_V1}/turnos/activo/${currentUser.id}`);
        if (resActivo.ok) {
          const data = await resActivo.json();
          onTurnoChange(data);
        }
        alert('Movimiento de caja registrado.');
        setFlowMonto('');
        setFlowMotivo('');
        setMode('status');
      } else {
        alert('No se pudo registrar el movimiento.');
      }
    } catch (e) {
      alert('Error de red al registrar flujo.');
    }
  };

  const handleCloseTurno = async () => {
    if (!efectivoCierre.trim() || isNaN(Number(efectivoCierre)) || Number(efectivoCierre) < 0) {
      alert('Ingresa el monto de efectivo físico en caja.');
      return;
    }

    try {
      const response = await fetch(`${API_V1}/turnos/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turnoId: activeTurno.id,
          efectivoCierre: Number(efectivoCierre),
          observaciones: observacionesCierre.trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setReporte(data.reporte);
        onTurnoChange(null); // Quitar turno activo del estado
        setMode('report');
      } else {
        alert(data.error || 'No se pudo cerrar el turno.');
      }
    } catch (e) {
      alert('Error de red al cerrar el turno.');
    }
  };

  const handlePrintCorte = () => {
    if (!reporte) return;
    const printerMsg = `
=== CORTE DE CAJA ===
Usuario: ${currentUser.nombre}
Fecha: ${new Date().toLocaleString()}
---------------------
Fondo Inicial:   $${reporte.fondoInicial.toFixed(2)}
Ventas Efectivo: $${reporte.ventasEfectivo.toFixed(2)}
Ventas Tarjeta:  $${reporte.ventasTarjeta.toFixed(2)}
Ventas Transf:   $${reporte.ventasTransferencia.toFixed(2)}
Ingresos Caja:   $${reporte.ingresosCaja.toFixed(2)}
Egresos Caja:    $${reporte.egresosCaja.toFixed(2)}
---------------------
Teórico Caja:    $${reporte.efectivoTeorico.toFixed(2)}
Físico Caja:     $${reporte.efectivoDeclarado.toFixed(2)}
Diferencia:      $${reporte.diferencia.toFixed(2)}
=====================
    `;
    alert('Ticket de Corte térmico enviado a la impresora:\n\n' + printerMsg);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-all ${
        theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-dashed border-slate-700/30">
          <h2 className="text-base font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Control de Caja y Turnos
          </h2>
          {mode !== 'open' && mode !== 'report' && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>

        {/* MODO: ABRIR TURNO */}
        {mode === 'open' && (
          <div>
            <div className="text-center mb-6">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2 animate-bounce" />
              <p className="text-sm font-bold text-amber-500">Caja Cerrada</p>
              <p className="text-xs text-slate-500 mt-1">Debes declarar el fondo de efectivo inicial antes de cobrar tu primer ticket.</p>
            </div>
            
            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-2">Fondo Inicial en Efectivo ($)</label>
              <input 
                type="text"
                value={fondoInicial}
                onChange={(e) => setFondoInicial(e.target.value)}
                className={`w-full text-center text-xl font-bold py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-slate-50 border-slate-250 text-slate-900'
                }`}
              />
            </div>

            <button 
              onClick={handleOpenTurno}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <CheckCircle2 className="w-5 h-5" />
              ABRIR TURNO / INICIAR DÍA
            </button>
          </div>
        )}

        {/* MODO: ESTADO ACTUAL */}
        {mode === 'status' && activeTurno && (
          <div>
            <div className="bg-[#13151b] border border-[#20222b] rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">Cajero activo:</span>
                <span className="text-xs font-bold text-white">{currentUser?.nombre}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-slate-500">Apertura:</span>
                <span className="text-xs font-mono text-slate-400">{new Date(activeTurno.abiertoAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[#20222b] pt-2 mt-2">
                <span className="text-xs text-slate-500 font-bold">Fondo Inicial:</span>
                <span className="text-xs font-black text-amber-500">${Number(activeTurno.fondoInicial).toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => setMode('flow')}
                className="py-3 rounded-xl border border-slate-700/50 hover:bg-slate-800/30 transition-all font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Retiros / Entradas
              </button>
              <button 
                onClick={() => setMode('close')}
                className="py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white transition-all font-bold text-xs flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-white" />
                Corte / Cerrar Caja
              </button>
            </div>
            
            <button 
              onClick={onClose}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-xs transition-colors"
            >
              Cerrar Ventana
            </button>
          </div>
        )}

        {/* MODO: RETIROS / ENTRADAS */}
        {mode === 'flow' && (
          <div>
            <div className="flex bg-[#13151b] p-1 rounded-xl mb-4">
              <button 
                onClick={() => setFlowTipo('EGRESO')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${flowTipo === 'EGRESO' ? 'bg-rose-500 text-white' : 'text-slate-500'}`}
              >
                🔴 Salida / Retiro
              </button>
              <button 
                onClick={() => setFlowTipo('INGRESO')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${flowTipo === 'INGRESO' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}
              >
                🟢 Entrada / Cambio
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
              <input 
                type="text" 
                placeholder="0.00"
                value={flowMonto}
                onChange={(e) => setFlowMonto(e.target.value)}
                className={`w-full py-2.5 px-3 rounded-xl border text-sm font-bold ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-slate-50 border-slate-250 text-slate-900'
                }`}
              />
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motivo / Concepto</label>
              <input 
                type="text" 
                placeholder="Ej: Pago a repartidor de refrescos"
                value={flowMotivo}
                onChange={(e) => setFlowMotivo(e.target.value)}
                className={`w-full py-2.5 px-3 rounded-xl border text-sm ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-slate-50 border-slate-250 text-slate-900'
                }`}
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setMode('status')}
                className="flex-1 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:bg-slate-800/30 text-xs font-bold"
              >
                Volver
              </button>
              <button 
                onClick={handleRegisterFlow}
                className={`flex-1 py-3 rounded-xl text-xs font-bold text-slate-950 ${flowTipo === 'EGRESO' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}
              >
                Confirmar Registro
              </button>
            </div>
          </div>
        )}

        {/* MODO: CERRAR CAJA */}
        {mode === 'close' && (
          <div>
            <div className="mb-4 text-center">
              <p className="text-xs text-slate-500">Cuenta todo el efectivo en monedas y billetes dentro del cajón e ingresa el total.</p>
            </div>

            <div className="mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Efectivo Físico en Caja ($)</label>
              <input 
                type="text" 
                placeholder="0.00"
                value={efectivoCierre}
                onChange={(e) => setEfectivoCierre(e.target.value)}
                className={`w-full py-3 px-3 text-center text-xl font-bold rounded-xl border ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-slate-50 border-slate-250 text-slate-900'
                }`}
              />
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observaciones de Cierre (Opcional)</label>
              <textarea 
                placeholder="Escribe algún comentario o descuadre..."
                value={observacionesCierre}
                onChange={(e) => setObservacionesCierre(e.target.value)}
                rows={2}
                className={`w-full py-2.5 px-3 rounded-xl border text-xs ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-slate-50 border-slate-250 text-slate-900'
                }`}
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setMode('status')}
                className="flex-1 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:bg-slate-800/30 text-xs font-bold"
              >
                Cancelar
              </button>
              <button 
                onClick={handleCloseTurno}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold active:scale-95"
              >
                PROCESAR CIERRE
              </button>
            </div>
          </div>
        )}

        {/* MODO: REPORT/RESUMEN FINAL */}
        {mode === 'report' && reporte && (
          <div>
            <div className="text-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-emerald-500">Corte Realizado con Éxito</p>
              <p className="text-[10px] text-slate-500">Turno cerrado oficialmente.</p>
            </div>

            <div className="bg-[#13151b] border border-[#20222b] rounded-xl p-4 text-xs mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500">Fondo Inicial:</span>
                <span className="text-white">${reporte.fondoInicial.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500">Ventas en Efectivo:</span>
                <span className="text-white">${reporte.ventasEfectivo.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 font-bold">Ingresos/Egresos Caja:</span>
                <span className="text-white">${(reporte.ingresosCaja - reporte.egresosCaja).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[#20222b] pt-2 mt-2">
                <span className="text-slate-500 font-bold">Teórico en Efectivo:</span>
                <span className="text-white">${reporte.efectivoTeorico.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500 font-bold">Declarado Físico:</span>
                <span className="text-white">${reporte.efectivoDeclarado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-dashed border-slate-700/50 pt-2 mt-2">
                <span className="font-bold text-slate-400">Diferencia / Arqueo:</span>
                <span className={`font-black text-sm ${reporte.diferencia === 0 ? 'text-emerald-500' : reporte.diferencia > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                  ${reporte.diferencia.toFixed(2)} {reporte.diferencia === 0 ? '(Completo)' : reporte.diferencia > 0 ? '(Sobrante)' : '(Faltante)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handlePrintCorte}
                className="py-3 rounded-xl border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-all font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Corte
              </button>
              <button 
                onClick={() => {
                  onClose();
                  // Forzar recarga de página para bloquear pantalla hasta abrir turno
                  window.location.reload();
                }}
                className="py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs active:scale-95 cursor-pointer"
              >
                Finalizar
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

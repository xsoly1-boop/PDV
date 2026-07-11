import { useState, useEffect } from 'react';
import { 
  X, TrendingUp, ShoppingBag, CreditCard, 
  Users, BarChart2, Award, Download, DollarSign
} from 'lucide-react';
import { API_V1 } from './config';
import { exportVentasCSV } from './services/exportUtils';

interface ReportesDashboardProps {
  theme: 'dark' | 'light';
  onClose: () => void;
}

export default function ReportesDashboard({ theme, onClose }: ReportesDashboardProps) {
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'personalizado'>('hoy');
  const [desde, setDesde] = useState(new Date().toISOString().split('T')[0]);
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0]);
  
  // Data States
  const [ventasDia, setVentasDia] = useState<any>(null);
  const [ventasPeriodo, setVentasPeriodo] = useState<any>(null);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [porCajero, setPorCajero] = useState<any[]>([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<any>({ total: 0, count: 0, clientes: [] });
  
  const isDark = theme === 'dark';

  // Get date range based on quick select
  const getRangeDates = (type: 'hoy' | 'semana' | 'mes') => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'hoy') {
      start = today;
      end = today;
    } else if (type === 'semana') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Lunes
      start = new Date(today.setDate(diff));
      end = new Date();
    } else if (type === 'mes') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date();
    }

    return {
      startStr: start.toISOString().split('T')[0],
      endStr: end.toISOString().split('T')[0]
    };
  };

  const loadData = async () => {
    try {
      let curDesde = desde;
      let curHasta = hasta;

      if (periodo !== 'personalizado') {
        const range = getRangeDates(periodo);
        curDesde = range.startStr;
        curHasta = range.endStr;
      }

      // Fetch Ventas Día (solo si es hoy, o para tener datos de hoy)
      const resDia = await fetch(`${API_V1}/reportes/ventas-dia`);
      if (resDia.ok) {
        setVentasDia(await resDia.ok ? await resDia.json() : null);
      }

      // Fetch Ventas Periodo
      const resPeriodo = await fetch(`${API_V1}/reportes/ventas-periodo?desde=${curDesde}&hasta=${curHasta}`);
      if (resPeriodo.ok) {
        setVentasPeriodo(await resPeriodo.json());
      }

      // Fetch Top Productos
      const resTop = await fetch(`${API_V1}/reportes/top-productos?desde=${curDesde}&hasta=${curHasta}&limit=8`);
      if (resTop.ok) {
        setTopProductos(await resTop.json());
      }

      // Fetch Cajeros
      const resCajeros = await fetch(`${API_V1}/reportes/por-cajero?desde=${curDesde}&hasta=${curHasta}`);
      if (resCajeros.ok) {
        setPorCajero(await resCajeros.json());
      }

      // Fetch Cuentas por Cobrar (Créditos vigentes)
      const resCreditos = await fetch(`${API_V1}/reportes/cuentas-por-cobrar`);
      if (resCreditos.ok) {
        setCuentasPorCobrar(await resCreditos.json());
      }
    } catch (err) {
      console.error('Error cargando reportes:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodo, desde, hasta]);

  const handleExport = () => {
    let curDesde = desde;
    let curHasta = hasta;
    if (periodo !== 'personalizado') {
      const range = getRangeDates(periodo);
      curDesde = range.startStr;
      curHasta = range.endStr;
    }
    exportVentasCSV(curDesde, curHasta);
  };

  // Prepara gráfica de ventas del día por hora
  const renderGraficaVentasDia = () => {
    if (!ventasDia || !ventasDia.porHora) return null;
    const dataHora = ventasDia.porHora;
    const maxVal = Math.max(...Object.values(dataHora).map((h: any) => h.total), 1);
    
    return (
      <div className={`p-6 rounded-2xl border flex flex-col h-[320px] justify-between ${
        isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-amber-500" /> Distribución de Ventas de Hoy (Por Hora)
        </h4>
        
        <div className="flex-1 flex items-end gap-2.5 pb-2">
          {Object.entries(dataHora).map(([horaStr, valObj]: [string, any]) => {
            const hora = Number(horaStr);
            const totalVal = Number(valObj.total);
            const pct = (totalVal / maxVal) * 100;
            return (
              <div key={hora} className="flex-1 flex flex-col items-center group h-full justify-end relative">
                {/* Tooltip */}
                <div className={`absolute bottom-full mb-2 bg-[#000000]/90 text-[10px] text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity font-bold shadow-xl border border-slate-700 whitespace-nowrap z-10`}>
                  ${totalVal.toFixed(1)} ({valObj.tickets} tkt)
                </div>
                {/* Barra */}
                <div 
                  className={`w-full rounded-t-lg transition-all duration-500 ${
                    pct > 0 
                      ? 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:brightness-110 shadow-lg shadow-amber-500/10' 
                      : 'bg-slate-500/5'
                  }`}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                {/* Label */}
                <span className="text-[10px] text-slate-500 mt-2 font-bold">{hora}h</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Totales calculados
  const totalPeriodo = ventasPeriodo?.totalPeriodo || 0;
  const totalTickets = ventasPeriodo?.tickets || 0;
  const ticketPromedio = ventasPeriodo?.ticketPromedio || 0;

  return (
    <div className={`fixed inset-0 z-40 flex flex-col font-sans select-none overflow-y-auto ${
      isDark ? 'bg-[#0b0c10] text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b ${
        isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-md font-bold uppercase tracking-wider">Centro de Reportes y Analíticas</h1>
            <p className="text-[10px] text-slate-500 font-medium">Auditoría, rendimiento de caja e inventario más vendido</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExport}
            className={`flex items-center gap-2 py-2.5 px-4 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
              isDark 
                ? 'bg-transparent border-[#20222b] text-slate-300 hover:bg-[#1a1c24]' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-500" /> Exportar Ventas a CSV
          </button>
          
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl border cursor-pointer transition-colors ${
              isDark ? 'bg-transparent border-[#20222b] text-slate-400 hover:text-white hover:bg-rose-500/10' : 'bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Control Bar: Selector de Periodo */}
      <div className={`p-4 border-b flex items-center justify-between px-6 ${
        isDark ? 'bg-[#151722] border-[#1d1f2b]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          {(['hoy', 'semana', 'mes', 'personalizado'] as const).map(type => (
            <button
              key={type}
              onClick={() => setPeriodo(type)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border-0 cursor-pointer transition-all ${
                periodo === type
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10'
                  : (isDark ? 'bg-[#1d1f2b] text-slate-400 hover:bg-[#252839]' : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm')
              }`}
            >
              {type === 'hoy' && 'Hoy'}
              {type === 'semana' && 'Esta Semana'}
              {type === 'mes' && 'Este Mes'}
              {type === 'personalizado' && 'Rango Personalizado'}
            </button>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex items-center gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Desde:</span>
              <input 
                type="date" 
                className={`p-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-white border-slate-200 shadow-sm'
                }`}
                value={desde}
                onChange={e => setDesde(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Hasta:</span>
              <input 
                type="date" 
                className={`p-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-white border-slate-200 shadow-sm'
                }`}
                value={hasta}
                onChange={e => setHasta(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Row 1: KPI Cards */}
        <div className="grid grid-cols-4 gap-6">
          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Vendido</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-500 mt-2">
              ${Number(totalPeriodo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Tickets Emitidos</span>
              <ShoppingBag className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-500 mt-2">{totalTickets}</p>
          </div>

          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Ticket Promedio</span>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-blue-400 mt-2">
              ${Number(ticketPromedio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Cuentas por Cobrar</span>
              <CreditCard className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black text-rose-450 mt-2">
              ${Number(cuentasPorCobrar.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Row 2: CSS Bar Chart */}
        {renderGraficaVentasDia()}

        {/* Row 3: Product and Employee Rankings */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top Products */}
          <div className={`p-6 rounded-2xl border ${
            isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-amber-500" /> Productos Más Vendidos
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Producto</th>
                    <th className="pb-3 text-right">Cant. Vendida</th>
                    <th className="pb-3 text-right">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {topProductos.length > 0 ? (
                    topProductos.map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-slate-500/5 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-200">{p.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{p.sku}</div>
                        </td>
                        <td className="py-3 text-right text-slate-400 font-semibold">{p.unidades}</td>
                        <td className="py-3 text-right font-black text-emerald-400">${Number(p.ingresos).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500 font-medium">Sin ventas registradas en el periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cajeros Ranking */}
          <div className={`p-6 rounded-2xl border ${
            isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-blue-500" /> Rendimiento de Cajeros
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3">Cajero</th>
                    <th className="pb-3 text-center">Tickets</th>
                    <th className="pb-3 text-right">Total Recaudado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {porCajero.length > 0 ? (
                    porCajero.map((u, idx) => (
                      <tr key={u.id || idx} className="hover:bg-slate-500/5 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-200">{u.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">{u.rol}</div>
                        </td>
                        <td className="py-3 text-center text-slate-400 font-semibold">{u.tickets}</td>
                        <td className="py-3 text-right font-black text-emerald-400">${Number(u.total).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-500 font-medium">Sin datos de cajeros en el periodo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

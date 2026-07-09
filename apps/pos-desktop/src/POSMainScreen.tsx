import { useState, useEffect } from 'react';
import { 
  Search, Wifi, User, Clock, 
  Trash2, Plus, Minus, AlertCircle, 
  Wrench, PackageOpen,
  PauseCircle, Scale, Banknote
} from 'lucide-react';

export default function POSMainScreen() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(2);
  const [activeTab, setActiveTab] = useState(1);

  // Simulamos un carrito EXCLUSIVO del giro Ferretería/Refaccionaria
  const [cart] = useState([
    {
      id: 1,
      sku: 'AUT-881',
      nombre: 'Balatas Delanteras Cerámicas de Alto Rendimiento',
      tipo: 'automotriz',
      metadata: { oem: 'D-1092', compatible: 'Vento 250 / Honda CGL', garantia: '6 Meses' },
      precio: 340.00,
      cantidad: 1,
      unidad: 'pieza'
    },
    {
      id: 2,
      sku: 'FER-092',
      nombre: 'Cable de Cobre Calibre 12 THW Aislamiento Extra',
      tipo: 'ferreteria',
      metadata: { marca: 'Condumex', ubicacion: 'Pasillo 4, Anaquel B', amperaje_max: '25A' },
      precio: 18.00,
      cantidad: 3.5, 
      unidad: 'metros',
      requiereBascula: true
    },
    {
      id: 3,
      sku: 'FER-114',
      nombre: 'Disco Abrasivo Corte Metal 4.5" Extra Fino',
      tipo: 'ferreteria',
      metadata: { marca: 'Dewalt', rpm_max: '13300', uso: 'Industrial' },
      precio: 45.50,
      cantidad: 5,
      unidad: 'piezas'
    }
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const total = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const subtotal = total * 0.84; 
  const iva = total * 0.16;

  const selectedItem = cart.find(item => item.id === selectedItemId);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-300 font-sans selection:bg-amber-500/30">
      
      {/* 1. TOPBAR */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 shadow-xl z-10">
        <div className="flex items-center gap-4 w-1/4">
          <div className="bg-amber-500 text-slate-950 font-black px-4 py-3 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <Wrench className="w-6 h-6" /> POS
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-slate-100 uppercase">Ferretería El Mazo</h1>
            <p className="text-sm text-amber-500/80 font-medium">Suc. Norte - Caja 01</p>
          </div>
        </div>

        {/* Omnibox Touch-Friendly */}
        <div className="flex-1 max-w-3xl px-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-6 h-6 group-focus-within:text-amber-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Escanear código, o buscar SKU, Nombre..." 
              className="w-full bg-slate-950 text-white placeholder-slate-600 border border-slate-700 rounded-2xl py-4 pl-14 pr-4 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-inner"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 w-1/4">
          <div className="flex items-center gap-2 text-amber-500 text-base font-medium">
            <Wifi className="w-5 h-5 animate-pulse" /> Sincronizado
          </div>
          <div className="flex items-center gap-2 font-mono text-base bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-slate-300">
            <Clock className="w-5 h-5 text-slate-500" /> {time}
          </div>
        </div>
      </header>

      {/* 2. ESPACIO DE TRABAJO */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: EL TICKET (Ahora al 60%) */}
        <section className="w-[60%] flex flex-col bg-slate-900 border-r border-slate-800 z-0 shadow-2xl">
          
          {/* SISTEMA DE VENTAS EN ESPERA (Multitasking) */}
          <div className="flex items-end px-4 pt-4 border-b border-slate-800 bg-slate-950/50 gap-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setActiveTab(1)}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-colors border-t border-l border-r ${activeTab === 1 ? 'bg-slate-900 border-slate-700 text-amber-500' : 'bg-slate-950 border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              Ticket #14092 (Actual)
            </button>
            <button 
              onClick={() => setActiveTab(2)}
              className={`flex items-center gap-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-colors border-t border-l border-r ${activeTab === 2 ? 'bg-slate-900 border-slate-700 text-amber-500' : 'bg-slate-950 border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <PauseCircle className="w-4 h-4" /> Ticket #14091 (En Espera)
            </button>
            <button className="flex items-center gap-2 px-4 py-3 rounded-t-xl font-bold text-sm text-slate-400 hover:bg-slate-800 transition-colors">
              <Plus className="w-5 h-5" /> Nuevo
            </button>
          </div>

          <div className="px-6 py-3 flex justify-between items-center bg-slate-900">
            <p className="text-base font-medium text-slate-400">Cliente: <span className="text-slate-200">Público General</span></p>
            <button className="text-amber-500 font-medium text-sm flex items-center gap-2 hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-colors">
              <User className="w-5 h-5" /> Cambiar Cliente
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItemId(item.id)}
                className={`flex gap-4 p-4 bg-slate-800 border cursor-pointer rounded-2xl transition-all group ${
                  selectedItemId === item.id ? 'border-amber-500 bg-slate-800/80 shadow-[0_4px_20px_rgba(245,158,11,0.1)]' : 'border-slate-700'
                }`}
              >
                
                {/* Controles Touch-Friendly */}
                <div className="flex flex-col items-center justify-center gap-3 border-r border-slate-700 pr-4">
                  <button className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition-colors active:scale-95">
                    <Plus className="w-6 h-6" />
                  </button>
                  <span className="font-mono font-black text-2xl w-16 text-center text-slate-100">{item.cantidad}</span>
                  <button className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-amber-500 hover:text-slate-950 transition-colors active:scale-95">
                    <Minus className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-center pl-2">
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <h3 className="font-bold text-xl text-slate-100 leading-tight mb-2">{item.nombre}</h3>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-400 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700">
                          {item.sku}
                        </p>
                        {item.requiereBascula && (
                          <button className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded border border-emerald-400/20 hover:bg-emerald-400/20">
                            <Scale className="w-4 h-4" /> Leer Báscula (COM3)
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-3xl text-white">${(item.precio * item.cantidad).toFixed(2)}</p>
                      <p className="text-sm text-slate-500 line-through mt-1">${((item.precio * item.cantidad) * 1.15).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Botón Eliminar grande para Touch */}
                <button className="text-slate-500 hover:text-red-400 p-4 transition-colors self-center hover:bg-slate-700 rounded-2xl active:scale-95">
                  <Trash2 className="w-8 h-8" />
                </button>
              </div>
            ))}
          </div>

          {/* Totales y Botones de Pago / Anticipos */}
          <div className="p-6 bg-slate-950 border-t border-slate-800">
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-1 w-1/3">
                <div className="flex justify-between text-slate-400 text-lg">
                  <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-lg">
                  <span>IVA (16%)</span><span>${iva.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-medium text-xl mb-1">Gran Total</p>
                <p className="text-6xl font-black text-amber-500 tracking-tighter">${total.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <button className="col-span-2 bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-black py-6 rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-4">
                COBRAR TICKET
                <span className="text-emerald-100 font-mono text-base bg-emerald-800/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">F12</span>
              </button>
              <button className="col-span-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-500 text-lg font-bold py-6 rounded-2xl active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1">
                <Banknote className="w-6 h-6" />
                RECIBIR ANTICIPO
              </button>
            </div>
          </div>
        </section>

        {/* COLUMNA DERECHA: BARRA LATERAL (Ahora al 40%) */}
        <section className="w-[40%] bg-slate-950 flex flex-col z-0 relative">
          
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-6">
                <div className="pb-4 border-b border-slate-800">
                  <h2 className="text-xl font-bold text-slate-100 leading-snug mb-3">{selectedItem.nombre}</h2>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500 font-mono text-base bg-amber-500/10 px-3 py-1.5 rounded border border-amber-500/20">{selectedItem.sku}</span>
                    <span className="text-3xl font-black text-white">${selectedItem.precio.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <PackageOpen className="w-5 h-5" /> Disponibilidad Red
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <span className="font-bold text-amber-500 text-base">Esta Sucursal</span>
                      <span className="font-black text-amber-400 text-2xl">145 <span className="text-sm font-medium">{selectedItem.unidad}</span></span>
                    </div>
                    <div className="flex justify-between items-center p-4 border border-slate-800 rounded-xl text-slate-400 bg-slate-950">
                      <span className="font-medium">Bodega Central</span>
                      <span className="font-bold text-slate-200 text-xl">850</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" /> Especificaciones (Metadata)
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className="border-b border-slate-800/50 pb-3 last:border-0 last:pb-0">
                        <p className="text-xs text-slate-500 capitalize">{key.replace('_', ' ')}</p>
                        <p className="text-base font-bold text-slate-200 mt-1">
                          {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <button className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-slate-200 text-base font-bold py-4 rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
                    <Search className="w-5 h-5 text-amber-500" /> Ver Piezas Compatibles
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* COLA DE PEDIDOS MÓVILES Y COTIZACIONES */}
          <div className="bg-slate-900 border-t border-slate-800 p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                Pedidos Móviles Pendientes (2)
              </h3>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              <div className="min-w-[220px] bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">#PED-0921</span>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">2m ago</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Taller Hermanos Ruiz</p>
                  <p className="text-xs text-slate-500 mt-1">Vend: Juan P. • 4 art.</p>
                </div>
                <p className="text-xl font-black text-amber-500 mt-3">$1,240.00</p>
              </div>

              <div className="min-w-[220px] bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500">#COT-0922</span>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">5m ago</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">Público General</p>
                  <p className="text-xs text-slate-500 mt-1">Vend: Ana G. • 1 art.</p>
                </div>
                <p className="text-xl font-black text-amber-500 mt-3">$85.00</p>
              </div>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}

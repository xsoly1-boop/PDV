import React, { useState, useEffect, useRef } from 'react';

// Enums locales alineados con shared-types para evitar problemas de compilación en el visualizador
enum EstadoRed {
  SINCRONIZADO = 'SINCRONIZADO',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR'
}

interface ProductoSimulado {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  categoria: string;
  stock: number;
}

interface TicketItem {
  producto: ProductoSimulado;
  cantidad: number;
}

const PRODUCTOS_CATALOGO: ProductoSimulado[] = [
  { id: '1', sku: 'PAN001', nombre: 'Pan Dulce (Concha)', precio: 15.00, categoria: 'Panadería', stock: 45 },
  { id: '2', sku: 'PAN002', nombre: 'Birote / Bolillo', precio: 6.50, categoria: 'Panadería', stock: 120 },
  { id: '3', sku: 'REF001', nombre: 'Coca Cola 600ml', precio: 18.50, categoria: 'Bebidas', stock: 80 },
  { id: '4', sku: 'REF002', nombre: 'Agua Purificada 1L', precio: 12.00, categoria: 'Bebidas', stock: 50 },
  { id: '5', sku: 'ABA001', nombre: 'Leche Entera 1L', precio: 26.00, categoria: 'Abarrotes', stock: 35 },
  { id: '6', sku: 'ABA002', nombre: 'Huevo (Cartera 30p)', precio: 85.00, categoria: 'Abarrotes', stock: 15 },
  { id: '7', sku: 'ABA003', nombre: 'Aceite Vegetal 1L', precio: 42.00, categoria: 'Abarrotes', stock: 22 },
  { id: '8', sku: 'ABA004', nombre: 'Arroz Súper 1kg', precio: 24.50, categoria: 'Abarrotes', stock: 60 },
  { id: '9', sku: 'SER001', nombre: 'Recarga Telcel $100', precio: 100.00, categoria: 'Servicios', stock: 999 },
  { id: '10', sku: 'SER002', nombre: 'Recarga Movistar $50', precio: 50.00, categoria: 'Servicios', stock: 999 },
];

export default function POSMainScreen() {
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>('Favoritos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [networkStatus, setNetworkStatus] = useState<EstadoRed>(EstadoRed.SINCRONIZADO);
  
  // Modales
  const [showCheckout, setShowCheckout] = useState<boolean>(false);
  const [showImportQuote, setShowImportQuote] = useState<boolean>(false);
  const [showQtyModal, setShowQtyModal] = useState<boolean>(false);
  
  // Lógica de Cobro
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');
  const [pagoCon, setPagoCon] = useState<string>('');
  const [quoteCode, setQuoteCode] = useState<string>('');
  const [newQty, setNewQty] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const quoteInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Totales
  const subtotal = ticketItems.reduce((acc, item) => acc + (item.producto.precio * item.cantidad), 0);
  const descuento = 0; // Simulador sin descuento por ahora
  const total = subtotal - descuento;
  const cambio = pagoCon ? Math.max(0, Number(pagoCon) - total) : 0;

  // Registrar shortcuts globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (ticketItems.length > 0) {
          setNewQty(ticketItems[ticketItems.length - 1].cantidad.toString());
          setShowQtyModal(true);
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        setShowImportQuote(true);
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (ticketItems.length > 0) {
          setPagoCon('');
          setShowCheckout(true);
        }
      } else if (e.key === 'Escape') {
        setShowCheckout(false);
        setShowImportQuote(false);
        setShowQtyModal(false);
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ticketItems]);

  // Enfocar inputs de modales al abrir
  useEffect(() => {
    if (showCheckout) {
      setTimeout(() => paymentInputRef.current?.focus(), 100);
    }
  }, [showCheckout]);

  useEffect(() => {
    if (showImportQuote) {
      setTimeout(() => quoteInputRef.current?.focus(), 100);
    }
  }, [showImportQuote]);

  useEffect(() => {
    if (showQtyModal) {
      setTimeout(() => qtyInputRef.current?.focus(), 100);
    }
  }, [showQtyModal]);

  // Manejar escaneo/búsqueda
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Buscar producto por SKU o código exacto
    const prod = PRODUCTOS_CATALOGO.find(
      p => p.sku.toLowerCase() === searchQuery.trim().toLowerCase() ||
           p.nombre.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );

    if (prod) {
      addToTicket(prod);
    } else {
      alert(`Producto "${searchQuery}" no encontrado`);
    }
    setSearchQuery('');
  };

  const addToTicket = (producto: ProductoSimulado) => {
    setTicketItems(prev => {
      const idx = prev.findIndex(item => item.producto.id === producto.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
        return updated;
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setTicketItems(prev => {
      return prev.map(item => {
        if (item.producto.id === id) {
          const nuevaCantidad = item.cantidad + delta;
          return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
        }
        return item;
      }).filter((item): item is TicketItem => item !== null);
    });
  };

  const executeQtyChange = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(newQty);
    if (!isNaN(qty) && qty > 0 && ticketItems.length > 0) {
      setTicketItems(prev => {
        const updated = [...prev];
        updated[updated.length - 1].cantidad = qty;
        return updated;
      });
      setShowQtyModal(false);
    }
  };

  const handleImportQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteCode.trim().length === 4) {
      // Simular importación de cotización móvil
      const mockQuoteItems = [
        { producto: PRODUCTOS_CATALOGO[2], cantidad: 3 }, // Coca Cola
        { producto: PRODUCTOS_CATALOGO[4], cantidad: 2 }, // Leche
        { producto: PRODUCTOS_CATALOGO[5], cantidad: 1 }, // Huevo
      ];
      
      setTicketItems(prev => {
        const updated = [...prev];
        mockQuoteItems.forEach(qItem => {
          const idx = updated.findIndex(item => item.producto.id === qItem.producto.id);
          if (idx > -1) {
            updated[idx].cantidad += qItem.cantidad;
          } else {
            updated.push(qItem);
          }
        });
        return updated;
      });

      setShowImportQuote(false);
      setQuoteCode('');
    } else {
      alert('Ingresa un código de cotización de 4 dígitos válido');
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Cobro procesado con éxito!\nMétodo: ${metodoPago}\nTotal: $${total.toFixed(2)}\nPago con: $${pagoCon || total.toFixed(2)}\nCambio: $${cambio.toFixed(2)}`);
    setTicketItems([]);
    setShowCheckout(false);
  };

  const categorias = ['Favoritos', 'Abarrotes', 'Bebidas', 'Panadería', 'Servicios'];
  const productosFiltrados = categoriaActiva === 'Favoritos' 
    ? PRODUCTOS_CATALOGO.slice(0, 8) 
    : PRODUCTOS_CATALOGO.filter(p => p.categoria === categoriaActiva);

  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans select-none overflow-hidden">
      
      {/* 1. Barra Superior (Navbar) */}
      <header className="bg-slate-900 text-white h-16 px-6 flex items-center justify-between shadow-md z-10">
        <div className="flex items-center space-x-4">
          <span className="text-xl font-bold tracking-tight text-emerald-400">APEX POS</span>
          <div className="hidden md:flex space-x-2 text-xs text-slate-400 border-l border-slate-800 pl-4">
            <span>Cajero: <strong className="text-slate-200">Dorian V.</strong></span>
            <span>•</span>
            <span>Caja: <strong className="text-slate-200">Caja 01</strong></span>
            <span>•</span>
            <span>Sucursal: <strong className="text-slate-200">Centro</strong></span>
          </div>
        </div>

        {/* Buscador Captura Código */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Escanear o buscar artículo... [F1]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-96 bg-slate-800 text-white placeholder-slate-500 border border-slate-700 px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tracking-wide transition-all"
            autoFocus
          />
          <button type="submit" className="absolute right-3 text-slate-500 hover:text-white">
            ↵
          </button>
        </form>

        {/* Telemetría Red */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowImportQuote(true)}
            className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <span>⚡ Importar Pedido [F5]</span>
          </button>
          
          <div 
            onClick={() => {
              // Rotar estados de red al dar click para simulación
              setNetworkStatus(prev => {
                if (prev === EstadoRed.SINCRONIZADO) return EstadoRed.OFFLINE;
                if (prev === EstadoRed.OFFLINE) return EstadoRed.ERROR;
                return EstadoRed.SINCRONIZADO;
              });
            }}
            className="flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-850 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
            title="Haz click para simular cambio de estado de red"
          >
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              networkStatus === EstadoRed.SINCRONIZADO ? 'bg-emerald-500' :
              networkStatus === EstadoRed.OFFLINE ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            <span className="text-xs font-medium tracking-wide">
              {networkStatus === EstadoRed.SINCRONIZADO && 'Sincronizado'}
              {networkStatus === EstadoRed.OFFLINE && 'Modo Offline'}
              {networkStatus === EstadoRed.ERROR && 'Error Red'}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Cuerpo Principal */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Columna Izquierda (40%): El Ticket Activo */}
        <section className="w-[40%] flex flex-col bg-white border-r border-slate-200 h-full shadow-lg z-0">
          
          {/* Header Ticket */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800 tracking-tight">Ticket de Venta</h2>
            <span className="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
              Artículos: {ticketItems.reduce((acc, item) => acc + item.cantidad, 0)}
            </span>
          </div>

          {/* Lista de Artículos */}
          <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-slate-100">
            {ticketItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                <span className="text-5xl mb-3">🛒</span>
                <p className="text-sm font-medium">El ticket está vacío</p>
                <p className="text-xs text-slate-400 mt-1">Escanea un artículo o selecciónalo del catálogo</p>
              </div>
            ) : (
              ticketItems.map((item) => (
                <div key={item.producto.id} className="py-3 flex items-center justify-between group">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-sm font-semibold text-slate-850 truncate">{item.producto.nombre}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{item.producto.sku}</p>
                  </div>
                  
                  {/* Cantidades y Precio */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border border-slate-250 rounded-lg overflow-hidden bg-slate-50">
                      <button 
                        onClick={() => updateQuantity(item.producto.id, -1)}
                        className="px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-850 transition-colors font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-semibold text-sm text-slate-850 bg-white min-w-[32px] text-center">
                        {item.cantidad}
                      </span>
                      <button 
                        onClick={() => updateQuantity(item.producto.id, 1)}
                        className="px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-850 transition-colors font-bold text-xs"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right w-24">
                      <span className="text-sm font-bold text-slate-800">
                        ${(item.producto.precio * item.cantidad).toFixed(2)}
                      </span>
                      <p className="text-2xs text-slate-400 font-medium">${item.producto.precio.toFixed(2)} c/u</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Panel Fijo Inferior Totales */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/70 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Descuento</span>
                <span>-${descuento.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>IVA (16%)</span>
                <span>Incluido</span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-800">Gran Total</span>
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => ticketItems.length > 0 && setShowCheckout(true)}
              disabled={ticketItems.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-base tracking-wide flex items-center justify-center space-x-2 shadow-lg transition-all transform active:scale-95 ${
                ticketItems.length > 0 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>COBRAR [F12]</span>
            </button>
          </div>
        </section>

        {/* Columna Derecha (60%): El Catálogo Rápido */}
        <section className="w-[60%] flex flex-col bg-slate-50 h-full overflow-hidden">
          
          {/* Selector de Categorías (Tabs) */}
          <div className="flex border-b border-slate-200 bg-white overflow-x-auto px-4 z-0">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaActiva(cat)}
                className={`px-5 py-4 font-semibold text-sm transition-all focus:outline-none border-b-2 whitespace-nowrap ${
                  categoriaActiva === cat
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de Productos */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {productosFiltrados.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => addToTicket(prod)}
                  className="bg-white border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between h-32 hover:border-emerald-500/50 hover:shadow-md cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
                >
                  <div>
                    <span className="text-2xs font-mono font-medium text-slate-400 block tracking-wider uppercase mb-1">
                      {prod.sku}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                      {prod.nombre}
                    </h4>
                  </div>

                  <div className="flex items-end justify-between mt-2">
                    <span className="text-sm font-extrabold text-slate-900">
                      ${prod.precio.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      prod.stock > 20 ? 'bg-slate-100 text-slate-600' : 'bg-rose-550/10 text-rose-650'
                    }`}>
                      Stk: {prod.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Barra de Atajos e Información de Ayuda */}
          <footer className="bg-slate-200/70 border-t border-slate-250 px-6 py-2 flex items-center justify-between text-xs text-slate-600 font-medium">
            <div className="flex space-x-6">
              <span><kbd className="bg-white px-1.5 py-0.5 rounded shadow text-slate-800 font-semibold mr-1">F1</kbd> Buscar</span>
              <span><kbd className="bg-white px-1.5 py-0.5 rounded shadow text-slate-800 font-semibold mr-1">F2</kbd> Cambiar Cantidad</span>
              <span><kbd className="bg-white px-1.5 py-0.5 rounded shadow text-slate-800 font-semibold mr-1">F5</kbd> Importar Cotización</span>
              <span><kbd className="bg-white px-1.5 py-0.5 rounded shadow text-slate-800 font-semibold mr-1">F12</kbd> Cobrar</span>
            </div>
            <div>
              <span>Presiona <kbd className="bg-white px-1.5 py-0.5 rounded shadow text-slate-800 font-semibold">ESC</kbd> para cerrar cualquier ventana</span>
            </div>
          </footer>
        </section>
      </main>

      {/* ==========================================
          MODALES DE SIMULACIÓN
         ========================================== */}

      {/* 1. Modal de Pago (F12) */}
      {showCheckout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-[480px] shadow-2xl overflow-hidden border border-slate-100 transform scale-100 transition-all duration-300">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Procesar Pago</h3>
              <button onClick={() => setShowCheckout(false)} className="text-slate-400 hover:text-white text-lg">×</button>
            </div>
            
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-6">
              {/* Selector de Método de Pago */}
              <div className="grid grid-cols-3 gap-3">
                {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setMetodoPago(method);
                      if (method !== 'EFECTIVO') setPagoCon(total.toString());
                    }}
                    className={`py-3 rounded-xl border-2 font-bold text-sm tracking-wide transition-all ${
                      metodoPago === method 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Detalle Importes */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-500">Monto a Cobrar</span>
                  <span className="text-2xl font-black text-slate-800">${total.toFixed(2)}</span>
                </div>

                {metodoPago === 'EFECTIVO' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Pago Con</label>
                    <input
                      ref={paymentInputRef}
                      type="number"
                      placeholder={`$${total.toFixed(2)}`}
                      value={pagoCon}
                      onChange={(e) => setPagoCon(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl px-4 py-3 text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 text-center text-xs font-semibold text-slate-500 border border-slate-100">
                    Cobro directo de tarjeta/transferencia en terminal. No aplica cambio en efectivo.
                  </div>
                )}

                {metodoPago === 'EFECTIVO' && (
                  <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-4">
                    <span className="text-sm font-bold text-slate-700">Cambio a entregar</span>
                    <span className="text-2xl font-black text-emerald-600">${cambio.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-sm shadow-md"
                >
                  Registrar Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal de Importación de Cotización (F5) */}
      {showImportQuote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-[400px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base">Importar Cotización Móvil</h3>
              <button onClick={() => setShowImportQuote(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            
            <form onSubmit={handleImportQuoteSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 block uppercase tracking-wider">Código de 4 dígitos (O QR)</label>
                <input
                  ref={quoteInputRef}
                  type="text"
                  maxLength={4}
                  placeholder="Ej: 1403"
                  value={quoteCode}
                  onChange={(e) => setQuoteCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-2xs text-slate-400 text-center leading-normal">
                Ingresa el código proporcionado por el vendedor o simula el escaneo del QR móvil para cargar los artículos directo al ticket.
              </p>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportQuote(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-xs shadow"
                >
                  Cargar Artículos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal de Cambio de Cantidad (F2) */}
      {showQtyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl w-[360px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Cambiar Cantidad</h3>
              <button onClick={() => setShowQtyModal(false)} className="text-slate-400 hover:text-white">×</button>
            </div>
            
            <form onSubmit={executeQtyChange} className="p-6 space-y-4">
              {ticketItems.length > 0 && (
                <div className="text-center space-y-1 mb-2">
                  <p className="text-xs text-slate-400 font-semibold uppercase">Modificar artículo:</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{ticketItems[ticketItems.length - 1].producto.nombre}</p>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-2xs font-bold text-slate-500 block uppercase tracking-wider">Nueva Cantidad</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  placeholder="Cantidad..."
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl px-4 py-2.5 text-center text-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQtyModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold text-xs shadow"
                >
                  Aplicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

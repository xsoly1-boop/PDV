import { useState, useEffect } from 'react';
import { 
  Search, Wifi, User, Clock, 
  Trash2, Plus, Minus, AlertCircle, 
  Wrench, CarFront, PackageOpen, Printer, Zap,
  Sun, Moon, LayoutDashboard, Bookmark, RotateCw, MessageCircle, CheckCircle2, X
} from 'lucide-react';
import { LocalDb } from './db/localDb';
import { SyncService } from './services/SyncService';
import AdminDashboard from './AdminDashboard';
import { API_V1 } from './config';

export default function POSInterface() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(2); // Seleccionamos el cable por defecto
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(LocalDb.getUnsynced().length);

  // Estados de Cotizaciones Centralizadas
  const [activeQuotes, setActiveQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [showImportQuote, setShowImportQuote] = useState(false);
  const [importQuoteCode, setImportQuoteCode] = useState('');
  const [showSaveQuoteModal, setShowSaveQuoteModal] = useState(false);
  const [quoteClientName, setQuoteClientName] = useState('Público General');
  const [savedQuoteResult, setSavedQuoteResult] = useState<any | null>(null);
  const [showSuccessQuoteModal, setShowSuccessQuoteModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  // Estados de Roles y Permisos (RBAC)
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminAuthAction, setAdminAuthAction] = useState<(() => void) | null>(null);
  const [adminAuthPin, setAdminAuthPin] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [discount, setDiscount] = useState(0);

  // Estados de Multisucursal
  const [sucursales] = useState<any[]>([
    { id: 'suc-norte', nombre: 'Sucursal Norte', direccion: 'Calle Falsa 123' },
    { id: 'suc-centro', nombre: 'Sucursal Centro', direccion: 'Av. Madero 450' }
  ]);
  const [selectedSucursalId, setSelectedSucursalId] = useState('suc-norte');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetSucursalId, setTransferTargetSucursalId] = useState('suc-centro');
  const [transferQty, setTransferQty] = useState('1');

  // Estados de Autenticación y Tema
  const [currentUser, setCurrentUser] = useState<{ nombre: string; rol: string } | null>(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentView, setCurrentView] = useState<'pos' | 'admin'>('pos');
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('pos_config');
    return saved ? JSON.parse(saved) : {
      businessName: 'Ferretería y Refaccionaria El Mazo',
      rfc: 'MAZO890412H34',
      currency: 'MXN ($)',
      taxRate: 16,
      address: 'Av. Industrial 405, Zona Centro',
      phone: '449-123-4567',
      logoUrl: '',
    };
  });

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('pos_products');
    return saved ? JSON.parse(saved) : [
      { id: '1', sku: 'AUT-881', codigoBarras: '7501006598214', nombre: 'Balatas Delanteras Cerámicas de Alto Rendimiento', categoria: 'Automotriz', precio: 340.00, costo: 180.00, stock: 15, unidad: 'pieza', metadata: { oem: 'D-1092', compatible: 'Vento 250 / Honda CGL', garantia: '6 Meses' } },
      { id: '2', sku: 'FER-092', codigoBarras: '7501006598221', nombre: 'Cable de Cobre Calibre 12 THW Aislamiento Extra', categoria: 'Ferretería', precio: 18.00, costo: 9.50, stock: 240, unidad: 'metros', metadata: { marca: 'Condumex', ubicacion: 'Pasillo 4, Anaquel B', amperaje_max: '25A' } },
      { id: '3', sku: 'FER-114', codigoBarras: '7501006598238', nombre: 'Disco Abrasivo Corte Metal 4.5" Extra Fino', categoria: 'Ferretería', precio: 45.50, costo: 22.00, stock: 85, unidad: 'piezas', metadata: { marca: 'Dewalt', rpm_max: '13300', uso: 'Industrial' } },
      { id: '4', sku: 'REF-001', codigoBarras: '7501011302722', nombre: 'Coca Cola 600ml', categoria: 'Abarrotes', precio: 18.50, costo: 12.00, stock: 50, unidad: 'piezas', metadata: { marca: 'Coca-Cola' } },
      { id: '5', sku: 'PAN-001', codigoBarras: '7501011302739', nombre: 'Pan Dulce (Concha)', categoria: 'Panadería', precio: 15.00, costo: 8.00, stock: 45, unidad: 'piezas', metadata: { tipo: 'Repostería' } }
    ];
  });



  // Simulamos un carrito EXCLUSIVO del giro Ferretería/Refaccionaria (Tema Oscuro/Industrial premium con la paleta de colores del portal)
  const [cart, setCart] = useState([
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
      cantidad: 3.5, // Fracciones nativas
      unidad: 'metros'
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

  const handleIncrement = (id: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const step = item.unidad === 'metros' ? 0.5 : 1;
        return { ...item, cantidad: parseFloat((item.cantidad + step).toFixed(3)) };
      }
      return item;
    }));
  };

  const handleDecrement = (id: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const step = item.unidad === 'metros' ? 0.5 : 1;
        const newQty = item.cantidad - step;
        return { ...item, cantidad: newQty > 0 ? parseFloat(newQty.toFixed(3)) : 0 };
      }
      return item;
    }).filter(item => item.cantidad > 0));
  };

  const handleRemove = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleAddToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        const step = product.unidad === 'metros' ? 0.5 : 1;
        return prev.map(item => item.sku === product.sku ? { ...item, cantidad: parseFloat((item.cantidad + step).toFixed(3)) } : item);
      }
      return [...prev, {
        id: prev.length + 1,
        sku: product.sku,
        nombre: product.nombre,
        tipo: product.categoria.toLowerCase(),
        metadata: product.metadata || { marca: 'Genérica', ubicacion: 'Mostrador' },
        precio: product.precio,
        cantidad: 1,
        unidad: product.unidad
      }];
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const exactMatch = products.find((p: any) => 
        (p.codigoBarras && p.codigoBarras.toLowerCase() === query) ||
        (p.sku.toLowerCase() === query)
      ) || products.find((p: any) => p.nombre.toLowerCase().includes(query));

      if (exactMatch) {
        handleAddToCart(exactMatch);
        setSearchQuery('');
      } else {
        alert('Ningún producto coincide con el código de barras o SKU ingresado.');
      }
    }
  };

  const fetchActiveQuotes = async () => {
    setLoadingQuotes(true);
    try {
      const response = await fetch(`${API_V1}/cotizaciones`);
      if (response.ok) {
        const data = await response.json();
        setActiveQuotes(data);
      }
    } catch (e) {
      console.log('Error al obtener cotizaciones.');
    } finally {
      setLoadingQuotes(false);
    }
  };

  const handleImportQuote = async (code: string) => {
    if (code.trim().length !== 4) {
      alert('Ingresa un código de cotización de 4 dígitos válido');
      return;
    }
    try {
      const response = await fetch(`${API_V1}/cotizaciones/buscar/${code.trim()}`);
      if (!response.ok) {
        throw new Error('Cotización no encontrada o ya expiró');
      }
      const quote = await response.json();
      
      setCart(prev => {
        const updated = [...prev];
        quote.detalles.forEach((detail: any) => {
          const prod = detail.producto;
          const idx = updated.findIndex(item => item.sku === prod.sku);
          if (idx > -1) {
            updated[idx].cantidad += detail.cantidad;
          } else {
            updated.push({
              id: updated.length + 1,
              sku: prod.sku,
              nombre: prod.nombre,
              tipo: prod.categoria.toLowerCase(),
              metadata: prod.metadata || { marca: 'Genérica', ubicacion: 'Mostrador' },
              precio: Number(prod.precio),
              cantidad: detail.cantidad,
              unidad: prod.unidad
            });
          }
        });
        return updated;
      });

      alert(`Cotización ${quote.folio} importada con éxito.`);
      setShowImportQuote(false);
      setImportQuoteCode('');
      fetchActiveQuotes();
    } catch (e: any) {
      alert(e.message || 'Error al conectar con el servidor.');
    }
  };

  const handleSaveQuote = async () => {
    if (cart.length === 0) return;
    try {
      const response = await fetch(`${API_V1}/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId: 'suc-norte',
          usuarioId: currentUser ? currentUser.nombre : 'cajero-principal',
          clienteNombre: quoteClientName || 'Público General',
          items: cart.map(item => {
            const dbProd = products.find((p: any) => p.sku === item.sku);
            return {
              productoId: dbProd ? dbProd.id : item.id.toString(),
              cantidad: item.cantidad
            };
          })
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar la cotización');
      }

      const result = await response.json();
      setSavedQuoteResult(result);
      setCart([]);
      setShowSaveQuoteModal(false);
      setWhatsAppPhone('');
      setShowSuccessQuoteModal(true);
      fetchActiveQuotes();
    } catch (e: any) {
      alert(e.message || 'Error al guardar la cotización.');
    }
  };

  const shareQuoteOnWhatsApp = (quote: any, phone: string) => {
    if (!phone) {
      alert('Ingresa un número telefónico.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('52') ? cleanPhone : `521${cleanPhone}`;

    let itemDetails = '';
    quote.detalles.forEach((d: any) => {
      const pName = d.producto ? d.producto.nombre : 'Producto';
      itemDetails += `- ${d.cantidad}x ${pName} ($${Number(d.precioUnitario).toFixed(2)})\n`;
    });

    const textMessage = `¡Hola! Te compartimos la cotización de *${config.businessName}*:\n\n*Folio:* ${quote.folio}\n*Código de cobro rápido:* *${quote.codigoCorto}*\n\n*Productos:*\n${itemDetails}\n*Total estimado:* *$${Number(quote.total).toFixed(2)}*\n\nPresenta el código *${quote.codigoCorto}* en la caja rápida de la tienda para realizar tu pago. ¡Gracias por tu preferencia!`;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMessage)}`;
    
    if (window.open) {
      window.open(waUrl, '_blank');
    }
  };

  useEffect(() => {
    fetchActiveQuotes();
    const interval = setInterval(fetchActiveQuotes, 30000);
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        setShowImportQuote(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const checkPermissionAndExecute = (actionName: string, actionCallback: () => void) => {
    console.log(`Verificando permisos para: ${actionName}`);
    if (currentUser?.rol === 'Administrador' || currentUser?.rol === 'Gerente') {
      actionCallback();
    } else {
      setAdminAuthPin('');
      setAdminAuthError('');
      setAdminAuthAction(() => actionCallback);
      setShowAdminAuthModal(true);
    }
  };

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_V1}/auth/autorizar-accion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminAuthPin, accion: 'AUTORIZAR_ACCION' })
      });
      const data = await response.json();
      if (response.ok && data.autorizado) {
        setShowAdminAuthModal(false);
        if (adminAuthAction) {
          adminAuthAction();
        }
      } else {
        setAdminAuthError(data.error || 'PIN de administrador incorrecto o sin privilegios.');
      }
    } catch (err) {
      if (adminAuthPin === '9999') {
        setShowAdminAuthModal(false);
        if (adminAuthAction) {
          adminAuthAction();
        }
      } else {
        setAdminAuthError('PIN de administrador incorrecto (Fallback Offline).');
      }
    }
  };

  const handleExecuteTransfer = async () => {
    if (!selectedItem) return;
    const qtyNum = Number(transferQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      alert('Ingresa una cantidad válida a transferir.');
      return;
    }
    
    try {
      const dbProd = products.find((p: any) => p.sku === selectedItem.sku);
      if (!dbProd) throw new Error('Producto no registrado en catálogo central.');

      const response = await fetch(`${API_V1}/inventario/traspaso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origenSucursalId: selectedSucursalId,
          destinoSucursalId: transferTargetSucursalId,
          usuarioEnviaId: currentUser ? currentUser.nombre : 'Dorian',
          items: [{ productoId: dbProd.id, cantidad: qtyNum }]
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Traspaso de inventario realizado con éxito.');
        setShowTransferModal(false);
        setTransferQty('1');
      } else {
        alert(data.error || 'No se pudo realizar el traspaso.');
      }
    } catch (err: any) {
      alert(err.message || 'Error de red al realizar traspaso.');
    }
  };

  const forceSync = async () => {
    if (!isOnline) {
      alert('Debes estar en línea para sincronizar con la base de datos central.');
      return;
    }
    const res = await SyncService.syncPendingMovimientos();
    if (res.success) {
      alert(`Sincronización exitosa: ${res.processed} movimientos cargados a PostgreSQL.`);
    } else {
      alert(`Fallo en sincronización: ${res.error}`);
    }
    setPendingCount(LocalDb.getUnsynced().length);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Registrar cada producto en la cola del Kardex local
    for (const item of cart) {
      SyncService.registrarMovimientoLocal({
        sucursalId: 'suc-norte',
        productoId: item.sku,
        usuarioId: currentUser ? currentUser.nombre : 'usr-desconocido',
        tipo: 'SALIDA_VENTA',
        cantidad: item.cantidad,
        referencia: 'TKT-14092',
        observacion: 'Venta de mostrador'
      });
    }

    setPendingCount(LocalDb.getUnsynced().length);

    if (isOnline) {
      const res = await SyncService.syncPendingMovimientos();
      if (res.success) {
        alert(`Venta registrada y sincronizada en PostgreSQL central con éxito!\nSaldos procesados: ${res.processed} movimientos.`);
      } else {
        alert(`Venta registrada en base de datos SQLite local (Simulada).\nAlerta de Red: ${res.error}. Se sincronizará automáticamente al detectar conexión.`);
      }
    } else {
      alert(`Modo Offline Activo: Venta guardada en SQLite local. Pendiente por sincronizar.`);
    }

    setCart([]);
    setPendingCount(LocalDb.getUnsynced().length);
  };

  // Manejador del Teclado Numérico para el PIN
  const handleKeypadPress = (val: string) => {
    setLoginError('');
    if (pin.length < 4) {
      const newPin = pin + val;
      setPin(newPin);
      
      // Auto-submit al completar 4 dígitos
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleKeypadDelete = () => {
    setLoginError('');
    setPin(pin.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setLoginError('');
    setPin('');
  };

  const verifyPin = (typedPin: string) => {
    // Simulación de credenciales de sucursales según schema.prisma
    if (typedPin === '1234') {
      setCurrentUser({ nombre: 'Dorian', rol: 'Cajero' });
      setPin('');
    } else if (typedPin === '9999') {
      setCurrentUser({ nombre: 'Carlos M.', rol: 'Administrador' });
      setPin('');
    } else if (typedPin === '5555') {
      setCurrentUser({ nombre: 'Ana G.', rol: 'Agente Ventas' });
      setPin('');
    } else {
      setLoginError('PIN Incorrecto. Intenta nuevamente.');
      setPin('');
    }
  };

  const handleThemeToggle = () => {
    if (currentUser?.rol !== 'Administrador') {
      alert('Acceso Denegado: Solo el Administrador de sistema puede cambiar el tema visual del POS.');
      return;
    }
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handlePrintMock = async () => {
    if (cart.length === 0) {
      alert('Agrega artículos al ticket antes de imprimir.');
      return;
    }
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      const res = await electronAPI.printTicket({
        ticketId: 'TKT-14092',
        cajero: currentUser?.nombre || 'Dorian',
        items: cart,
        total
      });
      alert(res.message);
    } else {
      alert('Impresión (Simulada): Ticket enviado a la cola de impresión térmica web.');
    }
  };

  const handlePrintQuote = async (quote: any) => {
    if (!quote) return;
    const electronAPI = (window as any).electronAPI;
    
    // Si la cotización viene con detalles estructurados
    const formattedItems = quote.detalles ? quote.detalles.map((d: any) => ({
      sku: d.producto.sku,
      nombre: d.producto.nombre,
      precio: Number(d.precioUnitario),
      cantidad: d.cantidad,
      unidad: d.producto.unidad
    })) : cart; // Si no, cae en fallback del carrito actual

    if (electronAPI) {
      const res = await electronAPI.printTicket({
        ticketId: quote.folio || 'COT-TEMP',
        cajero: currentUser?.nombre || 'Dorian',
        items: formattedItems,
        total: Number(quote.total) || total
      });
      alert(`Impresión de Cotización: ${res.message}`);
    } else {
      alert(`Impresión (Simulada): Ticket de Cotización ${quote.codigoCorto} enviado a la impresora.`);
    }
  };

  useEffect(() => {
    // Sincronizar automáticamente al recuperar conexión
    if (isOnline) {
      SyncService.syncPendingMovimientos().then(res => {
        if (res.success && res.processed > 0) {
          console.log(`[Sync] Sincronizados ${res.processed} movimientos.`);
          setPendingCount(LocalDb.getUnsynced().length);
        }
      });
    }
  }, [isOnline]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalBeforeDiscount = cart.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const total = Math.max(0, totalBeforeDiscount - discount);
  const subtotal = total * 0.84; 
  const iva = total * 0.16;

  const selectedItem = cart.find(item => item.id === selectedItemId);

  // 1. RENDER DE PANTALLA DE INGRESO (LOGIN POR PIN)
  if (!currentUser) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen font-sans ${
        theme === 'dark' ? 'bg-[#0d0e12] text-slate-300' : 'bg-slate-50 text-slate-700'
      }`}>
        
        {/* Toggle de Tema en Login */}
        <div className="absolute top-6 right-6">
          <button 
            onClick={handleThemeToggle}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#1a1c24] border-[#262836] text-amber-500 hover:text-amber-400' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
            title="Cambiar tema visual (Solo Administradores)"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className={`border p-8 rounded-3xl w-[400px] shadow-2xl flex flex-col items-center transition-all ${
          theme === 'dark' 
            ? 'bg-[#13151b] border-[#20222b]' 
            : 'bg-white border-slate-200 shadow-slate-200/50'
        }`}>
          
          {/* Logo Hexagonal */}
          <div className="w-16 h-16 bg-amber-500 text-[#0d0e12] font-black rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] mb-4">
            <Wrench className="w-8 h-8" />
          </div>

          <h2 className={`text-xl font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>APEX POS</h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">Ingresar PIN de Acceso Rápido</p>

          {/* Círculos del PIN */}
          <div className="flex gap-4 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div 
                key={idx}
                className={`w-4 h-4 rounded-full border transition-all ${
                  pin.length > idx 
                    ? 'bg-amber-500 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] scale-110' 
                    : theme === 'dark' ? 'bg-transparent border-[#2b2d3a]' : 'bg-transparent border-slate-300'
                }`}
              />
            ))}
          </div>

          {/* Mensaje de Error */}
          {loginError ? (
            <div className="text-rose-500 text-xs font-semibold mb-4 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-4 h-4" /> {loginError}
            </div>
          ) : (
            <div className="text-slate-500 text-[10px] uppercase tracking-widest font-mono mb-4">
              Demo: Cajero (1234) | Admin (9999)
            </div>
          )}

          {/* Teclado Numérico */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num)}
                className={`text-xl font-bold py-3.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-[#1a1c24] hover:bg-[#252837] text-white border-[#262836] hover:border-[#383b4f]' 
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200 hover:border-slate-300'
                }`}
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleKeypadClear}
              className={`text-sm font-bold py-3.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-[#1a1c24] hover:bg-rose-500/10 text-rose-500 border-[#262836] hover:border-rose-500/20' 
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
              }`}
            >
              C
            </button>
            <button
              key="0"
              onClick={() => handleKeypadPress('0')}
              className={`text-xl font-bold py-3.5 rounded-xl border transition-all active:scale-95 cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-[#1a1c24] hover:bg-[#252837] text-white border-[#262836] hover:border-[#383b4f]' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200 hover:border-slate-300'
              }`}
            >
              0
            </button>
            <button
              onClick={handleKeypadDelete}
              className={`text-sm font-bold py-3.5 rounded-xl border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-[#1a1c24] hover:bg-slate-700/20 text-slate-400 border-[#262836] hover:border-slate-700/30' 
                  : 'bg-slate-50 hover:bg-slate-150 text-slate-650 border-slate-200'
              }`}
            >
              ⌫
            </button>
          </div>

        </div>
      </div>
    );
  }

  // 2. RENDER DE LA PANTALLA PRINCIPAL DEL POS
  return (
    <div className={`flex flex-col h-screen font-sans selection:bg-amber-500/30 transition-colors ${
      theme === 'dark' ? 'bg-[#0d0e12] text-slate-300' : 'bg-slate-50 text-slate-700'
    }`}>
      
      {/* 1. TOPBAR (Telemetría y Búsqueda) */}
      <header className={`flex items-center justify-between px-6 py-4 border-b shadow-xl z-10 ${
        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4 w-fit mr-8">
          {config.logoUrl ? (
            <img src={config.logoUrl} alt="Logo" className="w-11 h-11 object-contain rounded-xl bg-white p-1 shadow-sm border border-slate-200" />
          ) : (
            <div className="bg-amber-500 text-slate-950 font-black px-3 py-2 rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.35)] border-0">
              <Wrench className="w-5 h-5 text-slate-955" /> POS
            </div>
          )}
          <div>
            <h1 className={`font-bold text-sm tracking-wide uppercase ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{config.businessName}</h1>
            <p className="text-xs text-amber-500/80 font-medium">Suc. Norte - Caja 01</p>
          </div>
        </div>


        {/* Omnibox */}
        <div className="flex-1 max-w-2xl px-2 mr-auto relative">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-amber-500 transition-colors" />
            <input
              type="text"
              placeholder="Escanear código de barras o escribir SKU/Nombre... (Enter para agregar)"
              className={`w-full rounded-md py-2 pl-8 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-inner ${
                theme === 'dark'
                  ? 'bg-[#090a0d] text-white placeholder-slate-400 border-[#242732]'
                  : 'bg-slate-100 text-slate-900 placeholder-slate-400 border-slate-200'
              }`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-1 py-0.5 rounded font-mono border ${
              theme === 'dark' ? 'bg-[#1b1c24] text-slate-400 border-[#2b2d3a]' : 'bg-white text-slate-500 border-slate-200 shadow-sm'
            }`}>Enter</div>
          </div>

          {/* Autocomplete Dropdown Search Results */}
          {searchQuery.trim() && (
            <div className={`absolute left-2 right-2 mt-1 max-h-60 overflow-y-auto rounded-xl border shadow-2xl z-50 ${
              theme === 'dark' ? 'bg-[#13151b] border-[#262836]' : 'bg-white border-slate-250'
            }`}>
              {products
                .filter((p: any) => 
                  p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (p.codigoBarras && p.codigoBarras.includes(searchQuery))
                )
                .map((product: any) => (
                  <div 
                    key={product.id}
                    onClick={() => {
                      handleAddToCart(product);
                      setSearchQuery('');
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs transition-colors border-b last:border-b-0 ${
                      theme === 'dark' 
                        ? 'border-[#1e202b] hover:bg-slate-800 text-slate-300' 
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{product.nombre}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        SKU: <span className="text-amber-500 font-bold">{product.sku}</span>
                        {product.codigoBarras && (
                          <span className="ml-3">Cód. Barras: <span className="text-slate-400 font-bold">{product.codigoBarras}</span></span>
                        )}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-sm text-amber-500">${product.precio.toFixed(2)}</span>
                  </div>
                ))}
              {products.filter((p: any) => 
                p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.codigoBarras && p.codigoBarras.includes(searchQuery))
              ).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">Ningún artículo coincide con tu búsqueda</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-6 w-1/4">
          
          {/* Botón de Administración */}
          {currentUser && currentUser.rol === 'Administrador' && (
            <button 
              onClick={() => setCurrentView('admin')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border-0 cursor-pointer shadow-md shadow-amber-500/10 active:scale-95"
              title="Ir al Panel de Administración"
            >
              <LayoutDashboard className="w-4 h-4" /> Admin
            </button>
          )}

          {/* Toggle de Tema */}
          <button 
            onClick={handleThemeToggle}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer bg-transparent ${
              theme === 'dark' ? 'border-[#20222b] text-slate-400 hover:text-amber-500' : 'border-slate-200 text-slate-600 hover:text-amber-500 hover:bg-slate-50 shadow-sm'
            }`}
            title="Alternar tema visual Claro / Oscuro (Solo Administradores)"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>


          <div 
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-2 cursor-pointer text-sm font-medium px-2.5 py-1 rounded-lg border transition-colors ${
              isOnline ? 'text-amber-500 border-amber-500/20 bg-amber-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'
            }`}
            title="Simular cambio de red (Clic para alternar)"
          >
            <Wifi className={`w-4 h-4 ${isOnline ? 'animate-pulse' : ''}`} /> 
            <span>{isOnline ? 'Sincronizado' : 'Offline'}</span>
          </div>

          {pendingCount > 0 && (
            <button 
              onClick={forceSync}
              className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors uppercase animate-pulse"
              title="Sincronizar movimientos pendientes"
            >
              🔄 {pendingCount} Sync
            </button>
          )}

          <button 
            onClick={handlePrintMock}
            className={`transition-colors bg-transparent border-0 cursor-pointer ${
              theme === 'dark' ? 'text-slate-400 hover:text-amber-500' : 'text-slate-500 hover:text-amber-500'
            }`} 
            title="Imprimir formato de ticket térmico"
          >
            <Printer className="w-5 h-5" />
          </button>

          {/* Cajero Activo y Botón de Bloqueo */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm border-r pr-3 ${
              theme === 'dark' ? 'text-slate-300 border-[#20222b]' : 'text-slate-600 border-slate-200'
            }`}>
              <User className="w-4 h-4 text-amber-500" /> 
              <span>{currentUser.nombre} <span className="text-[10px] text-slate-400">({currentUser.rol})</span></span>
            </div>
            <button 
              onClick={() => { setCurrentUser(null); setPin(''); setLoginError(''); }}
              className="text-xs text-rose-500 hover:text-rose-455 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors bg-transparent border border-transparent hover:border-rose-500/20 cursor-pointer"
              title="Cerrar sesión / Bloquear terminal"
            >
              Bloquear
            </button>
          </div>

          <div className={`flex items-center gap-2 font-mono text-sm border px-3 py-1.5 rounded-lg ${
            theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
          }`}>
            <Clock className="w-4 h-4 text-slate-500" /> {time}
          </div>
        </div>
      </header>

      {/* 2. ESPACIO DE TRABAJO */}
      <main className="flex flex-1 overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: EL TICKET (Al 60%) */}
        <section className={`w-[60%] flex flex-col border-r z-0 shadow-2xl transition-colors ${
          theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
        }`}>
          
          <div className={`px-8 py-4 border-b flex justify-between items-center ${
            theme === 'dark' ? 'border-[#20222b] bg-[#090a0d]/20' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div>
              <h2 className={`font-bold text-xl ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>Ticket #14092</h2>
              <p className="text-sm text-slate-400">Cliente: Público General</p>
            </div>
            <button className="text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1.5 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-amber-500/20 text-xs bg-transparent cursor-pointer">
              <User className="w-4 h-4" /> Asignar Cliente / RFC
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {cart.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItemId(item.id)}
                className={`flex gap-4 py-2.5 px-4 border cursor-pointer rounded-xl transition-all group ${
                  selectedItemId === item.id 
                    ? 'border-amber-500 bg-amber-500/5 shadow-sm' 
                    : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-[#383b4f]' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                
                {/* Controles de Cantidad */}
                <div className={`flex flex-col items-center justify-center gap-1.5 border-r pr-4 ${
                  theme === 'dark' ? 'border-[#262836]' : 'border-slate-200'
                }`} onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => handleIncrement(item.id)}
                    className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-colors shadow-sm border-0 cursor-pointer ${
                      theme === 'dark' ? 'bg-[#252837] text-slate-300 hover:bg-amber-500 hover:text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-800'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className={`font-mono font-black text-base w-9 text-center ${theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{item.cantidad}</span>
                  <button 
                    onClick={() => handleDecrement(item.id)}
                    className={`w-6.5 h-6.5 rounded-full flex items-center justify-center transition-colors shadow-sm border-0 cursor-pointer ${
                      theme === 'dark' ? 'bg-[#252837] text-slate-300 hover:bg-amber-500 hover:text-slate-950' : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-800'
                    }`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>

                {/* Detalles del Producto */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-start justify-between">
                    <div className="pr-4">
                      <h3 className={`font-bold text-lg leading-tight mb-1 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{item.nombre}</h3>
                      <p className={`text-xs font-mono mb-1 inline-block px-2 py-0.5 rounded border ${
                        theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
                      }`}>
                        {item.sku} • Venta por {item.unidad}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-xl ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>${(item.precio * item.cantidad).toFixed(2)}</p>
                      <p className="text-xs text-slate-400 line-through mt-0.5">${((item.precio * item.cantidad) * 1.15).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Badges Fijos del Vertical */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {item.metadata.ubicacion && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${
                        theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        <PackageOpen className="w-3 h-3 text-amber-500" /> {item.metadata.ubicacion}
                      </span>
                    )}
                    {item.metadata.compatible && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${
                        theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        <CarFront className="w-3 h-3 text-amber-500" /> {item.metadata.compatible}
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); checkPermissionAndExecute('Eliminar Artículo', () => handleRemove(item.id)); }}
                  className="text-slate-500 hover:text-red-400 p-1.5 transition-colors self-center opacity-0 group-hover:opacity-100 hover:bg-slate-500/10 rounded-full border-0 bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className={`p-8 border-t transition-colors ${
            theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex justify-between items-end mb-6">
              <div className="space-y-2 w-1/3">
                <div className="flex justify-between text-slate-400 text-base">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-base">
                  <span>Descuento</span>
                  <button 
                    onClick={() => {
                      checkPermissionAndExecute('Aplicar Descuento', () => {
                        const val = prompt('Ingresa el monto del descuento ($):', discount.toString());
                        if (val !== null) {
                          setDiscount(Number(val) || 0);
                        }
                      });
                    }}
                    className="text-amber-500 font-bold hover:underline cursor-pointer border-0 bg-transparent text-xs"
                  >
                    {discount > 0 ? `-$${discount.toFixed(2)}` : 'Agregar ($)'}
                  </button>
                </div>
                <div className="flex justify-between text-slate-400 text-base">
                  <span>IVA (16%)</span>
                  <span>${iva.toFixed(2)}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-400 font-medium text-lg mb-1">Gran Total</p>
                <p className="text-6xl font-black text-amber-500 tracking-tighter">${total.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black py-3.5 rounded-xl shadow-lg shadow-emerald-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-0 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
              >
                COBRAR TICKET
                <span className="text-emerald-100 font-mono text-xs bg-emerald-800/50 px-2 py-1 rounded border border-emerald-500/30">F12</span>
              </button>
              
              <button 
                onClick={() => {
                  if (cart.length > 0) {
                    setQuoteClientName('Público General');
                    setShowSaveQuoteModal(true);
                  }
                }}
                disabled={cart.length === 0}
                className="bg-[#1a1c24] hover:bg-[#252837] border border-[#2b2d3d] text-amber-500 text-sm font-bold px-5 py-3.5 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Bookmark className="w-5 h-5" />
                COTIZAR
              </button>
            </div>
          </div>
        </section>

        {/* COLUMNA DERECHA: BARRA LATERAL DE INTELIGENCIA (Al 40%) */}
        <section className={`w-[40%] flex flex-col z-0 relative transition-colors ${
          theme === 'dark' ? 'bg-[#0d0e12]' : 'bg-slate-100/50'
        }`}>
          
          <div className="flex-1 p-5 overflow-y-auto">
            {selectedItem ? (
              <div className="space-y-5">
                {/* Encabezado Compacto */}
                <div className={`pb-4 border-b ${theme === 'dark' ? 'border-[#20222b]' : 'border-slate-200'}`}>
                  <h2 className={`text-lg font-bold leading-snug mb-3 ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{selectedItem.nombre}</h2>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500 font-mono text-sm bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{selectedItem.sku}</span>
                    <span className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>${selectedItem.precio.toFixed(2)}</span>
                  </div>
                </div>

                {/* Disponibilidad */}
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <PackageOpen className="w-4 h-4" /> Disponibilidad Red
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <span className="font-medium text-amber-500 text-sm">Esta Sucursal</span>
                      <span className="font-black text-amber-400 text-lg">145 {selectedItem.unidad}</span>
                    </div>
                    <div className={`flex justify-between items-center p-3 border rounded-lg text-sm ${
                      theme === 'dark' ? 'border-[#20222b] text-slate-400 bg-[#0d0e12]' : 'border-slate-200 text-slate-500 bg-slate-50'
                    }`}>
                      <span>Bodega Central</span>
                      <span className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>850 {selectedItem.unidad}</span>
                    </div>
                    <button 
                      onClick={() => setShowTransferModal(true)}
                      className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-[#0d0e12] font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border-0 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" /> Transferir Mercancía
                    </button>
                  </div>
                </div>

                {/* Ficha Técnica */}
                <div className={`p-4 rounded-xl border ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Especificaciones
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(selectedItem.metadata).map(([key, value]) => (
                      <div key={key} className={`border-b pb-2 last:border-0 last:pb-0 ${
                        theme === 'dark' ? 'border-[#20222b]/50' : 'border-slate-100'
                      }`}>
                        <p className="text-[11px] text-slate-500 capitalize">{key.replace('_', ' ')}</p>
                        <p className={`text-sm font-medium mt-0.5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
                          {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : value}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <button className={`w-full mt-4 text-xs font-semibold py-1.5 rounded-lg border transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    theme === 'dark' 
                      ? 'bg-[#252837] hover:bg-[#2e3245] border-[#2c2f42] text-slate-200' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    <Search className="w-3.5 h-3.5 text-amber-500" /> Ver Equivalencias
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* COLA DE PEDIDOS MÓVILES */}
          <div className={`h-44 border-t p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-xs font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                Pedidos Móviles ({activeQuotes.length})
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowImportQuote(true)}
                  className="text-[10px] text-slate-100 bg-[#252837] hover:bg-[#32364c] font-semibold flex items-center gap-1.5 px-2 py-1 rounded border border-[#2c2f42] cursor-pointer border-0"
                >
                  Importar (F5)
                </button>
                <button 
                  onClick={fetchActiveQuotes}
                  className="text-[10px] text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded border border-transparent cursor-pointer border-0"
                >
                  {loadingQuotes ? '...' : 'Sync'} <RotateCw className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {activeQuotes.map((quote) => {
                const date = new Date(quote.createdAt);
                const timeDiff = Math.round((Date.now() - date.getTime()) / 60000);
                const timeText = timeDiff < 1 ? 'Ahora' : `${timeDiff}m`;
                
                return (
                  <div 
                    key={quote.id}
                    onClick={() => handleImportQuote(quote.codigoCorto)}
                    className={`min-w-[180px] border rounded-lg p-3 hover:border-amber-500/50 cursor-pointer transition-all group flex flex-col justify-between ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-slate-500 group-hover:text-amber-500/70">#{quote.codigoCorto}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-[#252837] text-slate-400' : 'bg-slate-200 text-slate-600'}`}>{timeText}</span>
                    </div>
                    <div>
                      <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-slate-200' : 'text-slate-855'}`}>{quote.clienteNombre}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{quote.detalles.length} art. • Cod: {quote.codigoCorto}</p>
                    </div>
                    <p className="text-sm font-black text-amber-500 mt-2">${Number(quote.total).toFixed(2)}</p>
                  </div>
                );
              })}
              {activeQuotes.length === 0 && (
                <div className="w-full flex items-center justify-center h-20">
                  <p className="text-xs text-slate-500 italic">No hay cotizaciones pendientes</p>
                </div>
              )}
            </div>
          </div>

        </section>
      </main>

      {/* MODAL 1: IMPORTAR COTIZACIÓN (F5) */}
      {showImportQuote && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <PackageOpen className="w-5 h-5 text-amber-500" /> Importar Cotización Móvil
              </h3>
              <button 
                onClick={() => setShowImportQuote(false)}
                className="text-slate-500 hover:text-slate-400 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Ingresa el código de 4 dígitos generado desde la aplicación móvil del vendedor para jalar los productos.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleImportQuote(importQuoteCode); }}>
              <input
                type="text"
                maxLength={4}
                placeholder="Ej: 5824"
                className={`w-full text-center text-3xl font-mono font-black tracking-widest rounded-xl py-3 border focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-transparent ${
                  theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-amber-500' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                value={importQuoteCode}
                onChange={(e) => setImportQuoteCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowImportQuote(false)}
                  className={`flex-1 font-bold py-3 rounded-xl border transition-colors cursor-pointer text-sm ${
                    theme === 'dark' ? 'border-[#262836] text-slate-400 bg-transparent hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={importQuoteCode.length !== 4}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-3 rounded-xl transition-colors cursor-pointer border-0 text-sm"
                >
                  Importar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: GUARDAR COTIZACIÓN (DESDE CAJA) */}
      {showSaveQuoteModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-500" /> Guardar Cotización Actual
              </h3>
              <button 
                onClick={() => setShowSaveQuoteModal(false)}
                className="text-slate-500 hover:text-slate-400 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              El ticket actual se guardará en la base de datos central. Podrá cobrarse después ingresando su folio o código.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">Nombre del Cliente / Referencia</label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez / Taller Mecánico"
                  className={`w-full rounded-xl py-3 px-4 border focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-transparent ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  value={quoteClientName}
                  onChange={(e) => setQuoteClientName(e.target.value)}
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowSaveQuoteModal(false)}
                  className={`flex-1 font-bold py-3 rounded-xl border transition-colors cursor-pointer text-sm ${
                    theme === 'dark' ? 'border-[#262836] text-slate-400 bg-transparent hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveQuote}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl transition-colors cursor-pointer border-0 text-sm"
                >
                  Guardar Cotización
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ÉXITO COTIZACIÓN + ENVIAR A WHATSAPP */}
      {showSuccessQuoteModal && savedQuoteResult && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-colors text-center ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl font-black">Cotización Guardada</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono">{savedQuoteResult.folio}</p>
            
            <p className="text-sm text-slate-400 mt-4">Presenta este código de cobro rápido en caja:</p>
            <div className={`my-4 inline-block px-8 py-3 rounded-2xl border-2 border-amber-500 ${
              theme === 'dark' ? 'bg-[#090a0d]' : 'bg-amber-500/5'
            }`}>
              <span className="text-4xl font-black text-amber-500 font-mono tracking-widest">{savedQuoteResult.codigoCorto}</span>
            </div>

            <div className="border-t border-[#20222b]/50 pt-4 mt-6 text-left">
              <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-500" /> Compartir con el Cliente por WhatsApp
              </h4>
              <p className="text-[11px] text-slate-500 mb-3">Ingresa su número para pre-cargar el mensaje con el folio y detalles de compra.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ej: 4491234567"
                  className={`flex-1 rounded-xl py-2 px-3 text-xs border focus:ring-1 focus:ring-emerald-500 focus:outline-none ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  onClick={() => shareQuoteOnWhatsApp(savedQuoteResult, whatsAppPhone)}
                  disabled={!whatsAppPhone}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 transition-colors border-0 cursor-pointer"
                >
                  Enviar Link
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handlePrintQuote(savedQuoteResult)}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition-colors border-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button
                onClick={() => setShowSuccessQuoteModal(false)}
                className="flex-1 bg-[#1a1c24] hover:bg-[#252837] border border-[#2b2d3d] text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer border-0"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de Administración (Overlay de Pantalla Completa) */}
      {currentView === 'admin' && currentUser && (
        <AdminDashboard 
          currentUser={currentUser} 
          theme={theme} 
          onClose={() => setCurrentView('pos')} 
          config={config}
          onConfigChange={(newConfig) => {
            setConfig(newConfig);
            localStorage.setItem('pos_config', JSON.stringify(newConfig));
          }}
          products={products}
          onProductsChange={(newProducts) => {
            setProducts(newProducts);
            localStorage.setItem('pos_products', JSON.stringify(newProducts));
          }}
        />
      )}

      {showAdminAuthModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold uppercase tracking-wider flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" /> Requiere Autorización
              </h3>
              <button 
                onClick={() => setShowAdminAuthModal(false)}
                className="text-slate-500 hover:text-slate-400 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Esta acción requiere la aprobación de un Administrador o Gerente. Por favor, ingresa el PIN de supervisor.
            </p>
            <form onSubmit={handleAdminAuthSubmit}>
              <input
                type="password"
                maxLength={4}
                placeholder="PIN de Supervisor"
                className={`w-full text-center text-2xl font-mono tracking-widest rounded-xl py-2.5 border focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-transparent ${
                  theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-amber-500' : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
                value={adminAuthPin}
                onChange={(e) => setAdminAuthPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              {adminAuthError && (
                <p className="text-rose-500 text-xs font-semibold mt-2 text-center">{adminAuthError}</p>
              )}
              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className={`flex-1 font-bold py-2.5 rounded-xl border transition-colors cursor-pointer text-xs ${
                    theme === 'dark' ? 'border-[#262836] text-slate-400 bg-transparent hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adminAuthPin.length !== 4}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-2.5 rounded-xl transition-colors cursor-pointer border-0 text-xs"
                >
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && selectedItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Traspaso de Inventario
              </h3>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-slate-500 hover:text-slate-400 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Transferir stock del producto <strong className="text-white">{selectedItem.nombre}</strong>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Sucursal Origen</label>
                <select
                  value={selectedSucursalId}
                  onChange={(e) => setSelectedSucursalId(e.target.value)}
                  className={`w-full rounded-xl py-2 px-3 text-xs border ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Sucursal Destino</label>
                <select
                  value={transferTargetSucursalId}
                  onChange={(e) => setTransferTargetSucursalId(e.target.value)}
                  className={`w-full rounded-xl py-2 px-3 text-xs border ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  {sucursales.filter(s => s.id !== selectedSucursalId).map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Cantidad a Transferir ({selectedItem.unidad})</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={`w-full rounded-xl py-2 px-3 text-xs border focus:ring-1 focus:ring-amber-500 focus:outline-none ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className={`flex-1 font-bold py-2.5 rounded-xl border transition-colors cursor-pointer text-xs ${
                    theme === 'dark' ? 'border-[#262836] text-slate-400 bg-transparent hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExecuteTransfer}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl transition-colors cursor-pointer border-0 text-xs"
                >
                  Ejecutar Traspaso
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

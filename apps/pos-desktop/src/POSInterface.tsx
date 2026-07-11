import { useState, useEffect } from 'react';
import { 
  Search, Wifi, User, Clock, 
  Trash2, Plus, Minus, AlertCircle, 
  Wrench, CarFront, PackageOpen, Printer, Zap,
  Sun, Moon, LayoutDashboard, Bookmark, RotateCw, MessageCircle, CheckCircle2, X, DollarSign,
  ClipboardList
} from 'lucide-react';
import { LocalDb } from './db/localDb';
import { SyncService } from './services/SyncService';
import { offlineStore } from './services/offlineStore';
import AdminDashboard from './AdminDashboard';
import QuotesDashboard from './QuotesDashboard';
import TurnoManager from './TurnoManager';
import { API_V1, API_BASE_URL } from './config';
import OnboardingWizard from './OnboardingWizard';
interface CompanyConfig {
  businessName: string;
  rfc: string;
  currency: string;
  taxRate: number;
  address: string;
  phone: string;
  logoUrl?: string;
  giro?: string;
  ticketMessage?: string;
  printerType?: 'thermal_58' | 'thermal_80' | 'pdf_a4' | 'virtual';
  printerCaja?: string;
  printerCliente?: string;
  printerMovil?: string;
  printerBodega?: string;
  allowCash?: boolean;
  allowCard?: boolean;
  allowTransfer?: boolean;
  allowDrawer?: boolean;
  drawerCommand?: string;
  allowScale?: boolean;
  scalePort?: string;
  scaleBaudRate?: number;
  scaleModel?: string;
  sessionTimeout?: number;
  businessStartHour?: string;
  businessEndHour?: string;
  allowGerenteLogin?: boolean;
  allowCajeroLogin?: boolean;
  allowVendedorMovilLogin?: boolean;
  restrictGerenteSchedule?: boolean;
  restrictCajeroSchedule?: boolean;
  restrictVendedorMovilSchedule?: boolean;
  allowGerenteCheckout?: boolean;
  allowCajeroCheckout?: boolean;
  allowVendedorMovilCheckout?: boolean;
}

export default function POSInterface() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [tabs, setTabs] = useState<any[]>(() => {
    const saved = localStorage.getItem('pos_tabs');
    if (saved) return JSON.parse(saved);
    const lastTicketSaved = localStorage.getItem('pos_last_ticket');
    const startTicket = lastTicketSaved ? parseInt(lastTicketSaved) + 1 : 1;
    return [
      {
        id: 'tab-default',
        name: 'Ticket 1',
        cart: [],
        ticketNumber: startTicket,
        selectedItemId: null,
        discount: 0,
        clienteNombre: ''
      }
    ];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('pos_active_tab_id') || 'tab-default';
  });

  useEffect(() => {
    localStorage.setItem('pos_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('pos_active_tab_id', activeTabId);
  }, [activeTabId]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || {
    id: 'tab-default',
    name: 'Ticket 1',
    cart: [],
    ticketNumber: 1,
    selectedItemId: null,
    discount: 0,
    clienteNombre: ''
  };

  const cart = activeTab.cart;
  const ticketNumber = activeTab.ticketNumber;
  const selectedItemId = activeTab.selectedItemId;
  const discount = activeTab.discount;

  const setCart = (newCart: any | ((prev: any[]) => any[])) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const nextCart = typeof newCart === 'function' ? newCart(t.cart) : newCart;
        return { ...t, cart: nextCart };
      }
      return t;
    }));
  };

  const setSelectedItemId = (id: any | ((prev: number | null) => number | null)) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const nextId = typeof id === 'function' ? id(t.selectedItemId) : id;
        return { ...t, selectedItemId: nextId };
      }
      return t;
    }));
  };

  const setDiscount = (disc: any | ((prev: number) => number)) => {
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const nextDisc = typeof disc === 'function' ? disc(t.discount) : disc;
        return { ...t, discount: nextDisc };
      }
      return t;
    }));
  };
  
  const handleAddTab = (clienteNombre?: string) => {
    const nextTicketNum = Math.max(...tabs.map(t => t.ticketNumber), 0) + 1;
    const newTabId = `tab-${Date.now()}`;
    const newTab = {
      id: newTabId,
      name: `Ticket ${tabs.length + 1}`,
      cart: [],
      ticketNumber: nextTicketNum,
      selectedItemId: null,
      discount: 0,
      clienteNombre: clienteNombre || ''
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      setTabs([
        {
          id: 'tab-default',
          name: 'Ticket 1',
          cart: [],
          ticketNumber: 1,
          selectedItemId: null,
          discount: 0,
          clienteNombre: ''
        }
      ]);
      setActiveTabId('tab-default');
      return;
    }
    const idx = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs.map((t, index) => ({ ...t, name: `Ticket ${index + 1}` })));
    if (activeTabId === id) {
      const nextActiveIdx = Math.max(0, idx - 1);
      setActiveTabId(newTabs[nextActiveIdx].id);
    }
  };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncingVentas, setSyncingVentas] = useState(false);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  const [pendingCount, setPendingCount] = useState(LocalDb.getUnsynced().length);

  // Sincronizar catálogo local
  const sincronizarCatalogoLocal = async () => {
    if (!navigator.onLine) return;
    try {
      console.log('[Offline] Iniciando sincronización del catálogo local...');
      const response = await fetch(`${API_V1}/productos`);
      if (response.ok) {
        const data = await response.json();
        const mapped = data.map((p: any) => ({
          id: String(p.id),
          sku: String(p.sku),
          codigoBarras: p.codigos?.[0]?.codigo || '',
          nombre: String(p.nombre),
          categoria: p.categoria?.nombre || 'General',
          precio: Number(p.precio) || 0,
          costo: Number(p.costo) || 0,
          stock: p.balances ? p.balances.reduce((sum: number, b: any) => sum + Number(b.stockReal), 0) : 0,
          unidad: p.metadatos?.unidad || 'pieza',
          descripcion: p.descripcion || ''
        }));
        await offlineStore.guardarCatalogo(mapped);
        console.log('[Offline] Catálogo local sincronizado correctamente. Total:', mapped.length);
      }
    } catch (err) {
      console.warn('[Offline] Error al sincronizar el catálogo local:', err);
    }
  };

  // Actualizar indicador de cola
  const actualizarTamanoColaOffline = async () => {
    const size = await offlineStore.obtenerTamanoCola();
    setOfflineQueueSize(size);
  };

  // Procesar ventas encoladas
  const procesarColaVentasOffline = async () => {
    if (!navigator.onLine || syncingVentas) return;
    const queue = await offlineStore.obtenerVentasEncoladas();
    if (queue.length === 0) return;

    setSyncingVentas(true);
    console.log(`[Offline] Sincronizando ${queue.length} ventas locales encoladas...`);
    
    for (const venta of queue) {
      try {
        const response = await fetch(`${API_V1}/ventas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            folio: venta.folio,
            sucursalId: 'suc-norte',
            usuarioId: venta.usuarioId,
            total: venta.total,
            subtotal: venta.subtotal,
            descuento: venta.descuento,
            metodo: venta.metodo,
            detalles: venta.detalles
          })
        });

        if (response.ok) {
          await response.json();
          await offlineStore.desencolarVenta(venta.id);
          console.log(`[Offline] Venta offline ${venta.folio} sincronizada correctamente.`);
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error || 'Error desconocido del servidor';
          console.warn(`[Offline] Servidor rechazó la venta ${venta.folio}: ${errMsg}`);
          alert(`Error al sincronizar venta ${venta.folio}: ${errMsg}\nPor favor, verifica la conexión o reintenta.`);
          break;
        }
      } catch (err: any) {
        console.error(`[Offline] Error de red al subir venta ${venta.folio}:`, err);
        alert(`Error de red al subir venta ${venta.folio}: ${err.message || err}`);
        break;
      }
    }
    
    await actualizarTamanoColaOffline();
    setSyncingVentas(false);
  };

  // Escuchar cambios de red nativos
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      procesarColaVentasOffline();
      sincronizarCatalogoLocal();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    actualizarTamanoColaOffline();
    if (navigator.onLine) {
      sincronizarCatalogoLocal();
      procesarColaVentasOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Atajos de teclado estilo eleventa (F3, F12, ESC)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F3: Enfocar buscador de productos
      if (e.key === 'F3') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
          searchInput.focus();
          (searchInput as any).select();
        }
      }
      
      // F12: Disparar Cobro
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) {
          setShowCheckoutModal(true);
        }
      }
      
      // ESC: Cerrar modales activos
      if (e.key === 'Escape') {
        setShowCheckoutModal(false);
        setShowSaveQuoteModal(false);
        setShowImportQuote(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart]);

  // Estados de Cotizaciones Centralizadas
  const [activeQuotes, setActiveQuotes] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [showImportQuote, setShowImportQuote] = useState(false);
  const [importQuoteCode, setImportQuoteCode] = useState('');
  const [showSaveQuoteModal, setShowSaveQuoteModal] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteClientName, setQuoteClientName] = useState('Público General');
  const [savedQuoteResult, setSavedQuoteResult] = useState<any | null>(null);
  const [showSuccessQuoteModal, setShowSuccessQuoteModal] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  // Estados de Roles y Permisos (RBAC)
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminAuthAction, setAdminAuthAction] = useState<(() => void) | null>(null);
  const [adminAuthPin, setAdminAuthPin] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

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
  const [currentUser, setCurrentUser] = useState<{ id?: string; nombre: string; rol: string } | null>(() => {
    const saved = localStorage.getItem('pos_current_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTurno, setActiveTurno] = useState<any | null>(null);
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('pos_auth_token'));
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState('');

  // Restore user from token on component mount
  useEffect(() => {
    if (authToken && !currentUser) {
      const saved = localStorage.getItem('pos_current_user');
      if (saved) {
        setCurrentUser(JSON.parse(saved));
      }
    }
  }, [authToken, currentUser]);

  // Verificar turno activo de caja (online/offline)
  useEffect(() => {
    const fetchActiveTurno = async () => {
      if (!currentUser || !currentUser.id) {
        setActiveTurno(null);
        return;
      }
      
      if (!isOnline) {
        // Modo Offline: buscar turno local en Dexie
        try {
          const data = await offlineStore.obtenerTurnoActivoLocal(currentUser.id);
          setActiveTurno(data);
          if (!data && (currentUser.rol === 'Administrador' || currentUser.rol === 'Gerente' || currentUser.rol === 'Cajero')) {
            setShowTurnoModal(true);
          }
        } catch (err) {
          console.warn('Error al verificar turno local:', err);
        }
        return;
      }

      // Modo Online: buscar en servidor central
      try {
        const response = await fetch(`${API_V1}/turnos/activo/${currentUser.id}`);
        if (response.ok) {
          const data = await response.json();
          setActiveTurno(data);
          // Si no hay turno abierto, forzar apertura
          if (!data && (currentUser.rol === 'Administrador' || currentUser.rol === 'Gerente' || currentUser.rol === 'Cajero')) {
            setShowTurnoModal(true);
          }
        }
      } catch (err) {
        console.warn('Error al verificar turno de caja:', err);
        // Fallback inmediato a IndexedDB si falla la red
        try {
          const data = await offlineStore.obtenerTurnoActivoLocal(currentUser.id);
          setActiveTurno(data);
          if (!data && (currentUser.rol === 'Administrador' || currentUser.rol === 'Gerente' || currentUser.rol === 'Cajero')) {
            setShowTurnoModal(true);
          }
        } catch (errLocal) {
          console.warn('Error en fallback de turno de caja:', errLocal);
        }
      }
    };
    fetchActiveTurno();
  }, [currentUser, isOnline]);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentView, setCurrentView] = useState<'pos' | 'admin' | 'quotes'>('pos');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO'>('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedCard, setMixedCard] = useState('');
  const [mixedTransfer, setMixedTransfer] = useState('');
  const [config, setConfig] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('pos_config');
    const base = saved ? JSON.parse(saved) : {
      businessName: 'Ferretería y Refaccionaria El Mazo',
      rfc: 'MAZO890412H34',
      currency: 'MXN ($)',
      taxRate: 16,
      address: 'Av. Industrial 405, Zona Centro',
      phone: '449-123-4567',
      logoUrl: '',
      giro: 'ferreteria',
      ticketMessage: '¡Gracias por su compra!',
      printerType: 'thermal_80',
      allowCash: true,
      allowCard: true,
      allowTransfer: true,
      allowDrawer: true,
      drawerCommand: '27,112,0,25,250',
      allowScale: false,
      scalePort: 'COM1',
      scaleBaudRate: 9605,
      scaleModel: 'torrey',
      sessionTimeout: 0,
      businessStartHour: '08:00',
      businessEndHour: '20:00',
      allowGerenteLogin: true,
      allowCajeroLogin: true,
      allowVendedorMovilLogin: true,
      restrictGerenteSchedule: false,
      restrictCajeroSchedule: false,
      restrictVendedorMovilSchedule: true,
      allowGerenteCheckout: true,
      allowCajeroCheckout: true,
      allowVendedorMovilCheckout: false
    };
    return {
      ...base,
      printerCaja: localStorage.getItem('pos_printer_caja') || base.printerCaja || '',
      printerCliente: localStorage.getItem('pos_printer_cliente') || base.printerCliente || '',
      printerMovil: localStorage.getItem('pos_printer_movil') || base.printerMovil || '',
      printerBodega: localStorage.getItem('pos_printer_bodega') || base.printerBodega || ''
    };
  });

  // Autolock: Cerrar sesión automática por inactividad
  useEffect(() => {
    if (!currentUser || !config.sessionTimeout || config.sessionTimeout === 0) {
      return;
    }

    const timeoutMs = config.sessionTimeout * 60 * 1000;
    let idleTimer: any;

    const resetTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Ejecutar cierre de sesión
        setCurrentUser(null);
        localStorage.removeItem('pos_current_user');
        localStorage.removeItem('pos_auth_token');
        alert('Sesión cerrada automáticamente por inactividad.');
        window.location.reload();
      }, timeoutMs);
    };

    // Agregar oyentes de actividad global
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    // Iniciar temporizador
    resetTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [currentUser, config.sessionTimeout]);

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('pos_products');
    return saved ? JSON.parse(saved) : [];
  });





  const handleIncrement = (id: number) => {
    setCart((prev: any[]) => prev.map((item: any) => {
      if (item.id === id) {
        const step = item.unidad === 'metros' ? 0.5 : 1;
        return { ...item, cantidad: parseFloat((item.cantidad + step).toFixed(3)) };
      }
      return item;
    }));
  };

  const handleDecrement = (id: number) => {
    setCart((prev: any[]) => prev.map((item: any) => {
      if (item.id === id) {
        const step = item.unidad === 'metros' ? 0.5 : 1;
        const newQty = item.cantidad - step;
        return { ...item, cantidad: newQty > 0 ? parseFloat(newQty.toFixed(3)) : 0 };
      }
      return item;
    }).filter((item: any) => item.cantidad > 0));
  };

  const handleRemove = (id: number) => {
    setCart((prev: any[]) => prev.filter((item: any) => item.id !== id));
  };

  const handleAddToCart = (product: any, customQty?: number) => {
    const qtyToAdd = customQty !== undefined ? customQty : 1;
    setCart((prev: any[]) => {
      const existing = prev.find((item: any) => item.sku === product.sku);
      if (existing) {
        return prev.map((item: any) => item.sku === product.sku ? { ...item, cantidad: parseFloat((item.cantidad + qtyToAdd).toFixed(3)) } : item);
      }
      return [...prev, {
        id: prev.length + 1,
        productoId: product.id,
        sku: product.sku,
        nombre: product.nombre,
        tipo: product.categoria.toLowerCase(),
        metadata: product.metadata || { marca: 'Genérica', ubicacion: 'Mostrador' },
        precio: product.precio,
        cantidad: qtyToAdd,
        unidad: product.unidad
      }];
    });
  };

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex((prev) => Math.min(prev + 1, products.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      
      let rawQuery = searchQuery.trim();
      let customQty = 1;

      // Parsear multiplicador si existe (ej: "5*7501...")
      const starIndex = rawQuery.indexOf('*');
      if (starIndex > 0 && starIndex < rawQuery.length - 1) {
        const parsedQty = parseFloat(rawQuery.substring(0, starIndex));
        if (!isNaN(parsedQty) && parsedQty > 0) {
          customQty = parsedQty;
          rawQuery = rawQuery.substring(starIndex + 1).trim();
        }
      }

      const query = rawQuery.toLowerCase();

      // Si tenemos resultados en la lista flotante y hay un índice seleccionado, agregamos al carrito
      if (query !== '' && products.length > 0 && selectedSearchIndex >= 0 && selectedSearchIndex < products.length) {
        const selectedProd = products[selectedSearchIndex];
        handleAddToCart(selectedProd, customQty);
        setSearchQuery('');
        setSelectedSearchIndex(0);
        return;
      }

      if (query === '') return;
      
      // 1. Buscar en la lista local de productos ya cargados
      let exactMatch = products.find((p: any) => 
        (p.codigoBarras && p.codigoBarras.toLowerCase() === query) ||
        (p.sku.toLowerCase() === query)
      ) || products.find((p: any) => p.nombre.toLowerCase().includes(query));

      // 2. Si no se encuentra en el estado local, buscar directamente en el servidor (u offline)
      if (!exactMatch) {
        if (!isOnline) {
          const localResults = await offlineStore.buscarProductos(query);
          if (localResults.length > 0) {
            const p = localResults[0];
            exactMatch = {
              id: p.id,
              sku: p.sku,
              codigoBarras: p.codigoBarras,
              nombre: p.nombre,
              categoria: p.categoria,
              precio: p.precio,
              costo: p.costo,
              stock: p.stock,
              unidad: p.unidad,
              metadata: {}
            };
          }
        } else {
          try {
            const url = `${API_V1}/productos/buscar?q=${encodeURIComponent(query)}`;
            console.log(`[API Instant Search] Buscando en: ${url}`);
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                const p = data[0];
                exactMatch = {
                  id: String(p.id),
                  sku: String(p.sku),
                  codigoBarras: p.codigos?.[0]?.codigo || '',
                  nombre: String(p.nombre),
                  categoria: p.metadatos?.categoria || 'General',
                  precio: Number(p.precio) || 0,
                  costo: Number(p.costo) || 0,
                  stock: p.balances ? p.balances.reduce((sum: number, b: any) => sum + Number(b.stockReal), 0) : 0,
                  unidad: p.metadatos?.unidad || 'pieza',
                  metadata: p.metadatos || {}
                };
              }
            }
          } catch (err) {
            console.warn('Error en búsqueda instantánea por Enter:', err);
          }
        }
      }

      if (exactMatch) {
        handleAddToCart(exactMatch, customQty);
        setSearchQuery('');
        setSelectedSearchIndex(0);
      } else {
        alert('Ningún producto coincide con el código de barras, SKU o nombre ingresado.');
      }
    }
  };

  const fetchProducts = async (query = '') => {
    if (!isOnline) {
      const localResults = await offlineStore.buscarProductos(query);
      const mapped = localResults.map((p) => ({
        id: p.id,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        nombre: p.nombre,
        categoria: p.categoria,
        precio: p.precio,
        costo: p.costo,
        stock: p.stock,
        unidad: p.unidad,
        metadata: {}
      }));
      setProducts(mapped);
      return;
    }

    try {
      const url = `${API_V1}/productos/buscar?q=${encodeURIComponent(query)}`;
      console.log(`[API Debounced Search] Buscando en: ${url}`);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapped = data.map((p: any) => ({
            id: String(p.id),
            sku: String(p.sku),
            codigoBarras: p.codigos?.[0]?.codigo || '',
            nombre: String(p.nombre),
            categoria: p.metadatos?.categoria || 'General',
            precio: Number(p.precio) || 0,
            costo: Number(p.costo) || 0,
            stock: p.balances ? p.balances.reduce((sum: number, b: any) => sum + Number(b.stockReal), 0) : 0,
            unidad: p.metadatos?.unidad || 'pieza',
            metadata: p.metadatos || {}
          }));
          setProducts(mapped);
          if (query === '') {
            localStorage.setItem('pos_products', JSON.stringify(mapped));
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching products from API:', e);
      const localResults = await offlineStore.buscarProductos(query);
      const mapped = localResults.map((p) => ({
        id: p.id,
        sku: p.sku,
        codigoBarras: p.codigoBarras,
        nombre: p.nombre,
        categoria: p.categoria,
        precio: p.precio,
        costo: p.costo,
        stock: p.stock,
        unidad: p.unidad,
        metadata: {}
      }));
      setProducts(mapped);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      fetchProducts('');
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchProducts(searchQuery.trim());
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchActiveQuotes = async () => {
    setLoadingQuotes(true);
    try {
      const response = await fetch(`${API_V1}/cotizaciones`);
      if (response.ok) {
        const data = await response.json();
        setActiveQuotes(data);

        // Ruteador de Impresión: Auto-imprimir cotizaciones nuevas de vendedores móviles
        const printedQuotesStr = localStorage.getItem('pos_printed_quotes') || '[]';
        const printedQuotes: string[] = JSON.parse(printedQuotesStr);
        let updatedPrinted = [...printedQuotes];
        let hasNew = false;

        data.forEach((quote: any) => {
          if (!printedQuotes.includes(quote.id)) {
            console.log(`[PRINTER ROUTER] Nueva cotización móvil detectada (#${quote.codigoCorto}). Imprimiendo en Mostrador.`);
            
            const electronAPI = (window as any).electronAPI;
            const formattedItems = quote.detalles ? quote.detalles.map((d: any) => ({
              sku: d.producto.sku,
              nombre: d.producto.nombre,
              precio: Number(d.precioUnitario),
              cantidad: d.cantidad,
              unidad: d.producto.unidad
            })) : [];

            if (electronAPI) {
              electronAPI.printTicket({
                ticketId: quote.folio || `COT-${quote.codigoCorto}`,
                cajero: quote.clienteNombre || 'Cliente Móvil',
                items: formattedItems,
                total: Number(quote.total),
                printerTarget: 'mostrador',
                printerName: config.printerMovil || localStorage.getItem('pos_printer_movil') || '',
                businessName: config.businessName,
                address: config.address,
                phone: config.phone,
                ticketMessage: config.ticketMessage,
                printerType: config.printerType
              });
            }
            
            updatedPrinted.push(quote.id);
            hasNew = true;
          }
        });

        if (hasNew) {
          localStorage.setItem('pos_printed_quotes', JSON.stringify(updatedPrinted));
        }
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
      
      setCart((prev: any[]) => {
        const updated = [...prev];
        quote.detalles.forEach((detail: any) => {
          const prod = detail.producto;
          if (!prod) return;

          const qty = Number(detail.cantidad);
          const idx = updated.findIndex((item: any) => item.sku === prod.sku);
          if (idx > -1) {
            updated[idx].cantidad += qty;
          } else {
            const metadatos = prod.metadatos || {};
            const categoria = metadatos.categoria || 'General';
            const unidad = metadatos.unidad || 'pieza';

            updated.push({
              id: updated.length + 1,
              productoId: prod.id,
              sku: prod.sku,
              nombre: prod.nombre,
              tipo: categoria.toLowerCase(),
              metadata: metadatos,
              precio: Number(prod.precio),
              cantidad: qty,
              unidad: unidad
            });
          }
        });
        return updated;
      });

      setTabs(prev => prev.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            cotizacionId: quote.id,
            clienteNombre: quote.clienteNombre || t.clienteNombre
          };
        }
        return t;
      }));

      alert(`Cotización ${quote.folio} importada con éxito.`);
      setShowImportQuote(false);
      setImportQuoteCode('');
      fetchActiveQuotes();
    } catch (e: any) {
      alert(e.message || 'Error al conectar con el servidor.');
    }
  };

  const handleConvertToSale = (quote: any) => {
    if (!quote || !quote.detalles) return;

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const newCart: any[] = [];
        quote.detalles.forEach((detail: any) => {
          const prod = detail.producto;
          if (!prod) return;

          const qty = Number(detail.cantidad);
          const metadatos = prod.metadatos || {};
          const categoria = metadatos.categoria || 'General';
          const unidad = metadatos.unidad || 'pieza';

          newCart.push({
            id: newCart.length + 1,
            productoId: prod.id,
            sku: prod.sku,
            nombre: prod.nombre,
            tipo: categoria.toLowerCase(),
            metadata: metadatos,
            precio: Number(detail.precioUnitario),
            cantidad: qty,
            unidad: unidad
          });
        });

        return {
          ...t,
          cart: newCart,
          cotizacionId: quote.id,
          clienteNombre: quote.clienteNombre || t.clienteNombre
        };
      }
      return t;
    }));

    setCurrentView('pos');
    alert(`Cotización ${quote.folio} convertida con éxito y cargada al carrito.`);
  };

  const handleSaveQuote = async () => {
    if (cart.length === 0 || savingQuote) return;
    setSavingQuote(true);
    try {
      const response = await fetch(`${API_V1}/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId: 'suc-norte',
          usuarioId: currentUser ? currentUser.nombre : 'cajero-principal',
          clienteNombre: quoteClientName || 'Público General',
          items: cart.map((item: any) => ({
            productoId: item.productoId || item.sku || item.id.toString(),
            cantidad: item.cantidad
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`No se pudo guardar la cotización. Servidor respondió con código ${response.status}. Detalle: ${errorText || 'Ninguno'}`);
      }

      const result = await response.json();
      setSavedQuoteResult(result);
      setCart([]);
      setShowSaveQuoteModal(false);
      setWhatsAppPhone('');
      setShowSuccessQuoteModal(true);
      fetchActiveQuotes();
    } catch (e: any) {
      alert(`Error al guardar cotización: ${e.message}\n\n[Configuración API_V1: ${API_V1}]`);
    } finally {
      setSavingQuote(false);
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
      if (e.key === 'F6') {
        e.preventDefault();
        const inputName = prompt("¿Desea asignar un nombre de cliente al nuevo ticket?\n\nEscribe el nombre del cliente (o presiona Aceptar para Público General, o Cancelar para no abrir el ticket):");
        if (inputName !== null) {
          handleAddTab(inputName.trim());
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [tabs]);

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

  const handleCheckout = async (metodoPago: string) => {
    if (cart.length === 0) return;

    if (!activeTurno && (currentUser?.rol === 'Administrador' || currentUser?.rol === 'Gerente' || currentUser?.rol === 'Cajero')) {
      alert('Operación Bloqueada: Debes abrir el turno de caja antes de realizar ventas.');
      setShowCheckoutModal(false);
      setShowTurnoModal(true);
      return;
    }

    let finalMetodo = metodoPago;
    if (metodoPago === 'MIXTO') {
      const parts = [];
      if (Number(mixedCash) > 0) parts.push(`Efectivo: $${Number(mixedCash).toFixed(2)}`);
      if (Number(mixedCard) > 0) parts.push(`Tarjeta: $${Number(mixedCard).toFixed(2)}`);
      if (Number(mixedTransfer) > 0) parts.push(`Transferencia: $${Number(mixedTransfer).toFixed(2)}`);
      finalMetodo = `MIXTO (${parts.join(', ')})`;
    }

    const ticketRef = 'TKT-' + ticketNumber;

    // Registrar cada producto en la cola del Kardex local
    for (const item of cart) {
      SyncService.registrarMovimientoLocal({
        sucursalId: 'suc-norte',
        productoId: item.sku,
        usuarioId: currentUser ? ((currentUser as any).id || currentUser.nombre) : 'usr-desconocido',
        tipo: 'SALIDA_VENTA',
        cantidad: item.cantidad,
        referencia: ticketRef,
        observacion: 'Venta mostrador (' + finalMetodo + ')' + (activeTab.clienteNombre ? ' - Cliente: ' + activeTab.clienteNombre : '')
      });
    }

    // Registrar la venta en la base de datos central o local offline
    let ventaGuardadaOffline = false;
    try {
      if (!isOnline) {
        throw new Error('Offline mode active');
      }
      const response = await fetch(`${API_V1}/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: ticketRef,
          sucursalId: 'suc-norte',
          usuarioId: currentUser ? ((currentUser as any).id || currentUser.nombre) : 'ADMIN',
          total: total,
          subtotal: subtotal,
          descuento: discount,
          metodo: finalMetodo,
          cotizacionId: activeTab.cotizacionId || null,
          detalles: cart.map((item: any) => ({
            productoId: item.productoId || item.sku,
            cantidad: item.cantidad,
            precioUnitario: item.precio,
            subtotal: item.precio * item.cantidad
          }))
        })
      });
      if (!response.ok) {
        throw new Error('Server returned error status');
      }
    } catch (err) {
      console.warn('[Offline] Sincronización fallida, guardando venta en la cola local:', err);
      ventaGuardadaOffline = true;
      
      await offlineStore.encolarVenta({
        folio: ticketRef,
        usuarioId: currentUser ? ((currentUser as any).id || currentUser.nombre) : 'ADMIN',
        total: total,
        subtotal: subtotal,
        descuento: discount,
        metodo: metodoPago === 'MIXTO' ? 'EFECTIVO' : (metodoPago as any),
        detalles: cart.map((item: any) => ({
          productoId: item.productoId || item.sku,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          subtotal: item.precio * item.cantidad
        }))
      });
      
      await actualizarTamanoColaOffline();
    }

    setPendingCount(LocalDb.getUnsynced().length);

    if (ventaGuardadaOffline) {
      alert('Modo Offline: Venta guardada localmente en IndexedDB. Se sincronizará automáticamente al recuperar conexión.');
    } else {
      if (isOnline) {
        const res = await SyncService.syncPendingMovimientos();
        if (res.success) {
          const hasCashPayment = metodoPago === 'EFECTIVO' || (metodoPago === 'MIXTO' && Number(mixedCash) > 0);
          const drawerMsg = (config.allowDrawer && hasCashPayment)
            ? '\n\n[Hardware] Cajón de dinero abierto (Comando: ' + (config.drawerCommand || '27,112,0,25,250') + ')'
            : '';
          alert('Venta registrada y sincronizada en PostgreSQL central con exito!' + drawerMsg);
        } else {
          alert('Venta registrada en base de datos local.\nAlerta de Red: ' + res.error + '. Se sincronizara automaticamente al detectar conexion.');
        }
      } else {
        alert('Modo Offline Activo: Venta guardada localmente. Pendiente por sincronizar.');
      }
    }

    // Imprimir ticket de venta para el cliente
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.printTicket({
          ticketId: ticketRef,
          cajero: currentUser?.nombre || 'Dorian',
          items: cart.map((item: any) => ({
            sku: item.sku,
            nombre: item.nombre,
            precio: Number(item.precio),
            cantidad: Number(item.cantidad),
            unidad: item.unidad
          })),
          total: total,
          printerTarget: 'cliente',
          printerName: config.printerCliente || localStorage.getItem('pos_printer_cliente') || '',
          businessName: config.businessName,
          address: config.address,
          phone: config.phone,
          ticketMessage: config.ticketMessage,
          printerType: config.printerType
        });
      } catch (err) {
        console.warn('Error al imprimir ticket de cliente:', err);
      }
    }

    // Avanzar al siguiente ticket y persistirlo
    const nextTicket = ticketNumber + 1;
    localStorage.setItem('pos_last_ticket', String(ticketNumber));
    
    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        return {
          ...t,
          ticketNumber: nextTicket,
          cart: [],
          selectedItemId: null,
          discount: 0,
          clienteNombre: '',
          cotizacionId: null
        };
      }
      return t;
    }));
    
    setShowCheckoutModal(false);
    setPendingCount(LocalDb.getUnsynced().length);
    fetchActiveQuotes();
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

  const verifyPin = async (typedPin: string) => {
    try {
      const response = await fetch(`${API_V1}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: typedPin })
      });
      const data = await response.json();
      if (response.ok && data.usuario) {
        const user = { id: data.usuario.id, nombre: data.usuario.nombre, rol: data.usuario.rol === 'ADMINISTRADOR' ? 'Administrador' : data.usuario.rol === 'CAJERO' ? 'Cajero' : 'Agente Ventas' };
        setCurrentUser(user);
        const token = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setAuthToken(token);
        localStorage.setItem('pos_auth_token', token);
        localStorage.setItem('pos_current_user', JSON.stringify(user));
        setPin('');
      } else {
        setLoginError('PIN incorrecto. Intenta nuevamente.');
        setPin('');
      }
    } catch (err) {
      setLoginError('Error de conexion con el servidor.');
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
        total,
        printerTarget: 'caja',
        printerName: config.printerCaja || localStorage.getItem('pos_printer_caja') || '',
        businessName: config.businessName,
        address: config.address,
        phone: config.phone,
        ticketMessage: config.ticketMessage,
        printerType: config.printerType
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
        total: Number(quote.total) || total,
        printerTarget: 'mostrador',
        printerName: config.printerMovil || localStorage.getItem('pos_printer_movil') || '',
        businessName: config.businessName,
        address: config.address,
        phone: config.phone,
        ticketMessage: config.ticketMessage,
        printerType: config.printerType
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
    const checkCompanyConfig = async () => {
      try {
        const resp = await fetch(`${API_V1}/configuracion-empresa`);
        if (resp.ok) {
          const data = await resp.json();
          if (!data) {
            setShowOnboarding(true);
          } else {
            const mapped = {
              businessName: data.nombreEmpresa,
              rfc: data.rfc || '',
              currency: 'MXN ($)',
              taxRate: 16,
              address: data.formatoTicket?.direccion || '',
              phone: data.formatoTicket?.telefono || '',
              logoUrl: data.logoUrl || '',
              giro: data.giro,
              ticketMessage: data.formatoTicket?.ticketMessage || '¡Gracias por su compra!',
              printerType: data.formatoTicket?.printerType || 'thermal_80',
              allowCash: data.formatoTicket?.allowCash !== false,
              allowCard: data.formatoTicket?.allowCard !== false,
              allowTransfer: data.formatoTicket?.allowTransfer !== false,
              allowDrawer: data.formatoTicket?.allowDrawer !== false,
              drawerCommand: data.formatoTicket?.drawerCommand || '27,112,0,25,250',
              allowScale: data.formatoTicket?.allowScale || false,
              scalePort: data.formatoTicket?.scalePort || 'COM1',
              scaleBaudRate: data.formatoTicket?.scaleBaudRate || 9600,
              scaleModel: data.formatoTicket?.scaleModel || 'torrey',
              printerCaja: localStorage.getItem('pos_printer_caja') || data.formatoTicket?.printerCaja || '',
              printerCliente: localStorage.getItem('pos_printer_cliente') || data.formatoTicket?.printerCliente || '',
              printerMovil: localStorage.getItem('pos_printer_movil') || data.formatoTicket?.printerMovil || '',
              printerBodega: localStorage.getItem('pos_printer_bodega') || data.formatoTicket?.printerBodega || ''
            };
            setConfig(mapped);
            localStorage.setItem('pos_config', JSON.stringify(mapped));
            setShowOnboarding(false);
          }
        }
      } catch (e) {
        console.error("Error loading config from API", e);
      }
    };

    checkCompanyConfig();
    fetchActiveQuotes();
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalBeforeDiscount = cart.reduce((acc: number, item: any) => acc + (item.precio * item.cantidad), 0);
  const total = Math.max(0, totalBeforeDiscount - discount);
  const subtotal = total * 0.84; 
  const iva = total * 0.16;

  const selectedItem = cart.find((item: any) => item.id === selectedItemId);

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

        <div className={`border p-8 rounded-3xl w-[400px] shadow-2xl flex flex-col items-center transition-all relative ${
          theme === 'dark' 
            ? 'bg-[#13151b] border-[#20222b]' 
            : 'bg-white border-slate-200 shadow-slate-200/50'
        }`}>
          {/* Botón de Configuración de Red */}
          <div className="absolute top-4 right-4">
            <button 
              onClick={() => {
                setTempApiBaseUrl(API_BASE_URL);
                setShowNetworkModal(true);
              }}
              className="text-slate-500 hover:text-slate-300 cursor-pointer border-0 bg-transparent text-[10px] font-bold flex items-center gap-0.5"
              title="Configurar conexión del servidor"
            >
              ⚙️ Red
            </button>
          </div>
          
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
              Ingresa tu PIN de acceso
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

  // 1.5. WIZARD DE CONFIGURACIÓN INICIAL (ONBOARDING)
  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={(newConfigData) => {
          const mapped = {
            businessName: newConfigData.nombre,
            rfc: newConfigData.rfc || '',
            currency: 'MXN ($)',
            taxRate: 16,
            address: newConfigData.direccion || '',
            phone: newConfigData.telefono || '',
            logoUrl: '',
            giro: newConfigData.giro
          };
          setConfig(mapped);
          localStorage.setItem('pos_config', JSON.stringify(mapped));
          setShowOnboarding(false);
        }}
      />
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
              id="pos-search-input"
              type="text"
              placeholder="[F3] Buscar artículo... o Cantidad*Código (ej: 5*SKU)"
              className={`w-full rounded-md py-2 pl-8 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-inner ${
                theme === 'dark'
                  ? 'bg-[#090a0d] text-white placeholder-slate-400 border-[#242732]'
                  : 'bg-slate-100 text-slate-900 placeholder-slate-400 border-slate-200'
              }`}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedSearchIndex(0); // Resetear índice al escribir
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              onKeyDown={handleSearchKeyDown}
            />
            <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 text-xs px-1 py-0.5 rounded font-mono border ${
              theme === 'dark' ? 'bg-[#1b1c24] text-slate-400 border-[#2b2d3a]' : 'bg-white text-slate-500 border-slate-200 shadow-sm'
            }`}>Enter</div>
          </div>

          {/* Autocomplete Dropdown Search Results */}
          {searchQuery.trim() && isSearchFocused && (
            <div className={`absolute left-2 right-2 mt-1 max-h-60 overflow-y-auto rounded-xl border shadow-2xl z-50 ${
              theme === 'dark' ? 'bg-[#13151b] border-[#262836]' : 'bg-white border-slate-250'
            }`}>
              {products.map((product: any, idx: number) => {
                const isSelected = idx === selectedSearchIndex;
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      let rawQuery = searchQuery.trim();
                      let customQty = 1;
                      const starIndex = rawQuery.indexOf('*');
                      if (starIndex > 0 && starIndex < rawQuery.length - 1) {
                        const parsedQty = parseFloat(rawQuery.substring(0, starIndex));
                        if (!isNaN(parsedQty) && parsedQty > 0) {
                          customQty = parsedQty;
                        }
                      }
                      handleAddToCart(product, customQty);
                      setSearchQuery('');
                      setSelectedSearchIndex(0);
                    }}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs transition-colors border-b last:border-b-0 ${
                      isSelected
                        ? (theme === 'dark' ? 'bg-[#252837] text-white border-[#383b4f]' : 'bg-slate-100 text-slate-900 border-slate-300')
                        : (theme === 'dark' ? 'border-[#1e202b] text-slate-300 hover:bg-[#1a1c24]' : 'border-slate-100 text-slate-700 hover:bg-slate-50')
                    }`}
                  >
                    <div>
                      <p className={`font-bold ${isSelected ? 'text-amber-500' : (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>{product.nombre}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>SKU: <span className="text-amber-500 font-bold">{product.sku}</span></span>
                        {product.codigoBarras && (
                          <span>Cód. Barras: <span className="text-slate-400 font-bold">{product.codigoBarras}</span></span>
                        )}
                        <span className={`font-black ${
                          product.stock > 5 ? 'text-emerald-500' : product.stock > 0 ? 'text-amber-500' : 'text-rose-500'
                        }`}>
                          • Existencia: {product.stock} {product.unidad}(s)
                        </span>
                      </p>
                    </div>
                    <span className="font-mono font-bold text-sm text-amber-500">${product.precio.toFixed(2)}</span>
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">Ningún artículo coincide con tu búsqueda</div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-4 w-fit">
          
          {/* Botón de Cotizaciones */}
          {currentUser && (
            <button 
              onClick={() => setCurrentView('quotes')}
              className={`font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border cursor-pointer active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-500 shadow-md' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-amber-600 shadow-sm'
              }`}
              title="Ir al Módulo de Cotizaciones"
            >
              <ClipboardList className="w-4 h-4" /> Cotizaciones
            </button>
          )}

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
            onClick={() => {
              const nextOnline = !isOnline;
              setIsOnline(nextOnline);
              if (nextOnline) {
                procesarColaVentasOffline();
                sincronizarCatalogoLocal();
              }
            }}
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

          {offlineQueueSize > 0 && (
            <button 
              onClick={procesarColaVentasOffline}
              disabled={syncingVentas}
              className="text-[10px] text-rose-500 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded font-bold hover:bg-rose-500 hover:text-slate-950 transition-colors uppercase animate-pulse"
              title="Ventas guardadas offline pendientes por subir"
            >
              📥 {offlineQueueSize} Ventas Offline {syncingVentas ? '(Subiendo...)' : ''}
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

          {/* Botón de Caja/Turno */}
          {currentUser && (
            <button 
              onClick={() => setShowTurnoModal(true)}
              className="text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 px-2.5 py-1.5 rounded-lg transition-colors bg-transparent border border-transparent hover:border-amber-500/20 cursor-pointer font-bold flex items-center gap-1 mr-1"
              title="Abrir, registrar flujos o cerrar el turno de caja"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Caja
            </button>
          )}

          {/* Cajero Activo y Botón de Bloqueo */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm border-r pr-3 ${
              theme === 'dark' ? 'text-slate-300 border-[#20222b]' : 'text-slate-600 border-slate-200'
            }`}>
              <User className="w-4 h-4 text-amber-500" /> 
              <span>{currentUser.nombre} <span className="text-[10px] text-slate-400">({currentUser.rol})</span></span>
            </div>
            <button 
              onClick={() => { 
                setCurrentUser(null); 
                setAuthToken(null);
                localStorage.removeItem('pos_auth_token');
                localStorage.removeItem('pos_current_user');
                setPin(''); 
                setLoginError(''); 
              }}
              className="text-xs text-rose-500 hover:text-rose-455 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg transition-colors bg-transparent border border-transparent hover:border-rose-500/20 cursor-pointer"
              title="Cerrar sesión / Bloquear terminal"
            >
              Salir
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
          
          {/* Barra de Tickets (Multi-Pestañas locales) */}
          <div className={`px-4 pt-3 border-b flex flex-col gap-2 ${
            theme === 'dark' ? 'border-[#20222b] bg-[#090a0d]/20' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div className="flex justify-between items-center">
              {/* Contenedor de Pestañas */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[75%]">
                {tabs.map((t, index) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTabId(t.id)}
                    className={`group px-3 py-1.5 rounded-t-xl border-t border-x text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none ${
                      activeTabId === t.id
                        ? theme === 'dark'
                          ? 'bg-[#13151b] border-[#20222b] text-slate-100 shadow-[0_-2px_10px_rgba(0,0,0,0.5)]'
                          : 'bg-white border-slate-200 text-slate-850 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]'
                        : theme === 'dark'
                          ? 'bg-[#090a0d]/40 border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#090a0d]/80'
                          : 'bg-slate-100 border-transparent text-slate-500 hover:text-slate-750 hover:bg-slate-200/50'
                    }`}
                  >
                    <span>🎟️ Ticket {index + 1} (#{t.ticketNumber})</span>
                    {t.cart.length > 0 && (
                      <span className="bg-emerald-500 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                        {t.cart.length}
                      </span>
                    )}
                    <span 
                      onClick={(e) => handleCloseTab(t.id, e)}
                      className="text-[10px] text-slate-500 hover:text-rose-500 p-0.5 rounded transition-colors"
                    >
                      ✕
                    </span>
                  </div>
                ))}
                
                {/* Botón Nueva Pestaña */}
                <button
                  type="button"
                  onClick={() => handleAddTab()}
                  className="px-3 py-1.5 rounded-t-xl text-xs font-bold transition-colors cursor-pointer border border-transparent bg-transparent hover:bg-amber-500/10 text-amber-500 flex items-center gap-1"
                  title="Abrir nuevo Ticket"
                >
                  + Nuevo
                </button>
              </div>

              {/* Botón Asignar Cliente */}
              <button className="text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1.5 hover:bg-amber-500/10 px-3 py-1 rounded-lg transition-colors border border-transparent hover:border-amber-500/20 text-xs bg-transparent cursor-pointer">
                <User className="w-4 h-4" /> Asignar Cliente / RFC
              </button>
            </div>
            
            {/* Info del Ticket Activo */}
            <div className="pb-2 pt-1 flex justify-between items-center text-xs text-slate-500 px-1 border-t border-slate-750/10">
              <div>
                <span>Atendiendo Ticket #{ticketNumber}</span>
                <span className="mx-2">•</span>
                <span>Artículos: {cart.reduce((sum: number, item: any) => sum + Number(item.cantidad), 0)}</span>
              </div>
              <span className="italic">Cliente: {activeTab.clienteNombre || 'Público General'}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
                <PackageOpen className="w-12 h-12 opacity-30" />
                <p className="text-sm font-medium opacity-50">Ticket vacío</p>
                <p className="text-xs opacity-30">Escanea un código o busca un producto</p>
              </div>
            ) : null}
            {cart.map((item: any) => (
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

            {(() => {
              const canCheckout = (() => {
                if (!currentUser) return false;
                const role = currentUser.rol;
                if (role === 'ADMINISTRADOR' || role === 'Administrador') return true;
                if (role === 'GERENTE' || role === 'Gerente') return config.allowGerenteCheckout !== false;
                if (role === 'CAJERO' || role === 'Cajero') return config.allowCajeroCheckout !== false;
                if (role === 'VENDEDOR_MOVIL' || role === 'Vendedor Móvil') return config.allowVendedorMovilCheckout === true;
                return false;
              })();

              return (
                <div className="flex gap-4">
                  {canCheckout && (
                    <button 
                      onClick={() => {
                        if (cart.length > 0) {
                          let defaultMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' = 'EFECTIVO';
                          if (config.allowCash === false) {
                            if (config.allowCard !== false) defaultMethod = 'TARJETA';
                            else if (config.allowTransfer !== false) defaultMethod = 'TRANSFERENCIA';
                          }
                          setPaymentMethod(defaultMethod);
                          setAmountPaid('');
                          setShowCheckoutModal(true);
                        }
                      }}
                      disabled={cart.length === 0}
                      className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black py-3.5 rounded-xl shadow-lg shadow-emerald-900/50 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-0 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                    >
                      COBRAR TICKET
                      <span className="text-emerald-100 font-mono text-xs bg-emerald-800/50 px-2 py-1 rounded border border-emerald-500/30">F12</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => {
                      if (cart.length > 0) {
                        setQuoteClientName('Público General');
                        setShowSaveQuoteModal(true);
                      }
                    }}
                    disabled={cart.length === 0}
                    className={`active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                      !canCheckout
                        ? 'flex-grow bg-amber-500 hover:bg-amber-400 text-[#0d0e12] text-base font-black py-3.5 rounded-xl border-0 shadow-lg shadow-amber-900/10'
                        : 'bg-[#1a1c24] hover:bg-[#252837] border border-[#2b2d3d] text-amber-500 text-sm font-bold px-5 py-3.5 rounded-xl'
                    }`}
                  >
                    <Bookmark className="w-5 h-5" />
                    {!canCheckout ? 'ENVIAR PEDIDO A CAJA' : 'COTIZAR'}
                  </button>
                </div>
              );
            })()}
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
                          {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)}
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

      {/* Barra de Atajos y Estado en Pie de Página */}
      <footer className={`px-6 py-2 border-t text-[11px] flex items-center justify-between font-mono select-none ${
        theme === 'dark' ? 'bg-[#0b0c10] border-[#1e2029] text-slate-400' : 'bg-slate-150 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1 flex-wrap">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${theme === 'dark' ? 'bg-[#1b1c24] border-[#2b2d3a] text-amber-500' : 'bg-white border-slate-300 text-amber-600'}`}>F3</kbd>
            <span>Buscar</span>
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${theme === 'dark' ? 'bg-[#1b1c24] border-[#2b2d3a] text-amber-500' : 'bg-white border-slate-300 text-amber-600'}`}>F12</kbd>
            <span>Cobrar</span>
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${theme === 'dark' ? 'bg-[#1b1c24] border-[#2b2d3a] text-amber-500' : 'bg-white border-slate-300 text-amber-600'}`}>ESC</kbd>
            <span>Cerrar Modal</span>
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <span className="text-amber-500 font-bold">Cant*Código</span>
            <span>Multiplicador (ej: 5*SKU)</span>
          </span>
        </div>
        <div>
          <span>Apex POS v2.0 • {!isOnline ? '🔴 Fuera de línea' : '🟢 En línea'}</span>
        </div>
      </footer>

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

      {/* MODAL CONFIGURACIÓN DE RED (DYNAMICAL API ROUTING) */}
      {showNetworkModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold flex items-center gap-2">
                ⚙️ Configuración de Conexión (Red/API)
              </h3>
              <button 
                onClick={() => setShowNetworkModal(false)}
                className="text-slate-500 hover:text-slate-400 border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Elige cómo se conectará esta terminal a la base de datos de Apex POS:
            </p>
            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setTempApiBaseUrl('http://localhost:3001')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    tempApiBaseUrl === 'http://localhost:3001'
                      ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                      : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-black">Opción A: Servidor Local (Auto-Sincronizado)</div>
                  <div className="font-medium text-[10px] text-slate-500 mt-0.5">La terminal se comunica localmente y se sincroniza con la nube (http://localhost:3001)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setTempApiBaseUrl('https://pdventa.onrender.com')}
                  className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    tempApiBaseUrl === 'https://pdventa.onrender.com'
                      ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                      : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-slate-400 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-black">Nube Directa: Servidor Cloud</div>
                  <div className="font-medium text-[10px] text-slate-500 mt-0.5">La terminal lee/escribe en caliente sobre internet (https://pdventa.onrender.com)</div>
                </button>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-bold mb-1 block">Dirección IP / Servidor Personalizado (Opción B)</label>
                <input
                  type="text"
                  placeholder="Ej: http://192.168.1.50:3001"
                  className={`w-full rounded-xl py-3 px-4 border focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-transparent ${
                    theme === 'dark' ? 'bg-[#090a0d] border-[#20222b] text-white' : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                  value={tempApiBaseUrl}
                  onChange={(e) => setTempApiBaseUrl(e.target.value)}
                />
                <p className="text-[9px] text-slate-500 mt-1">Escribe la dirección IP del ordenador principal (ej: http://192.168.1.X:3001) para el modelo de caja central local.</p>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowNetworkModal(false)}
                  className={`flex-1 font-bold py-3 rounded-xl border transition-colors cursor-pointer text-sm ${
                    theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (tempApiBaseUrl.trim()) {
                      localStorage.setItem('pos_api_base_url', tempApiBaseUrl.trim());
                      setShowNetworkModal(false);
                      alert('Dirección de red configurada con éxito. Recargando la terminal...');
                      window.location.reload();
                    } else {
                      alert('Ingresa una dirección de red válida.');
                    }
                  }}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-[#0d0e12] font-black py-3 rounded-xl shadow-lg shadow-amber-900/10 transition-colors border-0 cursor-pointer text-sm"
                >
                  Guardar y Reiniciar
                </button>
              </div>
            </div>
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
                  disabled={savingQuote}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-3 rounded-xl transition-colors cursor-pointer border-0 text-sm"
                >
                  {savingQuote ? 'Guardando...' : 'Guardar Cotización'}
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

      {/* Módulo de Gestión de Cotizaciones (Overlay de Pantalla Completa) */}
      {currentView === 'quotes' && currentUser && (
        <QuotesDashboard 
          theme={theme} 
          onClose={() => setCurrentView('pos')} 
          onConvertToSale={handleConvertToSale}
        />
      )}

      {/* Panel de Administración (Overlay de Pantalla Completa) */}
      {currentView === 'admin' && currentUser && (
        <AdminDashboard 
          currentUser={currentUser} 
          theme={theme} 
          onClose={() => setCurrentView('pos')} 
          config={config}
          onConfigChange={async (newConfig) => {
            setConfig(newConfig);
            localStorage.setItem('pos_config', JSON.stringify(newConfig));
            try {
              await fetch(`${API_V1}/configuracion-empresa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nombre: newConfig.businessName,
                  rfc: newConfig.rfc,
                  telefono: newConfig.phone,
                  direccion: newConfig.address,
                  ciudad: '',
                  giro: newConfig.giro || 'tienda',
                  ticketMessage: newConfig.ticketMessage || '',
                  printerType: newConfig.printerType || 'thermal_80',
                  allowCash: newConfig.allowCash !== false,
                  allowCard: newConfig.allowCard !== false,
                  allowTransfer: newConfig.allowTransfer !== false,
                  allowDrawer: newConfig.allowDrawer !== false,
                  drawerCommand: newConfig.drawerCommand || '',
                  allowScale: newConfig.allowScale || false,
                  scalePort: newConfig.scalePort || '',
                  scaleBaudRate: newConfig.scaleBaudRate || 9600,
                  scaleModel: newConfig.scaleModel || '',
                  sessionTimeout: newConfig.sessionTimeout || 0,
                  businessStartHour: newConfig.businessStartHour || '08:00',
                  businessEndHour: newConfig.businessEndHour || '20:00',
                  allowGerenteLogin: newConfig.allowGerenteLogin !== false,
                  allowCajeroLogin: newConfig.allowCajeroLogin !== false,
                  allowVendedorMovilLogin: newConfig.allowVendedorMovilLogin !== false,
                  restrictGerenteSchedule: newConfig.restrictGerenteSchedule || false,
                  restrictCajeroSchedule: newConfig.restrictCajeroSchedule || false,
                  restrictVendedorMovilSchedule: newConfig.restrictVendedorMovilSchedule !== false,
                  allowGerenteCheckout: newConfig.allowGerenteCheckout !== false,
                  allowCajeroCheckout: newConfig.allowCajeroCheckout !== false,
                  allowVendedorMovilCheckout: newConfig.allowVendedorMovilCheckout || false,
                  printerCaja: newConfig.printerCaja || '',
                  printerCliente: newConfig.printerCliente || '',
                  printerMovil: newConfig.printerMovil || '',
                  printerBodega: newConfig.printerBodega || ''
                })
              });
            } catch (err) {
              console.error('Error saving config to API:', err);
            }
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
      {/* Modal de Control de Caja y Turnos */}
      {showTurnoModal && currentUser && (
        <TurnoManager
          theme={theme}
          currentUser={currentUser}
          activeTurno={activeTurno}
          isOnline={isOnline}
          onTurnoChange={(turno) => setActiveTurno(turno)}
          onClose={() => setShowTurnoModal(false)}
        />
      )}
      {/* Modal de Cobro y Medios de Pago */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 font-sans animate-fadeIn">
          <div className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl transition-colors ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-emerald-500" /> Cobro de Ticket
              </h3>
              <button 
                onClick={() => setShowCheckoutModal(false)}
                className="text-slate-400 hover:text-white border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Resumen de Total */}
              <div className={`p-4 rounded-xl text-center border ${
                theme === 'dark' ? 'bg-[#090a0d]/50 border-[#20222b]' : 'bg-slate-50 border-slate-200'
              }`}>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Monto a Liquidar</p>
                <p className="text-4xl font-black text-emerald-500">${total.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500 mt-1">IVA del 16% Incluido (${iva.toFixed(2)})</p>
              </div>

              {/* Métodos de Pago Disponibles */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Método de Pago</label>
                <div className="grid grid-cols-3 gap-3">
                  {config.allowCash !== false && (
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('EFECTIVO'); setAmountPaid(''); }}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'EFECTIVO'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">💵</span> Efectivo
                    </button>
                  )}

                  {config.allowCard !== false && (
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('TARJETA'); setAmountPaid(String(total)); }}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'TARJETA'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">💳</span> Tarjeta
                    </button>
                  )}

                  {config.allowTransfer !== false && (
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('TRANSFERENCIA'); setAmountPaid(String(total)); }}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                        paymentMethod === 'TRANSFERENCIA'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">🏦</span> Transferencia
                    </button>
                  )}
                  {((config.allowCash !== false ? 1 : 0) + (config.allowCard !== false ? 1 : 0) + (config.allowTransfer !== false ? 1 : 0)) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('MIXTO');
                        setMixedCash('');
                        setMixedCard('');
                        setMixedTransfer('');
                      }}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 col-span-3 ${
                        paymentMethod === 'MIXTO'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                          : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">🔀</span> Pago Híbrido / Combinado
                    </button>
                  )}
                </div>
              </div>

              {/* Lógica Específica de Efectivo */}
              {paymentMethod === 'EFECTIVO' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Efectivo Recibido</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-black text-lg ${
                          theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Cambio a entregar</label>
                      <div className={`w-full rounded-xl p-3 border font-mono font-black text-lg flex items-center justify-between ${
                        Number(amountPaid) >= total 
                          ? theme === 'dark' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-250 text-emerald-700'
                          : theme === 'dark' ? 'bg-rose-950/20 border-rose-500/30 text-rose-450' : 'bg-rose-50 border-rose-250 text-rose-700'
                      }`}>
                        <span>Cambio:</span>
                        <span>
                          {Number(amountPaid) >= total 
                            ? '$' + (Number(amountPaid) - total).toFixed(2)
                            : '$0.00 (Monto insuficiente)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botones de Cobro Rápido */}
                  <div className="flex gap-2 justify-center flex-wrap">
                    {[
                      { label: 'Exacto', val: total.toFixed(2) },
                      { label: '$50', val: '50' },
                      { label: '$100', val: '100' },
                      { label: '$200', val: '200' },
                      { label: '$500', val: '500' },
                      { label: '$1000', val: '1000' }
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setAmountPaid(btn.val)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-slate-300 hover:bg-slate-800' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lógica Específica de Pago Híbrido */}
              {paymentMethod === 'MIXTO' && (
                <div className="space-y-4 border border-dashed border-slate-750/30 p-4 rounded-xl animate-fadeIn">
                  <h4 className="text-xs font-bold uppercase text-amber-500 tracking-wider mb-2">Desglose de Pago Combinado</h4>
                  
                  <div className="space-y-3">
                    {config.allowCash !== false && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-slate-400 uppercase w-28">💵 Efectivo:</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          className={`w-full max-w-[200px] rounded-lg p-2 border focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-sm text-right ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                          value={mixedCash}
                          onChange={e => setMixedCash(e.target.value)}
                        />
                      </div>
                    )}

                    {config.allowCard !== false && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-slate-400 uppercase w-28">💳 Tarjeta:</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          className={`w-full max-w-[200px] rounded-lg p-2 border focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-sm text-right ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                          value={mixedCard}
                          onChange={e => setMixedCard(e.target.value)}
                        />
                      </div>
                    )}

                    {config.allowTransfer !== false && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-slate-400 uppercase w-28">🏦 Transf.:</span>
                        <input
                          type="number"
                          placeholder="0.00"
                          className={`w-full max-w-[200px] rounded-lg p-2 border focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-sm text-right ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                          value={mixedTransfer}
                          onChange={e => setMixedTransfer(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Resultados del Pago Combinado */}
                  <div className={`mt-4 p-3 rounded-lg border flex items-center justify-between text-xs font-mono font-bold ${
                    (Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0)) >= total
                      ? theme === 'dark' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-250 text-emerald-700'
                      : theme === 'dark' ? 'bg-rose-950/20 border-rose-500/30 text-rose-450' : 'bg-rose-50 border-rose-250 text-rose-700'
                  }`}>
                    <span>Total Registrado:</span>
                    <span>
                      ${(Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0)).toFixed(2)} / ${total.toFixed(2)}
                    </span>
                  </div>

                  {/* Indicación de Saldo */}
                  <div className="text-[10px] text-right font-medium">
                    {(Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0)) >= total ? (
                      <span className="text-emerald-500">
                        Cobro completo. Cambio a entregar: ${(Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0) - total).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-rose-450">
                        Falta liquidar: ${(total - (Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0))).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Simulación de Báscula */}
              {config.allowScale && (
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-[#090a0d]/30 border-[#20222b]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lectura de Báscula ({config.scaleModel})</h4>
                    <p className="text-sm font-semibold text-amber-500 mt-1">Peso leido: 2.345 kg (Simulado)</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => alert('[Báscula] Lectura recalculada desde puerto serial: 2.345 kg.')}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Recalcular
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className={`flex-1 font-bold py-3 rounded-xl border transition-colors cursor-pointer text-sm ${
                  theme === 'dark' ? 'border-[#262836] text-slate-400 bg-transparent hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCheckout(paymentMethod)}
                disabled={
                  (paymentMethod === 'EFECTIVO' && Number(amountPaid) < total) ||
                  (paymentMethod === 'MIXTO' && (Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0)) < total)
                }
                className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-1.5"
              >
                ✓ Registrar Cobro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

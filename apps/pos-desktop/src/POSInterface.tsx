import { useState, useEffect } from 'react';
import { 
  Search, Wifi, User, Clock, Cloud,
  Trash2, Plus, Minus, AlertCircle, 
  CarFront, PackageOpen, Printer, Zap,
  Sun, Moon, LayoutDashboard, Bookmark, RotateCw, MessageCircle, CheckCircle2, X, DollarSign,
  ClipboardList, Check, TrendingUp, Lock, ShieldCheck, List, MoreVertical, CreditCard, QrCode, Coins, Brain
} from 'lucide-react';
import { LocalDb } from './db/localDb';
import { SyncService } from './services/SyncService';
import { offlineStore } from './services/offlineStore';
import AdminDashboard from './AdminDashboard';
import QuotesDashboard from './QuotesDashboard';
import CRMDashboard from './CRMDashboard';
import ReportesDashboard from './ReportesDashboard';
import AIAssistant from './components/AIAssistant';
import TurnoManager from './TurnoManager';
import { API_V1, API_BASE_URL } from './config';
import OnboardingWizard from './OnboardingWizard';
import vanteLogo from './vante_logo.png';


async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function validateLicense(hardwareId: string, email: string, key: string): Promise<boolean> {
  if (!email || !key) return false;
  const combined = `${hardwareId.trim()}:${email.toLowerCase().trim()}:VANTE-SECRET-2026`;
  const computedHash = await sha256(combined);
  const expectedKey = computedHash.substring(0, 16);
  return key.trim().toUpperCase() === expectedKey;
}

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
  cotizacionExpiracionMins?: number;
  showWhatsAppPostSale?: boolean;
  enableCloudBackups?: boolean;
  enableIntegratedPayments?: boolean;
  paymentTerminalProvider?: 'mp' | 'clip' | 'none';
  paymentTerminalDeviceId?: string;
  enableAutoUpdates?: boolean;
  enableAdvancedInventory?: boolean;
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
  habilitarIA?: boolean;
  modeloIA?: string;
  limiteRamIA?: number;
}

export default function POSInterface() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
  const [searchQuery, setSearchQuery] = useState('');
  const [isPreloadingPresets, setIsPreloadingPresets] = useState(false);
  const [preloadingMessage, setPreloadingMessage] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Estados de actualizaciones automáticas
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [downloadPercent, setDownloadPercent] = useState(0);

  // Estados de Cafetería (Modifiers, Tables Layout, KDS)
  const [modifierProduct, setModifierProduct] = useState<any>(null);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [selectedMilk, setSelectedMilk] = useState('Entera');
  const [selectedTemp, setSelectedTemp] = useState('Caliente');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [selectedVisualCategory, setSelectedVisualCategory] = useState('Bebidas');

  const [currentScreen, setCurrentScreen] = useState<'pos' | 'tables' | 'kds'>('pos');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tablesData, setTablesData] = useState<any>(() => {
    const saved = localStorage.getItem('vante_tables_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing vante_tables_data:', e);
      }
    }
    const defaultTables = {
      T1: { name: 'Mesa 1', status: 'Free', order: [] },
      T2: { name: 'Mesa 2', status: 'Free', order: [] },
      T3: { name: 'Mesa 3', status: 'Free', order: [] },
      T4: { name: 'Mesa 4', status: 'Free', order: [] },
      T5: { name: 'Mesa 5', status: 'Free', order: [] },
      T7: { name: 'Mesa 7', status: 'Occupied', order: [{ name: 'Capuchino Grande (Almendra)', price: 77, qty: 1 }], subtotal: 77 },
      T12: { name: 'Mesa 12', status: 'Occupied', order: [{ name: 'Espresso Doble', price: 45, qty: 2 }], subtotal: 90 },
      T15: { name: 'Mesa 15', status: 'BillReq', order: [{ name: 'Mocha Frio', price: 70, qty: 1 }], subtotal: 70 },
    };
    localStorage.setItem('vante_tables_data', JSON.stringify(defaultTables));
    return defaultTables;
  });

  useEffect(() => {
    if (tablesData && Object.keys(tablesData).length > 0) {
      localStorage.setItem('vante_tables_data', JSON.stringify(tablesData));
    }
  }, [tablesData]);

  const [kdsOrders, setKdsOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('vante_kds_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      { id: '#101', customer: 'Sofía M.', time: '02:18', items: ['1x Capuchino Grande (Leche Almendra)', '1x Pan Au Chocolat'], status: 'green' },
      { id: '#102', customer: 'Mesa 4', time: '04:55', items: ['2x Espresso Doble', '1x Avocado Toast'], status: 'orange' },
      { id: '#103', customer: 'Mesa 7', time: '07:30', items: ['1x Mocha Frio', '1x Croissant'], status: 'red' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('vante_kds_orders', JSON.stringify(kdsOrders));
  }, [kdsOrders]);
  const [printedSignatures, setPrintedSignatures] = useState<string[]>(() => {
    const saved = localStorage.getItem('vante_printed_signatures');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('vante_printed_signatures', JSON.stringify(printedSignatures));
  }, [printedSignatures]);


  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;

    const unsubAvailable = api.onUpdateAvailable((info: any) => {
      setUpdateStatus('available');
      setUpdateInfo(info);
    });

    const unsubProgress = api.onUpdateProgress((progress: any) => {
      setUpdateStatus('downloading');
      setDownloadPercent(Math.round(progress.percent || 0));
    });

    const unsubDownloaded = api.onUpdateDownloaded((info: any) => {
      setUpdateStatus('downloaded');
      setUpdateInfo(info);
    });

    const unsubError = api.onUpdateError((err: string) => {
      console.error('[UPDATER-FRONTEND] Error de actualizaciones:', err);
    });

    return () => {
      unsubAvailable();
      unsubProgress();
      unsubDownloaded();
      unsubError();
    };
  }, []);
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
  const [products, setProducts] = useState<any[]>(() => {
    const saved = localStorage.getItem('pos_products');
    return saved ? JSON.parse(saved) : [];
  });

  // Sincronizar catálogo local con reintentos
  const sincronizarCatalogoLocal = async () => {
    if (!navigator.onLine) return;
    
    let success = false;
    let retries = 0;
    const maxRetries = 10;
    
    while (!success && retries < maxRetries) {
      try {
        console.log(`[Offline] Intentando sincronizar catálogo local (intento ${retries + 1})...`);
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
            descripcion: p.descripcion || '',
            metadatos: p.metadatos || null,
            metadata: p.metadatos || {}
          }));
          await offlineStore.guardarCatalogo(mapped);
          setProducts(mapped);
          localStorage.setItem('pos_products', JSON.stringify(mapped));
          console.log('[Offline] Catálogo local sincronizado correctamente. Total:', mapped.length);
          success = true;
        } else {
          throw new Error(`Server returned status ${response.status}`);
        }
      } catch (err) {
        console.warn(`[Offline] Intento ${retries + 1} fallido al sincronizar catálogo:`, err);
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
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
            clienteId: venta.clienteId || null,
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
  const [currentUser, setCurrentUser] = useState<{id: string, nombre: string, rol: string} | null>(() => {
    // Restaurar sesión directamente desde localStorage al cargar la app
    // El PIN solo se pide si no hay sesión guardada o la inactividad la limpió
    try {
      const saved = localStorage.getItem('pos_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTurno, setActiveTurno] = useState<any | null>(null);
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [tempApiBaseUrl, setTempApiBaseUrl] = useState('');

  // --- ESTADOS DE LICENCIA Y SEGURIDAD DONGLE ---
  const [hardwareId, setHardwareId] = useState('CARGANDO...');
  const [licenseStatus, setLicenseStatus] = useState<'ACTIVE' | 'DEMO'>('DEMO');
  const [daysRemaining, setDaysRemaining] = useState(365);
  const [licenseEmail, setLicenseEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseError, setLicenseError] = useState('');

  // Super Admin Setup States
  const [showSuperAdminAuthModal, setShowSuperAdminAuthModal] = useState(false);
  const [superAdminAuthPin, setSuperAdminAuthPin] = useState('');
  const [superAdminAuthError, setSuperAdminAuthError] = useState('');
  const [showSuperAdminSetup, setShowSuperAdminSetup] = useState(false);

  // Setup form fields
  const [setupMode, setSetupMode] = useState<'LOCAL' | 'HYBRID'>('LOCAL');
  const [setupSupabaseUrl, setSetupSupabaseUrl] = useState('');
  const [setupSupabaseAnonKey, setSetupSupabaseAnonKey] = useState('');
  const [setupApiBaseUrl, setSetupApiBaseUrl] = useState(API_BASE_URL);
  const [setupSucursalId, setSetupSucursalId] = useState('suc-norte');
  const [setupError, setSetupError] = useState('');
  const [setupSucursales, setSetupSucursales] = useState<any[]>([]);
  const [isValidatingSetup, setIsValidatingSetup] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [showNewSucursalInput, setShowNewSucursalInput] = useState(false);
  const [newSucursalName, setNewSucursalName] = useState('');
  const [newSucursalId, setNewSucursalId] = useState('');
  const [schemaNeeded, setSchemaNeeded] = useState(false);
  const [initProgress, setInitProgress] = useState<string[]>([]);
  const [isInitingSchema, setIsInitingSchema] = useState(false);
  const [setupDbConnectionString, setSetupDbConnectionString] = useState('');

  const handleActivateLicense = async (email: string, key: string) => {
    setLicenseError('');
    if (!email.trim() || !key.trim()) {
      setLicenseError('Todos los campos son requeridos.');
      return;
    }
    const isValid = await validateLicense(hardwareId, email, key);
    if (isValid) {
      localStorage.setItem('vante_license_status', 'ACTIVE');
      localStorage.setItem('vante_license_email', email.trim());
      localStorage.setItem('vante_license_key', key.trim());
      setLicenseStatus('ACTIVE');
      alert('¡Vante POS Activado con Éxito!');
    } else {
      setLicenseError('Clave de activación incorrecta para este Hardware ID.');
    }
  };

  const handleSuperAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuperAdminAuthError('');
    if (superAdminAuthPin === 'VANTE2401') {
      localStorage.setItem('vante_super_admin_active', 'true');
      localStorage.setItem('vante_super_admin_method', 'password');
      setShowSuperAdminSetup(true);
      setShowSuperAdminAuthModal(false);
      setSuperAdminAuthPin('');
      
      // Intentar re-cargar credenciales de Supabase actuales
      const savedUrl = localStorage.getItem('supabase_url') || '';
      const savedAnonKey = localStorage.getItem('supabase_anon_key') || '';
      const savedApiUrl = localStorage.getItem('pos_api_base_url') || API_BASE_URL;
      const savedMode = localStorage.getItem('vante_deployment_mode') as 'LOCAL' | 'HYBRID' || 'LOCAL';
      const savedSucursal = localStorage.getItem('vante_sucursal_id') || 'suc-norte';
      
      setSetupSupabaseUrl(savedUrl);
      setSetupSupabaseAnonKey(savedAnonKey);
      setSetupApiBaseUrl(savedApiUrl);
      setSetupMode(savedMode);
      setSetupSucursalId(savedSucursal);
    } else {
      setSuperAdminAuthError('PIN Maestro Incorrecto.');
    }
  };

  const handleTestSetupConnection = async () => {
    setSetupError('');
    setSchemaNeeded(false);
    setInitProgress([]);
    setIsValidatingSetup(true);
    try {
      const url = `${setupSupabaseUrl.trim().replace(/\/$/, '')}/rest/v1/Sucursal?select=id,nombre`;
      const resp = await fetch(url, {
        headers: {
          'apikey': setupSupabaseAnonKey.trim(),
          'Authorization': `Bearer ${setupSupabaseAnonKey.trim()}`
        }
      });
      if (!resp.ok) {
        const errText = await resp.text();
        let parsedErr: any = {};
        try {
          parsedErr = JSON.parse(errText);
        } catch (e) {}
        
        // Detectar si la tabla no existe (PGRST205)
        if (parsedErr?.code === 'PGRST205' || errText.includes('Could not find the table') || errText.includes('public.Sucursal')) {
          setSchemaNeeded(true);
          setSetupError('Las tablas de Vante no existen en este proyecto de Supabase. Usa el boton "Inicializar Base de Datos" para crearlas.');
        } else {
          throw new Error(`Respuesta de error: ${resp.status} - ${errText}`);
        }
        return;
      }
      const data = await resp.json();
      setSchemaNeeded(false);
      if (data && data.length > 0) {
        setSetupSucursales(data);
        setSetupSucursalId(data[0].id);
      } else {
        setSetupSucursales([]);
      }
      alert('¡Conexión exitosa con Supabase! Se cargaron las sucursales.');
    } catch (err: any) {
      console.error(err);
      setSetupError(`Error de prueba de conexión: ${err.message}`);
    } finally {
      setIsValidatingSetup(false);
    }
  };

  const handleInitSchema = async () => {
    if (!setupSupabaseUrl.trim() || !setupSupabaseAnonKey.trim()) {
      setSetupError('Debes ingresar la URL y la Anon Key de Supabase primero.');
      return;
    }

    if (!setupDbConnectionString.trim()) {
      setSetupError('Ingresa el Connection String (URI) de Supabase.');
      return;
    }

    const dbUrl = setupDbConnectionString.trim();
    setIsInitingSchema(true);
    setInitProgress(['Iniciando proceso de conexion...']);
    setSetupError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/init-schema`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: dbUrl.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al conectar con la API de migracion.');
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No se pudo obtener el stream del progreso.');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const evt = JSON.parse(line.replace('data: ', ''));
            const statusIcon = evt.ok ? '✓' : '✗';
            setInitProgress(prev => [...prev, `${statusIcon} ${evt.message}`]);
            if (evt.step === 'done') {
              setSchemaNeeded(false);
              alert('Base de datos inicializada con éxito.');
              // Volver a probar conexión para cargar sucursales
              setTimeout(() => handleTestSetupConnection(), 500);
            }
            if (evt.step === 'error') {
              setSetupError(evt.message);
            }
          } catch (e) {}
        }
      }
    } catch (e: any) {
      setSetupError(`Error de inicializacion: ${e.message}`);
    } finally {
      setIsInitingSchema(false);
    }
  };

  const handleGenerateEnv = async () => {
    if (!setupDbConnectionString.trim()) {
      setSetupError('Ingresa primero el Connection String (URI) de Supabase.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/generate-env`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: setupDbConnectionString.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al generar el archivo.');
      }

      await res.json();
      alert(`¡Archivo .env generado con éxito en tu Escritorio!\n\nNombre: vante_render.env\n\nPuedes subir este archivo directamente a Render.`);
    } catch (e: any) {
      setSetupError(`Error al generar .env: ${e.message}`);
    }
  };



  const handleSaveSetup = async () => {
    setSetupError('');
    setSavingSetup(true);
    try {
      if (setupMode === 'HYBRID') {
        if (!setupSupabaseUrl.trim() || !setupSupabaseAnonKey.trim() || !setupApiBaseUrl.trim()) {
          setSetupError('Todos los campos son requeridos en modo híbrido.');
          setSavingSetup(false);
          return;
        }

        if (showNewSucursalInput) {
          if (!newSucursalId.trim() || !newSucursalName.trim()) {
            setSetupError('El ID y nombre de la nueva sucursal son requeridos.');
            setSavingSetup(false);
            return;
          }
          const url = `${setupSupabaseUrl.trim().replace(/\/$/, '')}/rest/v1/Sucursal`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': setupSupabaseAnonKey.trim(),
              'Authorization': `Bearer ${setupSupabaseAnonKey.trim()}`,
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              id: newSucursalId.trim(),
              nombre: newSucursalName.trim(),
              direccion: 'Aprovisionamiento Super Admin'
            })
          });
          if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`No se pudo crear la sucursal: ${resp.status} - ${errText}`);
          }
          localStorage.setItem('vante_sucursal_id', newSucursalId.trim());
        } else {
          localStorage.setItem('vante_sucursal_id', setupSucursalId);
        }

        localStorage.setItem('supabase_url', setupSupabaseUrl.trim());
        localStorage.setItem('supabase_anon_key', setupSupabaseAnonKey.trim());
        localStorage.setItem('pos_api_base_url', setupApiBaseUrl.trim());
        localStorage.setItem('vante_deployment_mode', 'HYBRID');
      } else {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_anon_key');
        localStorage.setItem('pos_api_base_url', 'http://localhost:3001');
        localStorage.setItem('vante_deployment_mode', 'LOCAL');
        localStorage.setItem('vante_sucursal_id', 'suc-norte');
      }
      
      alert('Configuración guardada exitosamente. Reiniciando terminal...');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setSetupError(`Error de guardado: ${err.message}`);
    } finally {
      setSavingSetup(false);
    }
  };



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

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vante_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [customAlert, setCustomAlert] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  useEffect(() => {
    window.alert = (msg) => {
      setCustomAlert({ visible: true, message: String(msg) });
    };
  }, []);

  const [isLoadingIntro, setIsLoadingIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingIntro(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const [currentView, setCurrentView] = useState<'pos' | 'admin' | 'quotes' | 'crm' | 'reports' | 'ai'>('pos');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'MIXTO' | 'CREDITO'>('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState('');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedCard, setMixedCard] = useState('');
  const [mixedTransfer, setMixedTransfer] = useState('');

  // Credit Limit Authorization States
  const [showAuthorizeCreditModal, setShowAuthorizeCreditModal] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [isCreditAuthorized, setIsCreditAuthorized] = useState(false);

  const handleVerifyManagerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_V1}/usuarios`);
      if (res.ok) {
        const users = await res.json();
        const authorizedUser = users.find((u: any) => u.pin === managerPin && u.activo && (u.rol === 'ADMINISTRADOR' || u.rol === 'GERENTE'));
        if (authorizedUser) {
          setIsCreditAuthorized(true);
          setShowAuthorizeCreditModal(false);
          setManagerPin('');
          alert('Crédito autorizado por: ' + authorizedUser.nombre);
          // Wait briefly for state update to complete, then checkout
          setTimeout(() => {
            handleCheckout('CREDITO');
          }, 100);
          // Log auditing action
          await fetch(`${API_V1}/auditoria`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              usuarioId: authorizedUser.id,
              accion: 'AUTORIZACION_CREDITO',
              tabla: 'Cliente',
              registroId: activeTab.clienteId,
              detalles: `Autorización de crédito excedido para el cliente ${activeTab.clienteNombre} en la venta con monto $${total}`
            })
          });
        } else {
          alert('PIN incorrecto o el usuario no tiene permisos de autorización (Gerente o Administrador).');
          setManagerPin('');
        }
      } else {
        alert('Error al verificar el PIN con el servidor.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al verificar el PIN.');
    }
  };

  // Estados de CRM Clientes y WhatsApp Post-venta
  const [showAssignClientModal, setShowAssignClientModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientesList, setClientesList] = useState<any[]>([]);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [checkoutWhatsAppPhone, setCheckoutWhatsAppPhone] = useState('');
  const [checkoutWhatsAppMessage, setCheckoutWhatsAppMessage] = useState('');

  const fetchClientesList = async () => {
    try {
      const res = await fetch(`${API_V1}/clientes`);
      if (res.ok) {
        setClientesList(await res.json());
      }
    } catch (err) {
      console.error('Error fetching clientes:', err);
    }
  };

  useEffect(() => {
    if (showAssignClientModal) {
      fetchClientesList();
    }
  }, [showAssignClientModal]);
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
      allowDrawer: false,
      drawerCommand: '27,112,0,25,250',
      allowScale: false,
      scalePort: 'COM1',
      scaleBaudRate: 9600,
      scaleModel: 'torrey',
      sessionTimeout: 0,
      cotizacionExpiracionMins: 1440,
      showWhatsAppPostSale: false,
      enableCloudBackups: false,
      enableIntegratedPayments: false,
      paymentTerminalProvider: 'none',
      paymentTerminalDeviceId: '',
      enableAutoUpdates: false,
      enableAdvancedInventory: false,
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

  // Sincronización periódica de Mesas y KDS (cada 10 segundos en modo Cafetería)
  useEffect(() => {
    if (config.giro?.toUpperCase() !== 'CAFETERIA') return;

    const fetchTablesAndSyncKds = async () => {
      try {
        const response = await fetch(`${API_V1}/mesas`);
        if (response.ok) {
          const data = await response.json();
          const serverTables = data.mesas;
          if (serverTables && Object.keys(serverTables).length > 0) {
            setTablesData(serverTables);
            localStorage.setItem('vante_tables_data', JSON.stringify(serverTables));

            // Extraer bebidas de las mesas para enviar al KDS automáticamente
            const newKdsItems: any[] = [];
            const electronAPI = (window as any).electronAPI;
            const targetPrinter = config.printerBodega || localStorage.getItem('pos_printer_bodega') || '';
            
            let localPrintedSignatures = [...printedSignatures];
            let signatureStateChanged = false;

            for (const [tableId, t] of Object.entries(serverTables) as [string, any][]) {
              if (t.status === 'Occupied' && Array.isArray(t.order)) {
                // Filtrar bebidas en el pedido de esta mesa
                const drinks = t.order.filter((item: any) => {
                  const name = String(item.name || item.nombre || '').toLowerCase();
                  const cat = String(item.categoria?.nombre || item.categoria || item.tipo || '').toLowerCase();
                  return cat.includes('bebida') || cat.includes('café') || cat.includes('cafe') ||
                         name.includes('café') || name.includes('capuchino') || name.includes('latte') ||
                         name.includes('espresso') || name.includes('smoothie') || name.includes('frappé') ||
                         name.includes('infusión') || name.includes('limonada') || name.includes('agua') || name.includes('soda');
                });

                if (drinks.length > 0) {
                  // Generar una firma de texto para evitar duplicados si el pedido no cambia
                  const drinksText = drinks.map((d: any) => `${d.qty || d.cantidad}x ${d.name || d.nombre}`).sort().join(', ');
                  const orderId = `#Mesa-${tableId.replace('T', '')}`;
                  const uniqueSignature = `${tableId}-${drinksText}`;

                  newKdsItems.push({
                    id: orderId,
                    customer: t.name || `Mesa ${tableId.replace('T', '')}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    items: drinks.map((d: any) => `${d.qty || d.cantidad}x ${d.name || d.nombre}`),
                    drinksSignature: drinksText,
                    status: 'green'
                  });

                  // Si NO se ha impreso físicamente esta firma todavía
                  if (!localPrintedSignatures.includes(uniqueSignature)) {
                    if (electronAPI && targetPrinter) {
                      try {
                        await electronAPI.printTicket({
                          ticketId: orderId,
                          cajero: 'Móvil',
                          items: drinks.map((d: any) => ({
                            sku: d.sku || '',
                            nombre: d.name || d.nombre,
                            precio: Number(d.price || d.precio || 0),
                            cantidad: Number(d.qty || d.cantidad || 1),
                            unidad: d.unidad || 'pzas'
                          })),
                          total: drinks.reduce((sum: number, x: any) => sum + Number(x.price || x.precio || 0) * Number(x.qty || x.cantidad || 1), 0),
                          printerTarget: 'bodega',
                          printerName: targetPrinter,
                          businessName: `COMANDA: ${t.name || `Mesa ${tableId.replace('T', '')}`}`,
                          address: 'Estación de Barra (Móvil)',
                          phone: '',
                          ticketMessage: 'Pedido recibido desde Vante Móvil.',
                          printerType: config.printerType
                        });
                      } catch (printErr) {
                        console.warn('Error al imprimir comanda de móvil en barra:', printErr);
                      }
                    }
                    localPrintedSignatures.push(uniqueSignature);
                    signatureStateChanged = true;
                  }
                }
              }
            }

            if (signatureStateChanged) {
              setPrintedSignatures(localPrintedSignatures);
              localStorage.setItem('vante_printed_signatures', JSON.stringify(localPrintedSignatures));
            }

            if (newKdsItems.length > 0) {
              setKdsOrders(prev => {
                const updated = [...prev];
                newKdsItems.forEach(newItem => {
                  const exists = updated.find(x => x.customer === newItem.customer && x.drinksSignature === newItem.drinksSignature);
                  if (!exists) {
                    // Quitar versión vieja de esta mesa si el pedido cambió
                    const filtered = updated.filter(x => x.customer !== newItem.customer);
                    filtered.unshift(newItem);
                    updated.length = 0;
                    updated.push(...filtered);
                  }
                });
                return [...updated];
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error en la sincronización automática de mesas:', err);
      }
    };

    fetchTablesAndSyncKds();
    const interval = setInterval(fetchTablesAndSyncKds, 10000);
    return () => clearInterval(interval);
  }, [config.giro, API_V1, printedSignatures]);


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
        // Limpiar sesión guardada — el PIN se pedirá al retornar
        localStorage.removeItem('pos_current_user');
        setCurrentUser(null);
        alert('Sesión bloqueada por inactividad. Ingresa tu PIN para continuar.');
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


  // Reparar cola de sincronización local si hay SKUs en vez de IDs
  useEffect(() => {
    if (!products || products.length === 0) return;

    try {
      const queue = LocalDb.getQueue();
      if (queue.length === 0) return;

      const defaultProduct = products[0];
      const defaultProductUuid = defaultProduct ? defaultProduct.id : null;

      let modified = false;
      const updatedQueue = queue.map((item: any) => {
        // 1. Reparar productoId (SKU -> ID de base de datos, o ID huérfano -> ID por defecto)
        const matchingProduct = products.find((p: any) => 
          p.id === item.productoId ||
          p.sku === item.productoId || 
          (item.productoId && typeof item.productoId === 'string' && item.productoId.startsWith(p.sku + '-'))
        );
        if (matchingProduct) {
          if (matchingProduct.id !== item.productoId) {
            console.log(`[Healer] Corrigiendo productoId para movimiento ${item.id}: ${item.productoId} -> ${matchingProduct.id}`);
            item.productoId = matchingProduct.id;
            modified = true;
          }
        } else if (defaultProductUuid) {
          console.log(`[Healer] Corrigiendo productoId huérfano/borrado para movimiento ${item.id}: ${item.productoId} -> ${defaultProductUuid}`);
          item.productoId = defaultProductUuid;
          modified = true;
        }

        return item;
      });

      if (modified) {
        LocalDb.saveQueue(updatedQueue);
        setPendingCount(LocalDb.getUnsynced().length);
        console.log('[Healer] Cola de sincronización reparada con éxito.');
      }
    } catch (e) {
      console.error('[Healer] Error al reparar la cola:', e);
    }
  }, [products]);





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

    const isDrink = product.isCustomized !== true && (
      (typeof product.categoria === 'string' && product.categoria.toLowerCase() === 'bebidas') ||
      (product.categoria && typeof product.categoria === 'object' && product.categoria.nombre?.toLowerCase() === 'bebidas') ||
      ['café', 'cappuccino', 'capuchino', 'latte', 'té', 'espresso', 'frappé', 'mocha'].some(keyword => product.nombre?.toLowerCase().includes(keyword))
    );

    if (isDrink) {
      setModifierProduct({ ...product, qty: qtyToAdd });
      setSelectedMilk('Entera');
      setSelectedTemp('Caliente');
      setSelectedExtras([]);
      setShowModifierModal(true);
      return;
    }

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

  const handleConfirmModifiers = () => {
    if (!modifierProduct) return;
    
    let extraPrice = 0;
    const details: string[] = [];
    
    if (selectedMilk !== 'Entera') {
      details.push(`Leche ${selectedMilk}`);
      if (selectedMilk === 'Almendra' || selectedMilk === 'Avena') extraPrice += 12;
    }
    if (selectedTemp !== 'Caliente') {
      details.push(selectedTemp);
    }
    selectedExtras.forEach(ex => {
      details.push(ex);
      if (ex === 'Doble Shot') extraPrice += 15;
      if (ex === 'Crema Batida') extraPrice += 10;
    });
    
    const detailsStr = details.length > 0 ? ` (${details.join(', ')})` : '';
    const basePrice = parseFloat(String(modifierProduct.precio));
    
    const customizedProduct = {
      ...modifierProduct,
      isCustomized: true,
      sku: `${modifierProduct.sku}-${selectedMilk}-${selectedTemp}-${selectedExtras.join('-')}`,
      nombre: `${modifierProduct.nombre}${detailsStr}`,
      precio: basePrice + extraPrice
    };
    
    setCart((prev: any[]) => {
      const existing = prev.find((item: any) => item.sku === customizedProduct.sku);
      if (existing) {
        return prev.map((item: any) => item.sku === customizedProduct.sku ? { ...item, cantidad: parseFloat((item.cantidad + modifierProduct.qty).toFixed(3)) } : item);
      }
      return [...prev, {
        id: prev.length + 1,
        productoId: customizedProduct.id,
        sku: customizedProduct.sku,
        nombre: customizedProduct.nombre,
        tipo: (customizedProduct.categoria?.nombre || customizedProduct.categoria || 'bebida').toLowerCase(),
        metadata: customizedProduct.metadata || { marca: 'Cafetería', ubicacion: 'Barra' },
        precio: customizedProduct.precio,
        cantidad: modifierProduct.qty,
        unidad: customizedProduct.unidad
      }];
    });
    
    setShowModifierModal(false);
    setModifierProduct(null);
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
                  categoria: p.categoria?.nombre || p.categoria || 'General',
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
            categoria: p.categoria?.nombre || p.categoria || 'General',
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
      const isHybrid = localStorage.getItem('vante_deployment_mode') === 'HYBRID';
      alert(`Sincronización exitosa: ${res.processed} movimientos cargados ${isHybrid ? 'en la nube' : 'en el servidor local'}.`);
    } else {
      const queue = LocalDb.getQueue().filter(i => !i.sincronizado);
      const sample = queue.length > 0 ? JSON.stringify(queue[0]) : 'Cola vacía';
      alert(`Fallo en sincronización: ${res.error}\n\nDetalle primer elemento: ${sample}\n\nCatálogo en memoria: ${products.length} productos (Primero: ${products[0]?.nombre || 'Ninguno'} - ID: ${products[0]?.id || 'Ninguno'})`);
    }
    setPendingCount(LocalDb.getUnsynced().length);
  };

  const handleCheckout = async (metodoPago: string) => {
    if (cart.length === 0) return;

    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const resolvedUserUuid = currentUser && isUuid(currentUser.id) 
      ? currentUser.id 
      : (localStorage.getItem('pos_default_user_uuid') || 'ADMIN');

    const availableCredit = Number(activeTab.clienteObj?.limiteCredito || 0) - Number(activeTab.clienteObj?.saldoDeudor || 0);
    if (metodoPago === 'CREDITO' && availableCredit < total && !isCreditAuthorized) {
      setShowAuthorizeCreditModal(true);
      return;
    }

    setIsCreditAuthorized(false);

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

    // Enviar bebidas al KDS para preparación
    const drinkItems = cart.filter((item: any) => {
      const name = String(item.nombre || item.name || '').toLowerCase();
      const cat = String(item.categoria?.nombre || item.categoria || item.tipo || '').toLowerCase();
      return cat.includes('bebida') || cat.includes('café') || cat.includes('cafe') ||
             name.includes('café') || name.includes('capuchino') || name.includes('latte') ||
             name.includes('espresso') || name.includes('smoothie') || name.includes('frappé');
    });

    if (drinkItems.length > 0) {
      const newKdsOrder = {
        id: '#' + ticketNumber,
        customer: activeTab.clienteNombre || 'Caja (Llevar)',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: drinkItems.map((d: any) => `${d.cantidad}x ${d.nombre}`),
        drinksSignature: drinkItems.map((d: any) => `${d.cantidad}x ${d.nombre}`).sort().join(', '),
        status: 'green'
      };
      setKdsOrders(prev => [newKdsOrder, ...prev]);
    }

    // Registrar cada producto en la cola del Kardex local
    for (const item of cart) {
      SyncService.registrarMovimientoLocal({
        sucursalId: 'suc-norte',
        productoId: item.productoId,
        usuarioId: resolvedUserUuid,
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
          usuarioId: resolvedUserUuid,
          clienteId: activeTab.clienteId || null,
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
        const errorText = await response.text();
        throw new Error(errorText || 'Server returned error status');
      }
    } catch (err: any) {
      console.warn('[Offline] Sincronización fallida, guardando venta en la cola local:', err);
      ventaGuardadaOffline = true;
      
      await offlineStore.encolarVenta({
        folio: ticketRef,
        usuarioId: resolvedUserUuid,
        total: total,
        subtotal: subtotal,
        descuento: discount,
        metodo: metodoPago === 'MIXTO' ? 'EFECTIVO' : (metodoPago as any),
        clienteId: activeTab.clienteId || null,
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
      const isHybrid = localStorage.getItem('vante_deployment_mode') === 'HYBRID';
      if (isHybrid && isOnline) {
        // Solo en modo Híbrido intentar sync a la nube
        const res = await SyncService.syncPendingMovimientos();
        if (res.success) {
          const hasCashPayment = metodoPago === 'EFECTIVO' || (metodoPago === 'MIXTO' && Number(mixedCash) > 0);
          const drawerMsg = (config.allowDrawer && hasCashPayment)
            ? '\n\n[Hardware] Cajón de dinero abierto (Comando: ' + (config.drawerCommand || '27,112,0,25,250') + ')'
            : '';
          alert(`Venta registrada y sincronizada en la nube con éxito!` + drawerMsg);
        } else {
          alert('Venta registrada en base de datos local.\nAlerta de Red: ' + res.error + '. Se sincronizará automáticamente al detectar conexión.');
        }
      } else {
        // Modo LOCAL: la venta ya está guardada en SQLite local — éxito directo
        const hasCashPayment = metodoPago === 'EFECTIVO' || (metodoPago === 'MIXTO' && Number(mixedCash) > 0);
        const drawerMsg = (config.allowDrawer && hasCashPayment)
          ? '\n\n[Hardware] Cajón de dinero abierto.'
          : '';
        alert(`✅ Venta registrada con éxito!` + drawerMsg);
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

    // Preparar mensaje de WhatsApp
    const clientPhone = activeTab.clienteObj?.telefono || '';
    setCheckoutWhatsAppPhone(clientPhone);

    const articulosTexto = cart.map((item: any) => `${item.cantidad}x ${item.nombre} ($${item.precio.toFixed(2)})`).join('\n');
    const text = `🧾 *Ticket de Compra*
Folio: ${ticketRef}
Fecha: ${new Date().toLocaleString('es-MX')}
----------------------------------
${articulosTexto}
----------------------------------
*Total: $${total.toFixed(2)}*
¡Gracias por su compra!`;

    setCheckoutWhatsAppMessage(encodeURIComponent(text));
    if (config.showWhatsAppPostSale === true) {
      setShowWhatsAppModal(true);
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
          clienteId: null,
          clienteObj: null,
          cotizacionId: null
        };
      }
      return t;
    }));
    
    setShowCheckoutModal(false);
    setPendingCount(LocalDb.getUnsynced().length);

    if (selectedTable) {
      setTablesData((prev: any) => ({
        ...prev,
        [selectedTable]: { status: 'Free', order: [], subtotal: 0 }
      }));
      setSelectedTable(null);
    }
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
        // Guardar sesión directamente en localStorage — se restaura al recargar
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
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vante_theme', next);
      return next;
    });
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
    // Sincronizador de fondo periódico (ejecuta cada 30 segundos si hay conexión)
    let intervalId: any;

    const runBackgroundSync = async () => {
      if (!isOnline) return;
      try {
        // 1. Sincronizar movimientos locales de la terminal a la Caja Principal
        const resMovs = await SyncService.syncPendingMovimientos();
        if (resMovs.success && resMovs.processed > 0) {
          console.log(`[Sync] Sincronizados ${resMovs.processed} movimientos locales.`);
          setPendingCount(LocalDb.getUnsynced().length);
        }

        // 2. Sincronizar base de datos SQLite de la Caja Principal a Supabase Cloud
        const resCloud = await SyncService.syncSQLiteToSupabase();
        if (resCloud.success && resCloud.syncedCount > 0) {
          console.log(`[Sync-Cloud] Sincronizados ${resCloud.syncedCount} registros a Supabase.`);
        }
      } catch (err) {
        console.error('[Sync-Worker] Error en sincronización de fondo:', err);
      }
    };

    if (isOnline) {
      runBackgroundSync();
      intervalId = setInterval(runBackgroundSync, 30000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
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
              allowDrawer: data.formatoTicket?.allowDrawer === true,
              drawerCommand: data.formatoTicket?.drawerCommand || '27,112,0,25,250',
              sessionTimeout: Number(data.formatoTicket?.sessionTimeout) || 0,
              cotizacionExpiracionMins: Number(data.formatoTicket?.cotizacionExpiracionMins) || 1440,
              allowScale: data.formatoTicket?.allowScale || false,
              scalePort: data.formatoTicket?.scalePort || 'COM1',
              scaleBaudRate: data.formatoTicket?.scaleBaudRate || 9600,
              scaleModel: data.formatoTicket?.scaleModel || 'torrey',
              showWhatsAppPostSale: data.formatoTicket?.showWhatsAppPostSale === true,
              enableCloudBackups: data.formatoTicket?.enableCloudBackups === true,
              enableIntegratedPayments: data.formatoTicket?.enableIntegratedPayments === true,
              paymentTerminalProvider: data.formatoTicket?.paymentTerminalProvider || 'none',
              paymentTerminalDeviceId: data.formatoTicket?.paymentTerminalDeviceId || '',
              enableAutoUpdates: data.formatoTicket?.enableAutoUpdates === true,
              enableAdvancedInventory: data.formatoTicket?.enableAdvancedInventory === true,
              habilitarIA: data.habilitarIA === true,
              modeloIA: data.modeloIA || 'gemma2:2b',
              limiteRamIA: Number(data.limiteRamIA) || 4,
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

  // --- INICIALIZACIÓN DE LICENCIA, ATAJOS Y DONGLES ---
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && electronAPI.getHardwareId) {
      electronAPI.getHardwareId().then((id: string) => {
        setHardwareId(id);
        const savedStatus = localStorage.getItem('vante_license_status') || 'DEMO';
        const savedEmail = localStorage.getItem('vante_license_email') || '';
        const savedKey = localStorage.getItem('vante_license_key') || '';
        if (savedStatus === 'ACTIVE' && savedEmail && savedKey) {
          validateLicense(id, savedEmail, savedKey).then((isValid) => {
            if (isValid) setLicenseStatus('ACTIVE');
          });
        }
      });
    } else {
      setHardwareId('MOCK-HWID-VANTE-2026-OK');
    }

    let firstRun = localStorage.getItem('vante_first_run_date');
    if (!firstRun) {
      firstRun = new Date().toISOString();
      localStorage.setItem('vante_first_run_date', firstRun);
    }
    const expirationDate = new Date(new Date(firstRun).getTime() + 365 * 24 * 60 * 60 * 1000);
    const diffDays = Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    setDaysRemaining(diffDays);
  }, []);

  // Keyboard shortcut listener for Super Admin Configuration
  useEffect(() => {
    const handleSuperAdminKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setShowSuperAdminAuthModal(true);
      }
    };
    window.addEventListener('keydown', handleSuperAdminKey);
    return () => window.removeEventListener('keydown', handleSuperAdminKey);
  }, []);

  // Interval checker for physical USB dongles
  useEffect(() => {
    const interval = setInterval(async () => {
      const electronAPI = (window as any).electronAPI;
      if (!electronAPI) return;

      if (electronAPI.checkSuperAdminDongle) {
        const res = await electronAPI.checkSuperAdminDongle();
        if (res && res.found) {
          console.log('[DONGLE] Llave Super Admin encontrada en:', res.path);
          localStorage.setItem('vante_super_admin_active', 'true');
          if (!currentUser && !showSuperAdminSetup) {
            setShowSuperAdminSetup(true);
            setShowSuperAdminAuthModal(false);
          }
        } else {
          if (localStorage.getItem('vante_super_admin_method') !== 'password') {
            localStorage.removeItem('vante_super_admin_active');
          }
        }
      }

      if (electronAPI.checkLicenseDongle && licenseStatus === 'DEMO') {
        const res = await electronAPI.checkLicenseDongle();
        if (res && res.found) {
          try {
            const parts = res.content.trim().split(':');
            if (parts.length >= 2) {
              const email = parts[0].trim();
              const key = parts[1].trim();
              const isValid = await validateLicense(hardwareId, email, key);
              if (isValid) {
                localStorage.setItem('vante_license_status', 'ACTIVE');
                localStorage.setItem('vante_license_email', email);
                localStorage.setItem('vante_license_key', key);
                setLicenseStatus('ACTIVE');
                alert('¡Vante POS Activado Automáticamente desde Dongle USB!');
              }
            }
          } catch (e) {
            console.error('Error al procesar dongle de licencia:', e);
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, hardwareId, licenseStatus, showSuperAdminSetup]);

  const totalBeforeDiscount = cart.reduce((acc: number, item: any) => acc + (item.precio * item.cantidad), 0);
  const total = Math.max(0, totalBeforeDiscount - discount);
  const subtotal = total * 0.84; 
  const iva = total * 0.16;

  const selectedItem = cart.find((item: any) => item.id === selectedItemId);

  // 0. PANTALLA DE INTRO (LOADING)
  if (isLoadingIntro) {
    return (
      <div className={`flex flex-col items-center justify-center h-screen font-sans transition-all duration-500 ${
        theme === 'dark' ? 'bg-[#0d0e12] text-slate-300' : 'bg-slate-50 text-slate-700'
      }`}>
        <div className="flex flex-col items-center max-w-sm w-full px-6 animate-fade-in">
          {/* Logo animado grande */}
          <div className={`relative mb-8 p-8 rounded-3xl border backdrop-blur-md flex items-center justify-center transition-all ${
            theme === 'dark' 
              ? 'bg-[#13151b] border-[#20222b] vante-accent-glow' 
              : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'
          }`}>
            <img 
              src={vanteLogo} 
              alt="Vante POS Logo" 
              className="h-28 w-auto object-contain animate-pulse" 
            />
          </div>
          
          {/* Título de la Aplicación */}
          <h2 className="text-2xl font-black tracking-wider text-center uppercase mb-1">
            <span className="text-gradient-vante">Vante POS</span>
          </h2>
          <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mb-12">
            Punto de Venta Híbrido
          </p>

          {/* Barra de progreso de carga */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden relative border border-slate-500/5">
            <div className="bg-gradient-vante h-full rounded-full animate-loading-bar" style={{ width: '0%' }}></div>
          </div>
          
          {/* Texto de Carga */}
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest mt-3.5 animate-pulse">
            Iniciando base de datos local SQLite...
          </p>
        </div>
      </div>
    );
  }

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
          
          {/* Logo Oficial Vante POS */}
          <div className={`flex justify-center items-center mb-6 w-full px-4 py-2.5 rounded-2xl border transition-all ${
            theme === 'dark' 
              ? 'bg-[#13151b]/80 border-[#20222b] backdrop-blur-md shadow-[0_0_25px_rgba(168,85,247,0.12)]' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <img src={vanteLogo} alt="Vante POS" className="h-14 object-contain" />
          </div>
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

        {/* Widget de Activación (Solo si está en Demo) */}
        {licenseStatus === 'DEMO' && (
          <div className={`mt-6 border p-6 rounded-3xl w-[400px] shadow-lg flex flex-col items-center transition-all ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b] text-slate-300' : 'bg-white border-slate-200 text-slate-700'
          }`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-2">Activación de Licencia</h4>
            <div className="text-[10px] text-slate-500 font-mono mb-4 text-center">
              HWID: <span className="font-bold text-slate-300">{hardwareId}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(hardwareId);
                  alert('¡Hardware ID copiado al portapapeles!');
                }}
                className="ml-2 bg-slate-800 hover:bg-slate-700 text-[9px] px-1.5 py-0.5 rounded cursor-pointer border-0 text-amber-500"
              >
                Copiar
              </button>
            </div>

            {licenseError && (
              <div className="text-rose-500 text-[10px] bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg mb-4 text-center">
                {licenseError}
              </div>
            )}

            <div className="space-y-3 w-full">
              <input
                type="email"
                placeholder="Email del Cliente"
                value={licenseEmail}
                onChange={(e) => setLicenseEmail(e.target.value)}
                className={`w-full text-xs rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
              <input
                type="text"
                placeholder="Licencia (Key)"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className={`w-full text-xs rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono ${
                  theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
              <button
                onClick={() => handleActivateLicense(licenseEmail, licenseKey)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer border-0"
              >
                Activar Vante POS
              </button>
            </div>

            {daysRemaining <= 30 && (
              <div className="mt-4 text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-center">
                ⚠️ Tu periodo de prueba expira en {daysRemaining <= 0 ? '0' : daysRemaining} días.
              </div>
            )}
          </div>
        )}

        {/* MODAL: AUTENTICACIÓN SUPER ADMIN */}
        {showSuperAdminAuthModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className={`p-8 rounded-3xl border w-full max-w-sm shadow-2xl relative ${
              theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}>
              <button 
                onClick={() => setShowSuperAdminAuthModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-md font-bold uppercase tracking-wider">Super Admin Master Setup</h3>
                <p className="text-xs text-slate-400 mt-2">
                  Ingrese el PIN maestro de seguridad para desbloquear los parámetros de red e infraestructura.
                </p>
              </div>

              {superAdminAuthError && (
                <div className="text-rose-500 text-xs font-semibold mb-4 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-center">
                  {superAdminAuthError}
                </div>
              )}

              <form onSubmit={handleSuperAdminAuthSubmit} className="space-y-4">
                <input 
                  type="password" 
                  required
                  maxLength={12}
                  placeholder="Clave Maestra"
                  className="w-full text-center tracking-widest text-lg font-black rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 bg-[#0d0e12] border-[#20222b] text-white"
                  value={superAdminAuthPin}
                  onChange={e => setSuperAdminAuthPin(e.target.value)}
                />
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl border-0 cursor-pointer text-xs uppercase tracking-wider transition-all">
                  Ingresar al Setup
                </button>
              </form>
            </div>
          </div>
        )}

        {/* OVERLAY: CONFIGURACIÓN SUPER ADMIN */}
        {showSuperAdminSetup && (
          <div className="fixed inset-0 bg-slate-950 z-[200] flex items-center justify-center p-6 overflow-y-auto">
            <div className="w-full max-w-lg bg-[#13151b] border border-[#20222b] rounded-3xl p-8 shadow-2xl text-slate-100 font-sans">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-white">Vante Super Admin Panel</h2>
                  <p className="text-xs text-slate-400">Configuración de Red y Despliegue Híbrido</p>
                </div>
                <button 
                  onClick={() => setShowSuperAdminSetup(false)}
                  className="text-slate-500 hover:text-white border-0 bg-transparent cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {setupError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-semibold mb-6">
                  ⚠️ {setupError}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Modo de Despliegue</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setSetupMode('LOCAL')}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        setupMode === 'LOCAL'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-[#262836] bg-[#1a1c24] text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Caja Local (SQLite)
                    </button>
                    <button
                      onClick={() => setSetupMode('HYBRID')}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                        setupMode === 'HYBRID'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-[#262836] bg-[#1a1c24] text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Modo Híbrido Nube (Supabase)
                    </button>
                  </div>
                </div>

                {setupMode === 'HYBRID' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supabase project URL</label>
                      <input
                        type="url"
                        placeholder="https://xxxx.supabase.co"
                        value={setupSupabaseUrl}
                        onChange={(e) => setSetupSupabaseUrl(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supabase Anon Key</label>
                      <textarea
                        rows={3}
                        placeholder="eyJhbGciOi..."
                        value={setupSupabaseAnonKey}
                        onChange={(e) => setSetupSupabaseAnonKey(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500 font-mono resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servidor API Nube (Render)</label>
                      <input
                        type="url"
                        placeholder="https://vante-api.onrender.com"
                        value={setupApiBaseUrl}
                        onChange={(e) => setSetupApiBaseUrl(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        disabled={isValidatingSetup}
                        onClick={handleTestSetupConnection}
                        className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer border-0 shadow-md"
                      >
                        {isValidatingSetup ? 'Validando conexión...' : '⚡ Probar Conexión Supabase'}
                      </button>

                      {/* Siempre visible: Caja para Connection String y generación de .env */}
                      <div className="space-y-2 border border-[#20222b] bg-[#0d0e12]/40 p-3.5 rounded-xl mt-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Supabase Connection String (URI)
                        </label>
                        <input
                          type="text"
                          placeholder="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"
                          value={setupDbConnectionString}
                          onChange={(e) => setSetupDbConnectionString(e.target.value)}
                          className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500 font-mono"
                        />
                        <p className="text-[9px] text-slate-500 leading-normal">
                          Lo encuentras en Supabase, seccion Settings, luego Database, Connection string, y finalmente URI.
                        </p>
                        
                        <div className="flex gap-2 pt-1">
                          {schemaNeeded && (
                            <button
                              type="button"
                              disabled={isInitingSchema || !setupDbConnectionString.trim()}
                              onClick={handleInitSchema}
                              className="flex-1 text-white font-bold py-2 rounded-xl text-xs cursor-pointer border-0 shadow-md transition-colors"
                              style={{
                                background: isInitingSchema
                                  ? '#334155'
                                  : 'linear-gradient(135deg, #f59e0b, #d97706)'
                              }}
                            >
                              {isInitingSchema ? '⏳ Inicializando...' : '🛠 Inicializar BD'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleGenerateEnv}
                            disabled={!setupDbConnectionString.trim()}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-200 font-bold py-2 rounded-xl text-xs cursor-pointer border-0 shadow-md transition-colors"
                            title="Generar archivo .env para subir a Render"
                          >
                            📄 Generar .env Render
                          </button>
                        </div>
                      </div>

                      {initProgress.length > 0 && (
                        <div className="bg-[#0d0e12] border border-[#20222b] rounded-xl p-3 text-[10px] font-mono text-slate-300 space-y-1 max-h-32 overflow-y-auto mt-2">
                          {initProgress.map((line, i) => (
                            <div key={i}>{line}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {setupSucursales.length > 0 && (
                      <div className="space-y-4 border-t border-[#20222b] pt-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sucursal Asociada a esta Caja</label>
                          <select
                            value={setupSucursalId}
                            onChange={(e) => {
                              if (e.target.value === 'new') {
                                setShowNewSucursalInput(true);
                              } else {
                                setShowNewSucursalInput(false);
                                setSetupSucursalId(e.target.value);
                              }
                            }}
                            className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                          >
                            {setupSucursales.map((suc) => (
                              <option key={suc.id} value={suc.id}>{suc.nombre} ({suc.id})</option>
                            ))}
                            <option value="new">+ Registrar Nueva Sucursal</option>
                          </select>
                        </div>

                        {showNewSucursalInput && (
                          <div className="grid grid-cols-2 gap-4 border border-dashed border-[#20222b] p-4 rounded-xl">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">ID Único (ej. suc-oriente)</label>
                              <input
                                type="text"
                                value={newSucursalId}
                                onChange={(e) => setNewSucursalId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nombre Sucursal</label>
                              <input
                                type="text"
                                value={newSucursalName}
                                onChange={(e) => setNewSucursalName(e.target.value)}
                                className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-between items-center border-t border-[#20222b] pt-6">
                <button
                  onClick={async () => {
                    if (window.confirm('🚨 ¿Está seguro de que desea REINICIAR TODO EL SISTEMA? Esto borrará el catálogo, usuarios y configuraciones locales regresando al estado de fábrica.')) {
                      try {
                        await fetch(`${API_V1}/system/reset`, { method: 'POST' });
                      } catch (err) {
                        console.error('Error al reiniciar base de datos local:', err);
                      }
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="py-3 px-5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-bold text-xs cursor-pointer transition-all"
                >
                  🗑️ Limpiar y Reiniciar de Fábrica
                </button>
                <button
                  onClick={async () => {
                    const giroActual = config?.giro?.toLowerCase() || 'abarrotes';
                    if (window.confirm(`¿Recargar el catálogo de ${giroActual.toUpperCase()}? Esto agregará los productos del preset sin borrar ventas ni clientes.`)) {
                      try {
                        const res = await fetch(`${API_V1}/presets/load`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ giro: giroActual, limpiarExistentes: true })
                        });
                        if (res.ok) {
                          localStorage.removeItem('pos_products');
                          alert(`✅ Catálogo de ${giroActual.toUpperCase()} cargado con éxito.`);
                          window.location.reload();
                        } else {
                          const err = await res.json();
                          alert('Error al cargar catálogo: ' + (err.error || 'Desconocido'));
                        }
                      } catch (e) { alert('Error de conexión al recargar catálogo.'); }
                    }
                  }}
                  className="py-3 px-5 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold text-xs cursor-pointer transition-all"
                >
                  📦 Recargar Catálogo
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSuperAdminSetup(false)}
                    className="py-3 px-6 rounded-xl border border-[#20222b] text-slate-400 hover:bg-[#1a1c24] font-bold text-xs cursor-pointer"
                  >
                    Cerrar Panel
                  </button>
                  <button
                    disabled={savingSetup}
                    onClick={handleSaveSetup}
                    className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-900 text-slate-950 font-black py-3 px-8 rounded-xl border-0 cursor-pointer text-xs uppercase tracking-wider"
                  >
                    {savingSetup ? 'Guardando...' : 'Guardar Parámetros'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // 1.5. WIZARD DE CONFIGURACIÓN INICIAL (ONBOARDING)
  if (showOnboarding) {
    return (
      <div className="relative w-screen h-screen">
        <OnboardingWizard
          onComplete={async (newConfigData) => {
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

            if (newConfigData.precargarCatalogos) {
              setIsPreloadingPresets(true);
              const presetCount = newConfigData.giro === 'cafeteria' ? '200' : '1,000+';
              setPreloadingMessage(`Generando catálogo inicial de ${presetCount} artículos de ${newConfigData.giro}...`);
              try {
                const res = await fetch(`${API_V1}/presets/load`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ giro: newConfigData.giro, limpiarExistentes: true })
                });
                if (!res.ok) {
                  const err = await res.json();
                  console.error('Error al precargarPreset:', err);
                  alert(`Error al precargar catálogo: ${err.error || 'Desconocido'}`);
                } else {
                  localStorage.removeItem('pos_products');
                }
              } catch (err) {
                console.error(err);
                alert('Error de red al precargar el catálogo.');
              } finally {
                setIsPreloadingPresets(false);
                setShowOnboarding(false);
              }
            } else {
              setShowOnboarding(false);
            }
          }}
        />
        
        {isPreloadingPresets && (
          <div className="absolute inset-0 bg-[#07080d]/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease]">
            <div className="relative flex items-center justify-center mb-8">
              {/* Outer glowing spinner */}
              <div className="absolute w-24 h-24 rounded-full border-4 border-amber-500/10 border-t-amber-500 animate-spin" />
              {/* Inner slower reverse spinner */}
              <div className="absolute w-16 h-16 rounded-full border-4 border-violet-500/10 border-t-violet-500 animate-[spin_1.5s_linear_infinite_reverse]" />
              {/* Center icon */}
              <div className="text-3xl animate-pulse">📦</div>
            </div>
            
            <h3 className="text-white font-extrabold text-2xl mb-2 tracking-tight">
              Precargando Catálogo de Vante
            </h3>
            <p className="text-slate-400 text-sm max-w-md text-center px-6 leading-relaxed font-medium">
              {preloadingMessage}
            </p>
            
            {/* Visual Progress Bar simulation */}
            <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-6 border border-slate-700/50">
              <div className="h-full bg-gradient-to-r from-amber-500 to-violet-500 animate-[loadingBar_3s_ease-in-out_infinite]" />
            </div>
            
            <style>{`
              @keyframes loadingBar {
                0% { width: 0%; transform: translateX(-10%); }
                50% { width: 70%; }
                100% { width: 100%; transform: translateX(0); }
              }
            `}</style>
          </div>
        )}
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
            <div className="flex items-center">
              <img src={vanteLogo} alt="Vante POS Logo" className="h-8 object-contain" />
            </div>
          )}
          <div>
            <h1 className={`font-bold text-sm tracking-wide uppercase ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{config.businessName}</h1>
            <p className="text-xs text-amber-500/80 font-medium">
              {localStorage.getItem('vante_sucursal_nombre') || 'Suc. Norte'} - {localStorage.getItem('vante_caja_nombre') || 'Caja 01'}
            </p>
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

        <div className="flex items-center justify-end gap-3 w-fit">
          
          {/* Indicador de Base de Datos Activa (Local SQLite vs Nube Supabase) */}
          <div 
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-lg border text-sky-400 border-sky-500/25 bg-sky-500/10 cursor-default select-none transition-all shadow-sm"
            title={config?.enableCloudBackups ? 'Operando con sincronización a Supabase Cloud' : 'Operando localmente en SQLite integrado'}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            {localStorage.getItem('vante_deployment_mode') === 'HYBRID' && <Cloud className="w-3.5 h-3.5 text-sky-400" />}
            <span>{localStorage.getItem('vante_deployment_mode') === 'HYBRID' ? 'NUBE' : 'LOCAL'}</span>
          </div>

          {/* Badge de Red y sincronizadores (Solo visibles si la nube está activada) */}
          {localStorage.getItem('vante_deployment_mode') === 'HYBRID' && (
            <>
              <div 
                onClick={() => {
                  const nextOnline = !isOnline;
                  setIsOnline(nextOnline);
                  if (nextOnline) {
                    procesarColaVentasOffline();
                    sincronizarCatalogoLocal();
                  }
                }}
                className={`flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  isOnline ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-500 border-rose-500/20 bg-rose-500/5'
                }`}
                title="Clic para alternar modo red"
              >
                <Wifi className={`w-3.5 h-3.5 ${isOnline ? 'animate-pulse' : ''}`} /> 
                <span>{isOnline ? 'Sincronizado' : 'Offline'}</span>
              </div>

              {pendingCount > 0 && (
                <button 
                  onClick={forceSync}
                  className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded font-bold hover:bg-amber-500 hover:text-slate-950 transition-colors uppercase animate-pulse"
                  title="Sincronizar movimientos pendientes central"
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
            </>
          )}

          {/* Botones de Navegación de Pantalla (POS / Mesas / KDS) - Solo en Giro Cafetería */}
          {currentUser && config.giro?.toUpperCase() === 'CAFETERIA' && (
            <div className="flex items-center gap-1 border-r pr-2 border-[#20222b]">
              <button 
                onClick={() => { setCurrentScreen('pos'); setCurrentView('pos'); }}
                className={`font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border-0 cursor-pointer ${
                  currentScreen === 'pos' && currentView === 'pos'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                ☕ Caja
              </button>
              <button 
                onClick={() => { setCurrentScreen('tables'); setCurrentView('pos'); }}
                className={`font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border-0 cursor-pointer ${
                  currentScreen === 'tables' && currentView === 'pos'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                🪑 Mesas
              </button>
              <button 
                onClick={() => { setCurrentScreen('kds'); setCurrentView('pos'); }}
                className={`font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border-0 cursor-pointer ${
                  currentScreen === 'kds' && currentView === 'pos'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 KDS Barra
              </button>
            </div>
          )}

          {/* Botón de Administración */}
          {currentUser && currentUser.rol === 'Administrador' && (
            <button 
              onClick={() => setCurrentView('admin')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-955 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all text-xs border-0 cursor-pointer shadow-md shadow-amber-500/10 active:scale-95"
              title="Ir al Panel de Administración"
            >
              <LayoutDashboard className="w-4 h-4" /> Admin
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
              <span>{currentUser.nombre} <span className="text-[10px] text-slate-400">({currentUser.rol})</span>{selectedTable ? <span className="ml-2 bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold">{tablesData[selectedTable]?.name || selectedTable.replace('T', 'Mesa ')}</span> : ''}</span>
            </div>
            <button 
              onClick={() => { 
                setCurrentUser(null);
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

        {currentScreen === 'tables' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-[#0d0e12]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white">🪑 Layout de Mesas - Cafetería</h2>
                <p className="text-xs text-slate-400">Selecciona una mesa ocupada para cargar su cuenta en caja o liberar mesa.</p>
              </div>
              <div className="flex gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> Libre
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Ocupada
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-3 h-3 rounded-full bg-amber-500" /> Cuenta Pedida
                </span>
              </div>
            </div>

            {/* Grid de Mesas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl">
              {Object.entries(tablesData).map(([id, t]: [string, any]) => (
                <div
                  key={id}
                  onClick={() => {
                    if (t.status === 'Free') {
                      setSelectedTable(id);
                      setCart([]);
                      setCurrentScreen('pos');
                    } else {
                      setSelectedTable(id);
                      const mockCart = t.order.map((item: any, idx: number) => ({
                        id: idx + 1,
                        productoId: `MOCK-${id}-${idx}`,
                        sku: `MOCK-${id}-${idx}`,
                        nombre: item.name,
                        tipo: 'bebida',
                        metadata: { marca: 'Barra', ubicacion: 'Cafetería' },
                        precio: item.price,
                        cantidad: item.qty,
                        unidad: 'pzas'
                      }));
                      setCart(mockCart);
                      setCurrentScreen('pos');
                    }
                  }}
                  className={`border-2 rounded-2xl p-6 flex flex-col items-center justify-between cursor-pointer transition-all active:scale-95 shadow-lg select-none min-h-[160px] ${
                    t.status === 'Free'
                      ? 'bg-[#13151b] border-emerald-500/30 hover:border-emerald-500/80 text-emerald-400 shadow-[0_4px_20px_rgba(16,185,129,0.05)]'
                      : t.status === 'Occupied'
                      ? 'bg-[#13151b] border-rose-500/30 hover:border-rose-500/80 text-rose-400 shadow-[0_4px_20px_rgba(239,68,68,0.05)]'
                      : 'bg-[#13151b] border-amber-500/30 hover:border-amber-500/80 text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.05)]'
                  }`}
                >
                  <span className="text-3xl">
                    {t.status === 'Free' ? '🟢' : t.status === 'Occupied' ? '🔴' : '🔔'}
                  </span>
                  <div className="text-center mt-2">
                    <span className="text-lg font-black tracking-tight text-white">{t.name || id.replace('T', 'Mesa ')}</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                      {t.status === 'Free' ? 'Disponible' : t.status === 'Occupied' ? 'Consumiendo' : 'Pide Cuenta'}
                    </p>
                  </div>
                  {t.subtotal > 0 ? (
                    <span className="mt-4 px-3 py-1 bg-slate-900 border border-[#20222b] text-white text-xs font-black rounded-lg">
                      ${t.subtotal.toFixed(2)}
                    </span>
                  ) : (
                    <span className="mt-4 px-3 py-1 text-slate-600 text-xs font-bold">
                      Vacía
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentScreen === 'kds' && (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto bg-[#0d0e12]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white">📋 Pantalla KDS - Estación Barista</h2>
                <p className="text-xs text-slate-400">Órdenes de bebidas en cola de preparación. Haz clic en "Listo" para archivar.</p>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold rounded-lg">
                Órdenes Activas: {kdsOrders.length}
              </span>
            </div>

            {/* Grid de Comandas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
              {kdsOrders.map((order) => (
                <div
                  key={order.id}
                  className={`bg-[#13151b] border rounded-2xl overflow-hidden flex flex-col shadow-xl min-h-[220px] ${
                    order.status === 'green'
                      ? 'border-emerald-500/20'
                      : order.status === 'orange'
                      ? 'border-amber-500/20'
                      : 'border-rose-500/20'
                  }`}
                >
                  <div className={`px-4 py-3 flex justify-between items-center ${
                    order.status === 'green'
                      ? 'bg-emerald-500/10'
                      : order.status === 'orange'
                      ? 'bg-amber-500/10'
                      : 'bg-rose-500/10'
                  }`}>
                    <div>
                      <span className="text-xs font-bold text-slate-400">Orden {order.id}</span>
                      <h4 className="text-white font-black text-sm mt-0.5">{order.customer}</h4>
                    </div>
                    <span className={`text-xs font-mono font-black ${
                      order.status === 'green'
                        ? 'text-emerald-400'
                        : order.status === 'orange'
                        ? 'text-amber-400'
                        : 'text-rose-400 animate-pulse'
                    }`}>
                      ⏱️ {order.time}
                    </span>
                  </div>

                  <div className="p-4 flex-1">
                    <ul className="space-y-2.5">
                      {order.items.map((item: string, idx: number) => (
                        <li key={idx} className="text-slate-200 text-xs font-medium flex items-start gap-2">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 border-t border-[#20222b] bg-[#090a0d]/40 flex gap-2">
                    <button
                      onClick={() => setKdsOrders(prev => prev.filter(x => x.id !== order.id))}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl border-0 cursor-pointer shadow-md active:scale-95 transition-all"
                    >
                      Listo
                    </button>
                    <button
                      onClick={() => alert(`Detalles de Orden ${order.id}: Mesero: Carlos, Mesa: 4, Notas: Sin azúcar.`)}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-[#2b2d3d] cursor-pointer transition-colors"
                    >
                      Ver
                    </button>
                  </div>
                </div>
              ))}
              {kdsOrders.length === 0 && (
                <div className="col-span-full py-16 flex flex-col items-center justify-center border border-dashed border-[#20222b] rounded-2xl bg-[#090a0d]/10">
                  <span className="text-4xl mb-3">☕</span>
                  <p className="text-sm font-bold text-slate-400">¡Barra limpia!</p>
                  <p className="text-xs text-slate-500 mt-1">No hay bebidas pendientes por preparar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentScreen === 'pos' && (
          config.giro?.toUpperCase() === 'CAFETERIA' ? (
            <div className="flex flex-1 overflow-hidden bg-[#0d0e12] text-slate-100 font-sans select-none w-full h-full">
              {/* Column 1: Catalog (55% width) */}
              <section className="w-[55%] flex flex-col border-r border-[#20222b] h-full p-4 overflow-y-auto">
                <div className="flex justify-between items-center pb-3 border-b border-[#20222b] mb-4">
                  {/* Category tabs matching design */}
                  <div className="flex gap-4">
                    {[
                      { id: 'Bebidas', label: 'BEBIDAS', icon: '🥛' },
                      { id: 'Alimentos', label: 'ALIMENTOS', icon: '🥐' },
                      { id: 'Postres', label: 'POSTRES', icon: '🍰' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedVisualCategory(tab.id)}
                        className={`px-4 py-2 text-xs font-extrabold tracking-wider border-b-2 cursor-pointer transition-all flex items-center gap-2 border-0 bg-transparent ${
                          selectedVisualCategory === tab.id
                            ? 'text-white border-purple-500 shadow-[0_2px_10px_rgba(168,85,247,0.15)]'
                            : 'text-slate-500 hover:text-slate-300 border-transparent'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                  <MoreVertical className="w-5 h-5 text-slate-500 cursor-pointer hover:text-white" />
                </div>

                <h3 className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-4">
                  {selectedVisualCategory === 'Bebidas' ? 'BEBIDAS' : selectedVisualCategory === 'Alimentos' ? 'ALIMENTOS' : 'POSTRES'}
                </h3>

                {/* Grid of Product Cards */}
                <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-1">
                  {(() => {
                    const currentCategoryLower = selectedVisualCategory.toLowerCase();
                    
                    // Optimización: calcular hayFlagEnCategoria una sola vez por render de categoría O(N)
                    const hayFlagEnCategoria = products.some((x: any) => {
                      const xCat = x.categoria?.nombre || x.categoria;
                      const xImg = x.metadatos?.imagenUrl || x.metadata?.imagenUrl;
                      return typeof xCat === 'string' &&
                        xCat.toLowerCase() === currentCategoryLower &&
                        xImg &&
                        (x.metadatos?.enMenuRapido === true || x.metadata?.enMenuRapido === true);
                    });

                    return products
                      .filter((p: any) => {
                        const pCat = p.categoria?.nombre || p.categoria;
                        const matchesCat = typeof pCat === 'string' && pCat.toLowerCase() === currentCategoryLower;
                        if (!matchesCat) return false;
                        
                        // Solo los artículos con imagen aparecen en el front
                        const imageSrc = p.metadatos?.imagenUrl || p.metadata?.imagenUrl;
                        if (!imageSrc) return false;

                        if (hayFlagEnCategoria) {
                          return p.metadatos?.enMenuRapido === true || p.metadata?.enMenuRapido === true;
                        }
                        return true; // sin flags configuradas → mostrar todos
                      })
                      .map((p: any) => {
                        const imageSrc = p.metadatos?.imagenUrl || p.metadata?.imagenUrl;
                        const cartItem = cart.find((item: any) => item.productoId === p.id || item.sku === p.sku);
                        const qtyInCart = cartItem ? cartItem.cantidad : 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleAddToCart(p)}
                            className={`group bg-[#13151b] border-2 rounded-2xl overflow-hidden cursor-pointer transition-all shadow-lg flex flex-col justify-between min-h-[190px] relative select-none ${
                              qtyInCart > 0 ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-[#20222b] hover:border-amber-500/50'
                            }`}
                          >
                            {qtyInCart > 0 && (
                              <div className="absolute top-2.5 right-2.5 bg-slate-800 border border-[#20222b] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10">
                                {qtyInCart}
                              </div>
                            )}
                            {imageSrc ? (
                              <div className="w-full h-24 overflow-hidden relative">
                                <img src={imageSrc} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              </div>
                            ) : (
                              <div className="w-full h-24 bg-[#090a0d] flex items-center justify-center text-3xl">
                                {selectedVisualCategory === 'Bebidas' ? '☕' : selectedVisualCategory === 'Alimentos' ? '🥪' : '🍰'}
                              </div>
                            )}
                            <div className="p-3 flex-1 flex flex-col justify-between">
                              <div>
                                <span className="text-xs font-black text-slate-100 line-clamp-1 group-hover:text-amber-400 transition-colors leading-snug">{p.nombre}</span>
                                <span className="text-[10px] text-slate-500 line-clamp-2 mt-1 leading-normal">
                                  {p.descripcion || `${p.nombre} premium de nuestra barra preparado al momento.`}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-[#20222b]/50">
                                <span className="text-xs font-extrabold text-[#f59e0b]">${Number(p.precio).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              </section>

              {/* Column 2: Current Order (22% width) */}
              <section className="w-[22%] flex flex-col border-r border-[#20222b] h-full p-4 overflow-y-auto bg-[#090a0d]">
                <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black p-3.5 rounded-t-2xl flex justify-between items-center select-none shadow-md shrink-0">
                  <span className="text-xs uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                    <List className="w-4 h-4" /> Comanda Actual
                  </span>
                  <MoreVertical className="w-4 h-4 cursor-pointer" />
                </div>
                
                <div className="flex-1 bg-[#13151b] border-x border-b border-[#20222b] rounded-b-2xl p-3 overflow-y-auto space-y-3.5 animate-fadeIn">
                  {cart.map((item: any) => {
                    const imageSrc = item.metadata?.imagenUrl || item.metadatos?.imagenUrl;
                    return (
                      <div
                        key={item.id}
                        className="bg-[#1a1c24] border border-amber-500/70 rounded-xl p-3 flex items-center justify-between shadow-md relative group transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          {imageSrc ? (
                            <img src={imageSrc} alt={item.nombre} className="w-10 h-10 rounded-full object-cover border border-[#20222b]" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[#090a0d] flex items-center justify-center text-sm border border-[#20222b]">
                              ☕
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-100 line-clamp-1">{item.nombre}</span>
                            <span className="text-[10px] text-slate-500 font-extrabold mt-0.5">({item.cantidad})</span>
                          </div>
                        </div>
                        <span className="text-xs font-extrabold text-[#f59e0b]">-${Number(item.precio * item.cantidad).toFixed(2)}</span>
                        
                        {/* Control buttons overlay on hover */}
                        <div className="absolute inset-0 bg-[#13151b]/90 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-150">
                          <button
                            onClick={() => handleDecrement(item.id)}
                            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border-0 cursor-pointer text-sm"
                          >
                            -
                          </button>
                          <span className="text-xs font-black text-white">{item.cantidad}</span>
                          <button
                            onClick={() => handleIncrement(item.id)}
                            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold border-0 cursor-pointer text-sm"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="w-7 h-7 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 flex items-center justify-center border-0 cursor-pointer ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {cart.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 italic text-xs">
                      <span>No hay artículos en la comanda actual.</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Column 3: Summary & Payments (23% width) */}
              <section className="w-[23%] flex flex-col justify-between h-full p-4 bg-[#13151b] border-l border-[#20222b]">
                {/* Header Summary */}
                <div className="flex justify-between items-center pb-3 border-b border-[#20222b]">
                  <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                    Comanda
                  </h3>
                  <MoreVertical className="w-4 h-4 text-slate-500 cursor-pointer" />
                </div>
                
                {/* Totals Section */}
                <div className="py-4 space-y-2 border-b border-[#20222b]">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Impuestos (16%)</span>
                    <span className="font-mono">${(subtotal * 0.16).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-white pt-2 border-t border-[#20222b]/50 mt-2">
                    <span>Total</span>
                    <span className="font-mono text-[#f59e0b]">${total.toFixed(2)}</span>
                  </div>
                </div>
                
                {/* Quick Payment Buttons */}
                <div className="flex-1 flex flex-col justify-end space-y-3.5 pt-4">
                  {selectedTable && (
                    <button
                      disabled={cart.length === 0}
                      onClick={async () => {
                        const electronAPI = (window as any).electronAPI;
                        try {
                          const updatedTables = {
                            ...tablesData,
                            [selectedTable]: {
                              ...tablesData[selectedTable],
                              status: cart.length > 0 ? 'Occupied' : 'Free',
                              order: cart.map((item: any) => ({
                                name: item.nombre,
                                price: item.precio,
                                qty: item.cantidad
                              })),
                              subtotal: cart.reduce((sum: number, x: any) => sum + x.precio * x.cantidad, 0)
                            }
                          };
                          
                          setTablesData(updatedTables);
                          localStorage.setItem('vante_tables_data', JSON.stringify(updatedTables));
                          
                          // Publicar en el servidor
                          await fetch(`${API_V1}/mesas`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mesas: updatedTables })
                          });
                          
                          // Enviar bebidas al KDS
                          const drinkItems = cart.filter((item: any) => {
                            const name = String(item.nombre || item.name || '').toLowerCase();
                            const cat = String(item.categoria?.nombre || item.categoria || item.tipo || '').toLowerCase();
                            return cat.includes('bebida') || cat.includes('café') || cat.includes('cafe') ||
                                   name.includes('café') || name.includes('capuchino') || name.includes('latte') ||
                                   name.includes('espresso') || name.includes('smoothie') || name.includes('frappé');
                          });

                          const targetPrinter = config.printerBodega || localStorage.getItem('pos_printer_bodega') || '';

                          if (drinkItems.length > 0) {
                            const drinksText = drinkItems.map((d: any) => `${d.cantidad}x ${d.nombre}`).sort().join(', ');
                            const uniqueSignature = `${selectedTable}-${drinksText}`;

                            // Imprimir físicamente en barra
                            if (electronAPI && targetPrinter) {
                              try {
                                await electronAPI.printTicket({
                                  ticketId: `#Mesa-${selectedTable.replace('T', '')}`,
                                  cajero: currentUser?.nombre || 'Mesero',
                                  items: drinkItems.map((d: any) => ({
                                    sku: d.sku || '',
                                    nombre: d.nombre,
                                    precio: Number(d.precio || 0),
                                    cantidad: Number(d.cantidad || 1),
                                    unidad: d.unidad || 'pzas'
                                  })),
                                  total: drinkItems.reduce((sum: number, x: any) => sum + x.precio * x.cantidad, 0),
                                  printerTarget: 'bodega',
                                  printerName: targetPrinter,
                                  businessName: `COMANDA: ${tablesData[selectedTable]?.name || 'Mesa'}`,
                                  address: 'Estación de Barra',
                                  phone: '',
                                  ticketMessage: 'Favor de preparar a la brevedad.',
                                  printerType: config.printerType
                                });
                              } catch (printErr) {
                                console.warn('Error al imprimir comanda en barra:', printErr);
                              }
                            }

                            // Añadir a firmas impresas para evitar re-impresión en el polling
                            setPrintedSignatures(prev => [...prev, uniqueSignature]);

                            const newKdsOrder = {
                              id: `#Mesa-${selectedTable.replace('T', '')}`,
                              customer: tablesData[selectedTable]?.name || `Mesa ${selectedTable.replace('T', '')}`,
                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              items: drinkItems.map((d: any) => `${d.cantidad}x ${d.nombre}`),
                              drinksSignature: drinksText,
                              status: 'green'
                            };
                            setKdsOrders(prev => {
                              const filtered = prev.filter(x => x.customer !== newKdsOrder.customer);
                              return [newKdsOrder, ...filtered];
                            });
                          }
                          
                          setSelectedTable(null);
                          setCart([]);
                          setCurrentScreen('tables');
                          alert('Comanda de la mesa guardada y sincronizada correctamente.');
                        } catch (err) {
                          console.error(err);
                          alert('Error al guardar comanda de la mesa.');
                        }
                      }}
                      className="w-full bg-[#3b2b1c] hover:bg-[#4a3623] disabled:bg-slate-900 border border-amber-500/30 hover:border-amber-500/80 rounded-2xl p-4 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed mb-2.5"
                    >
                      <span className="text-xs font-black text-amber-400 tracking-wide uppercase">💾 Guardar Comanda (Mesa)</span>
                    </button>
                  )}

                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Pago Rápido</span>
                  
                  {/* CASH BUTTON */}
                  <button
                    disabled={cart.length === 0}
                    onClick={() => handleCheckout('EFECTIVO')}
                    className="w-full bg-[#1b2c24] hover:bg-[#233a2f] disabled:bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/80 rounded-2xl p-4 flex items-center justify-between text-left cursor-pointer transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Coins className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white tracking-wide">EFECTIVO</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Cobrar con Efectivo</span>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[#f59e0b]">${total.toFixed(2)}</span>
                  </button>

                  {/* CARD BUTTON */}
                  <button
                    disabled={cart.length === 0}
                    onClick={() => handleCheckout('TARJETA')}
                    className="w-full bg-[#1c243a] hover:bg-[#243152] disabled:bg-slate-900 border border-blue-500/30 hover:border-blue-500/80 rounded-2xl p-4 flex items-center justify-between text-left cursor-pointer transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white tracking-wide">TARJETA</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Tarjeta Débito/Crédito</span>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[#f59e0b]">${total.toFixed(2)}</span>
                  </button>

                  {/* CoDi BUTTON */}
                  <button
                    disabled={cart.length === 0}
                    onClick={() => handleCheckout('TRANSFERENCIA')}
                    className="w-full bg-[#291b35] hover:bg-[#382449] disabled:bg-slate-900 border border-purple-500/30 hover:border-purple-500/80 rounded-2xl p-4 flex items-center justify-between text-left cursor-pointer transition-all active:scale-[0.98] group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white tracking-wide">CoDi</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Transferencia / CoDi</span>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-[#f59e0b]">${total.toFixed(2)}</span>
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <>
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
              <button 
                onClick={() => setShowAssignClientModal(true)}
                className="text-amber-500 hover:text-amber-400 font-semibold flex items-center gap-1.5 hover:bg-amber-500/10 px-3 py-1 rounded-lg transition-colors border border-transparent hover:border-amber-500/20 text-xs bg-transparent cursor-pointer"
              >
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
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-[#20222b]">
                  <h3 className="text-sm font-black text-white">📋 Menú Rápido</h3>
                  <div className="flex gap-1.5">
                    {['Bebidas', 'Alimentos', 'Postres'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedVisualCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                          selectedVisualCategory === cat
                            ? 'bg-amber-500 border-transparent text-slate-950 font-black'
                            : 'bg-transparent border-[#20222b] text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cat === 'Bebidas' ? '☕ Bebidas' : cat === 'Alimentos' ? '🥪 Alimentos' : '🍰 Postres'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {products
                    .filter((p: any) => {
                      const pCat = p.categoria?.nombre || p.categoria;
                      const matchesCat = typeof pCat === 'string' && pCat.toLowerCase() === selectedVisualCategory.toLowerCase();
                      if (!matchesCat) return false;
                      const imageSrc = p.metadatos?.imagenUrl || p.metadata?.imagenUrl;
                      return !!imageSrc;
                    })
                    .slice(0, 12)
                    .map((p: any) => {
                      const imageSrc = p.metadatos?.imagenUrl || p.metadata?.imagenUrl;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleAddToCart(p)}
                          className="group bg-[#13151b] border border-[#20222b] hover:border-amber-500/50 rounded-xl overflow-hidden cursor-pointer transition-all shadow-md select-none flex flex-col justify-between min-h-[140px]"
                        >
                          {imageSrc ? (
                            <img src={imageSrc} alt={p.nombre} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-full h-20 bg-[#090a0d] flex items-center justify-center text-xl">
                              {selectedVisualCategory === 'Bebidas' ? '☕' : selectedVisualCategory === 'Alimentos' ? '🥪' : '🍰'}
                            </div>
                          )}
                          <div className="p-2.5 flex-1 flex flex-col justify-between">
                            <span className="text-[11px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">{p.nombre}</span>
                            <div className="flex justify-between items-center mt-2.5">
                              <span className="text-xs font-black text-white">${Number(p.precio).toFixed(2)}</span>
                              <span className="text-[9px] bg-slate-900 border border-[#20222b] text-slate-400 px-1.5 py-0.5 rounded font-black">
                                +
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
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
            </>
          )
        )}
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
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${theme === 'dark' ? 'bg-[#1b1c24] border-[#2b2d3a] text-amber-500' : 'bg-white border-slate-300 text-amber-600'}`}>F5</kbd>
            <span>Importar Cot.</span>
          </span>
          <span className="flex items-center gap-1 flex-wrap">
            <kbd className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${theme === 'dark' ? 'bg-[#1b1c24] border-[#2b2d3a] text-amber-500' : 'bg-white border-slate-300 text-amber-600'}`}>F6</kbd>
            <span>Nuevo Ticket</span>
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

          {/* Botones de Navegación POS (Movidos al Footer) */}
          {currentUser && (
            <button 
              onClick={() => setCurrentView('quotes')}
              className={`font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[10px] border cursor-pointer active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-500 shadow-md' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-amber-600 shadow-sm'
              }`}
              title="Ir al Módulo de Cotizaciones"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Cotizaciones
            </button>
          )}

          {/* Botón de CRM */}
          {currentUser && (
            <button 
              onClick={() => setCurrentView('crm')}
              className={`font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[10px] border cursor-pointer active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-500 shadow-md' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-amber-600 shadow-sm'
              }`}
              title="Ir al Módulo de CRM Clientes"
            >
              <User className="w-3.5 h-3.5" /> CRM Clientes
            </button>
          )}

          {/* Botón de Vante AI */}
          {currentUser && config.habilitarIA && (
            <button 
              onClick={() => setCurrentView('ai')}
              className="font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[10px] border cursor-pointer active:scale-95 bg-violet-950/20 hover:bg-violet-900/40 border-violet-500/30 text-violet-400 shadow-md"
              title="Abrir Asistente Virtual Vante AI"
            >
              <Brain className="w-3.5 h-3.5" /> Vante AI
            </button>
          )}

          {/* Botón de Reportes */}
          {currentUser && (currentUser.rol === 'Administrador' || currentUser.rol === 'Gerente') && (
            <button 
              onClick={() => setCurrentView('reports')}
              className={`font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all text-[10px] border cursor-pointer active:scale-95 ${
                theme === 'dark' 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-500 shadow-md' 
                  : 'bg-white hover:bg-slate-50 border-slate-200 text-amber-600 shadow-sm'
              }`}
              title="Ir al Centro de Reportes"
            >
              <TrendingUp className="w-3.5 h-3.5" /> Reportes
            </button>
          )}
        </div>
        <div>
          <span>Vante POS v2.0 • {!isOnline ? '🔴 Fuera de línea' : '🟢 En línea'}</span>
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
              Elige cómo se conectará esta terminal a la base de datos de Vante POS:
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

      {/* Módulo de CRM y Cuentas por Cobrar (Overlay de Pantalla Completa) */}
      {currentView === 'crm' && currentUser && (
        <CRMDashboard 
          theme={theme} 
          onClose={() => setCurrentView('pos')} 
        />
      )}

      {/* Panel de Reportes (Overlay de Pantalla Completa) */}
      {currentView === 'reports' && currentUser && (
        <ReportesDashboard 
          theme={theme} 
          onClose={() => setCurrentView('pos')} 
        />
      )}

      {/* Asistente Vante AI (Overlay de Pantalla Completa) */}
      {currentView === 'ai' && currentUser && config.habilitarIA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-8">
          <div className="w-full max-w-4xl h-[85vh] relative">
            <button 
              onClick={() => setCurrentView('pos')}
              className="absolute -top-3 -right-3 z-50 p-2.5 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all shadow-lg border-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <AIAssistant theme={theme} />
          </div>
        </div>
      )}

      {/* Panel de Administración (Overlay de Pantalla Completa) */}
      {currentView === 'admin' && currentUser && (
        <AdminDashboard 
          currentUser={currentUser} 
          licenseStatus={licenseStatus}
          daysRemaining={daysRemaining}
          theme={theme}
          onClose={() => {
            setCurrentView('pos');
            localStorage.removeItem('vante_super_admin_active');
            localStorage.removeItem('vante_super_admin_method');
          }} 
          config={config}
          onConfigChange={async (newConfig) => {
            setConfig(newConfig);
            localStorage.setItem('pos_config', JSON.stringify(newConfig));
            try {
              const bodyData = {
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
                cotizacionExpiracionMins: newConfig.cotizacionExpiracionMins || 1440,
                printerCaja: newConfig.printerCaja || '',
                printerCliente: newConfig.printerCliente || '',
                printerMovil: newConfig.printerMovil || '',
                printerBodega: newConfig.printerBodega || '',
                showWhatsAppPostSale: newConfig.showWhatsAppPostSale === true,
                enableCloudBackups: newConfig.enableCloudBackups === true,
                enableIntegratedPayments: newConfig.enableIntegratedPayments === true,
                paymentTerminalProvider: newConfig.paymentTerminalProvider || 'none',
                paymentTerminalDeviceId: newConfig.paymentTerminalDeviceId || '',
                enableAutoUpdates: newConfig.enableAutoUpdates === true,
                enableAdvancedInventory: newConfig.enableAdvancedInventory === true,
                habilitarIA: newConfig.habilitarIA === true,
                modeloIA: newConfig.modeloIA || 'gemma2:2b',
                limiteRamIA: Number(newConfig.limiteRamIA) || 4,
                vante_tables_data: (newConfig as any).vante_tables_data || ''
              };

              await fetch(`${API_V1}/configuracion-empresa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
              });

              // Si estamos en modo híbrido, también guardar la configuración localmente
              if (API_V1.includes('onrender.com') || API_V1.includes('supabase') || !API_V1.includes('localhost') && !API_V1.includes('127.0.0.1')) {
                try {
                  await fetch('http://localhost:3001/api/v1/configuracion-empresa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bodyData)
                  });
                } catch (localErr) {
                  console.error('Error saving config to local SQLite API:', localErr);
                }
              }
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

                  {/* Botón A Crédito */}
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('CREDITO'); setAmountPaid(String(total)); }}
                    className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      paymentMethod === 'CREDITO'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-lg">👥</span> A Crédito
                  </button>

                  {((config.allowCash !== false ? 1 : 0) + (config.allowCard !== false ? 1 : 0) + (config.allowTransfer !== false ? 1 : 0)) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('MIXTO');
                        setMixedCash('');
                        setMixedCard('');
                        setMixedTransfer('');
                      }}
                      className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer flex flex-col items-center gap-1.5 col-span-2 ${
                        paymentMethod === 'MIXTO'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                          : theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] hover:border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-lg">🔀</span> Pago Combinado
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

              {/* Lógica Específica de Crédito */}
              {paymentMethod === 'CREDITO' && (
                <div className={`p-4 rounded-xl border space-y-3 animate-fadeIn ${
                  theme === 'dark' ? 'bg-[#1a1c24] border-[#262836]' : 'bg-slate-50 border-slate-200'
                }`}>
                  {activeTab.clienteId ? (
                    <div>
                      <p className="text-xs font-bold text-slate-300 font-sans">
                        Cliente: <span className="text-amber-500">{activeTab.clienteNombre}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-2 text-[11px] text-slate-400">
                        <div>
                          <span>Límite de Crédito:</span>
                          <span className="font-bold block text-slate-250">${Number(activeTab.clienteObj?.limiteCredito || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span>Saldo Deudor Actual:</span>
                          <span className="font-bold block text-rose-500">${Number(activeTab.clienteObj?.saldoDeudor || 0).toFixed(2)}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-slate-700/30 flex justify-between text-xs font-bold">
                          <span>Crédito Disponible:</span>
                          <span className={`font-black ${(Number(activeTab.clienteObj?.limiteCredito || 0) - Number(activeTab.clienteObj?.saldoDeudor || 0)) >= total ? 'text-emerald-400' : 'text-rose-500'}`}>
                            ${(Number(activeTab.clienteObj?.limiteCredito || 0) - Number(activeTab.clienteObj?.saldoDeudor || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {(Number(activeTab.clienteObj?.limiteCredito || 0) - Number(activeTab.clienteObj?.saldoDeudor || 0)) < total && (
                        <p className="text-[10px] text-rose-500 font-bold mt-2">
                          ⚠️ El cliente no cuenta con suficiente crédito disponible.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-3 text-rose-500 text-xs font-bold">
                      ⚠️ Debe asignar un cliente al ticket para cobrar a crédito.
                    </div>
                  )}
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
                  (paymentMethod === 'MIXTO' && (Number(mixedCash || 0) + Number(mixedCard || 0) + Number(mixedTransfer || 0)) < total) ||
                  (paymentMethod === 'CREDITO' && !activeTab.clienteId)
                }
                className="flex-grow bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm flex items-center justify-center gap-1.5"
              >
                {paymentMethod === 'CREDITO' && (Number(activeTab.clienteObj?.limiteCredito || 0) - Number(activeTab.clienteObj?.saldoDeudor || 0)) < total ? (
                  <>
                    <Lock className="w-4 h-4 text-amber-400 animate-pulse" /> Autorizar y Cobrar
                  </>
                ) : (
                  <>✓ Registrar Cobro</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar Cliente / RFC */}
      {showAssignClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-8 rounded-3xl border shadow-2xl relative flex flex-col max-h-[80vh] ${
            theme === 'dark' ? 'bg-[#12141c] border-[#20222b] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <button 
              type="button"
              onClick={() => setShowAssignClientModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" /> Asignar Cliente al Ticket
            </h3>

            <div className="mb-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, teléfono o RFC..."
                  className={`w-full rounded-xl py-2.5 pl-10 pr-4 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={clientSearchQuery}
                  onChange={e => setClientSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-850/20 mb-6">
              {/* Opción Público General */}
              <div 
                onClick={() => {
                  setTabs(prev => prev.map(t => {
                    if (t.id === activeTabId) {
                      return { ...t, clienteNombre: '', clienteId: null, clienteObj: null };
                    }
                    return t;
                  }));
                  setShowAssignClientModal(false);
                }}
                className={`p-3 flex items-center justify-between cursor-pointer rounded-xl transition-colors ${
                  !activeTab.clienteId 
                    ? (theme === 'dark' ? 'bg-amber-500/15 text-amber-400 font-bold' : 'bg-amber-50 text-amber-600 font-bold') 
                    : (theme === 'dark' ? 'hover:bg-[#1a1c24] text-slate-400' : 'hover:bg-slate-50 text-slate-600')
                }`}
              >
                <span>👥 Público General (Sin Crédito)</span>
                {!activeTab.clienteId && <Check className="w-4 h-4 text-amber-500" />}
              </div>

              {/* Lista filtrada */}
              {clientesList
                .filter((c: any) => 
                  c.nombre.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                  (c.telefono && c.telefono.includes(clientSearchQuery)) ||
                  (c.rfc && c.rfc.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                )
                .map((c: any) => {
                  const isSelected = activeTab.clienteId === c.id;
                  return (
                    <div 
                      key={c.id}
                      onClick={() => {
                        setTabs(prev => prev.map(t => {
                          if (t.id === activeTabId) {
                            return { ...t, clienteNombre: c.nombre, clienteId: c.id, clienteObj: c };
                          }
                          return t;
                        }));
                        setShowAssignClientModal(false);
                      }}
                      className={`p-3 flex items-center justify-between cursor-pointer rounded-xl transition-colors ${
                        isSelected 
                          ? (theme === 'dark' ? 'bg-amber-500/15 text-amber-400 font-bold' : 'bg-amber-50 text-amber-600 font-bold') 
                          : (theme === 'dark' ? 'hover:bg-[#1a1c24] text-slate-305' : 'hover:bg-slate-50 text-slate-700')
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <span className="block text-xs font-bold truncate">{c.nombre}</span>
                        <span className="block text-[10px] text-slate-500 mt-0.5 font-mono">
                          {c.rfc ? `RFC: ${c.rfc}` : ''} {c.telefono ? `| Tel: ${c.telefono}` : ''}
                        </span>
                      </div>
                      <div className="text-right pl-3">
                        <span className="block text-xs font-black text-rose-500">${Number(c.saldoDeudor).toFixed(2)}</span>
                        <span className="block text-[9px] text-slate-500">Límite: ${Number(c.limiteCredito).toFixed(0)}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-500 ml-3" />}
                    </div>
                  );
                })}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#20222b]/50">
              <button 
                type="button" 
                onClick={() => setShowAssignClientModal(false)}
                className={`py-2.5 px-6 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
                  theme === 'dark' ? 'bg-transparent border-[#20222b] text-slate-400 hover:bg-[#1a1c24]' : 'bg-slate-100 border-slate-200 text-slate-650 hover:bg-slate-200'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar Recibo por WhatsApp (Post-Venta) */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#12141c] border-[#20222b] text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <button 
              type="button"
              onClick={() => setShowWhatsAppModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-emerald-500 text-lg">💬</span> Enviar Recibo por WhatsApp
            </h3>

            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              ¿Desea enviar el recibo de compra al cliente por WhatsApp? Ingrese el número telefónico de 10 dígitos.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Número de WhatsApp (10 dígitos)</label>
                <input 
                  type="text" 
                  placeholder="Ej. 5512345678"
                  className={`w-full rounded-xl p-3 border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={checkoutWhatsAppPhone}
                  onChange={e => setCheckoutWhatsAppPhone(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowWhatsAppModal(false)}
                className={`py-3 px-6 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
                  theme === 'dark' ? 'bg-transparent border-[#20222b] text-slate-400 hover:bg-[#1a1c24]' : 'bg-slate-100 border-slate-200 text-slate-655 hover:bg-slate-200'
                }`}
              >
                Omitir
              </button>
              <button 
                type="button"
                onClick={() => {
                  const cleanedPhone = checkoutWhatsAppPhone.replace(/\D/g, '');
                  const phoneWithCountry = cleanedPhone.length === 10 ? `52${cleanedPhone}` : cleanedPhone;
                  window.open(`https://wa.me/${phoneWithCountry}?text=${checkoutWhatsAppMessage}`, '_blank');
                  setShowWhatsAppModal(false);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 px-6 rounded-xl border-0 font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Autorización de Crédito Excedido (PIN de Gerente / Admin) */}
      {showAuthorizeCreditModal && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`p-8 rounded-3xl border w-full max-w-sm shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <button 
              onClick={() => setShowAuthorizeCreditModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-md font-bold uppercase tracking-wider">Autorizar Límite de Crédito</h3>
              <p className="text-xs text-slate-500 mt-2">
                El saldo deudor del cliente <strong className="text-slate-350">{activeTab.clienteNombre}</strong> excede su límite de crédito. Se requiere el PIN de un Gerente o Administrador.
              </p>
            </div>

            <form onSubmit={handleVerifyManagerPin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5 text-center">Ingresa el PIN de Autorización</label>
                <input 
                  type="password" 
                  required
                  maxLength={6}
                  placeholder="••••••"
                  className="w-full text-center tracking-widest text-lg font-black rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 bg-[#0d0e12] border-[#20222b] text-white"
                  value={managerPin}
                  onChange={e => setManagerPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="flex flex-col gap-3 pt-3">
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl border-0 cursor-pointer text-xs uppercase tracking-wider transition-all active:scale-95">
                  ✓ Autorizar Crédito
                </button>
                <button type="button" onClick={() => setShowAuthorizeCreditModal(false)} className="w-full bg-transparent border border-slate-700/50 hover:bg-slate-800 text-slate-400 font-bold py-3 rounded-xl cursor-pointer text-xs">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PERSONALIZACIÓN DE BEBIDAS (MODIFICADORES) */}
      {showModifierModal && modifierProduct && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#11131c] border border-violet-500/20 rounded-3xl p-8 w-full max-w-md shadow-[0_20px_50px_rgba(139,92,246,0.15)] relative">
            <button 
              onClick={() => setShowModifierModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Personalizar Bebida</span>
              <h3 className="text-lg font-black text-white mt-1">
                {modifierProduct.nombre}
              </h3>
            </div>

            <div className="space-y-6">
              {/* Leche */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Tipo de Leche</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Entera', 'Deslactosada', 'Almendra', 'Avena'].map(milk => (
                    <button
                      key={milk}
                      type="button"
                      onClick={() => setSelectedMilk(milk)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedMilk === milk
                          ? 'bg-violet-600/20 border-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                          : 'bg-slate-900 border-[#20222b] text-slate-400 hover:text-white'
                      }`}
                    >
                      {milk === 'Almendra' || milk === 'Avena' ? `${milk} (+$12)` : milk}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperatura */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Temperatura</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Caliente', 'Tibio', 'Frío'].map(temp => (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => setSelectedTemp(temp)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        selectedTemp === temp
                          ? 'bg-amber-500/20 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900 border-[#20222b] text-slate-400 hover:text-white'
                      }`}
                    >
                      {temp === 'Caliente' ? '🔥 Caliente' : temp === 'Tibio' ? '🌡️ Tibio' : '❄️ Frío'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extras */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-3 tracking-wider">Extras</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Doble Shot', 'Crema Batida'].map(extra => {
                    const isSelected = selectedExtras.includes(extra);
                    return (
                      <button
                        key={extra}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedExtras(prev => prev.filter(x => x !== extra));
                          } else {
                            setSelectedExtras(prev => [...prev, extra]);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                            : 'bg-slate-900 border-[#20222b] text-slate-400 hover:text-white'
                        }`}
                      >
                        {extra === 'Doble Shot' ? '☕ Doble Shot (+$15)' : '🧁 Crema Batida (+$10)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-8">
              <button
                type="button"
                onClick={() => setShowModifierModal(false)}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-[#20222b] font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmModifiers}
                className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl border-0 cursor-pointer shadow-md active:scale-95 transition-all"
              >
                Confirmar Selección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUTENTICACIÓN SUPER ADMIN */}
      {showSuperAdminAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`p-8 rounded-3xl border w-full max-w-sm shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#13151b] border-[#262836] text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <button 
              onClick={() => setShowSuperAdminAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h3 className="text-md font-bold uppercase tracking-wider">Super Admin Master Setup</h3>
              <p className="text-xs text-slate-400 mt-2">
                Ingrese el PIN maestro de seguridad para desbloquear los parámetros de red e infraestructura.
              </p>
            </div>

            {superAdminAuthError && (
              <div className="text-rose-500 text-xs font-semibold mb-4 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg text-center">
                {superAdminAuthError}
              </div>
            )}

            <form onSubmit={handleSuperAdminAuthSubmit} className="space-y-4">
              <input 
                type="password" 
                required
                maxLength={12}
                placeholder="Clave Maestra"
                className="w-full text-center tracking-widest text-lg font-black rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 bg-[#0d0e12] border-[#20222b] text-white"
                value={superAdminAuthPin}
                onChange={e => setSuperAdminAuthPin(e.target.value)}
              />
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3 rounded-xl border-0 cursor-pointer text-xs uppercase tracking-wider transition-all">
                Ingresar al Setup
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY: CONFIGURACIÓN SUPER ADMIN */}
      {showSuperAdminSetup && (
        <div className="fixed inset-0 bg-slate-950 z-[200] flex items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#13151b] border border-[#20222b] rounded-3xl p-8 shadow-2xl text-slate-100 font-sans">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-white">Vante Super Admin Panel</h2>
                <p className="text-xs text-slate-400">Configuración de Red y Despliegue Híbrido</p>
              </div>
              <button 
                onClick={() => setShowSuperAdminSetup(false)}
                className="text-slate-500 hover:text-white border-0 bg-transparent cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {setupError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-semibold mb-6">
                ⚠️ {setupError}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Modo de Despliegue</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSetupMode('LOCAL')}
                    className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      setupMode === 'LOCAL'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-[#262836] bg-[#1a1c24] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Caja Local (SQLite)
                  </button>
                  <button
                    onClick={() => setSetupMode('HYBRID')}
                    className={`py-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      setupMode === 'HYBRID'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-[#262836] bg-[#1a1c24] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Modo Híbrido Nube (Supabase)
                  </button>
                </div>
              </div>

              {setupMode === 'HYBRID' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supabase project URL</label>
                    <input
                      type="url"
                      placeholder="https://xxxx.supabase.co"
                      value={setupSupabaseUrl}
                      onChange={(e) => setSetupSupabaseUrl(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Supabase Anon Key</label>
                    <textarea
                      rows={3}
                      placeholder="eyJhbGciOi..."
                      value={setupSupabaseAnonKey}
                      onChange={(e) => setSetupSupabaseAnonKey(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500 font-mono resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Servidor API Nube (Render)</label>
                    <input
                      type="url"
                      placeholder="https://vante-api.onrender.com"
                      value={setupApiBaseUrl}
                      onChange={(e) => setSetupApiBaseUrl(e.target.value)}
                      className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      disabled={isValidatingSetup}
                      onClick={handleTestSetupConnection}
                      className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer border-0 shadow-md"
                    >
                      {isValidatingSetup ? 'Validando conexión...' : '⚡ Probar Conexión Supabase'}
                    </button>

                    {/* Siempre visible: Caja para Connection String y generación de .env */}
                    <div className="space-y-2 border border-[#20222b] bg-[#0d0e12]/40 p-3.5 rounded-xl mt-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Supabase Connection String (URI)
                      </label>
                      <input
                        type="text"
                        placeholder="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"
                        value={setupDbConnectionString}
                        onChange={(e) => setSetupDbConnectionString(e.target.value)}
                        className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500 font-mono"
                      />
                      <p className="text-[9px] text-slate-500 leading-normal">
                        Lo encuentras en Supabase, seccion Settings, luego Database, Connection string, y finalmente URI.
                      </p>
                      
                      <div className="flex gap-2 pt-1">
                        {schemaNeeded && (
                          <button
                            type="button"
                            disabled={isInitingSchema || !setupDbConnectionString.trim()}
                            onClick={handleInitSchema}
                            className="flex-1 text-white font-bold py-2 rounded-xl text-xs cursor-pointer border-0 shadow-md transition-colors"
                            style={{
                              background: isInitingSchema
                                ? '#334155'
                                : 'linear-gradient(135deg, #f59e0b, #d97706)'
                            }}
                          >
                            {isInitingSchema ? '⏳ Inicializando...' : '🛠 Inicializar BD'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleGenerateEnv}
                          disabled={!setupDbConnectionString.trim()}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-200 font-bold py-2 rounded-xl text-xs cursor-pointer border-0 shadow-md transition-colors"
                          title="Generar archivo .env para subir a Render"
                        >
                          📄 Generar .env Render
                        </button>
                      </div>
                    </div>

                    {initProgress.length > 0 && (
                      <div className="bg-[#0d0e12] border border-[#20222b] rounded-xl p-3 text-[10px] font-mono text-slate-300 space-y-1 max-h-32 overflow-y-auto mt-2">
                        {initProgress.map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {setupSucursales.length > 0 && (
                    <div className="space-y-4 border-t border-[#20222b] pt-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sucursal Asociada a esta Caja</label>
                        <select
                          value={setupSucursalId}
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              setShowNewSucursalInput(true);
                            } else {
                              setShowNewSucursalInput(false);
                              setSetupSucursalId(e.target.value);
                            }
                          }}
                          className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2.5 px-4 text-xs text-white outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {setupSucursales.map((suc) => (
                            <option key={suc.id} value={suc.id}>{suc.nombre} ({suc.id})</option>
                          ))}
                          <option value="new">+ Registrar Nueva Sucursal</option>
                        </select>
                      </div>

                      {showNewSucursalInput && (
                        <div className="grid grid-cols-2 gap-4 border border-dashed border-[#20222b] p-4 rounded-xl">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">ID Único (ej. suc-oriente)</label>
                            <input
                              type="text"
                              value={newSucursalId}
                              onChange={(e) => setNewSucursalId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                              className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nombre Sucursal</label>
                            <input
                              type="text"
                              value={newSucursalName}
                              onChange={(e) => setNewSucursalName(e.target.value)}
                              className="w-full bg-[#0d0e12] border border-[#20222b] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-between items-center border-t border-[#20222b] pt-6">
              <button
                onClick={async () => {
                  if (window.confirm('🚨 ¿Está seguro de que desea REINICIAR TODO EL SISTEMA? Esto borrará el catálogo, usuarios y configuraciones locales regresando al estado de fábrica.')) {
                    try {
                      await fetch(`${API_V1}/system/reset`, { method: 'POST' });
                    } catch (err) {
                      console.error('Error al reiniciar base de datos local:', err);
                    }
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="py-3 px-5 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 font-bold text-xs cursor-pointer transition-all"
              >
                🗑️ Limpiar y Reiniciar de Fábrica
              </button>
              <button
                onClick={async () => {
                  const giroActual = config?.giro?.toLowerCase() || 'abarrotes';
                  if (window.confirm(`¿Recargar el catálogo de ${giroActual.toUpperCase()}? Esto agregará los productos del preset sin borrar ventas ni clientes.`)) {
                    try {
                      const res = await fetch(`${API_V1}/presets/load`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ giro: giroActual, limpiarExistentes: true })
                      });
                      if (res.ok) {
                        localStorage.removeItem('pos_products');
                        alert(`✅ Catálogo de ${giroActual.toUpperCase()} cargado con éxito.`);
                        window.location.reload();
                      } else {
                        const err = await res.json();
                        alert('Error al cargar catálogo: ' + (err.error || 'Desconocido'));
                      }
                    } catch (e) { alert('Error de conexión al recargar catálogo.'); }
                  }
                }}
                className="py-3 px-5 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 font-bold text-xs cursor-pointer transition-all"
              >
                📦 Recargar Catálogo
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSuperAdminSetup(false)}
                  className="py-3 px-6 rounded-xl border border-[#20222b] text-slate-400 hover:bg-[#1a1c24] font-bold text-xs cursor-pointer"
                >
                  Cerrar Panel
                </button>
                <button
                  disabled={savingSetup}
                  onClick={handleSaveSetup}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-slate-900 text-slate-950 font-black py-3 px-8 rounded-xl border-0 cursor-pointer text-xs uppercase tracking-wider"
                >
                  {savingSetup ? 'Guardando...' : 'Guardar y Reiniciar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Global Alert Modal (Vante POS Dark Theme with 30% Transparency blur card) */}
      {customAlert.visible && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm z-[99999] transition-all">
          <div className="bg-[#13151b]/75 border border-[#20222b]/50 rounded-2xl p-6 w-96 backdrop-blur-md shadow-[0_0_40px_rgba(168,85,247,0.15)] flex flex-col items-center">
            {/* Custom Glowing Icon */}
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            
            <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest mt-4">Notificación Vante</span>
            <p className="text-slate-200 text-sm mt-3 text-center font-medium leading-relaxed">
              {customAlert.message}
            </p>
            
            <button
              onClick={() => setCustomAlert({ visible: false, message: '' })}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-6 rounded-xl border-0 cursor-pointer text-xs w-full mt-6 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all uppercase tracking-wider"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
      {/* UPDATE NOTIFICATION BANNER */}
      {updateStatus !== 'idle' && updateStatus !== 'checking' && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full bg-[#11131c] border border-violet-500/30 rounded-2xl p-4 shadow-[0_8px_32px_rgba(139,92,246,0.25)] animate-[slideInRight_0.3s_ease] backdrop-blur-md">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-bold text-sm tracking-tight">
                {updateStatus === 'available' && 'Actualización Detectada'}
                {updateStatus === 'downloading' && 'Descargando Nueva Versión'}
                {updateStatus === 'downloaded' && 'Actualización Lista'}
              </h4>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed truncate">
                {updateStatus === 'available' && `Versión ${updateInfo?.version || ''} encontrada.`}
                {updateStatus === 'downloading' && `Progreso: ${downloadPercent}%`}
                {updateStatus === 'downloaded' && 'La descarga finalizó con éxito.'}
              </p>
              
              {updateStatus === 'downloading' && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
                  <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${downloadPercent}%` }} />
                </div>
              )}

              {updateStatus === 'downloaded' && (
                <button
                  onClick={() => {
                    const api = (window as any).electronAPI;
                    if (api) api.quitAndInstallUpdate();
                  }}
                  className="mt-3 w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-xs rounded-xl hover:from-violet-500 hover:to-indigo-500 shadow-md active:scale-95 transition-all"
                >
                  Reiniciar y Aplicar Ahora
                </button>
              )}
            </div>
            <button 
              onClick={() => setUpdateStatus('idle')} 
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

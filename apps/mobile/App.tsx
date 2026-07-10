import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, ScrollView, SafeAreaView, ActivityIndicator,
  Alert, Linking, Platform, PermissionsAndroid, Modal,
  Animated, Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Lazy-load camera module ───────────────────────────────────────────────
let CameraView: any = null;
try {
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView;
} catch (e) {
  console.warn('expo-camera not available:', e);
}

// ─── Constants ────────────────────────────────────────────────────────────
const API_URL = 'https://pdventa.onrender.com/api/v1';
const STORAGE_USER_KEY = '@apexpos_user';

// ─── Interfaces ───────────────────────────────────────────────────────────
interface AuthUser {
  id: string;
  nombre: string;
  role: 'admin' | 'gerente' | 'vendedor';
  token: string;
}

interface Product {
  id: string;
  sku: string;
  codigoBarras?: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  unidad: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

// ─── Error Boundary ───────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.log('App Error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Error del Sistema</Text>
          <ScrollView style={{ backgroundColor: '#1f2937', padding: 10, borderRadius: 8, width: '100%', maxHeight: 300 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{this.state.error?.toString()}</Text>
          </ScrollView>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: '#f59e0b', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Reintentar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

// ─── AuthGuard & Access Denied ─────────────────────────────────────────────
interface AuthGuardProps {
  user: AuthUser;
  allowedRoles: Array<'admin' | 'gerente' | 'vendedor'>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

function AuthGuard({ user, allowedRoles, fallback = null, children }: AuthGuardProps) {
  if (allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

function AccessDeniedScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 64, color: '#ef4444', marginBottom: 16 }}>🚫</Text>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 8, textAlign: 'center' }}>Acceso Denegado</Text>
      <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 }}>
        Tu rol actual no tiene autorización para ingresar a este módulo. Por favor contacta al administrador del sistema.
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: '#f59e0b', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 32, width: '100%', maxWidth: 260, alignItems: 'center' }}
        onPress={onBack}
      >
        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>Regresar al Inicio</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ─── PIN Login Screen ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  };

  const pressKey = (key: string) => {
    if (key === '←') {
      setPin(p => p.slice(0, -1));
    } else if (pin.length < 6) {
      setPin(p => p + key);
    }
  };

  const handleLogin = useCallback(async () => {
    if (pin.length < 4) { shake(); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!resp.ok) { shake(); setPin(''); throw new Error('PIN incorrecto'); }
      const data = await resp.json();
      const u = data.usuario || data;
      const user: AuthUser = {
        id: String(u.id ?? u.userId ?? 'unknown'),
        nombre: String(u.nombre ?? u.name ?? 'Vendedor'),
        role: (() => {
          const rawRole = String(u.rol ?? u.role ?? 'vendedor').toLowerCase();
          if (rawRole.includes('admin')) return 'admin';
          if (rawRole.includes('gerente')) return 'gerente';
          return 'vendedor';
        })(),
        token: data.token ?? '',
      };
      await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      onLogin(user);
    } catch (e: any) {
      Alert.alert('Acceso Denegado', e.message ?? 'PIN incorrecto. Intenta de nuevo.');
      setPin('');
      shake();
    } finally {
      setLoading(false);
    }
  }, [pin]);

  const keys = ['1','2','3','4','5','6','7','8','9','','0','←'];

  return (
    <SafeAreaView style={loginStyles.container}>
      <StatusBar style="light" />
      <View style={loginStyles.logoBox}>
        <Text style={loginStyles.logo}>⬡</Text>
        <Text style={loginStyles.brand}>APEX POS MÓVIL</Text>
        <Text style={loginStyles.tagline}>Acceso de Vendedor Autorizado</Text>
      </View>

      <Animated.View style={[loginStyles.pinBox, { transform: [{ translateX: shakeAnim }] }]}>
        {[0,1,2,3,4,5].map(i => (
          <View key={i} style={[loginStyles.pinDot, { backgroundColor: i < pin.length ? '#f59e0b' : '#20222b' }]} />
        ))}
      </Animated.View>

      <View style={loginStyles.keypad}>
        {keys.map((k, i) => (
          <TouchableOpacity
            key={i}
            style={[loginStyles.key, k === '' && { opacity: 0 }, k === '←' && { backgroundColor: '#20222b' }]}
            onPress={() => k !== '' && pressKey(k)}
            disabled={k === ''}
            activeOpacity={0.7}
          >
            <Text style={[loginStyles.keyText, k === '←' && { fontSize: 20 }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[loginStyles.loginBtn, (loading || pin.length < 4) && { opacity: 0.5 }]}
        onPress={handleLogin}
        disabled={loading || pin.length < 4}
      >
        {loading
          ? <ActivityIndicator color="#000" />
          : <Text style={loginStyles.loginBtnText}>INGRESAR</Text>
        }
      </TouchableOpacity>

      <Text style={loginStyles.hint}>Ingresa tu PIN de acceso (4–6 dígitos)</Text>
    </SafeAreaView>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────
function MainApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [currentView, setCurrentView] = useState<'catalog' | 'scanner' | 'cart' | 'result' | 'inventory'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);   // ← starts empty, no demo data
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<{ codigoCorto: string; folio: string } | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

  // Estados para el Módulo de Inventario
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [scannedInventoryCode, setScannedInventoryCode] = useState('');
  const [scannedProduct, setScannedProduct] = useState<any>(null);
  const [addStockQuantity, setAddStockQuantity] = useState('');
  const [inventoryScanned, setInventoryScanned] = useState(false);

  // Estados del Formulario de Alta Rápida (Producto Nuevo)
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductCosto, setNewProductCosto] = useState('');
  const [newProductPrecio, setNewProductPrecio] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductUnidad, setNewProductUnidad] = useState('pieza');

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de Cámara',
            message: 'Apex requiere acceso a la cámara para escanear códigos de barras.',
            buttonNeutral: 'Preguntar Después',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          }
        );
        const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(ok);
        return ok;
      } else {
        const { Camera } = require('expo-camera');
        const status = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status.granted);
        return status.granted;
      }
    } catch (err) {
      console.warn(err);
      setHasPermission(false);
      return false;
    }
  };

  const fetchProducts = async (q: string = searchQuery) => {
    setIsFetching(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;
      const response = await fetch(`${API_URL}/productos/buscar?q=${encodeURIComponent(q)}`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapped = data.map((p: any) => ({
            id: String(p.id),
            sku: String(p.sku ?? ''),
            codigoBarras: p.codigoBarras ? String(p.codigoBarras) : undefined,
            nombre: String(p.nombre),
            categoria: p.categoria ? String(p.categoria) : 'General',
            precio: Number(p.precio) || 0,
            stock: p.balances
              ? p.balances.reduce((s: number, b: any) => s + Number(b.stockReal ?? 0), 0)
              : Number(p.stock) || 0,
            unidad: p.unidad ? String(p.unidad) : 'pieza',
          }));
          setProducts(mapped);
        }
      }
    } catch (e) {
      console.log('Error de red al cargar productos.');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts(searchQuery);
    }, 150);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const handleAddToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    Alert.alert('✓ Agregado', `${product.nombre} se agregó al pedido.`, [{ text: 'OK' }], { cancelable: true });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    const matched = products.find(p => p.codigoBarras === data || p.sku === data);
    if (matched) {
      handleAddToCart(matched);
      setCurrentView('cart');
    } else {
      Alert.alert('No encontrado', `Ningún producto coincide con: ${data}`, [
        { text: 'Aceptar', onPress: () => setScanned(false) }
      ]);
    }
  };

  const handleCreateQuote = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

      const response = await fetch(`${API_URL}/cotizaciones`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sucursalId: 'suc-norte',
          usuarioId: user.id,
          vendedorNombre: user.nombre,
          clienteNombre: clientName.trim() || 'Cliente General',
          items: cart.map(item => ({
            productoId: item.product.id,
            cantidad: item.quantity,
          })),
        }),
      });

      if (!response.ok) throw new Error('Error al registrar cotización');

      const result = await response.json();
      setQuoteResult({ codigoCorto: result.codigoCorto, folio: result.folio });
      setCart([]);
      setClientName('');
      setCurrentView('result');
    } catch (e: any) {
      Alert.alert('Error de Red', 'No se pudo sincronizar el pedido con la caja central. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    
    const numericReceived = Number(receivedAmount);
    if (paymentMethod === 'EFECTIVO' && (isNaN(numericReceived) || numericReceived < cartTotal)) {
      Alert.alert('Pago Insuficiente', 'El monto recibido debe ser igual o mayor al total de la venta.');
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

      // Formatear detalles para el endpoint POST /api/v1/ventas
      const detalles = cart.map(item => ({
        productoId: item.product.id,
        cantidad: item.quantity,
        precioUnitario: item.product.precio,
        subtotal: item.product.precio * item.quantity
      }));

      const payload = {
        folio: `MOV-${Date.now()}`,
        sucursalId: 'suc-norte',
        usuarioId: user.id,
        total: cartTotal,
        subtotal: cartTotal,
        descuento: 0,
        metodo: paymentMethod,
        detalles
      };

      const response = await fetch(`${API_URL}/ventas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al completar la venta');
      }

      // Vaciar carrito, ocultar modal y limpiar estados
      setCart([]);
      setShowCheckoutModal(false);
      setReceivedAmount('');
      setChangeAmount(0);
      setClientName('');

      // Mostrar confirmación
      Alert.alert(
        'Venta Exitosa',
        `Venta registrada correctamente.\n\nFolio: ${payload.folio}\n${paymentMethod === 'EFECTIVO' ? `Cambio: $${(numericReceived - cartTotal).toFixed(2)}` : ''}`,
        [{ text: 'Aceptar' }]
      );
    } catch (e: any) {
      console.error('[Sale Error]:', e);
      Alert.alert('Error al cobrar', e.message || 'No se pudo registrar la venta en la base de datos central.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInventoryBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setInventoryScanned(true);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/productos/escanear/${data}`);
      if (response.ok) {
        const product = await response.json();
        // Escenario A: El producto YA existe
        setScannedProduct(product.producto || product);
        setScannedInventoryCode(data);
        setAddStockQuantity('');
        setShowAddStockModal(true);
      } else if (response.status === 404) {
        // Escenario B: El producto es NUEVO / No existe
        setScannedProduct(null);
        setScannedInventoryCode(data);
        setNewProductName('');
        setNewProductDescription('');
        setNewProductCosto('');
        setNewProductPrecio('');
        setNewProductStock('');
        setNewProductUnidad('pieza');
        setShowCreateProductModal(true);
      } else {
        throw new Error('Respuesta inesperada del servidor');
      }
    } catch (e: any) {
      console.warn('Error al verificar código en inventario:', e);
      Alert.alert('Error', 'No se pudo verificar el código de barras. Intente nuevamente.', [
        { text: 'Aceptar', onPress: () => setInventoryScanned(false) }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAddStock = async () => {
    const qty = Number(addStockQuantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Cantidad Inválida', 'Por favor ingresa un número de piezas válido mayor a cero.');
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

      const response = await fetch(`${API_URL}/productos/${scannedProduct.id}/stock`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cantidad: qty })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar stock');
      }

      // Recargar catálogo y cerrar modal
      fetchProducts();
      setShowAddStockModal(false);
      Alert.alert('Inventario Actualizado', `Se agregaron ${qty} unidades con éxito a "${scannedProduct.nombre}".`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo guardar la actualización en la base de datos.');
    } finally {
      setIsLoading(false);
      setInventoryScanned(false);
    }
  };

  const handleSaveNewProduct = async () => {
    if (!newProductName.trim()) {
      Alert.alert('Requerido', 'Por favor ingresa el nombre del producto.');
      return;
    }

    const costo = Number(newProductCosto);
    const precio = Number(newProductPrecio);
    const stockVal = Number(newProductStock);

    if (isNaN(costo) || costo < 0) {
      Alert.alert('Costo Inválido', 'El precio de compra debe ser un número válido.');
      return;
    }
    if (isNaN(precio) || precio < 0) {
      Alert.alert('Precio Inválido', 'El precio de venta debe ser un número válido.');
      return;
    }
    if (isNaN(stockVal) || stockVal < 0) {
      Alert.alert('Stock Inválido', 'La cantidad inicial debe ser un número válido.');
      return;
    }

    setIsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (user.token) headers['Authorization'] = `Bearer ${user.token}`;

      const response = await fetch(`${API_URL}/productos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sku: scannedInventoryCode,
          codigoBarras: scannedInventoryCode,
          nombre: newProductName.trim(),
          descripcion: newProductDescription.trim(),
          costo,
          precio,
          stock: stockVal,
          unidad: newProductUnidad
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar el nuevo producto');
      }

      // Recargar catálogo y cerrar modal
      fetchProducts();
      setShowCreateProductModal(false);
      Alert.alert('Producto Creado', `El producto "${newProductName}" se registró con éxito en la base de datos.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo crear el producto nuevo en el servidor.');
    } finally {
      setIsLoading(false);
      setInventoryScanned(false);
    }
  };

  const shareQuoteOnWhatsApp = (quote: { codigoCorto: string; folio: string }) => {
    if (!whatsAppPhone) {
      Alert.alert('Requerido', 'Ingresa el número telefónico del cliente.');
      return;
    }
    const clean = whatsAppPhone.replace(/\D/g, '');
    const phone = clean.startsWith('52') ? clean : `521${clean}`;
    const text = `¡Hola! Te compartimos tu cotización de *Apex POS Móvil*:\n\n*Folio:* ${quote.folio}\n*Código de cobro:* *${quote.codigoCorto}*\n\nPresenta el código *${quote.codigoCorto}* en caja para pagar. ¡Gracias!`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() =>
      Alert.alert('Error', 'No se pudo abrir WhatsApp.')
    );
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.product.precio * item.quantity, 0);

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>APEX MÓVIL</Text>
          <Text style={styles.headerSubtitle}>👤 {user.nombre} · {user.role.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* CATALOG VIEW */}
      {currentView === 'catalog' && (
        <View style={styles.content}>
          <TextInput
            placeholder="Buscar por código, SKU o nombre…"
            placeholderTextColor="#555"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {isFetching ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator color="#f59e0b" size="large" />
              <Text style={{ color: '#555', marginTop: 12 }}>Cargando catálogo…</Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.productCard}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.productName}>{item.nombre}</Text>
                    <Text style={styles.productMeta}>SKU: {item.sku} · {item.categoria}</Text>
                    <Text style={styles.productPrice}>${item.precio.toFixed(2)}</Text>
                    <Text style={styles.stockBadge}>Stock: {item.stock} {item.unidad}</Text>
                  </View>
                  <TouchableOpacity style={styles.addButton} onPress={() => handleAddToCart(item)}>
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <Text style={{ fontSize: 40 }}>📦</Text>
                  <Text style={[styles.emptyText, { marginTop: 12 }]}>No se encontraron productos</Text>
                  <TouchableOpacity onPress={() => fetchProducts()} style={{ marginTop: 16, padding: 12, backgroundColor: '#20222b', borderRadius: 12 }}>
                    <Text style={{ color: '#f59e0b', fontWeight: 'bold' }}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              }
            />
          )}

          <View style={styles.bottomNav}>
            <TouchableOpacity
              style={[styles.navButton, { backgroundColor: '#1a1c24', borderWidth: 1, borderColor: '#20222b' }]}
              onPress={async () => {
                setScanned(false);
                if (!hasPermission) {
                  const ok = await requestCameraPermission();
                  if (!ok) { Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara.'); return; }
                }
                setCurrentView('scanner');
              }}
            >
              <Text style={[styles.navButtonText, { color: '#fff' }]}>📷 ESCANEAR</Text>
            </TouchableOpacity>

            {(user.role === 'admin' || user.role === 'gerente') && (
              <TouchableOpacity
                style={[styles.navButton, { backgroundColor: '#1e3a8a', borderWidth: 1, borderColor: '#3b82f644' }]}
                onPress={async () => {
                  setScanned(false);
                  if (!hasPermission) {
                    const ok = await requestCameraPermission();
                    if (!ok) { Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara.'); return; }
                  }
                  setCurrentView('inventory');
                }}
              >
                <Text style={[styles.navButtonText, { color: '#fff' }]}>📦 INVENTARIO</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.navButton} onPress={() => setCurrentView('cart')}>
              <Text style={styles.navButtonText}>🛒 PEDIDO ({cart.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SCANNER VIEW */}
      {currentView === 'scanner' && (
        <View style={styles.content}>
          {hasPermission === null ? (
            <Text style={styles.emptyText}>Solicitando permiso de cámara…</Text>
          ) : hasPermission === false ? (
            <Text style={styles.emptyText}>Sin acceso a la cámara. Habilita permisos en ajustes.</Text>
          ) : !CameraView ? (
            <Text style={styles.emptyText}>Módulo de cámara no disponible.</Text>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
          )}
          <TouchableOpacity style={styles.closeScannerButton} onPress={() => setCurrentView('catalog')}>
            <Text style={styles.navButtonText}>← Volver al Catálogo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* INVENTORY SCANNER VIEW (PROTECTED BY AUTHGUARD) */}
      {currentView === 'inventory' && (
        <AuthGuard
          user={user}
          allowedRoles={['admin', 'gerente']}
          fallback={<AccessDeniedScreen onBack={() => setCurrentView('catalog')} />}
        >
          <View style={styles.content}>
            {hasPermission === null ? (
              <Text style={styles.emptyText}>Solicitando permiso de cámara…</Text>
            ) : hasPermission === false ? (
              <Text style={styles.emptyText}>Sin acceso a la cámara. Habilita permisos en ajustes.</Text>
            ) : !CameraView ? (
              <Text style={styles.emptyText}>Módulo de cámara no disponible.</Text>
            ) : (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={inventoryScanned ? undefined : handleInventoryBarCodeScanned}
              />
            )}
            <View style={{
              position: 'absolute',
              top: 20,
              left: 20,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>📦 MÓDULO DE INVENTARIO</Text>
              <Text style={{ color: '#aaa', fontSize: 10, marginTop: 2 }}>Escanea el código de barras del producto</Text>
            </View>
            <TouchableOpacity style={styles.closeScannerButton} onPress={() => setCurrentView('catalog')}>
              <Text style={styles.navButtonText}>← Volver al Catálogo</Text>
            </TouchableOpacity>
          </View>
        </AuthGuard>
      )}

      {/* CART VIEW */}
      {currentView === 'cart' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Pedido / Cotización</Text>

          {/* Client Name Field */}
          <View style={styles.clientRow}>
            <Text style={styles.clientLabel}>👤 Nombre del Cliente:</Text>
            <TextInput
              placeholder="Ej. Carlos González"
              placeholderTextColor="#555"
              style={styles.clientInput}
              value={clientName}
              onChangeText={setClientName}
              returnKeyType="done"
            />
          </View>

          <FlatList
            data={cart}
            keyExtractor={item => item.product.id}
            renderItem={({ item }) => (
              <View style={styles.cartCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.product.nombre}</Text>
                  <Text style={styles.productPrice}>
                    ${item.product.precio.toFixed(2)} × {item.quantity} = ${(item.product.precio * item.quantity).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setCart(prev => prev.map(c =>
                      c.product.id === item.product.id ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c
                    ))}
                  >
                    <Text style={styles.qtyText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setCart(prev => prev.map(c =>
                      c.product.id === item.product.id ? { ...c, quantity: c.quantity + 1 } : c
                    ))}
                  >
                    <Text style={styles.qtyText}>+</Text>
                  </TouchableOpacity>
                  {/* Remove button */}
                  <TouchableOpacity
                    style={[styles.qtyBtn, { marginLeft: 4, backgroundColor: '#ef4444', borderRadius: 8 }]}
                    onPress={() => handleRemoveFromCart(item.product.id)}
                  >
                    <Text style={[styles.qtyText, { color: '#fff' }]}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>El pedido está vacío</Text>}
          />

          {cart.length > 0 && (
            <View style={styles.cartSummary}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Estimado:</Text>
                <Text style={styles.totalVal}>${cartTotal.toFixed(2)}</Text>
              </View>
              {isLoading ? (
                <ActivityIndicator color="#f59e0b" style={{ marginVertical: 12 }} />
              ) : (
                <View style={{ gap: 8 }}>
                  <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: '#f59e0b' }]} onPress={handleCreateQuote}>
                    <Text style={styles.checkoutBtnText}>📤 ENVIAR A CAJA CENTRAL</Text>
                  </TouchableOpacity>
                  {(user.role === 'admin' || user.role === 'gerente') && (
                    <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: '#10b981' }]} onPress={() => setShowCheckoutModal(true)}>
                      <Text style={styles.checkoutBtnText}>💰 COBRAR VENTA</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => setCurrentView('catalog')}>
            <Text style={styles.backBtnText}>← Continuar Agregando</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* RESULT VIEW */}
      {currentView === 'result' && quoteResult && (
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.resultCheck}>✓</Text>
          <Text style={styles.resultTitle}>Pedido Enviado</Text>
          <Text style={styles.resultDesc}>Presenta este código en caja rápida:</Text>
          <View style={styles.codeCard}>
            <Text style={styles.resultCode}>{quoteResult.codigoCorto}</Text>
          </View>
          <Text style={styles.resultFolio}>{quoteResult.folio}</Text>

          <View style={styles.whatsappPanel}>
            <Text style={styles.whatsappLabel}>📲 Compartir por WhatsApp:</Text>
            <View style={styles.whatsappRow}>
              <TextInput
                placeholder="Ej: 4491234567"
                placeholderTextColor="#555"
                keyboardType="phone-pad"
                style={styles.whatsappInput}
                value={whatsAppPhone}
                onChangeText={setWhatsAppPhone}
              />
              <TouchableOpacity style={styles.whatsappBtn} onPress={() => shareQuoteOnWhatsApp(quoteResult)}>
                <Text style={styles.whatsappBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.checkoutBtn, { marginTop: 24, width: '80%' }]}
            onPress={() => { setWhatsAppPhone(''); setQuoteResult(null); setCurrentView('catalog'); }}
          >
            <Text style={styles.checkoutBtnText}>+ Nuevo Pedido</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Checkout Modal for Admin/Gerente */}
      <Modal
        visible={showCheckoutModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.content}>
            <Text style={modalStyles.title}>💰 COBRAR VENTA</Text>
            
            <View style={modalStyles.totalContainer}>
              <Text style={modalStyles.totalLabel}>Total a Pagar:</Text>
              <Text style={modalStyles.totalVal}>${cartTotal.toFixed(2)}</Text>
            </View>

            <Text style={modalStyles.sectionLabel}>Método de Pago:</Text>
            <View style={modalStyles.methodRow}>
              {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'] as const).map(method => (
                <TouchableOpacity
                  key={method}
                  style={[
                    modalStyles.methodBtn,
                    paymentMethod === method && modalStyles.methodBtnActive
                  ]}
                  onPress={() => {
                    setPaymentMethod(method);
                    if (method !== 'EFECTIVO') {
                      setReceivedAmount('');
                      setChangeAmount(0);
                    }
                  }}
                >
                  <Text style={[
                    modalStyles.methodBtnText,
                    paymentMethod === method && modalStyles.methodBtnTextActive
                  ]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {paymentMethod === 'EFECTIVO' && (
              <View style={modalStyles.cashSection}>
                <Text style={modalStyles.sectionLabel}>Monto Recibido ($):</Text>
                <TextInput
                  style={modalStyles.input}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#777"
                  value={receivedAmount}
                  onChangeText={(val) => {
                    setReceivedAmount(val);
                    const numericVal = Number(val);
                    if (!isNaN(numericVal) && numericVal >= cartTotal) {
                      setChangeAmount(numericVal - cartTotal);
                    } else {
                      setChangeAmount(0);
                    }
                  }}
                />
                
                {Number(receivedAmount) >= cartTotal && (
                  <View style={modalStyles.changeRow}>
                    <Text style={modalStyles.changeLabel}>Cambio:</Text>
                    <Text style={modalStyles.changeVal}>${changeAmount.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={modalStyles.actionRow}>
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.cancelBtn]}
                onPress={() => {
                  setShowCheckoutModal(false);
                  setReceivedAmount('');
                  setChangeAmount(0);
                }}
              >
                <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.confirmBtn]}
                onPress={handleCompleteSale}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={modalStyles.confirmBtnText}>Confirmar Pago</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal A: Sumar Stock Rápido (Producto Existente) */}
      <Modal
        visible={showAddStockModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowAddStockModal(false);
          setInventoryScanned(false);
        }}
      >
        <View style={modalStyles.overlay}>
          <View style={modalStyles.content}>
            <Text style={modalStyles.title}>📥 SUMAR STOCK</Text>
            
            {scannedProduct && (
              <View style={modalStyles.totalContainer}>
                <Text style={[modalStyles.totalLabel, { color: '#f59e0b', fontSize: 14 }]}>
                  {scannedProduct.nombre}
                </Text>
                <Text style={[modalStyles.totalLabel, { marginTop: 8 }]}>
                  Stock Actual: {scannedProduct.stock || (scannedProduct.balances ? scannedProduct.balances.reduce((sum: number, b: any) => sum + Number(b.stockReal), 0) : 0)} {scannedProduct.unidad || scannedProduct.metadatos?.unidad || 'pieza'}
                </Text>
                <Text style={{ color: '#666', fontSize: 10, marginTop: 4 }}>
                  SKU: {scannedProduct.sku}
                </Text>
              </View>
            )}

            <Text style={modalStyles.sectionLabel}>Piezas a agregar:</Text>
            <TextInput
              style={[modalStyles.input, { marginBottom: 20 }]}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#777"
              value={addStockQuantity}
              onChangeText={setAddStockQuantity}
            />

            <View style={modalStyles.actionRow}>
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.cancelBtn]}
                onPress={() => {
                  setShowAddStockModal(false);
                  setInventoryScanned(false);
                }}
              >
                <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[modalStyles.actionBtn, modalStyles.confirmBtn]}
                onPress={handleSaveAddStock}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={modalStyles.confirmBtnText}>Agregar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal B: Alta Rápida de Producto Nuevo (Producto Inexistente) */}
      <Modal
        visible={showCreateProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCreateProductModal(false);
          setInventoryScanned(false);
        }}
      >
        <View style={modalStyles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <View style={[modalStyles.content, { marginVertical: 40 }]}>
              <Text style={modalStyles.title}>✨ NUEVO PRODUCTO</Text>
              
              <Text style={modalStyles.sectionLabel}>SKU / Código (Leído):</Text>
              <TextInput
                style={[modalStyles.input, { backgroundColor: '#1f2937', color: '#888', marginBottom: 12, fontSize: 14 }]}
                editable={false}
                value={scannedInventoryCode}
              />

              <Text style={modalStyles.sectionLabel}>Nombre (*):</Text>
              <TextInput
                style={[modalStyles.input, { marginBottom: 12, fontSize: 14, textAlign: 'left', paddingHorizontal: 12 }]}
                placeholder="Nombre del producto"
                placeholderTextColor="#777"
                value={newProductName}
                onChangeText={setNewProductName}
              />

              <Text style={modalStyles.sectionLabel}>Descripción:</Text>
              <TextInput
                style={[modalStyles.input, { marginBottom: 12, fontSize: 14, textAlign: 'left', paddingHorizontal: 12 }]}
                placeholder="Descripción opcional"
                placeholderTextColor="#777"
                value={newProductDescription}
                onChangeText={setNewProductDescription}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.sectionLabel}>Costo ($):</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 12, fontSize: 14 }]}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#777"
                    value={newProductCosto}
                    onChangeText={setNewProductCosto}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.sectionLabel}>Precio ($):</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 12, fontSize: 14 }]}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#777"
                    value={newProductPrecio}
                    onChangeText={setNewProductPrecio}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.sectionLabel}>Stock Inicial:</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 16, fontSize: 14 }]}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#777"
                    value={newProductStock}
                    onChangeText={setNewProductStock}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={modalStyles.sectionLabel}>Unidad:</Text>
                  <TextInput
                    style={[modalStyles.input, { marginBottom: 16, fontSize: 14, textAlign: 'left', paddingHorizontal: 12 }]}
                    placeholder="pieza / kg / etc"
                    placeholderTextColor="#777"
                    value={newProductUnidad}
                    onChangeText={setNewProductUnidad}
                  />
                </View>
              </View>

              <View style={modalStyles.actionRow}>
                <TouchableOpacity
                  style={[modalStyles.actionBtn, modalStyles.cancelBtn]}
                  onPress={() => {
                    setShowCreateProductModal(false);
                    setInventoryScanned(false);
                  }}
                >
                  <Text style={modalStyles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[modalStyles.actionBtn, modalStyles.confirmBtn]}
                  onPress={handleSaveNewProduct}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={modalStyles.confirmBtnText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
function RootApp() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);

  // Restore session from AsyncStorage on launch
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_USER_KEY).then(raw => {
      if (raw) {
        try { setUser(JSON.parse(raw)); } catch {}
      }
      setBooting(false);
    });
  }, []);

  const handleLogin = (u: AuthUser) => setUser(u);

  const handleLogout = async () => {
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
  };

  if (booting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </SafeAreaView>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  return <MainApp user={user} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <RootApp />
    </ErrorBoundary>
  );
}

// ─── Styles: Login ─────────────────────────────────────────────────────────
const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080a0f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoBox: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 64, color: '#f59e0b' },
  brand: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 3, marginTop: 8 },
  tagline: { color: '#555', fontSize: 12, marginTop: 4 },
  pinBox: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 36,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 264,
    gap: 12,
    justifyContent: 'center',
    marginBottom: 32,
  },
  key: {
    width: 76,
    height: 76,
    backgroundColor: '#13151b',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#20222b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  loginBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 64,
    alignItems: 'center',
    width: '80%',
  },
  loginBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 2 },
  hint: { color: '#333', fontSize: 11, marginTop: 16 },
});

// ─── Styles: Main App ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0e12' },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#20222b',
    backgroundColor: '#13151b',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  headerSubtitle: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1a1c24',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12 },
  content: { flex: 1, padding: 16 },
  searchInput: {
    backgroundColor: '#13151b',
    color: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#20222b',
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  productMeta: { color: '#555', fontSize: 11, marginTop: 4 },
  productPrice: { color: '#f59e0b', fontSize: 15, fontWeight: '900', marginTop: 4 },
  stockBadge: { color: '#10b981', fontSize: 11, marginTop: 2 },
  addButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#0d0e12', fontSize: 24, fontWeight: 'bold' },
  emptyText: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 14 },
  bottomNav: { flexDirection: 'row', gap: 12, marginTop: 12 },
  navButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  navButtonText: { color: '#0d0e12', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  closeScannerButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  clientRow: { marginBottom: 16 },
  clientLabel: { color: '#aaa', fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  clientInput: {
    backgroundColor: '#13151b',
    color: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#f59e0b44',
  },
  cartCard: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0e12', borderRadius: 12, borderWidth: 1, borderColor: '#20222b' },
  qtyBtn: { padding: 10 },
  qtyText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  qtyValue: { color: '#fff', fontWeight: 'bold', paddingHorizontal: 6 },
  cartSummary: { borderTopWidth: 1, borderTopColor: '#20222b', paddingTop: 16, marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  totalLabel: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  totalVal: { color: '#f59e0b', fontSize: 24, fontWeight: '900' },
  checkoutBtn: { backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  backBtn: { alignItems: 'center', paddingVertical: 16 },
  backBtnText: { color: '#f59e0b', fontWeight: 'bold' },
  resultCheck: { fontSize: 64, color: '#10b981', fontWeight: 'bold' },
  resultTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 16 },
  resultDesc: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  codeCard: { backgroundColor: '#13151b', borderWidth: 2, borderColor: '#f59e0b', borderRadius: 24, paddingHorizontal: 36, paddingVertical: 18, marginTop: 24 },
  resultCode: { color: '#f59e0b', fontSize: 48, fontWeight: '900', letterSpacing: 4 },
  resultFolio: { color: '#444', fontFamily: 'monospace', fontSize: 10, marginTop: 12 },
  whatsappPanel: { marginTop: 24, width: '80%', backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20222b', borderRadius: 16, padding: 16 },
  whatsappLabel: { color: '#aaa', fontSize: 11, fontWeight: 'bold', marginBottom: 8 },
  whatsappRow: { flexDirection: 'row', gap: 8 },
  whatsappInput: { flex: 1, backgroundColor: '#0d0e12', color: '#fff', borderWidth: 1, borderColor: '#20222b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 },
  whatsappBtn: { backgroundColor: '#10b981', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 16 },
  whatsappBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#0d0e12',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  totalContainer: {
    backgroundColor: '#13151b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f59e0b33',
  },
  totalLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  totalVal: {
    color: '#f59e0b',
    fontSize: 32,
    fontWeight: '900',
  },
  sectionLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  methodBtn: {
    flex: 1,
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodBtnActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  methodBtnText: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
  },
  methodBtnTextActive: {
    color: '#fff',
  },
  cashSection: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#13151b',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  changeLabel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
  },
  changeVal: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#1f2937',
  },
  cancelBtnText: {
    color: '#aaa',
    fontWeight: 'bold',
  },
  confirmBtn: {
    backgroundColor: '#10b981',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

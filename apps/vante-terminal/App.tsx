import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, ScrollView, SafeAreaView, ActivityIndicator,
  Alert, Linking, Platform, Modal, Animated, Easing, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Global variables for dynamically updating endpoints ---
export let API_URL = 'https://pdventa.onrender.com/api/v1';
export let SUPABASE_URL = '';
export let SUPABASE_ANON_KEY = '';

const STORAGE_USER_KEY = '@vanteterminal_user';
const STORAGE_API_KEY = '@vanteterminal_api_url';
const STORAGE_SUPABASE_URL_KEY = '@vanteterminal_supabase_url';
const STORAGE_SUPABASE_KEY_KEY = '@vanteterminal_supabase_anon_key';

interface AuthUser {
  id: string;
  nombre: string;
  role: 'admin' | 'gerente' | 'vendedor';
  token: string;
}

interface Product {
  id: string;
  sku: string;
  nombre: string;
  precio: number;
  stock: number;
  categoria: string;
  unidad: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

// ─── Error Boundary ───────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Error del Sistema (Terminal)</Text>
          <Text style={{ color: '#fff', fontSize: 12 }}>{this.state.error?.toString()}</Text>
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

// ─── PIN Login Screen ──────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);

  // Connection settings states
  const [tempApiUrl, setTempApiUrl] = useState(API_URL);
  const [tempSupabaseUrl, setTempSupabaseUrl] = useState(SUPABASE_URL);
  const [tempSupabaseKey, setTempSupabaseKey] = useState(SUPABASE_ANON_KEY);

  const shakeAnim = useRef(new Animated.Value(0)).current;

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
      const newPin = pin + key;
      setPin(newPin);
      
      // Checar si introdujo el PIN Maestro de Super Admin
      if (newPin === 'VANTE2401') {
        setPin('');
        setTempSupabaseUrl(SUPABASE_URL);
        setTempSupabaseKey(SUPABASE_ANON_KEY);
        setTempApiUrl(API_URL);
        setShowSuperAdminModal(true);
      }
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
        nombre: String(u.nombre ?? u.name ?? 'Cajero'),
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
      
      <TouchableOpacity 
        style={loginStyles.configButton}
        onPress={() => {
          setTempApiUrl(API_URL);
          setShowConfigModal(true);
        }}
      >
        <Text style={loginStyles.configButtonText}>⚙️</Text>
      </TouchableOpacity>

      <View style={loginStyles.logoBox}>
        <Image source={require('./assets/vante_logo.png')} style={loginStyles.logo} />
        <Text style={loginStyles.brand}>VANTE TERMINAL</Text>
        <Text style={loginStyles.tagline}>Consola de Caja 100% Nube</Text>
      </View>

      <View style={loginStyles.rightContainer}>
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
          {loading ? <ActivityIndicator color="#000" /> : <Text style={loginStyles.loginBtnText}>INGRESAR</Text>}
        </TouchableOpacity>
        
        <Text style={loginStyles.hint}>Ingresa tu PIN de acceso (4–6 dígitos)</Text>
      </View>

      {/* MODAL CONFIGURACIÓN GENERAL (DIRECCIÓN SERVIDOR) */}
      <Modal visible={showConfigModal} transparent={true} animationType="slide" onRequestClose={() => setShowConfigModal(false)}>
        <View style={loginStyles.modalOverlay}>
          <View style={loginStyles.modalContent}>
            <Text style={loginStyles.modalTitle}>Enlace de Servidor Vante</Text>
            <Text style={loginStyles.modalDescription}>Dirección IP o dominio del servidor de caja (local o nube):</Text>
            <TextInput
              style={loginStyles.modalInput}
              value={tempApiUrl}
              onChangeText={setTempApiUrl}
              placeholder="Ej: http://192.168.1.100:3001/api/v1"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={loginStyles.modalButtons}>
              <TouchableOpacity style={[loginStyles.modalButton, loginStyles.modalCancelButton]} onPress={() => setShowConfigModal(false)}>
                <Text style={loginStyles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[loginStyles.modalButton, loginStyles.modalSaveButton]}
                onPress={async () => {
                  let targetUrl = tempApiUrl.trim();
                  if (!targetUrl.includes('/api/v1')) {
                    if (targetUrl.endsWith('/')) targetUrl = targetUrl.slice(0, -1);
                    targetUrl = `${targetUrl}/api/v1`;
                  }
                  setLoading(true);
                  try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 6000);
                    await fetch(`${targetUrl}/productos`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    API_URL = targetUrl;
                    await AsyncStorage.setItem(STORAGE_API_KEY, targetUrl);
                    Alert.alert('Conexión Exitosa', 'Enlace con servidor configurado.');
                    setShowConfigModal(false);
                  } catch (err) {
                    Alert.alert('Fallo de Conexión', 'No se pudo conectar con el servidor.');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Text style={[loginStyles.modalButtonText, { color: '#000' }]}>Enlazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CONFIGURACIÓN SUPER ADMIN (SUPABASE CLOUD INFRASTRUCTURE) */}
      <Modal visible={showSuperAdminModal} transparent={true} animationType="slide" onRequestClose={() => setShowSuperAdminModal(false)}>
        <View style={loginStyles.modalOverlay}>
          <View style={loginStyles.modalContent}>
            <Text style={loginStyles.modalTitle}>⚙️ Super Admin Cloud Setup</Text>
            <Text style={loginStyles.modalDescription}>Configuración de infraestructura en la Nube de Vante POS:</Text>
            
            <Text style={loginStyles.inputLabel}>SUPABASE URL</Text>
            <TextInput
              style={loginStyles.modalInput}
              value={tempSupabaseUrl}
              onChangeText={setTempSupabaseUrl}
              placeholder="https://your-project.supabase.co"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={loginStyles.inputLabel}>SUPABASE ANON KEY</Text>
            <TextInput
              style={loginStyles.modalInput}
              value={tempSupabaseKey}
              onChangeText={setTempSupabaseKey}
              placeholder="eyJhbGciOi..."
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <Text style={loginStyles.inputLabel}>RENDER API BASE URL</Text>
            <TextInput
              style={loginStyles.modalInput}
              value={tempApiUrl}
              onChangeText={setTempApiUrl}
              placeholder="https://your-api.onrender.com/api/v1"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={loginStyles.modalButtons}>
              <TouchableOpacity style={[loginStyles.modalButton, loginStyles.modalCancelButton]} onPress={() => setShowSuperAdminModal(false)}>
                <Text style={loginStyles.modalButtonText}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[loginStyles.modalButton, loginStyles.modalSaveButton]}
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem(STORAGE_SUPABASE_URL_KEY, tempSupabaseUrl.trim());
                    await AsyncStorage.setItem(STORAGE_SUPABASE_KEY_KEY, tempSupabaseKey.trim());
                    await AsyncStorage.setItem(STORAGE_API_KEY, tempApiUrl.trim());
                    SUPABASE_URL = tempSupabaseUrl.trim();
                    SUPABASE_ANON_KEY = tempSupabaseKey.trim();
                    API_URL = tempApiUrl.trim();
                    Alert.alert('Infraestructura Guardada', 'Se configuró la base de datos Supabase y el servidor API de forma exitosa.');
                    setShowSuperAdminModal(false);
                  } catch (e) {
                    Alert.alert('Error', 'Fallo al guardar parámetros.');
                  }
                }}
              >
                <Text style={[loginStyles.modalButtonText, { color: '#000' }]}>Guardar Nube</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Main Terminal UI (3 Columns Landscape) ──────────────────────────────────
function MainTerminal({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Todos']);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'nfc'>('cash');
  const [cashReceived, setCashReceived] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/productos`);
      if (resp.ok) {
        const data: Product[] = await resp.json();
        setProducts(data);
        
        // Extraer categorías únicas
        const cats = ['Todos', ...Array.from(new Set(data.map(p => p.categoria || 'Varios')))];
        setCategories(cats);
      }
    } catch (e) {
      console.log('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, val: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const nextQ = item.quantity + val;
          return nextQ > 0 ? { ...item, quantity: nextQ } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const getCartTotal = () => cart.reduce((total, item) => total + item.product.precio * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const ventaData = {
        folio: `VNT-${Date.now()}`,
        clienteId: null,
        sucursalId: 'suc-norte',
        usuarioId: user.id,
        items: cart.map(item => ({
          productoId: item.product.id,
          cantidad: item.quantity,
          precioUnitario: item.product.precio,
          subtotal: item.product.precio * item.quantity
        })),
        total: getCartTotal(),
        subtotal: getCartTotal(),
        descuento: 0,
        metodoPago: paymentType.toUpperCase(),
        efectivoRecibido: paymentType === 'cash' ? Number(cashReceived) : 0,
      };

      const resp = await fetch(`${API_URL}/ventas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(ventaData)
      });

      if (!resp.ok) throw new Error('Error al registrar venta');
      Alert.alert('Cobro Exitoso', 'Venta registrada directamente en la Nube de Vante.');
      setCart([]);
      setCashReceived('');
      setCheckoutVisible(false);
      fetchProducts(); // Actualizar stock
    } catch (e) {
      Alert.alert('Error', 'Fallo al procesar el cobro en la nube.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Todos' || p.categoria === selectedCategory;
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <SafeAreaView style={termStyles.container}>
      <StatusBar hidden={true} />
      
      {/* HEADER */}
      <View style={termStyles.header}>
        <View style={termStyles.headerLeft}>
          <Image source={require('./assets/vante_logo.png')} style={termStyles.headerLogo} />
          <Text style={termStyles.headerTitle}>Caja Terminal</Text>
        </View>
        <View style={termStyles.headerRight}>
          <Text style={termStyles.cajeroName}>🧑‍💼 {user.nombre} ({user.role})</Text>
          <TouchableOpacity style={termStyles.logoutBtn} onPress={onLogout}>
            <Text style={termStyles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3 COLUMNS BODY */}
      <View style={termStyles.body}>
        
        {/* COLUMN 1: PRODUCTS & CATEGORIES GRID */}
        <View style={termStyles.colProducts}>
          <View style={termStyles.searchContainer}>
            <TextInput
              style={termStyles.searchInput}
              placeholder="Buscar por nombre o código SKU..."
              placeholderTextColor="#555"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={termStyles.catsScroll}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[termStyles.catBtn, selectedCategory === cat && termStyles.catBtnActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[termStyles.catText, selectedCategory === cat && termStyles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color="#f59e0b" size="large" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={item => item.id}
              numColumns={3}
              renderItem={({ item }) => (
                <TouchableOpacity style={termStyles.prodCard} onPress={() => addToCart(item)}>
                  <Text style={termStyles.prodName} numberOfLines={2}>{item.nombre}</Text>
                  <Text style={termStyles.prodSku}>SKU: {item.sku}</Text>
                  <View style={termStyles.prodFooter}>
                    <Text style={termStyles.prodPrice}>${Number(item.precio).toFixed(2)}</Text>
                    <Text style={[termStyles.prodStock, item.stock <= 5 && { color: '#ef4444' }]}>
                      {item.stock} pz
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* COLUMN 2: ACTIVE TICKET (CART) */}
        <View style={termStyles.colCart}>
          <Text style={termStyles.sectionTitle}>Ticket Actual</Text>
          {cart.length === 0 ? (
            <View style={termStyles.emptyCart}>
              <Text style={termStyles.emptyCartText}>El carrito está vacío</Text>
            </View>
          ) : (
            <FlatList
              data={cart}
              keyExtractor={item => item.product.id}
              renderItem={({ item }) => (
                <View style={termStyles.cartItem}>
                  <View style={termStyles.cartItemDetails}>
                    <Text style={termStyles.cartItemName} numberOfLines={1}>{item.product.nombre}</Text>
                    <Text style={termStyles.cartItemPrice}>${Number(item.product.precio).toFixed(2)} c/u</Text>
                  </View>
                  <View style={termStyles.cartItemControls}>
                    <TouchableOpacity style={termStyles.qtyBtn} onPress={() => updateQuantity(item.product.id, -1)}>
                      <Text style={termStyles.qtyBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={termStyles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity style={termStyles.qtyBtn} onPress={() => updateQuantity(item.product.id, 1)}>
                      <Text style={termStyles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* COLUMN 3: PAYMENT / SUMMARY */}
        <View style={termStyles.colCheckout}>
          <Text style={termStyles.sectionTitle}>Total a Pagar</Text>
          <View style={termStyles.totalCard}>
            <Text style={termStyles.totalLabel}>TOTAL DUE</Text>
            <Text style={termStyles.totalValue}>${getCartTotal().toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[termStyles.payButton, cart.length === 0 && { opacity: 0.5 }]}
            disabled={cart.length === 0}
            onPress={() => setCheckoutVisible(true)}
          >
            <Text style={termStyles.payButtonText}>COMPLETAR COBRO</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CHECKOUT MODAL OVERLAY */}
      <Modal visible={checkoutVisible} transparent={true} animationType="fade" onRequestClose={() => setCheckoutVisible(false)}>
        <View style={termStyles.overlay}>
          <View style={termStyles.checkoutModal}>
            <Text style={termStyles.modalHeader}>Selección de Método de Pago</Text>
            <Text style={termStyles.checkoutTotal}>Total: ${getCartTotal().toFixed(2)}</Text>
            
            <View style={termStyles.payTypesGrid}>
              <TouchableOpacity
                style={[termStyles.payTypeCard, paymentType === 'cash' && termStyles.payTypeCardActive]}
                onPress={() => setPaymentType('cash')}
              >
                <Text style={termStyles.payTypeIcon}>💵</Text>
                <Text style={termStyles.payTypeTitle}>Efectivo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[termStyles.payTypeCard, paymentType === 'card' && termStyles.payTypeCardActive]}
                onPress={() => setPaymentType('card')}
              >
                <Text style={termStyles.payTypeIcon}>💳</Text>
                <Text style={termStyles.payTypeTitle}>Tarjeta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[termStyles.payTypeCard, paymentType === 'nfc' && termStyles.payTypeCardActive]}
                onPress={() => setPaymentType('nfc')}
              >
                <Text style={termStyles.payTypeIcon}>📱</Text>
                <Text style={termStyles.payTypeTitle}>Pago NFC Móvil</Text>
              </TouchableOpacity>
            </View>

            {paymentType === 'cash' && (
              <View style={termStyles.cashCalculator}>
                <Text style={termStyles.cashLabel}>Efectivo Recibido:</Text>
                <TextInput
                  style={termStyles.cashInput}
                  keyboardType="numeric"
                  value={cashReceived}
                  onChangeText={setCashReceived}
                  placeholder="0.00"
                  placeholderTextColor="#555"
                />
                {Number(cashReceived) >= getCartTotal() && (
                  <Text style={termStyles.changeText}>
                    Cambio a entregar: ${(Number(cashReceived) - getCartTotal()).toFixed(2)}
                  </Text>
                )}
              </View>
            )}

            <View style={termStyles.modalActionBtns}>
              <TouchableOpacity style={termStyles.btnCancel} onPress={() => setCheckoutVisible(false)}>
                <Text style={termStyles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={termStyles.btnConfirm} onPress={handleCheckout} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={[termStyles.btnText, { color: '#000' }]}>Confirmar Cobro</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [isLoadingIntro, setIsLoadingIntro] = useState(true);

  useEffect(() => {
    const initApp = async () => {
      // Ocultar barra de navegación en Android de manera inmersiva
      if (Platform.OS === 'android') {
        try {
          const NavigationBar = require('expo-navigation-bar');
          // Llamar sin bloquear la inicialización de la app
          NavigationBar.setVisibilityAsync('hidden').catch(() => {});
          NavigationBar.setBehaviorAsync('interactive-immersive').catch(() => {});
        } catch (e) {}
      }

      // Cargar configuraciones guardadas
      try {
        const savedUrl = await AsyncStorage.getItem(STORAGE_API_KEY);
        if (savedUrl) API_URL = savedUrl;

        const savedSubUrl = await AsyncStorage.getItem(STORAGE_SUPABASE_URL_KEY);
        if (savedSubUrl) SUPABASE_URL = savedSubUrl;

        const savedSubKey = await AsyncStorage.getItem(STORAGE_SUPABASE_KEY_KEY);
        if (savedSubKey) SUPABASE_ANON_KEY = savedSubKey;

        const savedUser = await AsyncStorage.getItem(STORAGE_USER_KEY);
        if (savedUser) setUser(JSON.parse(savedUser));
      } catch (e) {}

      setBooting(false);
      
      // Timer del Splash de marca Vante
      const timer = setTimeout(() => {
        setIsLoadingIntro(false);
      }, 3000);

      return () => clearTimeout(timer);
    };
    initApp();
  }, []);

  const handleLogin = (u: AuthUser) => setUser(u);
  const handleLogout = async () => {
    await AsyncStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
  };

  if (booting || isLoadingIntro) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('./assets/vante_logo.png')} style={{ width: 180, height: 100, resizeMode: 'contain', marginBottom: 24 }} />
          <ActivityIndicator color="#f59e0b" size="large" />
          <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: 'bold', marginTop: 16 }}>Iniciando Vante Terminal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      {!user ? <LoginScreen onLogin={handleLogin} /> : <MainTerminal user={user} onLogout={handleLogout} />}
    </ErrorBoundary>
  );
}

// ─── Styles: Login (Landscape Grid) ─────────────────────────────────────────
const loginStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#080a0f',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
  },
  logoBox: { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 180, height: 95, resizeMode: 'contain' },
  brand: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 4, marginTop: 12 },
  tagline: { color: '#555', fontSize: 13, marginTop: 4 },
  rightContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  configButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    zIndex: 10,
  },
  configButtonText: { fontSize: 20 },
  pinBox: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 220, gap: 10, justifyContent: 'center', marginBottom: 20 },
  key: {
    width: 60, height: 44, borderRadius: 12, backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20222b',
    alignItems: 'center', justifyContent: 'center'
  },
  keyText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  loginBtn: { backgroundColor: '#f59e0b', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 48, alignItems: 'center', width: '80%' },
  loginBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  hint: { color: '#333', fontSize: 10, marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  modalContent: { width: '100%', maxWidth: 400, backgroundColor: '#13151b', borderRadius: 20, borderWidth: 1, borderColor: '#20222b', padding: 24 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  modalDescription: { color: '#9ca3af', fontSize: 11, lineHeight: 16, marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#0d0e12', borderWidth: 1, borderColor: '#20222b', borderRadius: 12, color: '#fff', fontSize: 13, padding: 10, marginBottom: 12 },
  inputLabel: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalCancelButton: { backgroundColor: '#1f2937' },
  modalSaveButton: { backgroundColor: '#f59e0b' },
  modalButtonText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});

// ─── Styles: Main Terminal Layout ───────────────────────────────────────────
const termStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0e12' },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#20222b', backgroundColor: '#13151b'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 90, height: 35, resizeMode: 'contain' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cajeroName: { color: '#9ca3af', fontSize: 13, fontWeight: '500' },
  logoutBtn: { backgroundColor: '#1f2937', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logoutText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },
  body: { flex: 1, flexDirection: 'row' },
  
  // Col 1: Products (50% screen width)
  colProducts: { flex: 2, borderRightWidth: 1, borderRightColor: '#20222b', padding: 16 },
  searchContainer: { marginBottom: 12 },
  searchInput: { backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20222b', borderRadius: 12, color: '#fff', fontSize: 13, padding: 10 },
  catsScroll: { maxHeight: 36, marginBottom: 16 },
  catBtn: { backgroundColor: '#13151b', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: '#20222b' },
  catBtnActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  catText: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold' },
  catTextActive: { color: '#000' },
  prodCard: {
    flex: 1, margin: 4, padding: 10, backgroundColor: '#13151b', borderRadius: 12,
    borderWidth: 1, borderColor: '#20222b', justifyContent: 'space-between', height: 100
  },
  prodName: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  prodSku: { color: '#444', fontSize: 9, marginTop: 2 },
  prodFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  prodPrice: { color: '#f59e0b', fontSize: 13, fontWeight: 'bold' },
  prodStock: { color: '#10b981', fontSize: 11, fontWeight: 'bold' },

  // Col 2: Cart (30% screen width)
  colCart: { flex: 1.2, borderRightWidth: 1, borderRightColor: '#20222b', padding: 16, backgroundColor: '#090b0f' },
  sectionTitle: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 14 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCartText: { color: '#444', fontSize: 13 },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#20222b' },
  cartItemDetails: { flex: 1, marginRight: 10 },
  cartItemName: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  cartItemPrice: { color: '#555', fontSize: 11, marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20222b', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  qtyText: { color: '#fff', fontSize: 13, fontWeight: 'bold', minWidth: 20, textAlign: 'center' },

  // Col 3: Checkout (20% screen width)
  colCheckout: { flex: 0.8, padding: 16, justifyContent: 'space-between' },
  totalCard: { backgroundColor: '#13151b', borderWidth: 1, borderColor: '#20222b', borderRadius: 16, padding: 16, alignItems: 'center' },
  totalLabel: { color: '#555', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  totalValue: { color: '#10b981', fontSize: 24, fontWeight: '900', marginTop: 4 },
  payButton: { backgroundColor: '#10b981', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { color: '#000', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

  // Checkout modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)' },
  checkoutModal: { width: '100%', maxWidth: 460, backgroundColor: '#13151b', borderRadius: 20, borderWidth: 1, borderColor: '#20222b', padding: 24 },
  modalHeader: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  checkoutTotal: { color: '#10b981', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
  payTypesGrid: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
  payTypeCard: { flex: 1, padding: 14, backgroundColor: '#0d0e12', borderRadius: 16, borderWidth: 1, borderColor: '#20222b', alignItems: 'center' },
  payTypeCardActive: { borderColor: '#f59e0b', backgroundColor: '#1a1c24' },
  payTypeIcon: { fontSize: 22 },
  payTypeTitle: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginTop: 6 },
  cashCalculator: { marginBottom: 20 },
  cashLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 6 },
  cashInput: { backgroundColor: '#0d0e12', borderWidth: 1, borderColor: '#20222b', borderRadius: 12, color: '#fff', fontSize: 16, padding: 12, fontWeight: 'bold' },
  changeText: { color: '#10b981', fontSize: 14, fontWeight: 'bold', marginTop: 10, textAlign: 'center' },
  modalActionBtns: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnConfirm: { flex: 1, backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' }
});

import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  FlatList, ScrollView, SafeAreaView, ActivityIndicator, Alert, Linking,
  Platform, PermissionsAndroid
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
const CameraView: any = null;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.log('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0d0e12', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Error del Sistema</Text>
          <ScrollView style={{ backgroundColor: '#1f2937', padding: 10, borderRadius: 8, width: '100%', maxHeight: 300 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace' }}>{this.state.error?.toString()}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 10, fontFamily: 'monospace', marginTop: 10 }}>{this.state.error?.stack}</Text>
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

// API Central en producción
const API_URL = 'https://pdventa.onrender.com/api/v1';

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

function MainApp() {
  const [currentView, setCurrentView] = useState<'catalog' | 'scanner' | 'cart' | 'result'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Productos de catálogo local (como fallback, se actualiza desde API si hay red)
  const [products, setProducts] = useState<Product[]>([
    { id: '1', sku: 'AUT-881', codigoBarras: '7501006598214', nombre: 'Balatas Delanteras Cerámicas de Alto Rendimiento', categoria: 'Automotriz', precio: 340.00, stock: 15, unidad: 'pieza' },
    { id: '2', sku: 'FER-092', codigoBarras: '7501006598221', nombre: 'Cable de Cobre Calibre 12 THW Aislamiento Extra', categoria: 'Ferretería', precio: 18.00, stock: 240, unidad: 'metros' },
    { id: '3', sku: 'FER-114', codigoBarras: '7501006598238', nombre: 'Disco Abrasivo Corte Metal 4.5" Extra Fino', categoria: 'Ferretería', precio: 45.50, stock: 85, unidad: 'piezas' },
    { id: '4', sku: 'REF-001', codigoBarras: '7501011302722', nombre: 'Coca Cola 600ml', categoria: 'Abarrotes', precio: 18.50, stock: 50, unidad: 'piezas' },
    { id: '5', sku: 'PAN-001', codigoBarras: '7501011302739', nombre: 'Pan Dulce (Concha)', categoria: 'Panadería', precio: 15.00, stock: 45, unidad: 'piezas' },
  ]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<{ codigoCorto: string; folio: string } | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');

  // Cámara para escaneo de códigos de barra
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

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
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(isGranted);
        return isGranted;
      } else {
        setHasPermission(false);
        return false;
      }
    } catch (err) {
      console.warn(err);
      setHasPermission(false);
      return false;
    }
  };

  useEffect(() => {
    // Cargar productos actualizados de la API central
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/productos/buscar?q=`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          const mapped = data.map((p: any) => ({
            id: String(p.id),
            sku: String(p.sku),
            codigoBarras: p.codigoBarras ? String(p.codigoBarras) : undefined,
            nombre: String(p.nombre),
            categoria: p.categoria ? String(p.categoria) : 'General',
            precio: Number(p.precio) || 0,
            stock: Number(p.stock) || 0,
            unidad: p.unidad ? String(p.unidad) : 'pieza'
          }));
          setProducts(mapped);
        }
      }
    } catch (e) {
      console.log('Error de red, usando catálogo local persistido.');
    }
  };

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
    Alert.alert('Agregado', `${product.nombre} se agregó al pedido.`);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    const matched = products.find(p => p.codigoBarras === data || p.sku === data);
    
    if (matched) {
      handleAddToCart(matched);
      setCurrentView('cart');
    } else {
      Alert.alert('No encontrado', `Ningún producto coincide con el código: ${data}`, [
        { text: 'Aceptar', onPress: () => setScanned(false) }
      ]);
    }
  };

  // Crear Cotización / Apartado en Supabase a través de API
  const handleCreateQuote = async () => {
    if (cart.length === 0) return;
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursalId: 'suc-norte',
          usuarioId: 'vendedor-movil',
          clienteNombre: 'Vendedor Piso Movil',
          items: cart.map(item => ({
            productoId: item.product.id,
            cantidad: item.quantity
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Error al registrar cotización');
      }

      const result = await response.json();
      setQuoteResult({
        codigoCorto: result.codigoCorto,
        folio: result.folio
      });
      setCart([]);
      setCurrentView('result');
    } catch (e: any) {
      Alert.alert('Error de Red', 'No se pudo sincronizar el pedido con la caja central. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const shareQuoteOnWhatsApp = (quote: { codigoCorto: string; folio: string }) => {
    if (!whatsAppPhone) {
      Alert.alert('Requerido', 'Ingresa el número telefónico del cliente.');
      return;
    }
    const cleanPhone = whatsAppPhone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('52') ? cleanPhone : `521${cleanPhone}`;

    const textMessage = `¡Hola! Te compartimos la cotización de *Apex POS Móvil*:\n\n*Folio:* ${quote.folio}\n*Código de cobro rápido:* *${quote.codigoCorto}*\n\nPresenta el código *${quote.codigoCorto}* en la caja rápida de la tienda para realizar tu pago. ¡Gracias por tu preferencia!`;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(textMessage)}`;
    
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp en este dispositivo.');
    });
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.codigoBarras && p.codigoBarras.includes(searchQuery))
  );

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.precio * item.quantity), 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>APEX MÓVIL</Text>
        <Text style={styles.headerSubtitle}>Pedidos de Piso</Text>
      </View>

      {/* VISTA 1: CATÁLOGO */}
      {currentView === 'catalog' && (
        <View style={styles.content}>
          <TextInput
            placeholder="Buscar por código, SKU o nombre..."
            placeholderTextColor="#666"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <FlatList
            data={filteredProducts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={styles.productCard}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.productName}>{item.nombre}</Text>
                  <Text style={styles.productMeta}>SKU: {item.sku} • {item.categoria}</Text>
                  <Text style={styles.productPrice}>${item.precio.toFixed(2)}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={() => handleAddToCart(item)}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No se encontraron productos</Text>
            }
          />

          {/* Bottom Bar Actions */}
          <View style={styles.bottomNav}>
            <TouchableOpacity 
              style={[styles.navButton, { backgroundColor: '#1a1c24' }]}
              onPress={async () => { 
                setScanned(false); 
                if (!hasPermission) {
                  const resGranted = await requestCameraPermission();
                  if (!resGranted) {
                    Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para usar el escáner de códigos de barras.');
                    return;
                  }
                }
                setCurrentView('scanner'); 
              }}
            >
              <Text style={styles.navButtonText}>📷 ESCANEAR</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => setCurrentView('cart')}
            >
              <Text style={styles.navButtonText}>🛒 PEDIDO ({cart.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* VISTA 2: CÁMARA ESCÁNER */}
      {currentView === 'scanner' && (
        <View style={styles.content}>
          {hasPermission === null ? (
            <Text style={styles.emptyText}>Solicitando permiso de cámara...</Text>
          ) : hasPermission === false ? (
            <Text style={styles.emptyText}>Sin acceso a la cámara. Habilita permisos en ajustes.</Text>
          ) : !CameraView ? (
            <Text style={styles.emptyText}>Módulo de cámara no disponible en este dispositivo.</Text>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            />
          )}

          <TouchableOpacity 
            style={styles.closeScannerButton}
            onPress={() => setCurrentView('catalog')}
          >
            <Text style={styles.navButtonText}>Volver al Catálogo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VISTA 3: CARRITO / PEDIDO */}
      {currentView === 'cart' && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Productos en Pedido</Text>
          
          <FlatList
            data={cart}
            keyExtractor={item => item.product.id}
            renderItem={({ item }) => (
              <View style={styles.cartCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.product.nombre}</Text>
                  <Text style={styles.productPrice}>
                    ${item.product.precio.toFixed(2)} x {item.quantity}
                  </Text>
                </View>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => {
                      setCart(prev => prev.map(c => 
                        c.product.id === item.product.id ? { ...c, quantity: Math.max(1, c.quantity - 1) } : c
                      ));
                    }}
                  >
                    <Text style={styles.qtyText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => {
                      setCart(prev => prev.map(c => 
                        c.product.id === item.product.id ? { ...c, quantity: c.quantity + 1 } : c
                      ));
                    }}
                  >
                    <Text style={styles.qtyText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>El pedido está vacío</Text>
            }
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
                <TouchableOpacity 
                  style={styles.checkoutBtn}
                  onPress={handleCreateQuote}
                >
                  <Text style={styles.checkoutBtnText}>ENVIAR A CAJA CENTRAL</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => setCurrentView('catalog')}
          >
            <Text style={styles.backBtnText}>Continuar Agregando</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VISTA 4: RESULTADO DE COTIZACIÓN */}
      {currentView === 'result' && quoteResult && (
        <View style={[styles.content, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.resultCheck}>✓</Text>
          <Text style={styles.resultTitle}>Pedido Enviado</Text>
          <Text style={styles.resultDesc}>Presenta este código en caja rápida para cobrar:</Text>
          
          <View style={styles.codeCard}>
            <Text style={styles.resultCode}>{quoteResult.codigoCorto}</Text>
          </View>
          
          <Text style={styles.resultFolio}>{quoteResult.folio}</Text>

          {/* Compartir WhatsApp Panel */}
          <View style={styles.whatsappPanel}>
            <Text style={styles.whatsappLabel}>Compartir por WhatsApp:</Text>
            <View style={styles.whatsappRow}>
              <TextInput
                placeholder="Ej: 4491234567"
                placeholderTextColor="#666"
                keyboardType="phone-pad"
                style={styles.whatsappInput}
                value={whatsAppPhone}
                onChangeText={setWhatsAppPhone}
              />
              <TouchableOpacity 
                style={styles.whatsappBtn}
                onPress={() => shareQuoteOnWhatsApp(quoteResult)}
              >
                <Text style={styles.whatsappBtnText}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.checkoutBtn, { marginTop: 24, width: '80%' }]}
            onPress={() => { setWhatsAppPhone(''); setCurrentView('catalog'); }}
          >
            <Text style={styles.checkoutBtnText}>Nuevo Pedido</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0e12',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#20222b',
    backgroundColor: '#13151b',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
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
  productName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  productMeta: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  productPrice: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  addButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0d0e12',
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#0d0e12',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
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
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cartCard: {
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d0e12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#20222b',
  },
  qtyBtn: {
    padding: 12,
  },
  qtyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  qtyValue: {
    color: '#fff',
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  cartSummary: {
    borderTopWidth: 1,
    borderTopColor: '#20222b',
    paddingTop: 16,
    marginTop: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalVal: {
    color: '#f59e0b',
    fontSize: 24,
    fontWeight: '900',
  },
  checkoutBtn: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  backBtnText: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  resultCheck: {
    fontSize: 64,
    color: '#10b981',
    fontWeight: 'bold',
  },
  resultTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 16,
  },
  resultDesc: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  codeCard: {
    backgroundColor: '#13151b',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingVertical: 18,
    marginTop: 24,
  },
  resultCode: {
    color: '#f59e0b',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
  },
  resultFolio: {
    color: '#444',
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 12,
  },
  whatsappPanel: {
    marginTop: 24,
    width: '80%',
    backgroundColor: '#13151b',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 16,
    padding: 16,
  },
  whatsappLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  whatsappRow: {
    flexDirection: 'row',
    gap: 8,
  },
  whatsappInput: {
    flex: 1,
    backgroundColor: '#0d0e12',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#20222b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
  },
  whatsappBtn: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  }
});

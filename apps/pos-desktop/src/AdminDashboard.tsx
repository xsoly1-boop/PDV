import React, { useState } from 'react';
import { 
  LayoutDashboard, Package, Users, TrendingUp, Settings, 
  X, Edit2, Trash2, Search, Building, Save, 
  DollarSign, CheckCircle, Store,
  PlusCircle, FileSpreadsheet
} from 'lucide-react';

interface CompanyConfig {
  businessName: string;
  rfc: string;
  currency: string;
  taxRate: number;
  address: string;
  phone: string;
  logoUrl?: string;
}

interface AdminDashboardProps {
  currentUser: { nombre: string; rol: string };
  theme: 'dark' | 'light';
  onClose: () => void;
  config: CompanyConfig;
  onConfigChange: (newConfig: CompanyConfig) => void;
  products: Product[];
  onProductsChange: (newProducts: Product[]) => void;
}

interface Product {
  id: string;
  sku: string;
  codigoBarras?: string;
  nombre: string;
  categoria: string;
  precio: number;
  costo: number;
  stock: number;
  unidad: string;
}

interface Employee {
  id: string;
  nombre: string;
  rol: string;
  pin: string;
  activo: boolean;
}

export default function AdminDashboard({ currentUser, theme, onClose, config: initialConfig, onConfigChange, products, onProductsChange }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'products' | 'employees' | 'sales' | 'config'>('summary');
  const [searchQuery, setSearchQuery] = useState('');


  // 2. Mock Data for Employees
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', nombre: 'Carlos M.', rol: 'Administrador', pin: '9999', activo: true },
    { id: '2', nombre: 'Dorian', rol: 'Cajero', pin: '1234', activo: true },
    { id: '3', nombre: 'Ana G.', rol: 'Agente Ventas', pin: '5555', activo: true },
  ]);

  // 3. Mock Data for Sales
  const [sales] = useState([
    { id: 'TKT-14092', fecha: 'Hoy, 12:45 PM', cliente: 'Público General', total: 403.50, items: 3, metodo: 'Efectivo', sucursal: 'Suc. Norte' },
    { id: 'TKT-14091', fecha: 'Hoy, 11:20 AM', cliente: 'Taller Mecánico Hnos.', total: 1240.00, items: 4, metodo: 'Tarjeta', sucursal: 'Suc. Norte' },
    { id: 'TKT-14090', fecha: 'Ayer, 06:15 PM', cliente: 'Construcciones del Centro', total: 5850.00, items: 12, metodo: 'Transferencia', sucursal: 'Suc. Norte' },
    { id: 'TKT-14089', fecha: 'Ayer, 04:30 PM', cliente: 'Público General', total: 95.00, items: 1, metodo: 'Efectivo', sucursal: 'Suc. Sur' },
  ]);

  // 4. Config State
  const [config, setConfig] = useState<CompanyConfig>(initialConfig);

  // Modals / Form States
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee>>({});

  // Summary Metrics
  const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
  const totalStockItems = products.reduce((acc, p) => acc + p.stock, 0);
  const totalCost = products.reduce((acc, p) => acc + (p.costo * p.stock), 0);
  const estimatedProfit = products.reduce((acc, p) => acc + ((p.precio - p.costo) * p.stock), 0);

  // Logo file upload handler
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onConfigChange(config);
    alert('Configuración de la empresa guardada con éxito.');
  };


  // Add / Edit Product
  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentProduct.id) {
      // Edit
      const updated = products.map(p => p.id === currentProduct.id ? (currentProduct as Product) : p);
      onProductsChange(updated);
      alert('Producto actualizado con éxito.');
    } else {
      // Add
      const newP = {
        ...currentProduct,
        id: (products.length + 1).toString(),
        sku: currentProduct.sku || `SKU-${Math.floor(100 + Math.random() * 900)}`,
      } as Product;
      onProductsChange([...products, newP]);
      alert('Producto agregado al catálogo.');
    }
    setShowProductModal(false);
    setCurrentProduct({});
  };

  // Delete Product
  const handleDeleteProduct = (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      const updated = products.filter(p => p.id !== id);
      onProductsChange(updated);
    }
  };

  // Add / Edit Employee
  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentEmployee.id) {
      // Edit
      setEmployees(prev => prev.map(emp => emp.id === currentEmployee.id ? (currentEmployee as Employee) : emp));
      alert('Empleado actualizado con éxito.');
    } else {
      // Add
      const newEmp = {
        ...currentEmployee,
        id: (employees.length + 1).toString(),
        activo: true,
      } as Employee;
      setEmployees(prev => [...prev, newEmp]);
      alert('Personal agregado al sistema.');
    }
    setShowEmployeeModal(false);
    setCurrentEmployee({});
  };

  // Delete Employee
  const handleDeleteEmployee = (id: string) => {
    if (confirm('¿Estás seguro de dar de baja a este usuario?')) {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  const filteredProducts = products.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.categoria.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.codigoBarras && p.codigoBarras.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className={`fixed inset-0 z-50 flex flex-col font-sans select-none ${
      theme === 'dark' ? 'bg-[#0d0e12] text-slate-200' : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Header Panel */}
      <header className={`flex items-center justify-between px-8 py-5 border-b shadow-md ${
        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 text-slate-950 font-black p-2.5 rounded-xl shadow-lg shadow-amber-500/20">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider">Panel de Administración</h1>
            <p className="text-xs text-slate-500">Módulo de control de recursos e inventario global</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 border rounded-xl text-sm font-medium ${
            theme === 'dark' ? 'bg-[#1a1c24] border-[#262836] text-slate-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <span>Admin: <strong>{currentUser.nombre}</strong></span>
          </div>
          <button 
            onClick={onClose}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              theme === 'dark' 
                ? 'bg-[#1a1c24] border-[#262836] hover:bg-slate-800 text-slate-400 hover:text-white' 
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Panel View */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar Nav */}
        <aside className={`w-64 p-5 flex flex-col justify-between border-r ${
          theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-2">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border-0 cursor-pointer ${
                activeTab === 'summary' 
                  ? 'bg-amber-500 text-[#0d0e12] shadow-lg shadow-amber-500/10' 
                  : theme === 'dark' ? 'text-slate-400 hover:bg-[#1a1c24] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-5 h-5" /> Resumen y Métricas
            </button>
            
            <button 
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border-0 cursor-pointer ${
                activeTab === 'products' 
                  ? 'bg-amber-500 text-[#0d0e12] shadow-lg shadow-amber-500/10' 
                  : theme === 'dark' ? 'text-slate-400 hover:bg-[#1a1c24] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Package className="w-5 h-5" /> Catálogo / Stock
            </button>
            
            <button 
              onClick={() => setActiveTab('employees')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border-0 cursor-pointer ${
                activeTab === 'employees' 
                  ? 'bg-amber-500 text-[#0d0e12] shadow-lg shadow-amber-500/10' 
                  : theme === 'dark' ? 'text-slate-400 hover:bg-[#1a1c24] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Users className="w-5 h-5" /> Gestión de Personal
            </button>
            
            <button 
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border-0 cursor-pointer ${
                activeTab === 'sales' 
                  ? 'bg-amber-500 text-[#0d0e12] shadow-lg shadow-amber-500/10' 
                  : theme === 'dark' ? 'text-slate-400 hover:bg-[#1a1c24] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5" /> Historial de Ventas
            </button>
            
            <button 
              onClick={() => setActiveTab('config')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all border-0 cursor-pointer ${
                activeTab === 'config' 
                  ? 'bg-amber-500 text-[#0d0e12] shadow-lg shadow-amber-500/10' 
                  : theme === 'dark' ? 'text-slate-400 hover:bg-[#1a1c24] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-5 h-5" /> Configuración Empresa
            </button>
          </div>

          <div className={`p-4 rounded-xl border text-center ${
            theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200'
          }`}>
            <Building className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <p className="text-xs font-bold truncate">{config.businessName}</p>
            <p className="text-[10px] text-slate-500 mt-1">RFC: {config.rfc}</p>
          </div>
        </aside>

        {/* Tab Content Display Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          
          {/* TAB 1: SUMMARY METRICS */}
          {activeTab === 'summary' && (
            <div className="space-y-8 animate-fadeIn">
              <h2 className="text-lg font-bold uppercase tracking-wider mb-4">Métricas Globales de Hoy</h2>
              
              {/* Widgets Row */}
              <div className="grid grid-cols-4 gap-6">
                <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Ventas Cobradas (Hoy)</p>
                    <h3 className="text-3xl font-black text-emerald-550 mt-1">${totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-emerald-500/15 text-emerald-500 p-3.5 rounded-xl">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Total Items en Inventario</p>
                    <h3 className="text-3xl font-black text-amber-500 mt-1">{totalStockItems}</h3>
                  </div>
                  <div className="bg-amber-500/15 text-amber-500 p-3.5 rounded-xl">
                    <Package className="w-6 h-6" />
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Costo Total Valuado</p>
                    <h3 className="text-3xl font-black text-slate-400 mt-1">${totalCost.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-slate-500/15 text-slate-400 p-3.5 rounded-xl">
                    <Store className="w-6 h-6" />
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Utilidad Estimada</p>
                    <h3 className="text-3xl font-black text-amber-500 mt-1">${estimatedProfit.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h3>
                  </div>
                  <div className="bg-amber-500/15 text-amber-500 p-3.5 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Status and Database Connection Status Card */}
              <div className={`p-6 rounded-2xl border ${
                theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-amber-500" /> Sincronización y Enlace de Nube
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className={`p-4 rounded-xl text-center border ${theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-xs font-bold text-slate-500">Base de Datos Central</p>
                    <p className="text-base font-black text-emerald-500 mt-1">Supabase (PostgreSQL)</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center border ${theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-xs font-bold text-slate-500">Estado de Servidor API</p>
                    <p className="text-base font-black text-emerald-500 mt-1">Render (On-line)</p>
                  </div>
                  <div className={`p-4 rounded-xl text-center border ${theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-200'}`}>
                    <p className="text-xs font-bold text-slate-500">Tiempo de Respuesta API</p>
                    <p className="text-base font-black text-amber-500 mt-1">115 ms</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT CATALOG */}
          {activeTab === 'products' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold uppercase tracking-wider">Catálogo de Artículos</h2>
                <button 
                  onClick={() => { setCurrentProduct({}); setShowProductModal(true); }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 border-0 cursor-pointer transition-all active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" /> Agregar Artículo
                </button>
              </div>

              {/* Filter / Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar en el catálogo (SKU, nombre, categoría)..."
                  className={`w-full rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-amber-500 border ${
                    theme === 'dark' 
                      ? 'bg-[#13151b] border-[#20222b] text-white placeholder-slate-500' 
                      : 'bg-white border-slate-250 text-slate-900 placeholder-slate-400 shadow-sm'
                  }`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Data Table */}
              <div className={`border rounded-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-xs font-bold uppercase tracking-wider text-slate-500 ${
                      theme === 'dark' ? 'bg-[#1c1e27] border-[#20222b]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <th className="py-4 px-6">SKU</th>
                      <th className="py-4 px-6">Cód. Barras</th>
                      <th className="py-4 px-6">Descripción</th>
                      <th className="py-4 px-6">Categoría</th>
                      <th className="py-4 px-6 text-right">Costo</th>
                      <th className="py-4 px-6 text-right">Precio Público</th>
                      <th className="py-4 px-6 text-center">Stock</th>
                      <th className="py-4 px-6 text-center">Unidad</th>
                      <th className="py-4 px-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.id} className={`border-b text-sm transition-colors hover:bg-slate-500/5 ${
                        theme === 'dark' ? 'border-[#20222b]' : 'border-slate-150'
                      }`}>
                        <td className="py-3 px-6 font-mono font-bold text-amber-500">{p.sku}</td>
                        <td className="py-3 px-6 font-mono text-xs text-slate-400">{p.codigoBarras || '—'}</td>
                        <td className="py-3 px-6 font-medium">{p.nombre}</td>
                        <td className="py-3 px-6">{p.categoria}</td>
                        <td className="py-3 px-6 text-right font-mono text-slate-500">${p.costo.toFixed(2)}</td>
                        <td className="py-3 px-6 text-right font-mono font-bold text-slate-200">${p.precio.toFixed(2)}</td>
                        <td className="py-3 px-6 text-center font-mono">
                          <span className={`px-2 py-1 rounded-md font-black ${
                            p.stock < 10 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>{p.stock}</span>
                        </td>
                        <td className="py-3 px-6 text-center text-xs text-slate-500 capitalize">{p.unidad}</td>
                        <td className="py-3 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => { setCurrentProduct(p); setShowProductModal(true); }}
                              className={`p-1.5 rounded-lg border bg-transparent cursor-pointer hover:border-amber-500 text-slate-450 hover:text-amber-500 transition-all`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(p.id)}
                              className={`p-1.5 rounded-lg border bg-transparent cursor-pointer hover:border-rose-500 text-slate-450 hover:text-rose-500 transition-all`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GESTIÓN DE PERSONAL */}
          {activeTab === 'employees' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold uppercase tracking-wider">Colaboradores & Permisos</h2>
                <button 
                  onClick={() => { setCurrentEmployee({}); setShowEmployeeModal(true); }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 border-0 cursor-pointer transition-all active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" /> Registrar Personal
                </button>
              </div>

              {/* Data Table */}
              <div className={`border rounded-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-xs font-bold uppercase tracking-wider text-slate-500 ${
                      theme === 'dark' ? 'bg-[#1c1e27] border-[#20222b]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <th className="py-4 px-6">ID</th>
                      <th className="py-4 px-6">Nombre Completo</th>
                      <th className="py-4 px-6">Rol asignado</th>
                      <th className="py-4 px-6 text-center">PIN de Acceso</th>
                      <th className="py-4 px-6 text-center">Estado</th>
                      <th className="py-4 px-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id} className={`border-b text-sm transition-colors hover:bg-slate-500/5 ${
                        theme === 'dark' ? 'border-[#20222b]' : 'border-slate-150'
                      }`}>
                        <td className="py-4 px-6 font-mono text-slate-500">{emp.id}</td>
                        <td className="py-4 px-6 font-bold">{emp.nombre}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            emp.rol === 'Administrador' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-500/10 text-slate-400'
                          }`}>{emp.rol}</span>
                        </td>
                        <td className="py-4 px-6 text-center font-mono font-black tracking-widest text-slate-300">
                          {emp.pin}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                            emp.activo ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'
                          }`} />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => { setCurrentEmployee(emp); setShowEmployeeModal(true); }}
                              className={`p-1.5 rounded-lg border bg-transparent cursor-pointer hover:border-amber-500 text-slate-450 hover:text-amber-500 transition-all`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className={`p-1.5 rounded-lg border bg-transparent cursor-pointer hover:border-rose-500 text-slate-450 hover:text-rose-500 transition-all`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SALES LOG */}
          {activeTab === 'sales' && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-lg font-bold uppercase tracking-wider">Historial de Ventas Sincronizadas</h2>

              {/* Data Table */}
              <div className={`border rounded-2xl overflow-hidden ${
                theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-xs font-bold uppercase tracking-wider text-slate-500 ${
                      theme === 'dark' ? 'bg-[#1c1e27] border-[#20222b]' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <th className="py-4 px-6">Ticket ID</th>
                      <th className="py-4 px-6">Fecha/Hora</th>
                      <th className="py-4 px-6">Cliente / RFC</th>
                      <th className="py-4 px-6 text-center">Artículos</th>
                      <th className="py-4 px-6 text-center">Método de Pago</th>
                      <th className="py-4 px-6 text-right">Importe Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map(sale => (
                      <tr key={sale.id} className={`border-b text-sm transition-colors hover:bg-slate-500/5 ${
                        theme === 'dark' ? 'border-[#20222b]' : 'border-slate-150'
                      }`}>
                        <td className="py-4 px-6 font-mono font-bold text-amber-500">{sale.id}</td>
                        <td className="py-4 px-6 text-slate-400">{sale.fecha}</td>
                        <td className="py-4 px-6 font-medium">{sale.cliente}</td>
                        <td className="py-4 px-6 text-center font-mono">{sale.items}</td>
                        <td className="py-4 px-6 text-center font-medium">{sale.metodo}</td>
                        <td className="py-4 px-6 text-right font-mono font-black text-emerald-450">${sale.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: SYSTEM CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-6 animate-fadeIn max-w-2xl">
              <h2 className="text-lg font-bold uppercase tracking-wider">Configuración General de la Empresa</h2>
              
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Nombre Comercial</label>
                    <input
                      type="text"
                      className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                      value={config.businessName}
                      onChange={e => setConfig({ ...config, businessName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-550 mb-2">RFC Fiscal</label>
                    <input
                      type="text"
                      className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                      value={config.rfc}
                      onChange={e => setConfig({ ...config, rfc: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Moneda por defecto</label>
                    <input
                      type="text"
                      className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                      value={config.currency}
                      onChange={e => setConfig({ ...config, currency: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Tasa de IVA General (%)</label>
                    <input
                      type="number"
                      className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                        theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                      }`}
                      value={config.taxRate}
                      onChange={e => setConfig({ ...config, taxRate: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Dirección Fiscal / Oficina</label>
                  <input
                    type="text"
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                    value={config.address}
                    onChange={e => setConfig({ ...config, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Teléfono de Atención</label>
                  <input
                    type="text"
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'
                    }`}
                    value={config.phone}
                    onChange={e => setConfig({ ...config, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-550 mb-2">Logotipo del Negocio</label>
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-slate-700/50 bg-[#0d0e12]/30">
                    {config.logoUrl ? (
                      <div className="relative group">
                        <img src={config.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-slate-650" />
                        <button 
                          type="button" 
                          onClick={() => setConfig(prev => ({ ...prev, logoUrl: '' }))}
                          className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 cursor-pointer border-0 shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed border-slate-600 flex flex-col items-center justify-center text-[10px] text-slate-500">
                        <span>Sin Logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-[#0d0e12] file:cursor-pointer transition-all active:scale-95"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg border-0 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
                >
                  <Save className="w-5 h-5" /> Guardar Cambios
                </button>
              </form>
            </div>
          )}

        </main>
      </div>

      {/* ---------------- MODALES DE EDICIÓN ---------------- */}

      {/* Product Form Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className={`p-8 rounded-3xl border w-[550px] shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
          }`}>
            <button 
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold uppercase tracking-wider mb-6">
              {currentProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
            </h3>

            <form onSubmit={handleProductSubmit} className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-550 mb-1.5">SKU</label>
                  <input
                    type="text"
                    required
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.sku || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, sku: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-550 mb-1.5">Cód. Barras</label>
                  <input
                    type="text"
                    placeholder="EAN, UPC, etc."
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.codigoBarras || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, codigoBarras: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-550 mb-1.5">Categoría</label>
                  <input
                    type="text"
                    required
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.categoria || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, categoria: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Nombre / Descripción</label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                  }`}
                  value={currentProduct.nombre || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, nombre: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Costo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.costo || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, costo: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Precio ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.precio || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, precio: parseFloat(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Stock Real</label>
                  <input
                    type="number"
                    required
                    className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                    }`}
                    value={currentProduct.stock || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, stock: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Unidad de Medida (Ej: pieza, metros, kg)</label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                  }`}
                  value={currentProduct.unidad || ''}
                  onChange={e => setCurrentProduct({ ...currentProduct, unidad: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-[#0d0e12] font-bold py-3.5 rounded-xl shadow-lg border-0 cursor-pointer transition-all active:scale-95"
                >
                  Confirmar Artículo
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className={`flex-1 font-bold py-3.5 rounded-xl border bg-transparent cursor-pointer transition-all hover:bg-slate-500/10 ${
                    theme === 'dark' ? 'border-[#20222b] text-slate-400' : 'border-slate-350 text-slate-600'
                  }`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Form Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className={`p-8 rounded-3xl border w-[450px] shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200'
          }`}>
            <button 
              onClick={() => setShowEmployeeModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold uppercase tracking-wider mb-6">
              {currentEmployee.id ? 'Modificar Personal' : 'Nuevo Colaborador'}
            </h3>

            <form onSubmit={handleEmployeeSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Nombre Completo</label>
                <input
                  type="text"
                  required
                  className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                  }`}
                  value={currentEmployee.nombre || ''}
                  onChange={e => setCurrentEmployee({ ...currentEmployee, nombre: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Rol de Sistema</label>
                <select
                  className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-300' : 'bg-slate-50 border-slate-250 shadow-sm'
                  }`}
                  value={currentEmployee.rol || 'Cajero'}
                  onChange={e => setCurrentEmployee({ ...currentEmployee, rol: e.target.value })}
                >
                  <option value="Cajero">Cajero</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Agente Ventas">Agente Ventas</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">PIN Rápido (4 dígitos)</label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  className={`w-full rounded-xl p-3 border focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono tracking-widest ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b]' : 'bg-slate-50 border-slate-250 shadow-sm'
                  }`}
                  value={currentEmployee.pin || ''}
                  onChange={e => setCurrentEmployee({ ...currentEmployee, pin: e.target.value })}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-[#0d0e12] font-bold py-3.5 rounded-xl shadow-lg border-0 cursor-pointer transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className={`flex-1 font-bold py-3.5 rounded-xl border bg-transparent cursor-pointer transition-all hover:bg-slate-500/10 ${
                    theme === 'dark' ? 'border-[#20222b] text-slate-400' : 'border-slate-350 text-slate-600'
                  }`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

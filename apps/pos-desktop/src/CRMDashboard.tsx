import React, { useState, useEffect } from 'react';
import { 
  X, Search, PlusCircle, Edit2, Trash2, DollarSign, 
  User, Phone, Mail, MapPin, ArrowLeftRight, 
  Download
} from 'lucide-react';
import { API_V1 } from './config';
import { exportClientesCSV } from './services/exportUtils';

interface CRMDashboardProps {
  theme: 'dark' | 'light';
  onClose: () => void;
}

export default function CRMDashboard({ theme, onClose }: CRMDashboardProps) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [selectedHistorial, setSelectedHistorial] = useState<{ cliente: any; ventas: any[]; transacciones: any[] } | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoConcepto, setAbonoConcepto] = useState('');
  
  const [newCliente, setNewCliente] = useState({
    id: '',
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    limiteCredito: '5000',
    saldoDeudor: '0',
    rfc: '',
    razonSocial: '',
    regimenFiscal: '',
    codigoPostal: '',
    direccionFiscal: ''
  });

  const isDark = theme === 'dark';

  const fetchClientes = async () => {
    try {
      const res = await fetch(`${API_V1}/clientes`);
      if (res.ok) {
        const data = await res.json();
        setClientes(data);
      }
    } catch (err) {
      console.error('Error fetching clientes:', err);
    }
  };

  const fetchHistorial = async (clienteId: string) => {
    try {
      const res = await fetch(`${API_V1}/clientes/${clienteId}/historial`);
      if (res.ok) {
        const data = await res.json();
        setSelectedHistorial(data);
      }
    } catch (err) {
      console.error('Error fetching historial:', err);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  useEffect(() => {
    if (selectedCliente) {
      fetchHistorial(selectedCliente.id);
    } else {
      setSelectedHistorial(null);
    }
  }, [selectedCliente]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliente.nombre.trim()) return;

    try {
      const method = newCliente.id ? 'PUT' : 'POST';
      const url = newCliente.id ? `${API_V1}/clientes/${newCliente.id}` : `${API_V1}/clientes`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newCliente.nombre,
          telefono: newCliente.telefono || null,
          email: newCliente.email || null,
          direccion: newCliente.direccion || null,
          limiteCredito: Number(newCliente.limiteCredito) || 0,
          saldoDeudor: Number(newCliente.saldoDeudor) || 0,
          rfc: newCliente.rfc || null,
          razonSocial: newCliente.razonSocial || null,
          regimenFiscal: newCliente.regimenFiscal || null,
          codigoPostal: newCliente.codigoPostal || null,
          direccionFiscal: newCliente.direccionFiscal || null
        })
      });

      if (res.ok) {
        const saved = await res.json();
        setShowAddModal(false);
        setNewCliente({
          id: '', nombre: '', telefono: '', email: '', direccion: '',
          limiteCredito: '5000', saldoDeudor: '0', rfc: '',
          razonSocial: '', regimenFiscal: '', codigoPostal: '', direccionFiscal: ''
        });
        await fetchClientes();
        if (selectedCliente && selectedCliente.id === saved.id) {
          setSelectedCliente(saved);
        }
      } else {
        alert('Error al guardar el cliente');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const handleEdit = (c: any) => {
    setNewCliente({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
      limiteCredito: c.limiteCredito.toString(),
      saldoDeudor: c.saldoDeudor.toString(),
      rfc: c.rfc || '',
      razonSocial: c.razonSocial || '',
      regimenFiscal: c.regimenFiscal || '',
      codigoPostal: c.codigoPostal || '',
      direccionFiscal: c.direccionFiscal || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de desactivar al cliente "${nombre}"?`)) return;
    try {
      const res = await fetch(`${API_V1}/clientes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedCliente?.id === id) {
          setSelectedCliente(null);
        }
        fetchClientes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAbonoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = Number(abonoMonto);
    if (!selectedCliente || isNaN(monto) || monto <= 0) return;

    try {
      const res = await fetch(`${API_V1}/clientes/${selectedCliente.id}/abono`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto, concepto: abonoConcepto.trim() })
      });

      if (res.ok) {
        setShowAbonoModal(false);
        setAbonoMonto('');
        setAbonoConcepto('');
        // Recargar clientes e historial
        await fetchClientes();
        const updatedRes = await fetch(`${API_V1}/clientes/${selectedCliente.id}`);
        if (updatedRes.ok) {
          const updatedCl = await updatedRes.json();
          setSelectedCliente(updatedCl);
        }
      } else {
        const errorData = await res.json();
        alert('Error al registrar el abono: ' + (errorData.error || 'Intente nuevamente'));
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión');
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.telefono && c.telefono.includes(searchQuery)) ||
    (c.rfc && c.rfc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalDeuda = clientes.reduce((acc, c) => acc + Number(c.saldoDeudor), 0);
  const totalDeudores = clientes.filter(c => Number(c.saldoDeudor) > 0).length;

  return (
    <div className={`fixed inset-0 z-40 flex flex-col font-sans select-none ${
      isDark ? 'bg-[#0b0c10] text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Header bar */}
      <header className={`flex items-center justify-between px-6 py-4 border-b ${
        isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-md font-bold uppercase tracking-wider">CRM y Cuentas por Cobrar</h1>
            <p className="text-[10px] text-slate-500 font-medium">Historial crediticio, abonos y control de deudores</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportClientesCSV}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
              isDark 
                ? 'bg-transparent border-[#20222b] text-slate-300 hover:bg-[#1a1c24]' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-500" /> Exportar CSV
          </button>

          <button 
            onClick={() => {
              setNewCliente({
                id: '', nombre: '', telefono: '', email: '', direccion: '',
                limiteCredito: '5000', saldoDeudor: '0', rfc: '',
                razonSocial: '', regimenFiscal: '', codigoPostal: '', direccionFiscal: ''
              });
              setShowAddModal(true);
            }}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-4 rounded-xl border-0 cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo Cliente
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

      {/* Main layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Clientes List */}
        <section className={`w-[450px] flex flex-col border-r ${
          isDark ? 'border-[#1d1f2b] bg-[#12141c]' : 'border-slate-200 bg-white'
        }`}>
          {/* Stats quick view */}
          <div className={`p-4 border-b grid grid-cols-2 gap-3 ${
            isDark ? 'border-[#1d1f2b] bg-[#161822]' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0f1016] border-[#1e202e]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Deudores</span>
              <p className="text-md font-black text-rose-500 mt-1">{totalDeudores}</p>
            </div>
            <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#0f1016] border-[#1e202e]' : 'bg-white border-slate-200 shadow-sm'}`}>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total por Cobrar</span>
              <p className="text-md font-black text-emerald-500 mt-1">${totalDeuda.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Search box */}
          <div className="p-4 border-b border-slate-800/10">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Buscar por nombre, teléfono o RFC..."
                className={`w-full rounded-xl py-2.5 pl-10 pr-4 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                  isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                }`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/10">
            {filteredClientes.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No se encontraron clientes</div>
            ) : (
              filteredClientes.map(c => {
                const isSelected = selectedCliente?.id === c.id;
                const saldo = Number(c.saldoDeudor);
                const hasDeuda = saldo > 0;
                return (
                  <div 
                    key={c.id}
                    onClick={() => setSelectedCliente(c)}
                    className={`p-4 flex items-center justify-between cursor-pointer transition-all ${
                      isSelected 
                        ? (isDark ? 'bg-amber-500/10 border-l-4 border-amber-500' : 'bg-amber-500/5 border-l-4 border-amber-500') 
                        : (isDark ? 'hover:bg-[#161822]' : 'hover:bg-slate-50')
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <h4 className="font-bold text-xs truncate text-slate-200">{c.nombre}</h4>
                      <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        {c.telefono ? <span>📞 {c.telefono}</span> : null}
                        {c.rfc ? <span className="font-mono">💼 {c.rfc}</span> : null}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className={`font-black text-xs ${hasDeuda ? 'text-rose-500' : 'text-slate-500'}`}>
                        ${saldo.toFixed(2)}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-1">Límite: ${Number(c.limiteCredito).toFixed(0)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side: Historial & Details */}
        <section className={`flex-1 flex flex-col overflow-y-auto ${
          isDark ? 'bg-[#0d0e12]' : 'bg-slate-50'
        }`}>
          {selectedCliente ? (
            <div className="p-6 space-y-6">
              
              {/* Cliente Profile Cards */}
              <div className={`p-6 rounded-2xl border ${
                isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-black text-slate-100">{selectedCliente.nombre}</h2>
                    {selectedCliente.rfc && (
                      <p className="text-[10px] text-slate-500 mt-1 font-mono uppercase">
                        RFC: {selectedCliente.rfc} | Razón Social: {selectedCliente.razonSocial || selectedCliente.nombre}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(selectedCliente)}
                      className={`p-2 rounded-xl border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                        isDark ? 'bg-[#1d1f2b] border-[#2d2f3d] text-slate-300 hover:text-white' : 'bg-slate-50 border-slate-250 text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Editar Cliente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedCliente.id, selectedCliente.nombre)}
                      className={`p-2 rounded-xl border cursor-pointer hover:scale-105 active:scale-95 transition-all ${
                        isDark ? 'bg-[#1d1f2b] border-[#2d2f3d] text-rose-400 hover:bg-rose-500/10' : 'bg-slate-50 border-slate-250 text-rose-600 hover:bg-rose-50'
                      }`}
                      title="Eliminar Cliente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <hr className={`my-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`} />

                <div className="grid grid-cols-4 gap-4">
                  {/* Contactos */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Teléfono
                    </p>
                    <p className="text-xs font-semibold text-slate-300">{selectedCliente.telefono || 'Sin teléfono'}</p>
                    
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 pt-1">
                      <Mail className="w-3 h-3" /> Correo
                    </p>
                    <p className="text-xs font-semibold text-slate-300 truncate">{selectedCliente.email || 'Sin correo'}</p>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Dirección
                    </p>
                    <p className="text-xs font-semibold text-slate-300 leading-relaxed">{selectedCliente.direccion || 'Sin dirección registrada'}</p>
                  </div>

                  {/* Límite y Deuda */}
                  <div className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isDark ? 'bg-[#161822] border-[#20222b]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Saldo Pendiente</p>
                      <p className="text-lg font-black text-rose-500 mt-1">${Number(selectedCliente.saldoDeudor).toFixed(2)}</p>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-800/10 flex justify-between text-[10px] text-slate-400">
                      <span>Límite: ${Number(selectedCliente.limiteCredito).toFixed(0)}</span>
                      <span className="font-bold text-emerald-400">
                        Disp: ${(Number(selectedCliente.limiteCredito) - Number(selectedCliente.saldoDeudor)).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button 
                    onClick={() => setShowAbonoModal(true)}
                    disabled={Number(selectedCliente.saldoDeudor) <= 0}
                    className={`flex items-center gap-1.5 py-2.5 px-6 rounded-xl border-0 font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all ${
                      Number(selectedCliente.saldoDeudor) > 0
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" /> Registrar Abono
                  </button>
                </div>
              </div>

              {/* Historial Section (Tabs: Ventas vs Transacciones de Crédito) */}
              <div className={`p-6 rounded-2xl border ${
                isDark ? 'bg-[#12141c] border-[#1d1f2b]' : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-slate-300">
                  <ArrowLeftRight className="w-4 h-4 text-amber-500" /> Historial de Movimientos de Crédito
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="pb-3">Fecha</th>
                        <th className="pb-3">Tipo</th>
                        <th className="pb-3">Concepto</th>
                        <th className="pb-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50">
                      {selectedHistorial && selectedHistorial.transacciones.length > 0 ? (
                        selectedHistorial.transacciones.map((tx: any) => (
                          <tr key={tx.id} className="hover:bg-slate-550/5 transition-colors">
                            <td className="py-3 text-slate-400">{new Date(tx.creadoAt).toLocaleString('es-MX')}</td>
                            <td className="py-3 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                tx.tipo === 'CARGO' 
                                  ? 'bg-rose-500/10 text-rose-400' 
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}>
                                {tx.tipo}
                              </span>
                            </td>
                            <td className="py-3 text-slate-200">{tx.concepto}</td>
                            <td className={`py-3 text-right font-black ${
                              tx.tipo === 'CARGO' ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {tx.tipo === 'CARGO' ? '+' : '-'}${Number(tx.monto).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500 font-medium">Sin movimientos de crédito registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <User className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-xs font-semibold">Seleccione un cliente de la lista para ver su perfil y estado de cuenta</p>
            </div>
          )}
        </section>
      </main>

      {/* ---------------- MODALES INTERNOS ---------------- */}

      {/* Modal: Agregar / Editar Cliente */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddSubmit}
            className={`w-full max-w-xl p-8 rounded-3xl border shadow-2xl relative ${
              isDark ? 'bg-[#12141c] border-[#20222b] text-slate-100' : 'bg-white border-slate-250 text-slate-800'
            }`}
          >
            <button 
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-amber-500" /> 
              {newCliente.id ? 'Editar Datos de Cliente' : 'Registrar Nuevo Cliente'}
            </h3>

            <div className="grid grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2">
              {/* Sección General */}
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-2">Datos Generales</span>
              </div>
              
              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Nombre Completo *</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ej. Juan Pérez"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.nombre}
                  onChange={e => setNewCliente({ ...newCliente, nombre: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Teléfono</label>
                <input 
                  type="text" 
                  placeholder="Ej. 5512345678"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.telefono}
                  onChange={e => setNewCliente({ ...newCliente, telefono: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Correo Electrónico</label>
                <input 
                  type="email" 
                  placeholder="Ej. juan@correo.com"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.email}
                  onChange={e => setNewCliente({ ...newCliente, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Dirección</label>
                <input 
                  type="text" 
                  placeholder="Calle, No, Colonia, Municipio"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.direccion}
                  onChange={e => setNewCliente({ ...newCliente, direccion: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Límite de Crédito ($) *</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  placeholder="Ej. 5000"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.limiteCredito}
                  onChange={e => setNewCliente({ ...newCliente, limiteCredito: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Saldo Deudor Inicial ($)</label>
                <input 
                  type="number" 
                  min="0"
                  disabled={!!newCliente.id}
                  placeholder="Ej. 0"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200 opacity-60' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.saldoDeudor}
                  onChange={e => setNewCliente({ ...newCliente, saldoDeudor: e.target.value })}
                />
              </div>

              {/* Sección Facturación */}
              <div className="col-span-2 pt-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-2">Datos Fiscales (Facturación)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">RFC</label>
                <input 
                  type="text" 
                  placeholder="RFC de 12 o 13 caracteres"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.rfc}
                  onChange={e => setNewCliente({ ...newCliente, rfc: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Código Postal Fiscal</label>
                <input 
                  type="text" 
                  placeholder="CP de 5 dígitos"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.codigoPostal}
                  onChange={e => setNewCliente({ ...newCliente, codigoPostal: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Razón Social</label>
                <input 
                  type="text" 
                  placeholder="Denominación fiscal"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.razonSocial}
                  onChange={e => setNewCliente({ ...newCliente, razonSocial: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Régimen Fiscal (Código)</label>
                <input 
                  type="text" 
                  placeholder="Ej. 601, 605, 626"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.regimenFiscal}
                  onChange={e => setNewCliente({ ...newCliente, regimenFiscal: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Dirección Fiscal Completa</label>
                <input 
                  type="text" 
                  placeholder="Dirección registrada ante el SAT"
                  className={`w-full rounded-xl p-2.5 border text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={newCliente.direccionFiscal}
                  onChange={e => setNewCliente({ ...newCliente, direccionFiscal: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)}
                className={`py-3 px-6 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
                  isDark ? 'bg-transparent border-[#20222b] text-slate-400 hover:bg-[#1a1c24]' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-[#0c0d12] py-3 px-6 rounded-xl border-0 font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Registrar Abono */}
      {showAbonoModal && selectedCliente && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleAbonoSubmit}
            className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl relative ${
              isDark ? 'bg-[#12141c] border-[#20222b] text-slate-100' : 'bg-white border-slate-250 text-slate-800'
            }`}
          >
            <button 
              type="button"
              onClick={() => setShowAbonoModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-transparent border-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" /> Registrar Abono a Cuenta
            </h3>

            <p className="text-xs text-slate-400 leading-normal mb-6">
              El abono disminuirá el saldo deudor actual de <strong className="text-slate-200">{selectedCliente.nombre}</strong>.
              <br />
              Saldo actual pendiente: <strong className="text-rose-400">${Number(selectedCliente.saldoDeudor).toFixed(2)}</strong>.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Monto del Abono ($) *</label>
                <input 
                  type="number" 
                  required
                  min="0.01"
                  step="0.01"
                  max={Number(selectedCliente.saldoDeudor)}
                  placeholder="Ej. 100"
                  className={`w-full rounded-xl p-3 border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={abonoMonto}
                  onChange={e => setAbonoMonto(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Concepto / Comentario</label>
                <input 
                  type="text" 
                  placeholder="Ej. Abono en efectivo, transferencia..."
                  className={`w-full rounded-xl p-3 border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    isDark ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={abonoConcepto}
                  onChange={e => setAbonoConcepto(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowAbonoModal(false)}
                className={`py-3 px-6 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
                  isDark ? 'bg-transparent border-[#20222b] text-slate-400 hover:bg-[#1a1c24]' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-3 px-6 rounded-xl border-0 font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                Aplicar Abono
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}

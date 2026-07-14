import { useState, useEffect } from 'react';
import { 
  Search, X, Printer, ArrowRight, Clock, User, 
  Calendar, ArrowLeft, Eye, Trash2, MessageCircle
} from 'lucide-react';
import { API_V1 } from './config';

interface QuotesDashboardProps {
  theme: 'dark' | 'light';
  onClose: () => void;
  onConvertToSale: (quote: any) => void;
}

export default function QuotesDashboard({ theme, onClose, onConvertToSale }: QuotesDashboardProps) {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);

  // Estados para envío de WhatsApp
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappClientName, setWhatsappClientName] = useState('');
  const [whatsappQuote, setWhatsappQuote] = useState<any | null>(null);

  // Cargar cotizaciones activas e inactivas
  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_V1}/cotizaciones`);
      if (response.ok) {
        const data = await response.json();
        setQuotes(data);
      }
    } catch (e) {
      console.error('Error al cargar cotizaciones:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  // Filtrar cotizaciones por folio o cliente
  const filteredQuotes = quotes.filter(q => 
    q.folio.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.clienteNombre && q.clienteNombre.toLowerCase().includes(searchQuery.toLowerCase())) ||
    q.codigoCorto.includes(searchQuery)
  );

  // Manejador de impresión nativa de la cotización
  const handlePrintQuote = async (quote: any) => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.printTicket({
          ticketId: quote.folio,
          cajero: quote.usuario?.nombre || 'Cajero',
          items: quote.detalles.map((d: any) => ({
            sku: d.producto?.sku || 'GENERIC',
            nombre: d.producto?.nombre || 'Artículo sin nombre',
            precio: Number(d.precioUnitario),
            cantidad: Number(d.cantidad),
            unidad: d.producto?.unidad || 'pieza'
          })),
          total: Number(quote.total),
          printerTarget: 'cliente',
          // Se pasa 'cotizacion' para que el proceso nativo renderice cabecera de cotización no-fiscal
          printerType: 'cotizacion'
        });
        alert('Imprimiendo copia de cotización...');
      } catch (err) {
        console.error('Error al imprimir cotización:', err);
        alert('No se pudo imprimir. Verifique la configuración de impresora.');
      }
    } else {
      window.print();
    }
  };

  const handleDeleteQuote = async (quote: any) => {
    const confirm = window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la cotización ${quote.folio}? Esta acción liberará el stock reservado.`);
    if (!confirm) return;

    try {
      const response = await fetch(`${API_V1}/cotizaciones/${quote.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('Cotización eliminada y stock liberado correctamente.');
        fetchQuotes(); // Recargar lista
      } else {
        const data = await response.json();
        alert(data.error || 'No se pudo eliminar la cotización.');
      }
    } catch (err) {
      alert('Error de red al intentar eliminar la cotización.');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETADA':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'EXPIRADA':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETADA':
        return 'Cobrada';
      case 'EXPIRADA':
        return 'Vencida';
      default:
        return 'Pendiente';
    }
  };

  const handleOpenWhatsAppModal = (quote: any) => {
    setWhatsappQuote(quote);
    setWhatsappClientName(quote.clienteNombre || 'Público General');
    setWhatsappPhone(quote.cliente?.telefono || '');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = () => {
    if (!whatsappQuote) return;
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
    
    const articulosTexto = whatsappQuote.detalles
      ?.map((d: any) => `• ${d.cantidad}x ${d.producto?.nombre || 'Artículo'} ($${Number(d.precioUnitario).toFixed(2)})`)
      .join('\n') || '';

    const text = `📋 *Cotización Vante POS*
*Folio:* ${whatsappQuote.folio}
*Código de Cobro:* *${whatsappQuote.codigoCorto}*
*Cliente:* ${whatsappClientName}
*Fecha:* ${new Date(whatsappQuote.creadoAt).toLocaleDateString('es-MX')}
----------------------------------
${articulosTexto}
----------------------------------
*Total a pagar: $${Number(whatsappQuote.total).toFixed(2)}*

Presenta el código *${whatsappQuote.codigoCorto}* en la caja principal para pagar y completar tu compra.`;

    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`, '_blank');
    setShowWhatsAppModal(false);
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${theme === 'dark' ? 'bg-[#0d0e12] text-slate-350' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'bg-[#13151b] border-[#20222b]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-slate-400 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
              📋 Gestión de Cotizaciones
            </h1>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Historial centralizado y conversión rápida a venta en mostrador
            </p>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="w-96 relative">
          <Search className={`absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
          <input 
            type="text"
            placeholder="Buscar por Folio, Código o Cliente..."
            className={`w-full py-2 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all ${
              theme === 'dark' 
                ? 'bg-[#0d0e12] border-[#20222b] text-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
            }`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      {/* Main Table Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-t-amber-500 border-r-transparent border-[#20222b] animate-spin"></div>
            <span className="text-xs text-slate-500 font-medium">Cargando cotizaciones...</span>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <span className="text-5xl">📋</span>
            <div className="text-center">
              <h3 className="font-bold text-base">No se encontraron cotizaciones</h3>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Intenta buscar con otros términos o genera una nueva cotización móvil.
              </p>
            </div>
          </div>
        ) : (
          <div className={`border rounded-2xl overflow-hidden ${theme === 'dark' ? 'border-[#20222b] bg-[#13151b]' : 'border-slate-200 bg-white shadow-sm'}`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'border-[#20222b] text-slate-400 bg-[#0d0e12]/40' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                  <th className="p-4">Folio / Código</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20222b]/45 text-sm">
                {filteredQuotes.map(quote => (
                  <tr 
                    key={quote.id} 
                    className={`transition-colors ${theme === 'dark' ? 'hover:bg-[#1a1c24]/30' : 'hover:bg-slate-50'}`}
                  >
                    <td className="p-4 font-mono">
                      <span className="font-bold text-slate-200">{quote.folio}</span>
                      <span className={`block text-xs font-bold mt-1 px-1.5 py-0.5 rounded w-max ${theme === 'dark' ? 'bg-[#1a1c24] text-amber-500' : 'bg-amber-100 text-amber-800'}`}>
                        Código: {quote.codigoCorto}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium">
                      {new Date(quote.creadoAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 font-semibold">
                      {quote.clienteNombre || 'Público General'}
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-400">
                      👤 {quote.usuario?.nombre || 'Mostrador'}
                    </td>
                    <td className="p-4 font-black text-amber-500 text-base">
                      ${Number(quote.total).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(quote.estado)}`}>
                        {getStatusText(quote.estado)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedQuote(quote)}
                          className={`p-2 rounded-lg border flex items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-slate-350 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                          title="Ver Detalles"
                        >
                          <Eye className="w-4 h-4" /> Detalle
                        </button>
                        <button 
                          onClick={() => handlePrintQuote(quote)}
                          className={`p-2 rounded-lg border flex items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-slate-350 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                          }`}
                          title="Imprimir Copia"
                        >
                          <Printer className="w-4 h-4" /> Imprimir
                        </button>
                        <button 
                          onClick={() => handleOpenWhatsAppModal(quote)}
                          className={`p-2 rounded-lg border flex items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                            theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-emerald-450 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200'
                          }`}
                          title="Enviar por WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </button>
                        {quote.estado === 'ACTIVA' && (
                          <>
                            <button 
                              onClick={() => onConvertToSale(quote)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-2 rounded-lg flex items-center gap-1 text-xs transition-all border-0 cursor-pointer shadow active:scale-95"
                              title="Importar al carrito de caja"
                            >
                              <ArrowRight className="w-4 h-4" /> Cobrar
                            </button>
                            <button 
                              onClick={() => handleDeleteQuote(quote)}
                              className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 font-bold p-2 rounded-lg flex items-center gap-1 text-xs transition-all border border-rose-500/20 cursor-pointer shadow active:scale-95"
                              title="Eliminar cotización y liberar stock"
                            >
                              <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal de Detalle */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b] text-slate-200' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-[#20222b] bg-[#0d0e12]/40' : 'border-slate-100 bg-slate-50'}`}>
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  📄 Detalles de Cotización
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedQuote.folio}</p>
              </div>
              <button 
                onClick={() => setSelectedQuote(null)}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer bg-transparent ${
                  theme === 'dark' ? 'border-[#20222b] text-slate-400 hover:text-white hover:bg-[#1a1c24]' : 'border-slate-200 text-slate-500 hover:text-black hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Meta información */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#0d0e12]/30 border-[#20222b]' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Cliente / Referencia</p>
                  <p className="text-sm font-semibold mt-1 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" /> {selectedQuote.clienteNombre || 'Público General'}
                  </p>
                </div>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#0d0e12]/30 border-[#20222b]' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Fecha de Creación</p>
                  <p className="text-sm font-semibold mt-1 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-500" /> {new Date(selectedQuote.creadoAt).toLocaleString('es-MX')}
                  </p>
                </div>
              </div>

              {/* Tabla de Artículos */}
              <div className={`border rounded-xl overflow-hidden ${theme === 'dark' ? 'border-[#20222b]' : 'border-slate-200'}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-xs font-bold uppercase ${theme === 'dark' ? 'border-[#20222b] bg-[#0d0e12]/30 text-slate-400' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                      <th className="p-3">Artículo</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Unitario</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#20222b]/40 text-xs">
                    {selectedQuote.detalles?.map((detail: any) => (
                      <tr key={detail.id} className={theme === 'dark' ? 'hover:bg-[#1a1c24]/20' : 'hover:bg-slate-50'}>
                        <td className="p-3">
                          <p className="font-bold text-slate-200">{detail.producto?.nombre}</p>
                          <span className="text-[10px] text-slate-500 font-mono">SKU: {detail.producto?.sku}</span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-300">
                          {detail.cantidad} {detail.producto?.unidad || 'pieza'}
                        </td>
                        <td className="p-3 text-right font-mono text-slate-400">
                          ${Number(detail.precioUnitario).toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-200">
                          ${Number(detail.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cajas de resumen final */}
              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(selectedQuote.estado)}`}>
                    {getStatusText(selectedQuote.estado)}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Expira: {new Date(selectedQuote.expiraAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 font-bold uppercase">Gran Total</p>
                  <p className="text-3xl font-black text-amber-500">${Number(selectedQuote.total).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${theme === 'dark' ? 'border-[#20222b] bg-[#0d0e12]/20' : 'border-slate-100 bg-slate-50'}`}>
              <button 
                onClick={() => handlePrintQuote(selectedQuote)}
                className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold cursor-pointer transition-all ${
                  theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-slate-350 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Printer className="w-4.5 h-4.5" /> Imprimir Cotización
              </button>
              <button 
                onClick={() => handleOpenWhatsAppModal(selectedQuote)}
                className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 text-sm font-bold cursor-pointer transition-all ${
                  theme === 'dark' ? 'bg-[#1a1c24] border-[#20222b] text-emerald-450 hover:bg-[#252837]' : 'bg-slate-100 border-slate-200 text-emerald-600 hover:bg-slate-200'
                }`}
              >
                <MessageCircle className="w-4.5 h-4.5" /> Enviar WhatsApp
              </button>
              {selectedQuote.estado === 'ACTIVA' && (
                <>
                  <button 
                    onClick={() => {
                      setSelectedQuote(null);
                      handleDeleteQuote(selectedQuote);
                    }}
                    className="bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all border border-rose-500/25 cursor-pointer shadow active:scale-95"
                  >
                    <Trash2 className="w-4.5 h-4.5" /> Eliminar Cotización
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedQuote(null);
                      onConvertToSale(selectedQuote);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all border-0 cursor-pointer shadow active:scale-95"
                  >
                    <ArrowRight className="w-4.5 h-4.5" /> Convertir a Venta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enviar Cotización por WhatsApp */}
      {showWhatsAppModal && whatsappQuote && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md p-8 rounded-3xl border shadow-2xl relative ${
            theme === 'dark' ? 'bg-[#13151b] border-[#20222b] text-slate-200' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button 
              type="button"
              onClick={() => setShowWhatsAppModal(false)}
              className={`absolute top-5 right-5 p-1.5 rounded-lg transition-all cursor-pointer bg-transparent border-0 ${
                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-[#1a1c24]' : 'text-slate-500 hover:text-black hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-md font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="text-emerald-500 text-lg">💬</span> Enviar Cotización por WhatsApp
            </h3>

            <p className={`text-xs mb-6 leading-relaxed ${theme === 'dark' ? 'text-slate-450' : 'text-slate-500'}`}>
              Confirma los datos de contacto del cliente para enviar los detalles de la cotización **{whatsappQuote.folio}** vía WhatsApp.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Nombre de Cliente</label>
                <input 
                  type="text" 
                  placeholder="Nombre o Referencia"
                  className={`w-full rounded-xl p-3 border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={whatsappClientName}
                  onChange={e => setWhatsappClientName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">Número de Celular (10 dígitos)</label>
                <input 
                  type="text" 
                  placeholder="Ej. 5512345678"
                  className={`w-full rounded-xl p-3 border text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                    theme === 'dark' ? 'bg-[#0d0e12] border-[#20222b] text-slate-200' : 'bg-slate-50 border-slate-200'
                  }`}
                  value={whatsappPhone}
                  onChange={e => setWhatsappPhone(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowWhatsAppModal(false)}
                className={`py-3 px-6 rounded-xl border font-bold text-xs cursor-pointer active:scale-95 transition-all ${
                  theme === 'dark' ? 'bg-transparent border-[#20222b] text-slate-400 hover:bg-[#1a1c24]' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!whatsappPhone || whatsappPhone.length < 10}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1a1c24] disabled:text-slate-500 text-white py-3 px-6 rounded-xl border-0 font-bold text-xs cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

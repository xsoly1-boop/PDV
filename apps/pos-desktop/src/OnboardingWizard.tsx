import { useState } from 'react';
import { API_V1 } from './config';

interface OnboardingWizardProps {
  onComplete: (config: any) => void;
}

const GIROS = [
  {
    id: 'farmacia',
    nombre: 'Farmacia',
    icon: '💊',
    descripcion: 'Medicamentos, suplementos y productos de salud',
    color: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/40',
    accent: '#10b981',
    bgHover: 'hover:border-emerald-400',
  },
  {
    id: 'ferreteria',
    nombre: 'Ferretería',
    icon: '🔧',
    descripcion: 'Herramientas, materiales de construcción y fijaciones',
    color: 'from-amber-500/20 to-orange-500/10',
    border: 'border-amber-500/40',
    accent: '#f59e0b',
    bgHover: 'hover:border-amber-400',
  },
  {
    id: 'refaccionaria',
    nombre: 'Refaccionaria',
    icon: '🚗',
    descripcion: 'Autopartes, refacciones y accesorios automotrices',
    color: 'from-blue-500/20 to-sky-500/10',
    border: 'border-blue-500/40',
    accent: '#3b82f6',
    bgHover: 'hover:border-blue-400',
  },
  {
    id: 'tienda',
    nombre: 'Tienda',
    icon: '🏪',
    descripcion: 'Abarrotes, papelería, ropa o producto general',
    color: 'from-violet-500/20 to-purple-500/10',
    border: 'border-violet-500/40',
    accent: '#8b5cf6',
    bgHover: 'hover:border-violet-400',
  },
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedGiro, setSelectedGiro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    rfc: '',
    telefono: '',
    direccion: '',
    ciudad: '',
  });

  const giroInfo = GIROS.find(g => g.id === selectedGiro);

  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch(`${API_V1}/configuracion-empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          rfc: form.rfc,
          telefono: form.telefono,
          direccion: form.direccion,
          ciudad: form.ciudad,
          giro: selectedGiro,
        }),
      });
      if (resp.ok) {
        setStep(3);
      } else {
        alert('Error al guardar la configuración. Intenta nuevamente.');
      }
    } catch {
      // Si falla el API, igual avanzamos localmente
      setStep(3);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#080910] flex items-center justify-center font-sans z-50 overflow-auto py-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl mx-4">

        {/* ─── STEP 1: Seleccionar giro ─── */}
        {step === 1 && (
          <div className="animate-[fadeIn_0.4s_ease]">
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
                ✦ Configuración inicial
              </div>
              <h1 className="text-3xl font-black text-white mb-3">
                ¿Cuál es el giro de tu negocio?
              </h1>
              <p className="text-slate-400 text-sm">
                Elige el tipo de negocio para optimizar el sistema a tu operación
              </p>
            </div>

            {/* Giro cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              {GIROS.map(giro => (
                <button
                  key={giro.id}
                  onClick={() => setSelectedGiro(giro.id)}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 cursor-pointer group ${
                    selectedGiro === giro.id
                      ? `bg-gradient-to-br ${giro.color} ${giro.border} scale-[1.02] shadow-xl`
                      : `bg-[#0f1117] border-[#1e2030] ${giro.bgHover} hover:bg-[#13151f]`
                  }`}
                >
                  {selectedGiro === giro.id && (
                    <span
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ backgroundColor: giro.accent }}
                    >✓</span>
                  )}
                  <div className="text-4xl mb-3">{giro.icon}</div>
                  <h3 className="text-white font-bold text-lg mb-1">{giro.nombre}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{giro.descripcion}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => selectedGiro && setStep(2)}
              disabled={!selectedGiro}
              className="w-full py-4 rounded-2xl font-black text-base text-[#080910] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: selectedGiro
                  ? `linear-gradient(135deg, ${giroInfo?.accent}, ${giroInfo?.accent}cc)`
                  : '#334155',
                boxShadow: selectedGiro ? `0 8px 32px ${giroInfo?.accent}40` : 'none',
              }}
            >
              Continuar con {giroInfo?.nombre || '...'} →
            </button>
          </div>
        )}

        {/* ─── STEP 2: Datos del negocio ─── */}
        {step === 2 && (
          <div className="animate-[fadeIn_0.4s_ease]">
            {/* Header */}
            <div className="text-center mb-8">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs mb-4 transition-colors bg-transparent border-0 cursor-pointer"
              >
                ← Cambiar giro
              </button>
              <div
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4"
                style={{
                  background: `${giroInfo?.accent}15`,
                  border: `1px solid ${giroInfo?.accent}30`,
                  color: giroInfo?.accent,
                }}
              >
                {giroInfo?.icon} {giroInfo?.nombre} seleccionada
              </div>
              <h1 className="text-3xl font-black text-white mb-2">Datos de tu negocio</h1>
              <p className="text-slate-400 text-sm">Esta información aparecerá en tus tickets y facturas</p>
            </div>

            <div className="bg-[#0d0f18] border border-[#1e2030] rounded-2xl p-6 space-y-4 mb-6">
              {/* Nombre del negocio */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Nombre del negocio *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ferretería La Paloma"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-[#13151f] border border-[#252836] text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/60 transition-colors"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* RFC */}
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    RFC <span className="text-slate-600 normal-case">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="XAXX010101000"
                    value={form.rfc}
                    onChange={e => setForm(f => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    className="w-full bg-[#13151f] border border-[#252836] text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/60 transition-colors font-mono"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Teléfono <span className="text-slate-600 normal-case">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="614 123 4567"
                    value={form.telefono}
                    onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                    className="w-full bg-[#13151f] border border-[#252836] text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/60 transition-colors"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* Dirección */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Dirección <span className="text-slate-600 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Av. Juárez 450, Col. Centro"
                  value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full bg-[#13151f] border border-[#252836] text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/60 transition-colors"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

              {/* Ciudad */}
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Ciudad <span className="text-slate-600 normal-case">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Chihuahua, Chih."
                  value={form.ciudad}
                  onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                  className="w-full bg-[#13151f] border border-[#252836] text-white placeholder-slate-600 rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500/60 transition-colors"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!form.nombre.trim() || saving}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: form.nombre.trim()
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : '#334155',
                boxShadow: form.nombre.trim() ? '0 8px 32px rgba(245,158,11,0.3)' : 'none',
              }}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar y abrir el POS →'
              )}
            </button>
          </div>
        )}

        {/* ─── STEP 3: ¡Listo! ─── */}
        {step === 3 && (
          <div className="animate-[fadeIn_0.4s_ease] text-center">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${giroInfo?.accent}30, ${giroInfo?.accent}10)`, border: `2px solid ${giroInfo?.accent}40` }}
            >
              {giroInfo?.icon}
            </div>

            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5">
              ✓ Configuración completada
            </div>

            <h1 className="text-4xl font-black text-white mb-3">
              ¡Todo listo!
            </h1>
            <p className="text-slate-400 text-base mb-2">
              <span className="text-white font-bold">{form.nombre}</span> está configurada como{' '}
              <span style={{ color: giroInfo?.accent }} className="font-bold">{giroInfo?.nombre}</span>
            </p>
            <p className="text-slate-500 text-sm mb-10">
              Tu sistema está limpio y listo para operar desde cero.
            </p>

            <div className="bg-[#0d0f18] border border-[#1e2030] rounded-2xl p-5 mb-8 text-left space-y-2.5">
              {[
                { label: 'Negocio', value: form.nombre },
                { label: 'Giro', value: giroInfo?.nombre },
                { label: 'RFC', value: form.rfc || '—' },
                { label: 'Teléfono', value: form.telefono || '—' },
                { label: 'Dirección', value: form.direccion || '—' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="text-slate-200 font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => onComplete({ ...form, giro: selectedGiro })}
              className="w-full py-4 rounded-2xl font-black text-base text-[#080910] transition-all duration-200"
              style={{
                background: `linear-gradient(135deg, ${giroInfo?.accent}, ${giroInfo?.accent}cc)`,
                boxShadow: `0 8px 32px ${giroInfo?.accent}40`,
              }}
            >
              Abrir {giroInfo?.nombre} →
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: step === s ? '24px' : '6px',
                background: step >= s ? (giroInfo?.accent || '#f59e0b') : '#1e2030',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

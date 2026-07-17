import { useEffect, useRef, useState } from 'react';

const MODEL_SIZES: Record<string, string> = {
  'gemma2:2b': '1.6 GB',
  'llama3:8b': '4.7 GB',
};

const MODEL_LABELS: Record<string, string> = {
  'gemma2:2b': 'Gemma 2 2B — Económico (2 GB RAM mínimo)',
  'llama3:8b': 'Llama 3 8B — Completo (8 GB RAM)',
};

interface AISetupWizardProps {
  modelo: string;
  onCompleted: () => void;
  onCancel: () => void;
}

type WizardStep = 'confirm' | 'downloading' | 'done' | 'error';

export default function AISetupWizard({ modelo, onCompleted, onCancel }: AISetupWizardProps) {
  const [step, setStep]         = useState<WizardStep>('confirm');
  const [progreso, setProgreso]  = useState(0);
  const [mensaje, setMensaje]    = useState('');
  const [errorMsg, setErrorMsg]  = useState('');
  const eventSourceRef           = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  const startDownload = () => {
    setStep('downloading');
    setProgreso(0);
    setMensaje('Conectando con el motor de IA...');

    const es = new EventSource(`http://localhost:3001/api/v1/ai/descargar-modelo?modelo=${encodeURIComponent(modelo)}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setMensaje(data.mensaje || '');
        setProgreso(data.progreso || 0);

        if (data.status === 'listo' || data.status === 'completado') {
          es.close();
          setProgreso(100);
          setStep('done');
          setTimeout(onCompleted, 1800);
        } else if (data.status === 'error') {
          es.close();
          setErrorMsg(data.mensaje || 'Error desconocido.');
          setStep('error');
        }
      } catch (_) {}
    };

    es.onerror = () => {
      es.close();
      setErrorMsg('Se perdió la conexión con el motor de IA local. Asegúrate de que Vante AI Engine esté iniciando.');
      setStep('error');
    };
  };

  const modelLabel = MODEL_LABELS[modelo] || modelo;
  const modelSize  = MODEL_SIZES[modelo]  || '~2 GB';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-violet-500/20 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(15,10,35,0.97) 0%, rgba(20,14,45,0.97) 100%)',
          boxShadow: '0 0 80px rgba(139,92,246,0.25), 0 25px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Glow top bar */}
        <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #8b5cf6, #a78bfa, transparent)' }} />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">Vante AI Copilot</h2>
              <p className="text-violet-400 text-xs font-medium">Motor de IA local y privado</p>
            </div>
          </div>

          {/* STEP: CONFIRM */}
          {step === 'confirm' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Modelo seleccionado</span>
                  <span className="text-xs font-bold text-violet-300 bg-violet-900/40 px-2 py-0.5 rounded border border-violet-500/30">
                    {modelSize}
                  </span>
                </div>
                <p className="text-white font-bold text-base">{modelLabel}</p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Vante descargará este modelo directamente dentro de la aplicación. El proceso puede tardar varios
                  minutos según tu conexión. Una vez descargado,{' '}
                  <span className="text-violet-300 font-medium">funciona 100% sin internet</span>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-start gap-2">
                <span className="text-amber-400 text-sm mt-0.5">💡</span>
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  La descarga se realiza <strong>una sola vez</strong>. Si cambias de modelo en el futuro,
                  Vante lo descargará automáticamente.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:bg-slate-800/50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={startDownload}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  Descargar ahora
                </button>
              </div>
            </div>
          )}

          {/* STEP: DOWNLOADING */}
          {step === 'downloading' && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <p className="text-white font-bold text-base">Descargando modelo de IA...</p>
                <p className="text-slate-400 text-xs">No cierres la aplicación durante este proceso</p>
              </div>

              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(79,70,229,0.2))', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <span className="text-3xl">🧠</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400 truncate max-w-[70%]">{mensaje || 'Descargando...'}</span>
                  <span className="text-violet-300">{progreso}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progreso}%`,
                      background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                      boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 text-center">{modelLabel} · {modelSize}</p>
              </div>

              <p className="text-center text-xs text-slate-500">
                Tus datos permanecen <span className="text-emerald-400">100% privados</span> — sin servidores externos
              </p>
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <span className="text-3xl">✅</span>
                </div>
              </div>
              <div>
                <p className="text-white font-bold text-lg">¡Vante AI está lista!</p>
                <p className="text-slate-400 text-sm mt-1">
                  El modelo <span className="text-violet-300 font-semibold">{modelo}</span> se instaló correctamente.
                </p>
              </div>
              <p className="text-xs text-emerald-400/80">
                Ya puedes hacer preguntas sobre tu negocio directamente desde la caja 🚀
              </p>
            </div>
          )}

          {/* STEP: ERROR */}
          {step === 'error' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/20 space-y-2">
                <p className="text-red-300 font-bold text-sm flex items-center gap-2">
                  <span>⚠️</span> Error al descargar el modelo
                </p>
                <p className="text-red-300/70 text-xs leading-relaxed">{errorMsg}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-700/40 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Posibles causas:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>El motor de IA está iniciando — espera 10 segundos e intenta de nuevo.</li>
                  <li>Sin conexión a internet en este momento.</li>
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:bg-slate-800/50 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => { setStep('confirm'); setProgreso(0); setMensaje(''); }}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

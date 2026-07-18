import { useState, useEffect, useRef } from 'react';
import { Send, Brain, AlertCircle, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';
import { API_AI_V1 } from '../config';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface AIAssistantProps {
  theme?: 'dark' | 'light';
}

export default function AIAssistant({ theme = 'dark' }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '¡Hola! Soy **Vante AI**, tu copiloto de negocios local y privado. Además de analizar ventas y stock, tengo cargado el **Manual de Operación y Soporte** de Vante POS.\n\nPuedes preguntarme dudas sobre:\n* *¿Cómo conecto Vante Móvil?*\n* *¿Qué significa la alerta de turno abierto?*\n* *¿Cuáles son los límites del modo Demo?*\n\n¿De qué te gustaría hablar hoy?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ activo: boolean; error?: string; modelos: any[] }>({
    activo: false,
    modelos: []
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const checkOllama = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`${API_AI_V1}/ai/estado-ollama`);
      if (res.ok) {
        const data = await res.json();
        setOllamaStatus(data);
      } else {
        setOllamaStatus({ activo: false, error: 'Ollama local no respondió.', modelos: [] });
      }
    } catch (e: any) {
      setOllamaStatus({ activo: false, error: 'Error de red con el backend local.', modelos: [] });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkOllama();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || inputText).trim();
    if (!queryText || isLoading) return;

    if (!textToSend) setInputText('');

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: queryText, timestamp }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_AI_V1}/ai/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: queryText })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al conectar con Vante AI.');
      }

      const data = await response.json();
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: data.respuesta || 'Lo siento, no pude generar una respuesta en este momento.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (error: any) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ **Error local**: ${error.message || 'No se pudo comunicar con el motor de IA.'}\n\n*Por favor, verifica que el servicio de Ollama local esté en ejecución en tu PC Server.*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    'Resumen de ventas de hoy',
    '¿Qué productos tienen bajo inventario?',
    'Dame sugerencias para mejorar ventas',
    '¿Cuál es el valor acumulado en ventas?'
  ];

  // Helper simple para renderizar formateo básico de markdown
  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Reemplazo simple de negritas **text**
      let formatted = line;
      const boldRegex = /\*\*(.*?)\*\*/g;
      const italicRegex = /\*(.*?)\*/g;
      
      formatted = formatted.replace(boldRegex, '<strong class="font-extrabold text-white">$1</strong>');
      formatted = formatted.replace(italicRegex, '<em class="italic text-slate-300">$1</em>');

      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-200 text-xs py-0.5" dangerouslySetInnerHTML={{ __html: formatted.substring(2) }} />
        );
      }
      return (
        <p key={idx} className="text-slate-200 text-xs leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    });
  };

  return (
    <div className={`flex flex-col h-full rounded-2xl border ${
      theme === 'dark' ? 'bg-[#0d0e12]/80 border-slate-800 text-slate-100' : 'bg-white/90 border-slate-200 text-slate-800'
    } backdrop-blur-md overflow-hidden shadow-2xl`}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/60 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/20">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-wide text-white">Vante AI Copilot</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isCheckingStatus ? (
                <>
                  <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                  <span className="text-[10px] text-slate-400 font-semibold">Verificando Ollama...</span>
                </>
              ) : ollamaStatus.activo ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-400 font-bold">Local Host Conectado (100% Privado)</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-rose-500" />
                  <span className="text-[10px] text-rose-400 font-bold">Ollama Desconectado</span>
                </>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={checkOllama} 
          disabled={isCheckingStatus}
          className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border-0 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* MESSAGES LIST */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 max-h-[calc(100vh-320px)]">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-md ${
              msg.sender === 'user'
                ? 'bg-violet-600 text-white rounded-tr-none'
                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
            }`}>
              <div className="text-xs">
                {msg.sender === 'user' ? (
                  <p className="text-slate-100 leading-relaxed text-xs">{msg.text}</p>
                ) : (
                  renderMessageText(msg.text)
                )}
              </div>
              <span className={`block text-[9px] mt-1.5 font-semibold text-right ${
                msg.sender === 'user' ? 'text-violet-200' : 'text-slate-500'
              }`}>{msg.timestamp}</span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-5 py-4 shadow-md flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wide">Vante AI está analizando SQLite local...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTION CHIPS */}
      {messages.length < 3 && !isLoading && (
        <div className="px-6 py-2 flex flex-wrap gap-2">
          {suggestions.map((text, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(text)}
              className="text-[10px] font-bold bg-violet-950/40 border border-violet-500/25 text-violet-300 hover:bg-violet-900/60 hover:text-white px-3.5 py-1.5 rounded-full cursor-pointer transition-all active:scale-[0.98]"
            >
              ✨ {text}
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM INPUT BOX */}
      <div className="p-4 border-t border-slate-850 bg-slate-950/40">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-1.5"
        >
          <Terminal className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={ollamaStatus.activo ? "Pregúntale a Vante AI..." : "Enciende Ollama local para conversar..."}
            disabled={!ollamaStatus.activo || isLoading}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent border-0 outline-none text-xs text-white placeholder-slate-500 py-2.5"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading || !ollamaStatus.activo}
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 text-white disabled:text-slate-650 cursor-pointer border-0 transition-all active:scale-[0.96]"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

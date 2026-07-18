// Configuración centralizada de la API
// En producción apunta a Render; en desarrollo a localhost


const getApiBaseUrl = () => {
  const saved = localStorage.getItem('pos_api_base_url');
  if (saved) return saved;
  return 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_V1 = `${API_BASE_URL}/api/v1`;

// Para IA local (Ollama), siempre consultamos al backend local localmente
export const API_AI_V1 = 'http://localhost:3001/api/v1';

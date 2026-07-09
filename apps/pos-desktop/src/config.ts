// Configuración centralizada de la API
// En producción apunta a Render; en desarrollo a localhost

const isDev = import.meta.env.DEV;

const getApiBaseUrl = () => {
  const saved = localStorage.getItem('pos_api_base_url');
  if (saved) return saved;
  return isDev ? 'http://localhost:3001' : 'https://pdventa.onrender.com';
};

export const API_BASE_URL = getApiBaseUrl();

export const API_V1 = `${API_BASE_URL}/api/v1`;

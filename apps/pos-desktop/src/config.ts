// Configuración centralizada de la API
// En producción apunta a Render; en desarrollo a localhost

const isDev = import.meta.env.DEV;

export const API_BASE_URL = isDev
  ? 'http://localhost:3001'
  : 'https://pdventa.onrender.com';

export const API_V1 = `${API_BASE_URL}/api/v1`;

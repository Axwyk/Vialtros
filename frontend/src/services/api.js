// Servicio de conexión a la API REST con JWT
import axios from 'axios';

function resolveApiUrl() {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  // Por defecto usa misma origin para funcionar en producción y con proxy en desarrollo.
  return '/api';
}

const api = axios.create({
  baseURL: resolveApiUrl(),
});

// Interceptor para agregar el token JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token && !config.url.includes('/token/')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

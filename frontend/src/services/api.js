// Servicio de conexión a la API REST con JWT
import axios from "axios";
import { isLocalAccessEnabled, isLocalAccessToken } from "./auth";

const LOCAL_DEV_INGEST_TOKEN = "local-dev-access";

function resolveApiUrl() {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // Por defecto usa misma origin para funcionar en producción y con proxy en desarrollo.
  return "/api";
}

const api = axios.create({
  baseURL: resolveApiUrl(),
});

// Interceptor para agregar el token JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");

  if (token && isLocalAccessEnabled() && isLocalAccessToken(token)) {
    if (config.url?.includes("/tracking/ingest/")) {
      config.headers["X-Tracking-Token"] =
        process.env.REACT_APP_TRACKING_INGEST_TOKEN || LOCAL_DEV_INGEST_TOKEN;
    }
    // Agregar Authorization header incluso para local dev tokens
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  if (token && !config.url.includes("/token/")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function requestPasswordReset(email) {
  return api.post('/auth/forgot-password/', { email });
}

export function resetPassword(token, newPassword) {
  return api.post('/auth/reset-password/', { token, new_password: newPassword });
}

export default api;

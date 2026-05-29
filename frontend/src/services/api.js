// Servicio de conexión a la API REST con JWT
import axios from "axios";
import { isLocalAccessEnabled, isLocalAccessToken } from "./auth";

const LOCAL_DEV_INGEST_TOKEN = "local-dev-access";

function resolveApiUrl() {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "/api";
}

const api = axios.create({
  baseURL: resolveApiUrl(),
});

// ---- Request interceptor: adjunta el token a cada llamada ----
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");

  if (token && isLocalAccessEnabled() && isLocalAccessToken(token)) {
    if (config.url?.includes("/tracking/ingest/")) {
      config.headers["X-Tracking-Token"] =
        process.env.REACT_APP_TRACKING_INGEST_TOKEN || LOCAL_DEV_INGEST_TOKEN;
    }
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  if (token && !config.url.includes("/token/")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: refresca el token automáticamente ante 401 ----
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

function redirectToLogin() {
  if (!window.location.pathname.includes("/login")) {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.location.href = "/login";
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Solo actúa en 401 que no sean del propio endpoint de token
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes("/token/")
    ) {
      return Promise.reject(error);
    }

    // Si ya hay un refresh en curso, encola esta petición
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      isRefreshing = false;
      processQueue(error);
      redirectToLogin();
      return Promise.reject(error);
    }

    try {
      // Usa axios directo para evitar que el interceptor se llame a sí mismo
      const { data } = await axios.post(
        `${resolveApiUrl()}/token/refresh/`,
        { refresh: refreshToken },
      );
      localStorage.setItem("access", data.access);
      if (data.refresh) localStorage.setItem("refresh", data.refresh);

      processQueue(null, data.access);
      original.headers.Authorization = `Bearer ${data.access}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError);
      redirectToLogin();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export function requestPasswordReset(email) {
  return api.post('/auth/forgot-password/', { email });
}

export function resetPassword(token, newPassword) {
  return api.post('/auth/reset-password/', { token, new_password: newPassword });
}

export default api;

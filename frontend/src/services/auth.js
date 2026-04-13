// Servicio para obtener el usuario actual y su rol
import api from './api';

const LOCAL_ACCESS_TOKEN = 'local-dev-access';
const LOCAL_REFRESH_TOKEN = 'local-dev-refresh';
const LOCAL_DEFAULT_ROLE = 'admin';
const LOCAL_DEFAULT_USERNAME = 'Invitado';

export function isLocalAccessEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.REACT_APP_ALLOW_LOCAL_ACCESS === 'true';
}

export function ensureLocalAccessSession(overrides = {}) {
  if (!isLocalAccessEnabled()) return false;

  const username = (overrides.username || localStorage.getItem('username') || LOCAL_DEFAULT_USERNAME).trim();
  const role = overrides.role || localStorage.getItem('role') || LOCAL_DEFAULT_ROLE;

  localStorage.setItem('access', LOCAL_ACCESS_TOKEN);
  localStorage.setItem('refresh', LOCAL_REFRESH_TOKEN);
  localStorage.setItem('username', username || LOCAL_DEFAULT_USERNAME);
  localStorage.setItem('role', role);
  return true;
}

export function isLocalAccessToken(token) {
  return token === LOCAL_ACCESS_TOKEN;
}

function buildLocalUser() {
  return {
    username: localStorage.getItem('username') || LOCAL_DEFAULT_USERNAME,
    role: localStorage.getItem('role') || LOCAL_DEFAULT_ROLE,
  };
}

export function clearSession() {
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  localStorage.removeItem('role');
  localStorage.removeItem('username');
}

export async function getCurrentUser() {
  const token = localStorage.getItem('access');

  if (!token) {
    if (ensureLocalAccessSession()) {
      return buildLocalUser();
    }
    return null;
  }

  if (isLocalAccessToken(token) && isLocalAccessEnabled()) {
    return buildLocalUser();
  }

  try {
    const res = await api.get('/users/me/');
    return res.data;
  } catch {
    if (ensureLocalAccessSession()) {
      return buildLocalUser();
    }
    return null;
  }
}

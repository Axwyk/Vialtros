import api from './api';

export async function getDashboardStats() {
  const response = await api.get('/users/dashboard_stats/');
  return response.data;
}

export async function getDriverAssignedRoutes() {
  const response = await api.get('/users/assigned_routes/');
  return response.data;
}

export async function getUserAssignedRoute() {
  const response = await api.get('/users/my_conductor/');
  return response.data;
}

export async function getDriverTrackings() {
  const response = await api.get('/tracking/');
  return response.data;
}

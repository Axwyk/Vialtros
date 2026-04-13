import api from './api';

export async function getTrackingsByRoute(routeId) {
  const data = await api.get('/tracking/').then((r) => r.data);

  if (!Array.isArray(data)) {
    return [];
  }

  const routeIdNum = Number(routeId);
  return data.filter((item) => Number(item.route) === routeIdNum);
}

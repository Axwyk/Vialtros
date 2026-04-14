import api from './api';

export async function getTrackings() {
  const response = await api.get('/tracking/');
  return Array.isArray(response.data) ? response.data : [];
}

export async function getTrackingsByRoute(routeId) {
  const data = await getTrackings();

  if (!Array.isArray(data)) {
    return [];
  }

  const routeIdNum = Number(routeId);
  return data.filter((item) => Number(item.route) === routeIdNum);
}

export async function updateTrackingStatus(trackingId, status) {
  const response = await api.post(`/tracking/${trackingId}/update_status/`, { status });
  return response.data;
}

export async function updateTrackingStatusByPassenger(routeId, passengerId, status) {
  const response = await api.post('/tracking/update_status_by_passenger/', {
    route_id: routeId,
    passenger_id: passengerId,
    status,
  });
  return response.data;
}

import api from './api';

export async function sendDriverLocation(payload) {
  const response = await api.post('/tracking/ingest/', payload);
  return response.data;
}

import api from './api';

export async function getDashboardStats() {
  // Llama a los endpoints reales de la API para obtener los datos
  // Ajusta los endpoints según tu backend
  const [routes, users, trackings] = await Promise.all([
    api.get('/routes/'),
    api.get('/users/'),
    api.get('/tracking/'),
  ]);
  return {
    routes: routes.data.length,
    users: users.data.length,
    trackings: trackings.data.length,
  };
}

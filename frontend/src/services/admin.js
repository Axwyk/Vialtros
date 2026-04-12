import api from './api';

// ── Usuarios ──────────────────────────────────────────────
export const getUsers    = ()       => api.get('/users/').then(r => r.data);
export const getUser     = (id)     => api.get(`/users/${id}/`).then(r => r.data);
export const createUser  = (data)   => api.post('/users/', data).then(r => r.data);
export const updateUser  = (id, d)  => api.patch(`/users/${id}/`, d).then(r => r.data);
export const deleteUser  = (id)     => api.delete(`/users/${id}/`);

// ── Conductores ───────────────────────────────────────────
export const getDrivers   = ()      => api.get('/drivers/').then(r => r.data);
export const getDriver    = (id)    => api.get(`/drivers/${id}/`).then(r => r.data);
export const createDriver = (data)  => api.post('/drivers/', data).then(r => r.data);
export const updateDriver = (id, d) => api.patch(`/drivers/${id}/`, d).then(r => r.data);
export const deleteDriver = (id)    => api.delete(`/drivers/${id}/`);

// ── Rutas ─────────────────────────────────────────────────
export const getRoutes    = ()      => api.get('/routes/').then(r => r.data);
export const getRoute     = (id)    => api.get(`/routes/${id}/`).then(r => r.data);
export const createRoute  = (data)  => api.post('/routes/', data).then(r => r.data);
export const updateRoute  = (id, d) => api.patch(`/routes/${id}/`, d).then(r => r.data);
export const deleteRoute  = (id)    => api.delete(`/routes/${id}/`);

// ── Pasajeros ─────────────────────────────────────────────────
export const getPassengers    = ()      => api.get('/passengers/').then(r => r.data);
export const createPassenger  = (data)  => api.post('/passengers/', data).then(r => r.data);
export const updatePassenger  = (id, d) => api.patch(`/passengers/${id}/`, d).then(r => r.data);
export const deletePassenger  = (id)    => api.delete(`/passengers/${id}/`);

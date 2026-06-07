import api from "./api";

// ── Usuarios ──────────────────────────────────────────────
export const getUsers = (params) =>
  api.get("/users/", { params }).then((r) => r.data);
export const getUser = (id) => api.get(`/users/${id}/`).then((r) => r.data);
export const createUser = (data) =>
  api.post("/users/", data).then((r) => r.data);
export const updateUser = (id, d) =>
  api.patch(`/users/${id}/`, d).then((r) => r.data);
export const deleteUser = (id) => api.delete(`/users/${id}/`);

// ── Conductores ───────────────────────────────────────────
export const getDrivers = (params) =>
  api.get("/drivers/", { params }).then((r) => r.data);
export const getDriver = (id) => api.get(`/drivers/${id}/`).then((r) => r.data);
export const createDriver = (data) =>
  api.post("/drivers/", data).then((r) => r.data);
export const updateDriver = (id, d) =>
  api.patch(`/drivers/${id}/`, d).then((r) => r.data);
export const deleteDriver = (id) => api.delete(`/drivers/${id}/`);

// ── Rutas ─────────────────────────────────────────────────
export const getRoutes = (params) =>
  api.get("/routes/", { params }).then((r) => r.data);
export const getRoute = (id) => api.get(`/routes/${id}/`).then((r) => r.data);
export const getRouteMonitoringSummary = () =>
  api.get("/routes/monitoring-summary/").then((r) => r.data);
export const createRoute = (data) =>
  api.post("/routes/", data).then((r) => r.data);
export const updateRoute = (id, d) =>
  api.patch(`/routes/${id}/`, d).then((r) => r.data);
export const deleteRoute = (id) => api.delete(`/routes/${id}/`);
export const assignPassengerToRoute = (routeId, passengerId) =>
  api
    .post(`/routes/${routeId}/assign_passenger/`, { passenger_id: passengerId })
    .then((r) => r.data);
export const removePassengerFromRoute = (routeId, passengerId) =>
  api
    .post(`/routes/${routeId}/remove_passenger/`, { passenger_id: passengerId })
    .then((r) => r.data);
export const completeRoute = (routeId) =>
  api.post(`/routes/${routeId}/complete/`).then((r) => r.data);

// ── Pasajeros ─────────────────────────────────────────────────
export const getPassengers = (params) =>
  api.get("/passengers/", { params }).then((r) => r.data);
export const createPassenger = (data) =>
  api.post("/passengers/", data).then((r) => r.data);
export const updatePassenger = (id, d) =>
  api.patch(`/passengers/${id}/`, d).then((r) => r.data);
export const deletePassenger = (id) => api.delete(`/passengers/${id}/`);

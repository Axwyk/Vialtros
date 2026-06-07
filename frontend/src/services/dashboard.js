import api from "./api";

export async function getDashboardStats() {
  const response = await api.get("/users/dashboard_stats/");
  return response.data;
}

export async function getWeeklyActivity() {
  const response = await api.get("/users/weekly-activity/");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getRecentActivity() {
  const response = await api.get("/users/recent-activity/");
  return Array.isArray(response.data) ? response.data : [];
}

export async function getDriverAssignedRoutes() {
  const response = await api.get("/users/assigned_routes/");
  return response.data;
}

export async function getUserAssignedRoute() {
  const response = await api.get("/users/my_conductor/");
  return response.data;
}

export async function getDriverTrackings(routeId) {
  const url = routeId ? `/tracking/?route=${routeId}` : "/tracking/";
  const response = await api.get(url);
  return Array.isArray(response.data) ? response.data : [];
}

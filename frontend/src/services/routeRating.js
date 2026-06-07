import api from "./api";

/**
 * Envía la calificación del conductor al finalizar una ruta.
 * Si ya existe una calificación para esa ruta, la actualiza (upsert en el backend).
 *
 * @param {number} routeId   - ID de la ruta
 * @param {number} stars     - Estrellas (1-5)
 * @param {string} comment   - Comentario opcional
 * @returns {Promise<Object>} - Datos de la calificación guardada
 */
export async function submitRouteRating(routeId, stars, comment = "") {
  const response = await api.post("/route-ratings/", {
    route: routeId,
    stars,
    comment,
  });
  return response.data;
}

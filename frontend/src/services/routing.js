// Servicio de enrutamiento real por calles usando OSRM (sin API key)
// y geocodificación con Nominatim (OpenStreetMap).
//
// NOTA: el servidor público de OSRM está pensado para desarrollo.
// En producción se recomienda instancia propia u OSRM Cloud.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Convierte una dirección de texto a coordenadas [lat, lng].
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address) {
  if (!address?.trim()) return null;

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', address.trim());
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('accept-language', 'es');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Vialtros/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}

/**
 * Obtiene la ruta real por calles entre dos puntos usando la API de OSRM.
 * @param {[number, number]} from  - [lat, lng] del origen
 * @param {[number, number]} to    - [lat, lng] del destino
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number } | null>}
 */
export async function getStreetRoute(from, to) {
  if (!from || !to) return null;

  // OSRM espera las coordenadas como lng,lat
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;

  try {
    const res = await fetch(
      `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;

    const route = data.routes[0];
    return {
      // GeoJSON devuelve [lng, lat], lo invertimos a [lat, lng]
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      duration: route.duration,  // segundos
      distance: route.distance,  // metros
    };
  } catch {
    return null;
  }
}

/**
 * Calcula el ETA en minutos desde una posición hasta el destino.
 * @param {[number, number]} from
 * @param {[number, number]} to
 * @returns {Promise<number | null>}
 */
export async function getETAMinutes(from, to) {
  const result = await getStreetRoute(from, to);
  if (!result) return null;
  return Math.ceil(result.duration / 60);
}

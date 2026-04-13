// Servicio de enrutamiento real por calles usando OSRM (sin API key)
// y geocodificación con Nominatim (OpenStreetMap).

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = '-77.18,3.72,-76.85,4.02';
const BVA_CITY_SUFFIX = ', Buenaventura, Colombia';

/**
 * Convierte una dirección de texto a coordenadas [lat, lng].
 * Prioriza resultados dentro del viewbox de Buenaventura.
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address) {
  if (!address?.trim()) return null;
  const clean = address.trim();

  const trySearch = async (query, bounded) => {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('accept-language', 'es');
    url.searchParams.set('countrycodes', 'co');
    url.searchParams.set('viewbox', BVA_VIEWBOX);
    if (bounded) url.searchParams.set('bounded', '1');
    try {
      const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Vialtros/1.0' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    } catch {
      return null;
    }
  };

  // 1. Con ciudad en la query, dentro del viewbox
  const withCity = clean.toLowerCase().includes('buenaventura')
    ? clean
    : `${clean}${BVA_CITY_SUFFIX}`;
  let result = await trySearch(withCity, true);

  // 2. Con ciudad pero sin bounded
  if (!result) result = await trySearch(withCity, false);

  // 3. Fallback global (sin restricción geográfica)
  if (!result) result = await trySearch(clean, false);

  return result;
}

/** Haversine: distancia en km entre dos puntos [lat, lng]. */
function haversineKm(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(to[0] - from[0]);
  const dLng = toRad(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from[0])) * Math.cos(toRad(to[0])) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fallback: polyline recta interpolada entre dos puntos (islas, rutas sin asfalto). */
function straightLineRoute(from, to) {
  const steps = 10;
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    coords.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  const distKm = haversineKm(from, to);
  return { coordinates: coords, duration: (distKm / 30) * 3600, distance: distKm * 1000, isStraightLine: true };
}

/**
 * Obtiene la ruta real por calles entre dos puntos usando OSRM.
 * Si OSRM falla o devuelve una ruta irreal (> 60 km), usa polyline recta.
 * @param {[number, number]} from  - [lat, lng]
 * @param {[number, number]} to    - [lat, lng]
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean }>}
 */
export async function getStreetRoute(from, to) {
  if (!from || !to) return null;

  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;

  try {
    const res = await fetch(
      `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length) {
        const route = data.routes[0];
        // Rechazar rutas > 60 km (desvíos marítimos absurdos de OSRM)
        if (route.distance < 60000) {
          return {
            coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
            duration: route.duration,
            distance: route.distance,
          };
        }
      }
    }
  } catch {
    // OSRM timeout o no disponible → fallback
  }

  return straightLineRoute(from, to);
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

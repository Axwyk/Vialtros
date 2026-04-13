// Servicio de enrutamiento real por calles usando OSRM (sin API key)
// y geocodificación con Nominatim (OpenStreetMap).

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_MATCH_BASE = 'https://router.project-osrm.org/match/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = '-77.18,3.72,-76.85,4.02';
const BVA_CITY_SUFFIX = ', Buenaventura, Colombia';

const REAL_BUENAVENTURA_PLACES = [
  {
    aliases: ['pueblo nuevo', 'barrio pueblo nuevo'],
    coords: [3.88982, -77.07077],
  },
  {
    aliases: ['seminario san buenaventura', 'seminario', 'seminario diocesan san buenaventura'],
    coords: [3.90188, -77.02293],
  },
  {
    aliases: ['termarit', 'institucion educativa termarit', 'ie termarit', 'terminal maritimo termarit', 'terminal maritimo termarit'],
    coords: [3.87851, -77.01242],
  },
  {
    aliases: ['centro buenaventura', 'centro, buenaventura', 'centro', 'centro de buenaventura'],
    coords: [3.87712, -77.02986],
  },
  {
    aliases: ['bellavista', 'barrio bellavista'],
    coords: [3.88291, -77.04041],
  },
  {
    aliases: ['cascajal', 'isla cascajal', 'localidad isla cascajal'],
    coords: [3.88563, -77.03138],
  },
  {
    aliases: ['san luis', 'barrio san luis'],
    coords: [3.87913, -77.03527],
  },
  {
    aliases: [
      'normal superior juan ladrilleros',
      'escuela normal superior juan ladrilleros',
      'institucion educativa normal superior juan ladrilleros',
      'normal juan ladrilleros',
      'juan ladrilleros',
      'normal superior',
    ],
    coords: [3.87829, -77.01886],
  },
  {
    aliases: [
      'pascual de andagoya',
      'institucion educativa pascual de andagoya',
      'colegio pascual de andagoya',
      'pascual',
    ],
    coords: [3.88129, -77.05968],
  },
  {
    aliases: ['terminal', 'terminal de transporte', 'terminal de transportes', 'terminal de buenaventura'],
    coords: [3.89015, -77.07366],
  },
];

function normalizePlaceName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveKnownPlace(address) {
  const normalized = normalizePlaceName(address);
  if (!normalized) return null;

  const knownPlace = REAL_BUENAVENTURA_PLACES.find(({ aliases }) =>
    aliases.some((alias) => normalized === alias || normalized.includes(alias) || alias.includes(normalized))
  );

  return knownPlace?.coords || null;
}

function normalizePathPoints(points) {
  return (Array.isArray(points) ? points : [])
    .filter((point) => Array.isArray(point) && point.length === 2)
    .map(([lat, lng]) => [Number(lat), Number(lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function dedupeConsecutivePoints(points) {
  return points.reduce((acc, point) => {
    const last = acc[acc.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return acc;
    acc.push(point);
    return acc;
  }, []);
}

function samplePathPoints(points, maxPoints = 12) {
  if (points.length <= maxPoints) return points;

  const sampled = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    sampled.push(points[pointIndex]);
  }

  return dedupeConsecutivePoints(sampled);
}

function buildOsrmCoordinates(points) {
  return points.map(([lat, lng]) => `${lng},${lat}`).join(';');
}

function mergePolylineSegments(segments) {
  const merged = [];

  segments.forEach((segment) => {
    (segment || []).forEach((point) => {
      const last = merged[merged.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) return;
      merged.push(point);
    });
  });

  return merged;
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return response.json();
}

/**
 * Convierte una dirección de texto a coordenadas [lat, lng].
 * Prioriza resultados dentro del viewbox de Buenaventura.
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address) {
  if (!address?.trim()) return null;
  const clean = address.trim();

  const knownCoords = resolveKnownPlace(clean);
  if (knownCoords) return knownCoords;

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
 * Ajusta una secuencia de puntos GPS a un recorrido mas cercano a calles reales.
 * Primero intenta OSRM Match y, si falla, arma una ruta pasando por waypoints.
 * @param {[number, number][]} points
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean } | null>}
 */
export async function getTrackedStreetRoute(points) {
  const normalized = dedupeConsecutivePoints(normalizePathPoints(points));
  if (normalized.length < 2) return null;

  const sampled = samplePathPoints(normalized, 12);
  const sampledCoordinates = buildOsrmCoordinates(sampled);

  try {
    const matchUrl = `${OSRM_MATCH_BASE}/${sampledCoordinates}?geometries=geojson&overview=full&tidy=true&gaps=ignore&annotations=false`;
    const data = await fetchJson(matchUrl);
    if (data?.code === 'Ok' && Array.isArray(data.matchings) && data.matchings.length > 0) {
      const coordinates = mergePolylineSegments(
        data.matchings.map((matching) => matching.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || []),
      );
      if (coordinates.length > 1) {
        return {
          coordinates,
          duration: data.matchings.reduce((sum, matching) => sum + (matching.duration || 0), 0),
          distance: data.matchings.reduce((sum, matching) => sum + (matching.distance || 0), 0),
        };
      }
    }
  } catch {
    // Seguimos con el fallback por waypoints.
  }

  try {
    const routeUrl = `${OSRM_BASE}/${sampledCoordinates}?overview=full&geometries=geojson&continue_straight=false`;
    const data = await fetchJson(routeUrl);
    if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const route = data.routes[0];
      if (route.distance < 80000) {
        return {
          coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          duration: route.duration,
          distance: route.distance,
        };
      }
    }
  } catch {
    // Seguimos con fallback por segmentos.
  }

  const segmentRoutes = await Promise.all(
    sampled.slice(1).map((to, index) => getStreetRoute(sampled[index], to)),
  );
  const coordinates = mergePolylineSegments(segmentRoutes.map((segment) => segment?.coordinates || []));
  if (coordinates.length > 1) {
    return {
      coordinates,
      duration: segmentRoutes.reduce((sum, segment) => sum + (segment?.duration || 0), 0),
      distance: segmentRoutes.reduce((sum, segment) => sum + (segment?.distance || 0), 0),
      isStraightLine: segmentRoutes.every((segment) => segment?.isStraightLine),
    };
  }

  return null;
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

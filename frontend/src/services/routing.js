// Servicio de enrutamiento real por calles usando OSRM (sin API key)
// y geocodificación con Nominatim (OpenStreetMap).

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_MATCH_BASE = 'https://router.project-osrm.org/match/v1/driving';
const OSRM_NEAREST_BASE = 'https://router.project-osrm.org/nearest/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = '-77.18,3.72,-76.85,4.02';
const BVA_CITY_SUFFIX = ', Buenaventura, Colombia';
const geocodeCache = new Map();
const routeCache = new Map();
const TRACK_MATCH_RADIUS_METERS = 35;
const TRACK_MATCH_GAP_SECONDS = 8;
const TRACK_MAX_POINT_JUMP_KM = 1.4;
const TRACK_MAX_BEARING_RANGE = 90;
export const BUENAVENTURA_CENTER = [3.89243, -77.02824];
export const BUENAVENTURA_URBAN_BOUNDS = {
  minLat: 3.84,
  maxLat: 3.93,
  minLng: -77.09,
  maxLng: -76.99,
};

const REAL_BUENAVENTURA_PLACES = [
  {
    name: 'Pueblo Nuevo',
    aliases: ['pueblo nuevo', 'barrio pueblo nuevo'],
    coords: [3.88982, -77.07077],
  },
  {
    name: 'Seminario San Buenaventura',
    aliases: ['seminario san buenaventura', 'seminario', 'seminario diocesan san buenaventura'],
    coords: [3.90188, -77.02293],
  },
  {
    name: 'Termarit',
    aliases: ['termarit', 'institucion educativa termarit', 'ie termarit', 'terminal maritimo termarit', 'terminal maritimo termarit'],
    coords: [3.87851, -77.01242],
  },
  {
    name: 'Centro, Buenaventura',
    aliases: ['centro buenaventura', 'centro, buenaventura', 'centro', 'centro de buenaventura'],
    coords: [3.87712, -77.02986],
  },
  {
    name: 'Bellavista',
    aliases: ['bellavista', 'barrio bellavista'],
    coords: [3.88291, -77.04041],
  },
  {
    name: 'Cascajal',
    aliases: ['cascajal', 'isla cascajal', 'localidad isla cascajal'],
    coords: [3.88563, -77.03138],
  },
  {
    name: 'San Luis',
    aliases: ['san luis', 'barrio san luis'],
    coords: [3.87913, -77.03527],
  },
  {
    name: 'Normal Superior Juan Ladrilleros',
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
    name: 'Pascual de Andagoya',
    aliases: [
      'pascual de andagoya',
      'institucion educativa pascual de andagoya',
      'colegio pascual de andagoya',
      'pascual',
    ],
    coords: [3.88129, -77.05968],
  },
  {
    name: 'Terminal de Buenaventura',
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

export async function searchBuenaventuraPlaces(query) {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const localMatches = REAL_BUENAVENTURA_PLACES
    .filter(({ aliases, name }) => {
      const normalizedName = normalizePlaceName(name);
      return normalizedName.includes(normalizedQuery)
        || aliases.some((alias) => alias.includes(normalizedQuery));
    })
    .slice(0, 5)
    .map(({ name, coords }) => ({
      label: name,
      subtitle: 'Lugar conocido en Buenaventura',
      coords,
      source: 'local',
    }));

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set('q', query.toLowerCase().includes('buenaventura') ? query : `${query}${BVA_CITY_SUFFIX}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('countrycodes', 'co');
  url.searchParams.set('viewbox', BVA_VIEWBOX);

  const remoteMatches = [];
  try {
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'Vialtros/1.0' } });
    if (res.ok) {
      const data = await res.json();
      (Array.isArray(data) ? data : []).forEach((item) => {
        const coords = sanitizeBuenaventuraCoords([parseFloat(item.lat), parseFloat(item.lon)]);
        if (!Array.isArray(coords) || !isWithinBuenaventuraZone(coords)) return;
        remoteMatches.push({
          label: String(item.display_name || '').split(',').slice(0, 2).join(', '),
          subtitle: 'Sugerencia del mapa',
          coords,
          source: 'nominatim',
        });
      });
    }
  } catch {
    // Si falla Nominatim, devolvemos solo coincidencias locales.
  }

  const seen = new Set();
  return [...localMatches, ...remoteMatches].filter((item) => {
    const key = normalizePlaceName(item.label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

export function isWithinBuenaventuraZone(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lat, lng] = coords;
  return (
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= BUENAVENTURA_URBAN_BOUNDS.minLat
    && lat <= BUENAVENTURA_URBAN_BOUNDS.maxLat
    && lng >= BUENAVENTURA_URBAN_BOUNDS.minLng
    && lng <= BUENAVENTURA_URBAN_BOUNDS.maxLng
  );
}

function sanitizeBuenaventuraCoords(coords, fallbackCoords = null) {
  if (isWithinBuenaventuraZone(coords)) return coords;
  if (isWithinBuenaventuraZone(fallbackCoords)) return fallbackCoords;
  return null;
}

function normalizeTrackMatchPoints(points) {
  return (Array.isArray(points) ? points : [])
    .map((point) => {
      if (Array.isArray(point) && point.length === 2) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          coords: [lat, lng],
          speedKmh: null,
          timestampMs: null,
        };
      }

      if (!point || typeof point !== 'object') return null;

      const lat = Number(point.latitude ?? point.lat ?? point.coords?.[0]);
      const lng = Number(point.longitude ?? point.lng ?? point.coords?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const speedRaw = Number(point.speed ?? point.speed_kmh ?? point.velocity);
      const timestampMs = point.timestamp ? new Date(point.timestamp).getTime() : Number.NaN;

      return {
        coords: [lat, lng],
        speedKmh: Number.isFinite(speedRaw) ? speedRaw : null,
        timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
      };
    })
    .filter(Boolean);
}

function dedupeConsecutiveTrackMatchPoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    const last = acc[acc.length - 1];
    if (last && last.coords[0] === point.coords[0] && last.coords[1] === point.coords[1]) {
      return acc;
    }
    acc.push(point);
    return acc;
  }, []);
}

function sampleTrackMatchPoints(points, maxPoints = 12) {
  if (points.length <= maxPoints) return points;

  const sampled = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    sampled.push(points[pointIndex]);
  }

  return dedupeConsecutiveTrackMatchPoints(sampled);
}

function filterAbruptPathJumps(points, maxJumpKm = TRACK_MAX_POINT_JUMP_KM) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    const last = acc[acc.length - 1];
    if (!last) {
      acc.push(point);
      return acc;
    }

    if (haversineKm(last.coords, point.coords) <= maxJumpKm) {
      acc.push(point);
    }

    return acc;
  }, []);
}

function buildMatchParams(points) {
  const radiuses = points.map(() => String(TRACK_MATCH_RADIUS_METERS)).join(';');
  const firstTimestampMs = points.find((point) => Number.isFinite(point.timestampMs))?.timestampMs ?? null;
  const timestamps = points.map((point, index) => {
    if (Number.isFinite(firstTimestampMs) && Number.isFinite(point.timestampMs)) {
      return String(Math.max(1, Math.round(point.timestampMs / 1000)));
    }

    return String(1700000000 + (index * TRACK_MATCH_GAP_SECONDS));
  }).join(';');
  const bearings = points.map((point, index) => {
    const previous = points[index - 1]?.coords;
    const next = points[index + 1]?.coords;
    const from = previous || point.coords;
    const to = next || previous;

    if (!Array.isArray(from) || !Array.isArray(to) || (from[0] === to[0] && from[1] === to[1])) {
      return '';
    }

    const deltaLng = to[1] - from[1];
    const deltaLat = to[0] - from[0];
    const bearing = (Math.atan2(deltaLng, deltaLat) * (180 / Math.PI) + 360) % 360;
    const speed = point.speedKmh ?? 0;
    const range = speed >= 45
      ? 20
      : speed >= 30
        ? 28
        : speed >= 18
          ? 38
          : speed >= 8
            ? 55
            : TRACK_MAX_BEARING_RANGE;

    return `${Math.round(bearing)},${range}`;
  }).join(';');

  return { radiuses, timestamps, bearings };
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

function isUsableRoadRoute(route, maxDistance = 60000) {
  return Boolean(route?.geometry?.coordinates?.length > 1 && route?.distance < maxDistance);
}

function toLatLngPolyline(route) {
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    duration: route.duration,
    distance: route.distance,
  };
}

function trimAccessRoadLoops(coordinates, from, to) {
  const routePoints = (Array.isArray(coordinates) ? coordinates : [])
    .filter((point) => Array.isArray(point) && point.length === 2);

  if (routePoints.length < 4 || !Array.isArray(from) || !Array.isArray(to)) {
    return routePoints;
  }

  const accessThresholdKm = 0.45;
  const scanLimit = Math.min(routePoints.length - 2, 18);

  let startIndex = 0;
  let bestStartScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index <= scanLimit; index += 1) {
    const point = routePoints[index];
    const distanceFromOrigin = haversineKm(from, point);
    if (distanceFromOrigin > accessThresholdKm) break;

    const distanceToDestination = haversineKm(point, to);
    const score = (distanceToDestination * 0.82) + (distanceFromOrigin * 0.18);
    if (score < bestStartScore) {
      bestStartScore = score;
      startIndex = index;
    }
  }

  let endIndex = routePoints.length - 1;
  let bestEndScore = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset <= scanLimit; offset += 1) {
    const index = routePoints.length - 1 - offset;
    const point = routePoints[index];
    const distanceToDestination = haversineKm(point, to);
    if (distanceToDestination > accessThresholdKm) break;

    const distanceFromOrigin = haversineKm(point, from);
    const score = (distanceFromOrigin * 0.82) + (distanceToDestination * 0.18);
    if (score < bestEndScore) {
      bestEndScore = score;
      endIndex = index;
    }
  }

  if (endIndex - startIndex < 2) {
    return routePoints;
  }

  return routePoints.slice(startIndex, endIndex + 1);
}

async function snapToNearestRoad(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return null;

  const [lat, lng] = coords;
  try {
    const data = await fetchJson(`${OSRM_NEAREST_BASE}/${lng},${lat}?number=1`);
    const location = data?.waypoints?.[0]?.location;
    if (!Array.isArray(location) || location.length !== 2) return null;
    return sanitizeBuenaventuraCoords([location[1], location[0]], coords);
  } catch {
    return null;
  }
}

async function getNearestRoadCandidates(coords, number = 3) {
  if (!Array.isArray(coords) || coords.length !== 2) return [];

  const [lat, lng] = coords;
  try {
    const data = await fetchJson(`${OSRM_NEAREST_BASE}/${lng},${lat}?number=${number}`);
    const candidates = (Array.isArray(data?.waypoints) ? data.waypoints : [])
      .map((waypoint) => waypoint?.location)
      .filter((location) => Array.isArray(location) && location.length === 2)
      .map(([candidateLng, candidateLat]) => sanitizeBuenaventuraCoords([candidateLat, candidateLng], coords))
      .filter(Boolean);

    return dedupeConsecutiveTrackMatchPoints(
      normalizeTrackMatchPoints([
        { coords },
        ...candidates.map((candidate) => ({ coords: candidate })),
      ]),
    ).map((point) => point.coords);
  } catch {
    return [coords];
  }
}

async function requestBestStreetRoute(fromCandidates, toCandidates, maxDistance = 60000) {
  const safeFromCandidates = (Array.isArray(fromCandidates) ? fromCandidates : []).filter(Array.isArray);
  const safeToCandidates = (Array.isArray(toCandidates) ? toCandidates : []).filter(Array.isArray);

  let bestRoute = null;

  for (const from of safeFromCandidates) {
    for (const to of safeToCandidates) {
      const route = await requestStreetRoute([from, to], maxDistance);
      if (!route) continue;

      if (!bestRoute || route.distance < bestRoute.distance) {
        bestRoute = route;
      }
    }
  }

  return bestRoute;
}

async function snapPathToRoad(points) {
  const snapped = await Promise.all(
    (Array.isArray(points) ? points : []).map(async (point) => {
      const snappedCoords = await snapToNearestRoad(point.coords);
      return {
        ...point,
        coords: snappedCoords || point.coords,
      };
    }),
  );

  return dedupeConsecutiveTrackMatchPoints(normalizeTrackMatchPoints(snapped));
}

async function requestStreetRoute(points, maxDistance = 60000) {
  const coordinates = buildOsrmCoordinates(points);
  const cacheKey = `${coordinates}|${maxDistance}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }
  const data = await fetchJson(`${OSRM_BASE}/${coordinates}?overview=full&geometries=geojson&continue_straight=false&steps=true`);
  if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
    const route = data.routes[0];
    if (isUsableRoadRoute(route, maxDistance)) {
      const resolved = toLatLngPolyline(route);
      routeCache.set(cacheKey, resolved);
      return resolved;
    }
  }
  routeCache.set(cacheKey, null);
  return null;
}

/**
 * Convierte una dirección de texto a coordenadas [lat, lng].
 * Prioriza resultados dentro del viewbox de Buenaventura.
 * @param {string} address
 * @returns {Promise<[number, number] | null>}
 */
export async function geocodeAddress(address, options = {}) {
  if (!address?.trim()) return null;
  const clean = address.trim();
  const { fallbackCoords = null } = options;
  const cacheKey = `${normalizePlaceName(clean)}|${Array.isArray(fallbackCoords) ? fallbackCoords.join(',') : 'no-fallback'}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const knownCoords = resolveKnownPlace(clean);
  if (knownCoords) {
    const resolved = sanitizeBuenaventuraCoords(knownCoords, fallbackCoords);
    geocodeCache.set(cacheKey, resolved);
    return resolved;
  }

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
      return sanitizeBuenaventuraCoords(
        [parseFloat(data[0].lat), parseFloat(data[0].lon)],
        fallbackCoords,
      );
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

  const resolved = result || (isWithinBuenaventuraZone(fallbackCoords) ? fallbackCoords : null);
  geocodeCache.set(cacheKey, resolved);
  return resolved;
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

  const safeFrom = sanitizeBuenaventuraCoords(from) || from;
  const safeTo = sanitizeBuenaventuraCoords(to, safeFrom) || to;

  try {
    const [fromCandidates, toCandidates] = await Promise.all([
      getNearestRoadCandidates(safeFrom),
      getNearestRoadCandidates(safeTo),
    ]);

    const snappedRoute = await requestBestStreetRoute(
      fromCandidates.length > 0 ? fromCandidates : [safeFrom],
      toCandidates.length > 0 ? toCandidates : [safeTo],
    );
    if (snappedRoute) {
      return {
        ...snappedRoute,
        coordinates: trimAccessRoadLoops(snappedRoute.coordinates, safeFrom, safeTo),
      };
    }
  } catch {
    // Si falla el ajuste a la vía, probamos con las coordenadas saneadas.
  }

  try {
    const directRoute = await requestStreetRoute([safeFrom, safeTo]);
    if (directRoute) {
      return {
        ...directRoute,
        coordinates: trimAccessRoadLoops(directRoute.coordinates, safeFrom, safeTo),
      };
    }
  } catch {
    // Último recurso: línea recta.
  }

  return straightLineRoute(safeFrom, safeTo);
}

/**
 * Ajusta una secuencia de puntos GPS a un recorrido mas cercano a calles reales.
 * Primero intenta OSRM Match y, si falla, arma una ruta pasando por waypoints.
 * @param {[number, number][]} points
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean } | null>}
 */
export async function getTrackedStreetRoute(points) {
  const normalized = filterAbruptPathJumps(
    dedupeConsecutiveTrackMatchPoints(normalizeTrackMatchPoints(points)),
  );
  if (normalized.length < 2) return null;

  const sampled = sampleTrackMatchPoints(normalized, 14);
  const snappedSampled = await snapPathToRoad(sampled);
  const roadAnchoredPoints = snappedSampled.length > 1 ? snappedSampled : sampled;
  const sampledCoordinates = buildOsrmCoordinates(roadAnchoredPoints.map((point) => point.coords));
  const { radiuses, timestamps, bearings } = buildMatchParams(roadAnchoredPoints);

  try {
    const matchUrl = `${OSRM_MATCH_BASE}/${sampledCoordinates}?geometries=geojson&overview=full&tidy=true&gaps=split&annotations=false&radiuses=${radiuses}&timestamps=${timestamps}&bearings=${bearings}`;
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
    const routeUrl = `${OSRM_BASE}/${sampledCoordinates}?overview=full&geometries=geojson&continue_straight=false&steps=true`;
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
    roadAnchoredPoints.slice(1).map(async (to, index) => {
      const from = roadAnchoredPoints[index]?.coords;
      const toCoords = to?.coords;
      const directSegment = await requestStreetRoute([from, toCoords], 30000);
      if (directSegment) {
        return directSegment;
      }

      return getStreetRoute(from, toCoords);
    }),
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

  if (roadAnchoredPoints.length > 1) {
    return {
      coordinates: roadAnchoredPoints.map((point) => point.coords),
      duration: 0,
      distance: 0,
      isStraightLine: false,
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

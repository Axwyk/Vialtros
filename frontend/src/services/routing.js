// Servicio de enrutamiento real por calles usando Valhalla (FOSSGIS) como primario
// y OSRM como fallback. Geocodificación con Nominatim (OpenStreetMap).

const VALHALLA_BASE = 'https://valhalla1.openstreetmap.de';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_MATCH_BASE = 'https://router.project-osrm.org/match/v1/driving';
const OSRM_NEAREST_BASE = 'https://router.project-osrm.org/nearest/v1/driving';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = '-77.18,3.72,-76.85,4.02';
const BVA_CITY_SUFFIX = ', Buenaventura, Colombia';
const geocodeCache = new Map();
const routeCache = new Map();
const TRACK_MATCH_RADIUS_METERS = 100;
const TRACK_MATCH_GAP_SECONDS = 8;
const TRACK_MAX_POINT_JUMP_KM = 1.4;
const TRACK_MAX_BEARING_RANGE = 180;
const snapCache = new Map();
const SNAP_CACHE_MAX = 400;
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
      ? 30
      : speed >= 30
        ? 45
        : speed >= 18
          ? 60
          : speed >= 8
            ? 90
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

async function fetchJson(url, timeoutMs = 12000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;
  return response.json();
}

async function fetchPostJson(url, body, timeoutMs = 12000) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  return response.json();
}

async function fetchJsonWithRetry(url, retries = 1, timeoutMs = 12000) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await fetchJson(url, timeoutMs);
      if (result !== null) return result;
    } catch {
      if (attempt >= retries) return null;
    }
  }
  return null;
}

// Decode Valhalla encoded polyline6 (precision 1e-6)
function decodePolyline6(encoded) {
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);

    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

// Valhalla costing options: prefer main roads, avoid residential shortcuts
const VALHALLA_COSTING_OPTIONS = {
  auto: {
    use_highways: 1,
    use_living_streets: 0,
    use_ferry: 0,
    shortest: false,
    top_speed: 80,
  },
};

// Primary routing via Valhalla (FOSSGIS)
async function valhallaRoute(from, to, timeoutMs = 15000) {
  const body = {
    locations: [
      { lat: from[0], lon: from[1] },
      { lat: to[0], lon: to[1] },
    ],
    costing: 'auto',
    costing_options: VALHALLA_COSTING_OPTIONS,
    directions_options: { units: 'km' },
  };

  const data = await fetchPostJson(`${VALHALLA_BASE}/route`, body, timeoutMs);
  if (!data?.trip?.legs?.[0]?.shape) return null;

  const leg = data.trip.legs[0];
  const coordinates = decodePolyline6(leg.shape);
  if (coordinates.length < 2) return null;

  return {
    coordinates,
    duration: leg.summary?.time || 0,
    distance: (leg.summary?.length || 0) * 1000, // km→m
  };
}

// Valhalla snap to nearest road
async function valhallaLocate(coords, timeoutMs = 8000) {
  const body = {
    locations: [{ lat: coords[0], lon: coords[1] }],
    costing: 'auto',
    costing_options: VALHALLA_COSTING_OPTIONS,
    verbose: false,
  };

  const data = await fetchPostJson(`${VALHALLA_BASE}/locate`, body, timeoutMs);
  if (!Array.isArray(data) || data.length === 0) return null;

  const result = data[0];
  if (!result?.edges?.length) return null;

  const edge = result.edges[0];
  if (!Number.isFinite(edge.correlated_lat) || !Number.isFinite(edge.correlated_lon)) return null;

  return sanitizeBuenaventuraCoords(
    [edge.correlated_lat, edge.correlated_lon],
    coords,
  );
}

// Valhalla trace_route for map matching (GPS points → road path)
async function valhallaTraceRoute(points, timeoutMs = 12000) {
  if (!Array.isArray(points) || points.length < 2) return null;

  const shape = points.map((p) => ({
    lat: Array.isArray(p) ? p[0] : p.latitude,
    lon: Array.isArray(p) ? p[1] : p.longitude,
  }));

  const body = {
    shape,
    costing: 'auto',
    costing_options: VALHALLA_COSTING_OPTIONS,
    shape_match: 'map_snap',
    search_radius: 150,
  };

  const data = await fetchPostJson(`${VALHALLA_BASE}/trace_route`, body, timeoutMs);
  if (!data?.trip?.legs) return null;

  const allCoords = data.trip.legs.flatMap((leg) => {
    if (!leg.shape) return [];
    return decodePolyline6(leg.shape);
  });
  if (allCoords.length < 2) return null;

  const totalTime = data.trip.legs.reduce((s, l) => s + (l.summary?.time || 0), 0);
  const totalDist = data.trip.legs.reduce((s, l) => s + (l.summary?.length || 0), 0);
  return {
    coordinates: allCoords,
    duration: totalTime,
    distance: totalDist * 1000,
  };
}

// Valhalla route with multiple waypoints
async function valhallaRouteWaypoints(waypoints, timeoutMs = 15000) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;

  const body = {
    locations: waypoints.map((p) => ({ lat: p[0], lon: p[1], type: 'through' })),
    costing: 'auto',
    costing_options: VALHALLA_COSTING_OPTIONS,
    directions_options: { units: 'km' },
  };
  // First and last must be 'break'
  body.locations[0].type = 'break';
  body.locations[body.locations.length - 1].type = 'break';

  const data = await fetchPostJson(`${VALHALLA_BASE}/route`, body, timeoutMs);
  if (!data?.trip?.legs) return null;

  const allCoords = data.trip.legs.flatMap((leg) => {
    if (!leg.shape) return [];
    return decodePolyline6(leg.shape);
  });
  if (allCoords.length < 2) return null;

  const totalTime = data.trip.legs.reduce((s, l) => s + (l.summary?.time || 0), 0);
  const totalDist = data.trip.legs.reduce((s, l) => s + (l.summary?.length || 0), 0);
  return {
    coordinates: allCoords,
    duration: totalTime,
    distance: totalDist * 1000,
  };
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

  // 1. Primary: Valhalla locate
  try {
    const snapped = await valhallaLocate(coords);
    if (snapped) return snapped;
  } catch {
    // Valhalla failed, try OSRM
  }

  // 2. Fallback: OSRM nearest
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

  // 1. Primary: Valhalla locate (single best snap)
  try {
    const snapped = await valhallaLocate(coords);
    if (snapped) return [coords, snapped];
  } catch {
    // Valhalla failed, try OSRM
  }

  // 2. Fallback: OSRM nearest with multiple candidates
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

  // Build pairs prioritizing first candidates (closest to road), limit to 4 attempts max
  const pairs = [];
  for (const from of safeFromCandidates) {
    for (const to of safeToCandidates) {
      pairs.push([from, to]);
    }
  }
  const limitedPairs = pairs.slice(0, 4);

  // Try pairs in parallel to avoid sequential stalling
  const results = await Promise.all(
    limitedPairs.map((pair) => requestStreetRoute(pair, maxDistance).catch(() => null)),
  );

  let bestRoute = null;
  for (const route of results) {
    if (route && (!bestRoute || route.distance < bestRoute.distance)) {
      bestRoute = route;
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
  // Try Valhalla first if exactly 2 points
  if (Array.isArray(points) && points.length === 2) {
    try {
      const valResult = await valhallaRoute(points[0], points[1]);
      if (valResult?.coordinates?.length > 1 && valResult.distance < maxDistance) {
        const cacheKey = `val|${points[0].join(',')}->${points[1].join(',')}`;
        routeCache.set(cacheKey, valResult);
        return valResult;
      }
    } catch {
      // Valhalla failed, try OSRM
    }
  }

  const coordinates = buildOsrmCoordinates(points);
  const cacheKey = `${coordinates}|${maxDistance}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }
  const data = await fetchJsonWithRetry(`${OSRM_BASE}/${coordinates}?overview=full&geometries=geojson&continue_straight=false&steps=true`, 1);
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

  // Snap geocoded coordinate to nearest road for precision
  if (resolved) {
    try {
      const snapped = await valhallaLocate(resolved);
      if (snapped) {
        geocodeCache.set(cacheKey, snapped);
        return snapped;
      }
    } catch {
      // Use un-snapped coordinate
    }
  }

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

  // Helper: anchor first/last points of route to exact origin/destination
  const anchorEndpoints = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return coords;
    const result = [...coords];
    result[0] = safeFrom;
    result[result.length - 1] = safeTo;
    return result;
  };

  // 1. Primary: Valhalla (FOSSGIS) — reliable, fast, no rate limit
  try {
    const valRoute = await valhallaRoute(safeFrom, safeTo);
    if (valRoute?.coordinates?.length > 1) {
      const cacheKey = `${safeFrom.join(',')}->${safeTo.join(',')}`;
      routeCache.set(cacheKey, valRoute);
      return {
        ...valRoute,
        coordinates: anchorEndpoints(trimAccessRoadLoops(valRoute.coordinates, safeFrom, safeTo)),
      };
    }
  } catch {
    // Valhalla failed, try OSRM
  }

  // 2. Fallback: direct OSRM route
  try {
    const directRoute = await requestStreetRoute([safeFrom, safeTo]);
    if (directRoute) {
      return {
        ...directRoute,
        coordinates: anchorEndpoints(trimAccessRoadLoops(directRoute.coordinates, safeFrom, safeTo)),
      };
    }
  } catch {
    // Continue to snap approach
  }

  // 3. Last resort with snapped endpoints (OSRM)
  try {
    const [snappedFrom, snappedTo] = await Promise.all([
      snapToNearestRoad(safeFrom),
      snapToNearestRoad(safeTo),
    ]);

    const routeFrom = snappedFrom || safeFrom;
    const routeTo = snappedTo || safeTo;

    const snappedRoute = await requestStreetRoute([routeFrom, routeTo]);
    if (snappedRoute) {
      return {
        ...snappedRoute,
        coordinates: anchorEndpoints(trimAccessRoadLoops(snappedRoute.coordinates, safeFrom, safeTo)),
      };
    }
  } catch {
    // Straight line fallback
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

  const sampled = sampleTrackMatchPoints(normalized, 20);
  const sampledCoords = sampled.map((p) => p.coords);

  // 1. Primary: Valhalla trace_route (map matching)
  try {
    const traceResult = await valhallaTraceRoute(sampledCoords);
    if (traceResult?.coordinates?.length > 1) return traceResult;
  } catch {
    // Valhalla trace failed, try waypoints route
  }

  // 2. Valhalla route with waypoints
  try {
    const waypointResult = await valhallaRouteWaypoints(sampledCoords);
    if (waypointResult?.coordinates?.length > 1) return waypointResult;
  } catch {
    // Valhalla waypoints failed, try OSRM
  }

  // 3. Fallback: OSRM Match
  try {
    const snappedSampled = await snapPathToRoad(sampled);
    const roadAnchoredPoints = snappedSampled.length > 1 ? snappedSampled : sampled;
    const sampledCoordinates = buildOsrmCoordinates(roadAnchoredPoints.map((point) => point.coords));
    const { radiuses, timestamps } = buildMatchParams(roadAnchoredPoints);

    const matchUrl = `${OSRM_MATCH_BASE}/${sampledCoordinates}?geometries=geojson&overview=full&tidy=true&gaps=split&annotations=false&radiuses=${radiuses}&timestamps=${timestamps}`;
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
    // OSRM Match failed
  }

  // 4. Segment-by-segment via getStreetRoute (already Valhalla-primary)
  const segmentRoutes = await Promise.all(
    sampledCoords.slice(1).map(async (to, index) => {
      const from = sampledCoords[index];
      return getStreetRoute(from, to);
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

  if (sampledCoords.length > 1) {
    return {
      coordinates: sampledCoords,
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

/**
 * Ajusta un punto GPS individual a la vía más cercana.
 * Usa caché para evitar llamadas repetidas a puntos cercanos.
 * @param {[number, number]} coords [lat, lng]
 * @returns {Promise<[number, number]>}
 */
export async function snapPointToRoad(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return coords;
  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return coords;

  // Cuantizar a ~11 metros para aprovechar caché
  const keyLat = (Math.round(lat * 10000) / 10000).toFixed(4);
  const keyLng = (Math.round(lng * 10000) / 10000).toFixed(4);
  const cacheKey = `${keyLat},${keyLng}`;
  if (snapCache.has(cacheKey)) return snapCache.get(cacheKey);

  try {
    const snapped = await snapToNearestRoad(coords);
    const result = snapped || coords;
    if (snapCache.size >= SNAP_CACHE_MAX) {
      const firstKey = snapCache.keys().next().value;
      snapCache.delete(firstKey);
    }
    snapCache.set(cacheKey, result);
    return result;
  } catch {
    return coords;
  }
}

/**
 * Construye una polilínea por calles entre puntos GPS dispersos.
 * En lugar de líneas rectas, usa OSRM route entre cada par consecutivo.
 * @param {[number, number][]} points Array de [lat, lng]
 * @returns {Promise<[number, number][]>}
 */
export async function buildRoadPathBetweenPoints(points) {
  const validPoints = (Array.isArray(points) ? points : [])
    .filter((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (validPoints.length < 2) return validPoints;

  // Snap todos los puntos a vías
  const snappedPoints = await Promise.all(validPoints.map((p) => snapPointToRoad(p)));
  const dedupedPoints = dedupeConsecutivePoints(snappedPoints);
  if (dedupedPoints.length < 2) return dedupedPoints;

  const sampled = dedupedPoints.length > 25
    ? sampleTrackMatchPoints(normalizeTrackMatchPoints(dedupedPoints), 25).map((p) => p.coords)
    : dedupedPoints;

  // 1. Primary: Valhalla route with waypoints
  try {
    const valResult = await valhallaRouteWaypoints(sampled);
    if (valResult?.coordinates?.length > 1) return valResult.coordinates;
  } catch {
    // Valhalla failed, try OSRM
  }

  // 2. Fallback: OSRM route with all waypoints
  try {
    const coords = sampled.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const data = await fetchJson(
      `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&continue_straight=false`,
    );
    if (data?.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length > 1) {
      const roadPath = data.routes[0].geometry.coordinates.map(([rLng, rLat]) => [rLat, rLng]);
      if (roadPath.length > 1) return roadPath;
    }
  } catch {
    // Fallback: segmento a segmento
  }

  // 3. Fallback: segment-by-segment via getStreetRoute (already Valhalla-primary)
  const segments = await Promise.all(
    sampled.slice(1).map(async (to, idx) => {
      const from = sampled[idx];
      try {
        const route = await getStreetRoute(from, to);
        return route?.coordinates || [from, to];
      } catch {
        return [from, to];
      }
    }),
  );
  return mergePolylineSegments(segments);
}

function dedupeConsecutivePoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    if (!Array.isArray(point) || point.length !== 2) return acc;
    const last = acc[acc.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return acc;
    acc.push(point);
    return acc;
  }, []);
}

// Servicio de enrutamiento real por calles usando Google Routes API
// y Nominatim para geocodificación
// NOTA: Valhalla/OSRM reemplazados por Google Routes API (mejor precisión en Buenaventura)

import {
  getStreetRoute as googleGetStreetRoute,
  getStreetRouteThroughPoints as googleGetStreetRouteThroughPoints,
  snapPointToRoad as googleSnapPointToRoad,
} from "./googleRoutesApi";


const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = "-77.18,3.72,-76.85,4.02";
const BVA_CITY_SUFFIX = ", Buenaventura, Colombia";
const geocodeCache = new Map();
const TRACK_MAX_POINT_JUMP_KM = 1.4;
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
    name: "Pueblo Nuevo",
    aliases: ["pueblo nuevo", "barrio pueblo nuevo"],
    coords: [3.88982, -77.07077],
  },
  {
    name: "Seminario San Buenaventura",
    aliases: [
      "seminario san buenaventura",
      "seminario",
      "seminario diocesan san buenaventura",
    ],
    coords: [3.90188, -77.02293],
  },
  {
    name: "Termarit",
    aliases: [
      "termarit",
      "institucion educativa termarit",
      "ie termarit",
      "terminal maritimo termarit",
      "terminal maritimo termarit",
    ],
    coords: [3.87851, -77.01242],
  },
  {
    name: "Centro, Buenaventura",
    aliases: [
      "centro buenaventura",
      "centro, buenaventura",
      "centro",
      "centro de buenaventura",
    ],
    coords: [3.87712, -77.02986],
  },
  {
    name: "Bellavista",
    aliases: ["bellavista", "barrio bellavista"],
    coords: [3.88291, -77.04041],
  },
  {
    name: "Cascajal",
    aliases: ["cascajal", "isla cascajal", "localidad isla cascajal"],
    coords: [3.88563, -77.03138],
  },
  {
    name: "San Luis",
    aliases: ["san luis", "barrio san luis"],
    coords: [3.87913, -77.03527],
  },
  {
    name: "Normal Superior Juan Ladrilleros",
    aliases: [
      "normal superior juan ladrilleros",
      "escuela normal superior juan ladrilleros",
      "institucion educativa normal superior juan ladrilleros",
      "normal juan ladrilleros",
      "juan ladrilleros",
      "normal superior",
    ],
    coords: [3.87829, -77.01886],
  },
  {
    name: "Pascual de Andagoya",
    aliases: [
      "pascual de andagoya",
      "institucion educativa pascual de andagoya",
      "colegio pascual de andagoya",
      "pascual",
    ],
    coords: [3.88129, -77.05968],
  },
  {
    name: "Terminal de Buenaventura",
    aliases: [
      "terminal",
      "terminal de transporte",
      "terminal de transportes",
      "terminal de buenaventura",
    ],
    coords: [3.89015, -77.07366],
  },
  {
    name: "Universidad del Valle sede Pacífico",
    aliases: [
      "universidad del valle",
      "univalle",
      "univalle pacifico",
      "universidad del valle sede pacifico",
      "sede pacifico",
    ],
    coords: [3.88126, -77.01018],
  },
  {
    name: "INSTITUCION EDUCATIVA TERMARIT",
    aliases: ["institucion educativa termarit carrera 53"],
    coords: [3.87851, -77.01242],
  },
];

function normalizePlaceName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKnownPlace(address) {
  const normalized = normalizePlaceName(address);
  if (!normalized) return null;

  const knownPlace = REAL_BUENAVENTURA_PLACES.find(({ aliases }) =>
    aliases.some(
      (alias) =>
        normalized === alias ||
        normalized.includes(alias) ||
        alias.includes(normalized),
    ),
  );

  return knownPlace?.coords || null;
}

export async function searchBuenaventuraPlaces(query) {
  const normalizedQuery = normalizePlaceName(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const localMatches = REAL_BUENAVENTURA_PLACES.filter(({ aliases, name }) => {
    const normalizedName = normalizePlaceName(name);
    return (
      normalizedName.includes(normalizedQuery) ||
      aliases.some((alias) => alias.includes(normalizedQuery))
    );
  })
    .slice(0, 5)
    .map(({ name, coords }) => ({
      label: name,
      subtitle: "Lugar conocido en Buenaventura",
      coords,
      source: "local",
    }));

  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set(
    "q",
    query.toLowerCase().includes("buenaventura")
      ? query
      : `${query}${BVA_CITY_SUFFIX}`,
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "es");
  url.searchParams.set("countrycodes", "co");
  url.searchParams.set("viewbox", BVA_VIEWBOX);

  const remoteMatches = [];
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Vialtros/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      (Array.isArray(data) ? data : []).forEach((item) => {
        const coords = sanitizeBuenaventuraCoords([
          parseFloat(item.lat),
          parseFloat(item.lon),
        ]);
        if (!Array.isArray(coords) || !isWithinBuenaventuraZone(coords)) return;
        remoteMatches.push({
          label: String(item.display_name || "")
            .split(",")
            .slice(0, 2)
            .join(", "),
          subtitle: "Sugerencia del mapa",
          coords,
          source: "nominatim",
        });
      });
    }
  } catch {
    // Si falla Nominatim, devolvemos solo coincidencias locales.
  }

  const seen = new Set();
  return [...localMatches, ...remoteMatches]
    .filter((item) => {
      const key = normalizePlaceName(item.label);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export function isWithinBuenaventuraZone(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lat, lng] = coords;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BUENAVENTURA_URBAN_BOUNDS.minLat &&
    lat <= BUENAVENTURA_URBAN_BOUNDS.maxLat &&
    lng >= BUENAVENTURA_URBAN_BOUNDS.minLng &&
    lng <= BUENAVENTURA_URBAN_BOUNDS.maxLng
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

      if (!point || typeof point !== "object") return null;

      const lat = Number(point.latitude ?? point.lat ?? point.coords?.[0]);
      const lng = Number(point.longitude ?? point.lng ?? point.coords?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const speedRaw = Number(point.speed ?? point.speed_kmh ?? point.velocity);
      const timestampMs = point.timestamp
        ? new Date(point.timestamp).getTime()
        : Number.NaN;

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
    if (
      last &&
      last.coords[0] === point.coords[0] &&
      last.coords[1] === point.coords[1]
    ) {
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




function anchorRouteEndpoints(coordinates, from, to) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return coordinates;
  const anchored = [...coordinates];
  anchored[0] = from;
  anchored[anchored.length - 1] = to;
  return anchored;
}

export async function getStreetRouteThroughPoints(points, options = {}) {
  const validPoints = dedupeConsecutivePoints(
    (Array.isArray(points) ? points : [])
      .map((point) => {
        if (!Array.isArray(point) || point.length !== 2) return null;
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return sanitizeBuenaventuraCoords([lat, lng]) || [lat, lng];
      })
      .filter(Boolean),
  );

  if (validPoints.length < 2) {
    return validPoints.length === 1
      ? { coordinates: validPoints, duration: 0, distance: 0 }
      : null;
  }

  const maxDistance = Number.isFinite(options.maxDistance)
    ? Number(options.maxDistance)
    : 60000 * Math.max(1, validPoints.length - 1);

  try {
    // Usar Google Routes API para múltiples puntos
    const googleRoute = await googleGetStreetRouteThroughPoints(validPoints, {
      maxDistance,
    });
    if (googleRoute?.coordinates?.length > 1) {
      return googleRoute;
    }
  } catch (error) {
    console.warn("Google Routes API multi-point failed, using segments:", error.message);
  }

  // Fallback: construir ruta por segmentos
  const segmentRoutes = await Promise.all(
    validPoints.slice(1).map(async (to, index) => {
      const from = validPoints[index];
      try {
        const segment = await googleGetStreetRoute(from, to);
        if (segment?.coordinates?.length > 1) {
          return {
            ...segment,
            coordinates: anchorRouteEndpoints(segment.coordinates, from, to),
          };
        }
      } catch (error) {
        console.warn(`Segment route failed from ${from} to ${to}:`, error.message);
      }
      return straightLineRoute(from, to);
    }),
  );

  const mergedCoordinates = mergePolylineSegments(
    segmentRoutes.map((segment) => segment?.coordinates || []),
  );
  if (mergedCoordinates.length > 1) {
    const resolved = {
      coordinates: anchorRouteEndpoints(
        mergedCoordinates,
        validPoints[0],
        validPoints[validPoints.length - 1],
      ),
      duration: segmentRoutes.reduce(
        (sum, segment) => sum + (segment?.duration || 0),
        0,
      ),
      distance: segmentRoutes.reduce(
        (sum, segment) => sum + (segment?.distance || 0),
        0,
      ),
      isStraightLine: segmentRoutes.every((segment) => segment?.isStraightLine),
    };
    return resolved;
  }

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
  const cacheKey = `${normalizePlaceName(clean)}|${Array.isArray(fallbackCoords) ? fallbackCoords.join(",") : "no-fallback"}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  const knownCoords = resolveKnownPlace(clean);
  if (knownCoords) {
    const resolved = sanitizeBuenaventuraCoords(knownCoords, fallbackCoords);
    geocodeCache.set(cacheKey, resolved);
    return resolved;
  }

  const trySearch = async (query, fallback) => {
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", "es");
    if (fallback && Array.isArray(fallback) && fallback.length === 2) {
      const [lat, lng] = fallback;
      const d = 0.5;
      url.searchParams.set("viewbox", `${lng - d},${lat - d},${lng + d},${lat + d}`);
    }
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "Vialtros/1.0" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    } catch {
      return null;
    }
  };

  // 1. Con bias de ubicacion conocida si esta disponible
  let result = await trySearch(clean, fallbackCoords);

  // 2. Fallback sin restriccion geografica
  if (!result) result = await trySearch(clean, null);

  const resolved = result || (Array.isArray(fallbackCoords) && fallbackCoords.length === 2 ? fallbackCoords : null);

  // Snap geocoded coordinate to nearest road for precision
  if (resolved) {
    try {
      const snapped = await googleSnapPointToRoad(resolved);
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
    coords.push([
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
    ]);
  }
  const distKm = haversineKm(from, to);
  return {
    coordinates: coords,
    duration: (distKm / 30) * 3600,
    distance: distKm * 1000,
    isStraightLine: true,
  };
}

/**
 * Obtiene la ruta real por calles entre dos puntos usando Google Routes API.
 * Si Google Routes falla, usa polyline recta.
 * @param {[number, number]} from  - [lat, lng]
 * @param {[number, number]} to    - [lat, lng]
 * @returns {Promise<{ coordinates: [number, number][], duration: number, distance: number, isStraightLine?: boolean }>}
 */
export async function getStreetRoute(from, to) {
  if (!from || !to) return null;

  const safeFrom = sanitizeBuenaventuraCoords(from) || from;
  const safeTo = sanitizeBuenaventuraCoords(to, safeFrom) || to;

  // Usar Google Routes API
  try {
    const googleRoute = await googleGetStreetRoute(safeFrom, safeTo);
    if (googleRoute?.coordinates?.length > 1) {
      return googleRoute;
    }
  } catch (error) {
    console.warn("Google Routes API failed, using fallback:", error.message);
  }

  // Fallback: línea recta
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

  const sampled = sampleTrackMatchPoints(normalized, 35);
  const sampledCoords = sampled.map((p) => p.coords);

  // 1. Primary: Google Routes API multi-point route
  try {
    const googleResult = await googleGetStreetRouteThroughPoints(sampledCoords);
    if (googleResult?.coordinates?.length > 1) return googleResult;
  } catch {
    // Google Routes failed, try segment-by-segment
  }

  // 2. Fallback: Segment-by-segment via getStreetRoute
  const segmentRoutes = await Promise.all(
    sampledCoords.slice(1).map(async (to, index) => {
      const from = sampledCoords[index];
      try {
        return await getStreetRoute(from, to);
      } catch {
        return straightLineRoute(from, to);
      }
    }),
  );

  const mergedCoordinates = mergePolylineSegments(
    segmentRoutes.map((segment) => segment?.coordinates || []),
  );
  if (mergedCoordinates.length > 1) {
    return {
      coordinates: mergedCoordinates,
      duration: segmentRoutes.reduce(
        (sum, segment) => sum + (segment?.duration || 0),
        0,
      ),
      distance: segmentRoutes.reduce(
        (sum, segment) => sum + (segment?.distance || 0),
        0,
      ),
    };
  }

  // 3. Last resort: straight line
  return straightLineRoute(sampledCoords[0], sampledCoords[sampledCoords.length - 1]);
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
    // Usar Google Routes API snap
    const snapped = await googleSnapPointToRoad(coords);
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
 * En lugar de líneas rectas, usa Google Routes API entre cada par consecutivo.
 * @param {[number, number][]} points Array de [lat, lng]
 * @returns {Promise<[number, number][]>}
 */
export async function buildRoadPathBetweenPoints(points) {
  const validPoints = (Array.isArray(points) ? points : []).filter(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  );
  if (validPoints.length < 2) return validPoints;

  const routed = await getStreetRouteThroughPoints(validPoints, {
    maxDistance: 60000 * Math.max(1, validPoints.length - 1),
  });
  return routed?.coordinates || validPoints;
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

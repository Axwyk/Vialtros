// Servicio de enrutamiento real por calles usando Valhalla (FOSSGIS) como primario
// y OSRM como fallback. Geocodificación con Nominatim (OpenStreetMap).

const VALHALLA_BASE = "https://valhalla1.openstreetmap.de";
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_MATCH_BASE = "https://router.project-osrm.org/match/v1/driving";
const OSRM_NEAREST_BASE = "https://router.project-osrm.org/nearest/v1/driving";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Buenaventura viewbox: minLng,minLat,maxLng,maxLat
const BVA_VIEWBOX = "-77.18,3.72,-76.85,4.02";
const BVA_CITY_SUFFIX = ", Buenaventura, Colombia";
const geocodeCache = new Map();
const routeCache = new Map();
const TRACK_MATCH_RADIUS_METERS = 50;
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

function buildMatchParams(points) {
  const radiuses = points
    .map(() => String(TRACK_MATCH_RADIUS_METERS))
    .join(";");
  const firstTimestampMs =
    points.find((point) => Number.isFinite(point.timestampMs))?.timestampMs ??
    null;
  const timestamps = points
    .map((point, index) => {
      if (
        Number.isFinite(firstTimestampMs) &&
        Number.isFinite(point.timestampMs)
      ) {
        return String(Math.max(1, Math.round(point.timestampMs / 1000)));
      }

      return String(1700000000 + index * TRACK_MATCH_GAP_SECONDS);
    })
    .join(";");
  const bearings = points
    .map((point, index) => {
      const previous = points[index - 1]?.coords;
      const next = points[index + 1]?.coords;
      const from = previous || point.coords;
      const to = next || previous;

      if (
        !Array.isArray(from) ||
        !Array.isArray(to) ||
        (from[0] === to[0] && from[1] === to[1])
      ) {
        return "";
      }

      const deltaLng = to[1] - from[1];
      const deltaLat = to[0] - from[0];
      const bearing =
        (Math.atan2(deltaLng, deltaLat) * (180 / Math.PI) + 360) % 360;
      const speed = point.speedKmh ?? 0;
      const range =
        speed >= 45
          ? 30
          : speed >= 30
            ? 45
            : speed >= 18
              ? 60
              : speed >= 8
                ? 90
                : TRACK_MAX_BEARING_RANGE;

      return `${Math.round(bearing)},${range}`;
    })
    .join(";");

  return { radiuses, timestamps, bearings };
}

function buildOsrmCoordinates(points) {
  return points.map(([lat, lng]) => `${lng},${lat}`).join(";");
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
  const maxRetries = 3;
  const serializedBody = JSON.stringify(body);

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serializedBody,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429) {
        // Rate limited — wait with exponential backoff before retrying
        const delay = Math.min(1500 * Math.pow(2, attempt), 8000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) return null;
      return response.json();
    } catch (err) {
      if (attempt >= maxRetries - 1) return null;
      // Brief pause before retry on network error
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  return null;
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
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

// Valhalla request serializer: prevents concurrent requests that trigger 429
let valhallaQueuePromise = Promise.resolve();
function enqueueValhallaRequest(fn) {
  const next = valhallaQueuePromise.then(() => fn()).catch(() => fn());
  valhallaQueuePromise = next.catch(() => {});
  return next;
}

// Persistent route cache in localStorage
const ROUTE_CACHE_LS_KEY = "vialtros_route_cache";
const ROUTE_CACHE_MAX_ENTRIES = 50;

function loadPersistentRouteCache() {
  try {
    const raw = localStorage.getItem(ROUTE_CACHE_LS_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (Array.isArray(entries)) {
      entries.forEach(([key, value]) => routeCache.set(key, value));
    }
  } catch {
    /* ignore corrupt cache */
  }
}

function savePersistentRouteCache() {
  try {
    const entries = Array.from(routeCache.entries())
      .filter(([, v]) => v && v.coordinates?.length > 1)
      .slice(-ROUTE_CACHE_MAX_ENTRIES);
    localStorage.setItem(ROUTE_CACHE_LS_KEY, JSON.stringify(entries));
  } catch {
    /* ignore storage quota errors */
  }
}

loadPersistentRouteCache();

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

// Primary routing via Valhalla (FOSSGIS) — serialized to avoid 429
async function valhallaRoute(from, to, timeoutMs = 15000) {
  // Check route cache first
  const cacheKey = `val|${from[0]},${from[1]}->${to[0]},${to[1]}`;
  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey);
    if (cached?.coordinates?.length > 1) return cached;
  }

  return enqueueValhallaRequest(async () => {
    const body = {
      locations: [
        { lat: from[0], lon: from[1] },
        { lat: to[0], lon: to[1] },
      ],
      costing: "auto",
      costing_options: VALHALLA_COSTING_OPTIONS,
      directions_options: { units: "km" },
      directions_type: "maneuvers",
    };

    const data = await fetchPostJson(`${VALHALLA_BASE}/route`, body, timeoutMs);
    if (!data?.trip?.legs?.[0]?.shape) return null;

    const leg = data.trip.legs[0];
    const coordinates = decodePolyline6(leg.shape);
    if (coordinates.length < 2) return null;

    // Extraer maniobras de Valhalla como pasos de navegación
    const steps = valhallaManeuversToSteps(leg.maneuvers || [], coordinates);

    const result = {
      coordinates,
      duration: leg.summary?.time || 0,
      distance: (leg.summary?.length || 0) * 1000, // km→m
      steps: steps.length > 0 ? steps : null,
    };

    routeCache.set(cacheKey, result);
    savePersistentRouteCache();
    return result;
  });
}

// Convierte tipos de maniobra Valhalla a modifier OSRM-compatible
function valhallaTypeToModifier(type) {
  // Valhalla maneuver types: https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
  switch (type) {
    case 2: return "right";       // StartRight
    case 3: return "left";        // StartLeft
    case 9: return "slight right"; // SlightRight
    case 10: return "right";      // Right
    case 11: return "sharp right"; // SharpRight
    case 12: return "uturn";      // UTurnRight
    case 13: return "uturn";      // UTurnLeft
    case 14: return "sharp left";  // SharpLeft
    case 15: return "left";       // Left
    case 16: return "slight left"; // SlightLeft
    case 4: case 5: case 6: return "arrive"; // Destination variants
    default: return "straight";
  }
}

function valhallaManeuversToSteps(maneuvers, coordinates) {
  return maneuvers
    .filter((m) => {
      // Excluir maniobrAs de inicio, destino y "continue straight" sin nombre
      if (m.type === 1 || m.type === 4 || m.type === 5 || m.type === 6) return false;
      if (m.type === 8 && !m.street_names?.length) return false; // Continue sin calle
      return true;
    })
    .map((m) => {
      const idx = m.begin_shape_index ?? 0;
      const point = coordinates[Math.min(idx, coordinates.length - 1)] || coordinates[0];
      const modifier = valhallaTypeToModifier(m.type);
      const streetName = (m.street_names || [])[0] || "";
      return {
        location: [point[0], point[1]],
        distance: (m.length || 0) * 1000, // km → m
        name: streetName,
        type: modifier === "arrive" ? "arrive" : "turn",
        modifier,
      };
    });
}

// Valhalla snap to nearest road — serialized
async function valhallaLocate(coords, timeoutMs = 8000) {
  return enqueueValhallaRequest(async () => {
    const body = {
      locations: [{ lat: coords[0], lon: coords[1] }],
      costing: "auto",
      costing_options: VALHALLA_COSTING_OPTIONS,
      verbose: false,
    };

    const data = await fetchPostJson(
      `${VALHALLA_BASE}/locate`,
      body,
      timeoutMs,
    );
    if (!Array.isArray(data) || data.length === 0) return null;

    const result = data[0];
    if (!result?.edges?.length) return null;

    const edge = result.edges[0];
    if (
      !Number.isFinite(edge.correlated_lat) ||
      !Number.isFinite(edge.correlated_lon)
    )
      return null;

    return sanitizeBuenaventuraCoords(
      [edge.correlated_lat, edge.correlated_lon],
      coords,
    );
  });
}

// Valhalla trace_route for map matching (GPS points → road path) — serialized
async function valhallaTraceRoute(points, timeoutMs = 12000) {
  if (!Array.isArray(points) || points.length < 2) return null;

  return enqueueValhallaRequest(async () => {
    const shape = points.map((p) => ({
      lat: Array.isArray(p) ? p[0] : p.latitude,
      lon: Array.isArray(p) ? p[1] : p.longitude,
    }));

    const body = {
      shape,
      costing: "auto",
      costing_options: VALHALLA_COSTING_OPTIONS,
      shape_match: "map_snap",
      search_radius: 150,
    };

    const data = await fetchPostJson(
      `${VALHALLA_BASE}/trace_route`,
      body,
      timeoutMs,
    );
    if (!data?.trip?.legs) return null;

    const allCoords = data.trip.legs.flatMap((leg) => {
      if (!leg.shape) return [];
      return decodePolyline6(leg.shape);
    });
    if (allCoords.length < 2) return null;

    const totalTime = data.trip.legs.reduce(
      (s, l) => s + (l.summary?.time || 0),
      0,
    );
    const totalDist = data.trip.legs.reduce(
      (s, l) => s + (l.summary?.length || 0),
      0,
    );
    return {
      coordinates: allCoords,
      duration: totalTime,
      distance: totalDist * 1000,
    };
  });
}

// Valhalla route with multiple waypoints — serialized
async function valhallaRouteWaypoints(waypoints, timeoutMs = 15000) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return null;

  return enqueueValhallaRequest(async () => {
    const body = {
      locations: waypoints.map((p) => ({
        lat: p[0],
        lon: p[1],
        type: "through",
      })),
      costing: "auto",
      costing_options: VALHALLA_COSTING_OPTIONS,
      directions_options: { units: "km" },
      directions_type: "maneuvers",
    };
    // First and last must be 'break'
    body.locations[0].type = "break";
    body.locations[body.locations.length - 1].type = "break";

    const data = await fetchPostJson(`${VALHALLA_BASE}/route`, body, timeoutMs);
    if (!data?.trip?.legs) return null;

    const allCoords = data.trip.legs.flatMap((leg) => {
      if (!leg.shape) return [];
      return decodePolyline6(leg.shape);
    });
    if (allCoords.length < 2) return null;

    const totalTime = data.trip.legs.reduce(
      (s, l) => s + (l.summary?.time || 0),
      0,
    );
    const totalDist = data.trip.legs.reduce(
      (s, l) => s + (l.summary?.length || 0),
      0,
    );
    const allSteps = data.trip.legs.flatMap((leg, legIdx) => {
      const legCoords = decodePolyline6(leg.shape || "");
      const offset = data.trip.legs.slice(0, legIdx).reduce(
        (s, l) => s + decodePolyline6(l.shape || "").length,
        0,
      );
      return valhallaManeuversToSteps(leg.maneuvers || [], legCoords).map((s) => ({
        ...s,
        _coordOffset: offset,
      }));
    });
    return {
      coordinates: allCoords,
      duration: totalTime,
      distance: totalDist * 1000,
      steps: allSteps.length > 0 ? allSteps : null,
    };
  });
}

function isUsableRoadRoute(route, maxDistance = 60000) {
  return Boolean(
    route?.geometry?.coordinates?.length > 1 && route?.distance < maxDistance,
  );
}

function toLatLngPolyline(route) {
  const steps = (route.legs || []).flatMap((leg) =>
    (leg.steps || []).map((step) => ({
      location: [step.maneuver.location[1], step.maneuver.location[0]],
      distance: step.distance,
      name: step.name || "",
      type: step.maneuver.type,
      modifier: step.maneuver.modifier || "straight",
    })).filter((s) => s.type !== "depart"),
  );
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    duration: route.duration,
    distance: route.distance,
    steps: steps.length > 0 ? steps : null,
  };
}

function trimAccessRoadLoops(coordinates, from, to) {
  const routePoints = (Array.isArray(coordinates) ? coordinates : []).filter(
    (point) => Array.isArray(point) && point.length === 2,
  );

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
    const score = distanceToDestination * 0.82 + distanceFromOrigin * 0.18;
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
    const score = distanceFromOrigin * 0.82 + distanceToDestination * 0.18;
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
  const cacheKey = `osrm|${coordinates}|${maxDistance}`;
  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey);
  }

  try {
    const data = await fetchJsonWithRetry(
      `${OSRM_BASE}/${coordinates}?overview=full&geometries=geojson&continue_straight=false&steps=true`,
      1,
    );
    if (
      data?.code === "Ok" &&
      Array.isArray(data.routes) &&
      data.routes.length > 0
    ) {
      const route = data.routes[0];
      if (isUsableRoadRoute(route, maxDistance)) {
        const resolved = toLatLngPolyline(route);
        routeCache.set(cacheKey, resolved);
        return resolved;
      }
    }
  } catch {
    // OSRM failed, try Valhalla for simple two-point trips.
  }

  if (Array.isArray(points) && points.length === 2) {
    try {
      const valResult = await valhallaRoute(points[0], points[1]);
      if (
        valResult?.coordinates?.length > 1 &&
        valResult.distance < maxDistance
      ) {
        const fallbackCacheKey = `val|${points[0].join(",")}->${points[1].join(",")}`;
        routeCache.set(cacheKey, valResult);
        routeCache.set(fallbackCacheKey, valResult);
        return valResult;
      }
    } catch {
      // Valhalla fallback failed.
    }
  }

  routeCache.set(cacheKey, null);
  return null;
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
  const shouldSnapWaypoints = options.snapWaypoints !== false;

  const snappedWaypoints = shouldSnapWaypoints
    ? dedupeConsecutivePoints(
        await Promise.all(
          validPoints.map(async (point) =>
            snapPointToRoad(point).catch(() => point),
          ),
        ),
      )
    : validPoints;

  const routeCacheKey = `route-through|${snappedWaypoints.map((point) => point.join(",")).join("->")}|${maxDistance}`;
  if (routeCache.has(routeCacheKey)) {
    const cached = routeCache.get(routeCacheKey);
    if (cached?.coordinates?.length > 1) {
      return {
        ...cached,
        coordinates: anchorRouteEndpoints(
          cached.coordinates,
          validPoints[0],
          validPoints[validPoints.length - 1],
        ),
      };
    }
  }

  const directRoute = await requestStreetRoute(
    snappedWaypoints,
    maxDistance,
  ).catch(() => null);
  if (directRoute?.coordinates?.length > 1) {
    const resolved = {
      ...directRoute,
      coordinates: anchorRouteEndpoints(
        trimAccessRoadLoops(
          directRoute.coordinates,
          validPoints[0],
          validPoints[validPoints.length - 1],
        ),
        validPoints[0],
        validPoints[validPoints.length - 1],
      ),
    };
    routeCache.set(routeCacheKey, resolved);
    return resolved;
  }

  const segmentRoutes = await Promise.all(
    snappedWaypoints.slice(1).map(async (to, index) => {
      const from = snappedWaypoints[index];
      const segment = await requestStreetRoute([from, to], 60000).catch(
        () => null,
      );
      if (segment?.coordinates?.length > 1) {
        return {
          ...segment,
          coordinates: anchorRouteEndpoints(
            segment.coordinates,
            validPoints[index],
            validPoints[index + 1],
          ),
        };
      }
      return straightLineRoute(validPoints[index], validPoints[index + 1]);
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
    routeCache.set(routeCacheKey, resolved);
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

  const routed = await getStreetRouteThroughPoints([safeFrom, safeTo], {
    maxDistance: 60000,
  });
  return routed || straightLineRoute(safeFrom, safeTo);
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
    const roadAnchoredPoints =
      snappedSampled.length > 1 ? snappedSampled : sampled;
    const sampledCoordinates = buildOsrmCoordinates(
      roadAnchoredPoints.map((point) => point.coords),
    );
    const { radiuses, timestamps } = buildMatchParams(roadAnchoredPoints);

    const matchUrl = `${OSRM_MATCH_BASE}/${sampledCoordinates}?geometries=geojson&overview=full&tidy=true&gaps=split&annotations=false&radiuses=${radiuses}&timestamps=${timestamps}`;
    const data = await fetchJson(matchUrl);
    if (
      data?.code === "Ok" &&
      Array.isArray(data.matchings) &&
      data.matchings.length > 0
    ) {
      const coordinates = mergePolylineSegments(
        data.matchings.map(
          (matching) =>
            matching.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) ||
            [],
        ),
      );
      if (coordinates.length > 1) {
        return {
          coordinates,
          duration: data.matchings.reduce(
            (sum, matching) => sum + (matching.duration || 0),
            0,
          ),
          distance: data.matchings.reduce(
            (sum, matching) => sum + (matching.distance || 0),
            0,
          ),
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
  const coordinates = mergePolylineSegments(
    segmentRoutes.map((segment) => segment?.coordinates || []),
  );
  if (coordinates.length > 1) {
    return {
      coordinates,
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

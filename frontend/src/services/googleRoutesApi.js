// Google Routes API - Reemplaza Valhalla/OSRM para mejor precisión
// Documentación: https://developers.google.com/maps/documentation/routes

const GOOGLE_ROUTES_API_KEY =
  process.env.REACT_APP_GOOGLE_ROUTES_API_KEY ||
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const GOOGLE_ROUTES_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";

// X-Goog-FieldMask es obligatorio en Routes API v2; sin el header la API devuelve 400
const FIELD_MASK_FULL =
  "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters," +
  "routes.legs.steps.startLocation,routes.legs.steps.navigationInstruction," +
  "routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration";
const FIELD_MASK_BASIC =
  "routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters";

// Cache para rutas
const routeCache = new Map();
const ROUTE_CACHE_LS_KEY = "google_routes_cache_v1";
const ROUTE_CACHE_MAX_ENTRIES = 200;

// Cargar caché persistente
function loadPersistentRouteCache() {
  try {
    const cached = localStorage.getItem(ROUTE_CACHE_LS_KEY);
    if (cached) {
      const entries = JSON.parse(cached);
      entries.forEach(([key, value]) => {
        routeCache.set(key, value);
      });
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

/**
 * Decodifica polyline comprimido (algoritmo Google)
 * @param {string} encoded 
 * @param {number} precision
 */
function decodePolyline(encoded, precision = 5) {
  const factor = Math.pow(10, precision);
  const coordinates = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let result = 0,
      shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

/**
 * Obtiene ruta con Google Routes API (mejor que Valhalla para ciudades)
 * @param {[number, number]} origin [lat, lng]
 * @param {[number, number]} destination [lat, lng]
 * @param {Object} options
 */
export async function getStreetRoute(origin, destination, options = {}) {
  if (!GOOGLE_ROUTES_API_KEY) {
    console.error(
      "Google Routes API key not configured. Set REACT_APP_GOOGLE_ROUTES_API_KEY"
    );
    return null;
  }

  if (!origin || !destination) return null;

  const cacheKey = `route|${origin[0]},${origin[1]}->${destination[0]},${destination[1]}`;
  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey);
    if (cached?.coordinates?.length > 1) return cached;
  }

  try {
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin[0],
            longitude: origin[1],
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination[0],
            longitude: destination[1],
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL", // Considera tráfico
      computeAlternativeRoutes: false,
      languageCode: "es",
      units: "METRIC",
    };

    const response = await fetch(GOOGLE_ROUTES_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK_FULL,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Google Routes API error: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      console.warn("No routes found from Google Routes API");
      return null;
    }

    const route = data.routes[0];
    if (!route.polyline) {
      return null;
    }

    // Decodificar polyline
    const coordinates = decodePolyline(route.polyline.encodedPolyline, 5);

    // Extraer pasos para instrucciones turn-by-turn
    const legs = route.legs || [];
    const steps = [];

    legs.forEach((leg) => {
      (leg.steps || []).forEach((step) => {
        const startLocation = step.startLocation?.latLng;
        if (startLocation && step.navigationInstruction) {
          steps.push({
            location: [startLocation.latitude, startLocation.longitude],
            instruction: step.navigationInstruction.instructions,
            distance: step.distanceMeters || 0,
            duration: step.staticDuration?.seconds * 1000 || 0, // A ms
          });
        }
      });
    });

    const result = {
      coordinates,
      duration: route.duration?.seconds * 1000 || 0, // A ms
      distance: route.distanceMeters || 0,
      steps: steps.length > 0 ? steps : null,
      trafficAware: true,
    };

    routeCache.set(cacheKey, result);
    savePersistentRouteCache();

    return result;
  } catch (error) {
    console.error("Error getting route from Google Routes API:", error);
    return null;
  }
}

/**
 * Ruta a través de múltiples puntos (waypoints)
 * Útil para rutas con paradas intermedias
 * @param {[number, number][]} waypoints
 * @param {Object} options
 */
export async function getStreetRouteThroughPoints(waypoints, options = {}) {
  if (!GOOGLE_ROUTES_API_KEY || !Array.isArray(waypoints) || waypoints.length < 2) {
    return null;
  }

  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, -1);

  const cacheKey = `multi-route|${waypoints.map((w) => w.join(",")).join("->")}`;
  if (routeCache.has(cacheKey)) {
    const cached = routeCache.get(cacheKey);
    if (cached?.coordinates?.length > 1) return cached;
  }

  try {
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin[0],
            longitude: origin[1],
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination[0],
            longitude: destination[1],
          },
        },
      },
      intermediates: intermediates.map((waypoint) => ({
        location: {
          latLng: {
            latitude: waypoint[0],
            longitude: waypoint[1],
          },
        },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      languageCode: "es",
      units: "METRIC",
    };

    const response = await fetch(GOOGLE_ROUTES_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": FIELD_MASK_BASIC,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Google Routes API error: ${response.status} ${errBody}`);
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    if (!route.polyline) {
      return null;
    }

    const coordinates = decodePolyline(route.polyline.encodedPolyline, 5);

    const result = {
      coordinates,
      duration: route.duration?.seconds * 1000 || 0,
      distance: route.distanceMeters || 0,
      trafficAware: true,
    };

    routeCache.set(cacheKey, result);
    savePersistentRouteCache();

    return result;
  } catch (error) {
    console.error("Error getting multi-waypoint route from Google Routes API:", error);
    return null;
  }
}

/**
 * Ajusta punto GPS a la vía más cercana (SNAP)
 * Usa Google Roads API (snapToRoads)
 * @param {[number, number]} coords [lat, lng]
 */
export async function snapPointToRoad(coords) {
  if (!coords || !Array.isArray(coords) || coords.length !== 2) return coords;
  
  // Por ahora, retorna las coordenadas sin cambios
  // Para implementar: usar Google Roads API (roadSnapping endpoint)
  // Requiere habilitación adicional en Google Cloud
  return coords;
}

export function clearCache() {
  routeCache.clear();
  localStorage.removeItem(ROUTE_CACHE_LS_KEY);
}

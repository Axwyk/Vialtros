import React, { useEffect, useMemo, useState, useRef } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import "./tracking-map.css";
import MapViewLegacy from "./MapView";

const DEFAULT_CENTER = {
  longitude: -77.02824,
  latitude: 3.89243,
  zoom: 13,
  pitch: 0,
};

// Capa de ruta con estilo Uber: azul marino oscuro con patrón de guiones
const routeLineLayer = {
  id: "route-line",
  type: "line",
  paint: {
    "line-color": "#2E63D8",
    "line-width": 6,
    "line-opacity": 0.98,
    "line-dasharray": [3, 3],
    "line-blur": 0.5,
  },
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
};

function normalizeRouteCoordinates(routeCoordinates = []) {
  return routeCoordinates
    .map((point) => {
      if (Array.isArray(point) && point.length === 2) {
        const first = Number(point[0]);
        const second = Number(point[1]);

        if (!Number.isFinite(first) || !Number.isFinite(second)) {
          return null;
        }

        // Soporta [lng, lat] (GeoJSON) y [lat, lng] desde APIs heredadas.
        return Math.abs(first) > 90 ? [first, second] : [second, first];
      }

      if (point && typeof point === "object") {
        const lat = Number(point.lat ?? point.latitude);
        const lng = Number(point.lng ?? point.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lng, lat];
        }
      }

      return null;
    })
    .filter(Boolean);
}

function resolveMapboxToken() {
  return (
    process.env.REACT_APP_MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || ""
  );
}

export default function TrackingMap({
  vehiclePosition = null,
  routeCoordinates = [],
  mapStyle = null,
  height = "560px",
}) {
  const [viewState, setViewState] = useState(DEFAULT_CENTER);
  const mapboxToken = resolveMapboxToken();

  // POIs (puntos de interés) cercanos obtenidos desde Overpass (OpenStreetMap)
  const [pois, setPois] = useState([]);
  const poisTimerRef = useRef(null);

  const samplePois = [
    { id: "s1", lat: viewState.latitude + 0.002, lon: viewState.longitude + 0.002, tags: { name: "Universidad Demo", amenity: "university" } },
    { id: "s2", lat: viewState.latitude - 0.0015, lon: viewState.longitude - 0.0015, tags: { name: "Hospital Demo", amenity: "hospital" } },
    { id: "s3", lat: viewState.latitude + 0.0018, lon: viewState.longitude - 0.0018, tags: { name: "Parque Demo", leisure: "park" } },
    { id: "s4", lat: viewState.latitude - 0.0022, lon: viewState.longitude + 0.0012, tags: { name: "Gasolinera Demo", amenity: "fuel" } },
  ];

  function injectSamplePois() {
    setPois(samplePois);
    console.debug("Injected sample POIs", samplePois);
  }

  // Resuelve el estilo: Mapbox si hay token, sino usa OpenStreetMap gratuito
  const resolvedStyle =
    mapboxToken && mapStyle
      ? mapStyle
      : "https://basemaps.cartocdn.com/gl/positron-nolabels/style.json";

  const normalizedRoute = useMemo(
    () => normalizeRouteCoordinates(routeCoordinates),
    [routeCoordinates],
  );

  // Distancia de ruta (normalizedRoute tiene [lng,lat]) → convertimos a [lat,lng]
  function lineDistanceKmLngLat(line = []) {
    if (!Array.isArray(line) || line.length < 2) return 0;
    const toRad = (v) => (v * Math.PI) / 180;
    const earthKm = 6371;
    let total = 0;
    for (let i = 1; i < line.length; i += 1) {
      const prev = line[i - 1];
      const cur = line[i];
      if (!prev || !cur) continue;
      const lat1 = Number(prev[1]);
      const lng1 = Number(prev[0]);
      const lat2 = Number(cur[1]);
      const lng2 = Number(cur[0]);
      if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) continue;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      total += earthKm * c;
    }
    return total;
  }

  const plannedKm = Math.round((normalizedRoute?.length > 1 ? lineDistanceKmLngLat(normalizedRoute) : 0) * 10) / 10;
  // Si tenemos posición del vehículo y ruta, estimamos km recorridos proyectando
  function computeTraveledKmFromVehicle(route = [], lat, lng) {
    if (!Array.isArray(route) || route.length < 2) return 0;
    // Convert route to [lat,lng]
    const toLatLng = (p) => [Number(p[1]), Number(p[0])];
    const toRad = (v) => (v * Math.PI) / 180;
    const earthKm = 6371;

    // Haversine distance
    const dist = (a, b) => {
      const dLat = toRad(b[0] - a[0]);
      const dLon = toRad(b[1] - a[1]);
      const A =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 2 * earthKm * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
    };

    // Find closest projection point along route
    let best = { index: -1, t: 0, sq: Infinity };
    for (let i = 0; i < route.length - 1; i += 1) {
      const a = toLatLng(route[i]);
      const b = toLatLng(route[i + 1]);
      const vx = b[0] - a[0];
      const vy = b[1] - a[1];
      const wx = lat - a[0];
      const wy = lng - a[1];
      const len2 = vx * vx + vy * vy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
      const proj = [a[0] + vx * t, a[1] + vy * t];
      const dx = lat - proj[0];
      const dy = lng - proj[1];
      const sq = dx * dx + dy * dy;
      if (sq < best.sq) best = { index: i, t, sq };
    }

    if (best.index < 0) return 0;

    // Sum distances up to projected point
    let acc = 0;
    for (let i = 0; i < best.index; i += 1) {
      const p1 = toLatLng(route[i]);
      const p2 = toLatLng(route[i + 1]);
      acc += dist(p1, p2);
    }
    // add partial segment
    const segA = toLatLng(route[best.index]);
    const segB = toLatLng(route[best.index + 1]);
    const projPoint = [segA[0] + (segB[0] - segA[0]) * best.t, segA[1] + (segB[1] - segA[1]) * best.t];
    acc += dist(segA, projPoint);
    return Math.round(acc * 10) / 10;
  }


  const routeGeoJson = useMemo(
    () => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: normalizedRoute,
      },
    }),
    [normalizedRoute],
  );

  const vehicleLat = Number(vehiclePosition?.lat ?? vehiclePosition?.latitude);
  const vehicleLng = Number(vehiclePosition?.lng ?? vehiclePosition?.longitude);
  const hasVehicle = Number.isFinite(vehicleLat) && Number.isFinite(vehicleLng);

  const traveledKm = hasVehicle ? computeTraveledKmFromVehicle(normalizedRoute, vehicleLat, vehicleLng) : 0;
  const pendingKm = Math.round(Math.max(0, plannedKm - traveledKm) * 10) / 10;

  useEffect(() => {
    if (!hasVehicle) return;

    setViewState((prev) => ({
      ...prev,
      latitude: vehicleLat,
      longitude: vehicleLng,
    }));
  }, [hasVehicle, vehicleLat, vehicleLng]);

  // Convierte el zoom en un radio aproximado (metros) para la consulta POI
  function zoomToRadius(zoom) {
    // heurística simple: a menor zoom, mayor radio
    const base = 2000; // metros en zoom ~13
    return Math.max(600, Math.round(base * Math.pow(2, 13 - (zoom || 13)) / 4));
  }

  // Consulta Overpass API por amenidades relevantes alrededor de un punto
  async function fetchPOIs(lat, lng, radiusMeters = 2000) {
    try {
      // Overpass QL: buscamos nodos con tags útiles
      const q = `[out:json][timeout:25];(
  node(around:${radiusMeters},${lat},${lng})[amenity=school];
  node(around:${radiusMeters},${lat},${lng})[amenity=university];
  node(around:${radiusMeters},${lat},${lng})[amenity=hospital];
  node(around:${radiusMeters},${lat},${lng})[amenity=fuel];
  node(around:${radiusMeters},${lat},${lng})[shop~"mall|supermarket|department_store|mall"];
  node(around:${radiusMeters},${lat},${lng})[leisure=park];
);
out center;`;

      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
        q,
      )}`;

      const res = await fetch(url);
      console.debug("Overpass request:", url);
      if (!res.ok) {
        console.warn("Overpass response not ok", res.status, res.statusText);
        return;
      }
      const data = await res.json();

      const parsed = (data.elements || []).map((el) => ({
        id: el.id,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        tags: el.tags || {},
      }));

      setPois(parsed);
      console.debug("Fetched POIs:", parsed.length, parsed.slice(0, 6));
    } catch (err) {
      // Silencioso: no bloquear la experiencia por fallos en Overpass
      console.warn("Error fetching POIs:", err);
    }
  }

  // Debounce: recarga POIs cuando cambia la vista (centro/zoom)
  useEffect(() => {
    if (!viewState || !viewState.latitude || !viewState.longitude) return;
    if (poisTimerRef.current) clearTimeout(poisTimerRef.current);

    poisTimerRef.current = setTimeout(() => {
      const radius = zoomToRadius(viewState.zoom);
      fetchPOIs(viewState.latitude, viewState.longitude, radius);
    }, 600);

    return () => {
      if (poisTimerRef.current) clearTimeout(poisTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState.latitude, viewState.longitude, viewState.zoom]);

  // Elige un icono (emoji) según los tags del OSM element
  function getPoiIcon(tags = {}) {
    const amenity = (tags.amenity || "").toLowerCase();
    const shop = (tags.shop || "").toLowerCase();
    const leisure = (tags.leisure || "").toLowerCase();

    if (amenity === "university") return "🎓";
    if (amenity === "school") return "🏫";
    if (amenity === "hospital") return "🏥";
    if (amenity === "fuel") return "⛽";
    if (leisure === "park") return "🌳";
    if (shop && /mall|supermarket|department_store/.test(shop)) return "🛍️";

    // fallback: pin genérico
    return "📍";
  }

  if (!mapboxToken) {
    // Fallback a Leaflet cuando no hay token Mapbox disponible
    const trackingsData = vehiclePosition
      ? [
          {
            latitude: vehiclePosition.lat ?? vehiclePosition.latitude,
            longitude: vehiclePosition.lng ?? vehiclePosition.longitude,
          },
        ]
      : [];

    return (
      <MapViewLegacy
        trackings={trackingsData}
        routePolyline={routeCoordinates}
        mapHeight={height}
        pois={pois}
      />
    );
  }

  return (
    <div
      style={{
        height,
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        position: "relative",
      }}
      className="tracking-map-container"
    >
      <Map
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={resolvedStyle}
        mapboxAccessToken={mapboxToken}
        attributionControl={false}
      >
        {/* Controles de navegación */}
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        {normalizedRoute.length > 1 && (
          <Source id="tracking-route" type="geojson" data={routeGeoJson}>
            <Layer {...routeLineLayer} />
          </Source>
        )}

        {hasVehicle && (
          <Marker longitude={vehicleLng} latitude={vehicleLat} anchor="center">
            <div className="vehicle-marker" title="Vehículo en movimiento">
              <div className="vehicle-marker-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="1" y="4" width="16" height="12" rx="2" />
                  <path d="M17 8h3l3 4v4h-6V8z" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
            </div>
          </Marker>
        )}

        {normalizedRoute.length > 0 && normalizedRoute[0] && (
          <Marker
            longitude={normalizedRoute[0][1]}
            latitude={normalizedRoute[0][0]}
            anchor="center"
          >
            <div className="location-marker origin" title="Origen">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="white"
                strokeWidth="1"
              >
                <circle cx="12" cy="12" r="8" />
              </svg>
            </div>
          </Marker>
        )}

        {normalizedRoute.length > 0 &&
          normalizedRoute[normalizedRoute.length - 1] && (
            <Marker
              longitude={normalizedRoute[normalizedRoute.length - 1][1]}
              latitude={normalizedRoute[normalizedRoute.length - 1][0]}
              anchor="center"
            >
              <div className="location-marker destination" title="Destino">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z" />
                </svg>
              </div>
            </Marker>
          )}

        {/* Marcadores POI (Overpass / OSM) */}
        {pois.map((p) =>
          p.lat && p.lon ? (
            <Marker
              key={`poi-${p.id}`}
              longitude={Number(p.lon)}
              latitude={Number(p.lat)}
              anchor="center"
            >
              <div
                className="poi-marker"
                title={p.tags.name || p.tags.amenity || p.tags.shop || "POI"}
                aria-label={p.tags.name || "POI"}
                style={{ fontSize: 18, transform: "translateY(-6px)" }}
              >
                <span>{getPoiIcon(p.tags)}</span>
              </div>
            </Marker>
          ) : null,
        )}
      </Map>
      {/* Panel de métricas (Mapbox) */}
      <div className="route-metrics-panel">
        <div className="route-metrics-grid">
          <div className="route-metric-tile">
            <span className="route-metric-label">Planif.</span>
            <span className="route-metric-value">{plannedKm} km</span>
          </div>
          <div className="route-metric-tile">
            <span className="route-metric-label">Recorr.</span>
            <span className="route-metric-value">{traveledKm} km</span>
          </div>
          <div className="route-metric-tile">
            <span className="route-metric-label">Pend.</span>
            <span className="route-metric-value">{pendingKm} km</span>
          </div>
        </div>
      </div>
      {/* Leyenda en esquina inferior izquierda */}
      <div className="map-legend">
        <div className="legend-title">Leyenda</div>
        <div className="legend-item">
          <div className="legend-marker vehicle-dot"></div>
          <span>Vehículo</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker origin-dot"></div>
          <span>Origen</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker destination-dot"></div>
          <span>Destino</span>
        </div>
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Ruta</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker">🎓</div>
          <span>Universidad</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker">🏥</div>
          <span>Hospital</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker">⛽</div>
          <span>Bomba de gasolina</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker">🌳</div>
          <span>Parque</span>
        </div>
        <div className="legend-item">
          <div className="legend-marker">🛍️</div>
          <span>Centro comercial</span>
        </div>
      </div>
        {/* Botón de depuración: inyectar POIs de prueba */}
        <button className="poi-debug-btn" onClick={injectSamplePois}>
          Inyectar POIs de prueba
        </button>
      {normalizedRoute.length > 0 &&
        normalizedRoute[normalizedRoute.length - 1] && (
          <div
            className="tracking-map-label destination"
            style={{
              left: `calc(50% + ${(normalizedRoute[normalizedRoute.length - 1][1] - viewState.longitude) * Math.pow(2, viewState.zoom) * 0.038}px)`,
              top: `calc(50% - ${(normalizedRoute[normalizedRoute.length - 1][0] - viewState.latitude) * Math.pow(2, viewState.zoom) * 0.038}px)`,
            }}
          >
            Destino
          </div>
        )}
    </div>
  );
}

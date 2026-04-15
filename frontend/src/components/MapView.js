// Mapa en tiempo real con estilo limpio tipo navegacion
import { useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import "./leaflet-fixes.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const originIcon = L.divIcon({
  className: "",
  html: `
    <div class="vt-route-point vt-route-point-start"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const destinationIcon = L.divIcon({
  className: "",
  html: `
    <div class="vt-route-point vt-route-point-end"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function createIntermediateStopIcon(index) {
  return L.divIcon({
    className: "",
    html: `
      <div class="vt-route-stop-marker">
        <span class="vt-route-stop-ring"></span>
        <span class="vt-route-stop-core">${safeText(index)}</span>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const BUENAVENTURA_CENTER = [3.89243, -77.02824];
const BUENAVENTURA_MAX_BOUNDS = [
  [3.84, -77.09],
  [3.93, -76.99],
];
const CORPORATE_ROUTE_COLOR = "#0A2B3D";
const CORPORATE_ROUTE_HALO = "#dbeafe";

function projectPointOnSegment(point, start, end) {
  const startX = start[1];
  const startY = start[0];
  const endX = end[1];
  const endY = end[0];
  const pointX = point[1];
  const pointY = point[0];
  const dx = endX - startX;
  const dy = endY - startY;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    const distSquared = (pointX - startX) ** 2 + (pointY - startY) ** 2;
    return { t: 0, distanceSquared: distSquared };
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((pointX - startX) * dx + (pointY - startY) * dy) / segmentLengthSquared,
    ),
  );
  const projectedX = startX + dx * t;
  const projectedY = startY + dy * t;
  const distanceSquared =
    (pointX - projectedX) ** 2 + (pointY - projectedY) ** 2;

  return { t, distanceSquared };
}

function getSegmentRotation(start, end) {
  const deltaLat = end[0] - start[0];
  const deltaLng = end[1] - start[1];
  if (
    !Number.isFinite(deltaLat) ||
    !Number.isFinite(deltaLng) ||
    (deltaLat === 0 && deltaLng === 0)
  ) {
    return 0;
  }
  return Math.atan2(-deltaLat, deltaLng) * (180 / Math.PI);
}

function getVehicleRotation(line, vehiclePoint) {
  if (!Array.isArray(line) || line.length < 2) return 0;

  if (!Array.isArray(vehiclePoint) || vehiclePoint.length !== 2) {
    return getSegmentRotation(line[line.length - 2], line[line.length - 1]);
  }

  let closestSegmentIndex = 0;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index];
    const end = line[index + 1];
    if (!start || !end) continue;

    const { distanceSquared } = projectPointOnSegment(vehiclePoint, start, end);
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestSegmentIndex = index;
    }
  }

  return getSegmentRotation(
    line[closestSegmentIndex],
    line[closestSegmentIndex + 1],
  );
}

function distanceBetweenPoints(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;
  const deltaLat = to[0] - from[0];
  const deltaLng = to[1] - from[1];
  return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng);
}

function interpolatePoint(from, to, progress) {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ];
}

function buildAnimationPath(
  targetPoint,
  traveledLine,
  previousPoint,
  previousLineLength,
) {
  if (Array.isArray(traveledLine) && traveledLine.length > 1) {
    const startIndex =
      previousLineLength > 1 ? Math.max(previousLineLength - 1, 0) : 0;
    const nextPath = traveledLine.slice(startIndex);
    if (Array.isArray(previousPoint) && nextPath.length > 0) {
      if (distanceBetweenPoints(previousPoint, nextPath[0]) > 0.00001) {
        return [previousPoint, ...nextPath];
      }
    }
    return nextPath;
  }

  if (Array.isArray(previousPoint) && Array.isArray(targetPoint)) {
    return [previousPoint, targetPoint];
  }

  return Array.isArray(targetPoint) ? [targetPoint] : [];
}

function totalPathDistance(path) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceBetweenPoints(path[index - 1], path[index]);
  }
  return total;
}

function getPointAtDistance(path, distance) {
  if (path.length === 0) return null;
  if (path.length === 1 || distance <= 0) return path[0];

  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentDistance = distanceBetweenPoints(start, end);

    if (traversed + segmentDistance >= distance) {
      const localProgress =
        segmentDistance === 0 ? 1 : (distance - traversed) / segmentDistance;
      return interpolatePoint(start, end, localProgress);
    }

    traversed += segmentDistance;
  }

  return path[path.length - 1];
}

function createVehicleIcon(label, status = "Detenido", rotation = 0) {
  const safeLabel = safeText(label || "Vehiculo");
  const normalizedStatus = status === "En ruta" ? "moving" : "idle";
  const safeRotation = Number.isFinite(rotation) ? rotation : 0;
  return L.divIcon({
    className: "",
    html: `
      <div class="vt-vehicle-chip vt-vehicle-chip-${normalizedStatus}">
        <span class="vt-vehicle-icon" aria-hidden="true" style="transform: rotate(${safeRotation}deg);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="16" height="12" rx="2"></rect>
            <path d="M17 8h3l3 4v4h-6V8z"></path>
            <circle cx="5.5" cy="18.5" r="2.2"></circle>
            <circle cx="18.5" cy="18.5" r="2.2"></circle>
          </svg>
        </span>
        <span class="vt-vehicle-text">${safeLabel}</span>
      </div>`,
    iconSize: [132, 36],
    iconAnchor: [66, 18],
  });
}

function getPoiEmoji(tags = {}) {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();

  if (amenity === "university") return "🎓";
  if (amenity === "school") return "🏫";
  if (amenity === "hospital") return "🏥";
  if (amenity === "fuel") return "⛽";
  if (leisure === "park") return "🌳";
  if (shop && /mall|supermarket|department_store/.test(shop)) return "🛍️";

  return "📍";
}

function safeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createRouteLabelIcon(label, variant) {
  const safeLabel = safeText(
    label || (variant === "start" ? "Origen" : "Destino"),
  );
  return L.divIcon({
    className: "",
    html: `
      <div class="vt-route-chip vt-route-chip-${variant}">
        <span class="vt-route-chip-text">${safeLabel}</span>
        <span class="vt-route-chip-arrow">›</span>
      </div>`,
    iconSize: [220, 52],
    iconAnchor: variant === "start" ? [10, 46] : [210, 46],
  });
}

function FitBounds({ coordinates, freezeAfterFirstFit = false }) {
  const map = useMap();
  const lastLengthRef = useRef(-1);
  const fittedOnceRef = useRef(false);

  useEffect(() => {
    if (!coordinates?.length) return;
    if (freezeAfterFirstFit && fittedOnceRef.current) return;
    if (coordinates.length === lastLengthRef.current) return;
    lastLengthRef.current = coordinates.length;

    const valid = coordinates.filter(
      (c) => c && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (!valid.length) return;

    if (valid.length === 1) {
      map.setView(valid[0], 15, { animate: false });
      fittedOnceRef.current = true;
      return;
    }

    const bounds = L.latLngBounds(valid);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [80, 80], animate: false, maxZoom: 16 });
      fittedOnceRef.current = true;
    }
  }, [map, coordinates, freezeAfterFirstFit]);

  return null;
}

function AutoFollowVehicle({ vehiclePoint, enabled = true }) {
  const map = useMap();
  const firstFollowRef = useRef(true);

  useEffect(() => {
    if (!enabled || !vehiclePoint) return;

    const [lat, lng] = vehiclePoint;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (firstFollowRef.current) {
      firstFollowRef.current = false;
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: false });
      return;
    }

    map.panTo([lat, lng], {
      animate: true,
      duration: 1.1,
      easeLinearity: 0.22,
    });

    if (map.getZoom() < 17) {
      map.setZoom(17, { animate: true });
    }
  }, [map, vehiclePoint, enabled]);

  return null;
}

/**
 * @param {Object[]}          trackings         Puntos de tracking del bus.
 * @param {[number,number][]} routePolyline     Coordenadas de la ruta por calles.
 * @param {[number,number]}   originCoords      [lat,lng] del origen.
 * @param {[number,number]}   destinationCoords [lat,lng] del destino.
 * @param {Object[]}          intermediateStops Paradas intermedias con coords.
 * @param {string}            originName        Nombre legible del origen.
 * @param {string}            destinationName   Nombre legible del destino.
 * @param {string}            mapHeight         Altura CSS del mapa (default "560px").
 */
export default function MapView({
  trackings = [],
  routePolyline = null,
  // ETA props: minutos estimados y timestamp de actualización
  eta = null,
  etaUpdated = null,
  plannedRoutePolyline = null,
  remainingRoutePolyline = null,
  traveledRoutePolyline = null,
  originCoords = null,
  destinationCoords = null,
  intermediateStops = [],
  originName = null,
  destinationName = null,
  activeVehicles = [],
  vehiclePosition = null,
  userCoords = null,
  mapHeight = "560px",
  focusAllVehicles = false,
  routeOverlays = [],
  highlightedRouteIds = [],
  pois = [],
}) {
  const [displayPois, setDisplayPois] = useState(Array.isArray(pois) ? pois : []);

  useEffect(() => {
    setDisplayPois(Array.isArray(pois) ? pois : []);
  }, [pois]);
  const [animatedVehiclePoint, setAnimatedVehiclePoint] = useState(null);
  const animationFrameRef = useRef(null);
  const animationStartRef = useRef(0);
  const previousAnimatedPointRef = useRef(null);
  const previousTraveledLineLengthRef = useRef(0);

  const validPoints = useMemo(
    () =>
      trackings
        .map((t) => [Number(t.latitude), Number(t.longitude)])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)),
    [trackings],
  );
  const latestPoint = useMemo(
    () => (validPoints.length > 0 ? validPoints[validPoints.length - 1] : null),
    [validPoints],
  );
  const center = useMemo(
    () =>
      focusAllVehicles
        ? BUENAVENTURA_CENTER
        : latestPoint ||
          originCoords ||
          destinationCoords ||
          userCoords ||
          BUENAVENTURA_CENTER,
    [
      focusAllVehicles,
      latestPoint,
      originCoords,
      destinationCoords,
      userCoords,
    ],
  );
  const samplePois = [
    { id: "s1", lat: center[0] + 0.002, lon: center[1] + 0.002, tags: { name: "Universidad Demo", amenity: "university" } },
    { id: "s2", lat: center[0] - 0.0015, lon: center[1] - 0.0015, tags: { name: "Hospital Demo", amenity: "hospital" } },
    { id: "s3", lat: center[0] + 0.0018, lon: center[1] - 0.0018, tags: { name: "Parque Demo", leisure: "park" } },
    { id: "s4", lat: center[0] - 0.0022, lon: center[1] + 0.0012, tags: { name: "Gasolinera Demo", amenity: "fuel" } },
  ];

  function injectSamplePois() {
    setDisplayPois(samplePois);
    console.debug("MapView injected sample POIs", samplePois);
  }
  const poisTimerRef = useRef(null);
  const [mapRef, setMapRef] = useState(null);

  function zoomToRadius(zoom) {
    const base = 2000; // meters around zoom ~13
    return Math.max(600, Math.round(base * Math.pow(2, 13 - (zoom || 13)) / 4));
  }

  async function fetchPOIs(lat, lng, radiusMeters = 2000) {
    try {
      const q = `[out:json][timeout:25];(
  node(around:${radiusMeters},${lat},${lng})[amenity=school];
  node(around:${radiusMeters},${lat},${lng})[amenity=university];
  node(around:${radiusMeters},${lat},${lng})[amenity=hospital];
  node(around:${radiusMeters},${lat},${lng})[amenity=fuel];
  node(around:${radiusMeters},${lat},${lng})[shop~"mall|supermarket|department_store|mall"];
  node(around:${radiusMeters},${lat},${lng})[leisure=park];
);
out center;`;

      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`;
      console.debug("MapView fetchPOIs url:", url);
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const parsed = (data.elements || []).map((el) => ({
        id: el.id,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        tags: el.tags || {},
      }));
      console.debug("MapView fetchPOIs parsed:", parsed.length, parsed.slice(0, 6));
      setDisplayPois(parsed);
      console.debug("MapView fetched POIs:", parsed.length);
    } catch (err) {
      console.warn("MapView error fetching POIs:", err);
    }
  }

  // NOTE: POI fetch effect moved below after `vehiclePoint` declaration
  const startLabelIcon = useMemo(
    () => createRouteLabelIcon(originName || "Origen", "start"),
    [originName],
  );
  const endLabelIcon = useMemo(
    () => createRouteLabelIcon(destinationName || "Destino", "end"),
    [destinationName],
  );

  const plannedLine =
    plannedRoutePolyline?.length > 1
      ? plannedRoutePolyline
      : routePolyline?.length > 1
        ? routePolyline
        : null;
  const remainingLine =
    remainingRoutePolyline?.length > 1 ? remainingRoutePolyline : null;
  const traveledLine =
    traveledRoutePolyline?.length > 1 ? traveledRoutePolyline : null;
  const normalizedRouteOverlays = useMemo(
    () =>
      (Array.isArray(routeOverlays) ? routeOverlays : [])
        .map((overlay) => ({
          ...overlay,
          polyline: Array.isArray(overlay?.polyline)
            ? overlay.polyline.filter(
                (point) =>
                  Array.isArray(point) &&
                  Number.isFinite(point[0]) &&
                  Number.isFinite(point[1]),
              )
            : [],
        }))
        .filter((overlay) => overlay.polyline.length > 1),
    [routeOverlays],
  );
  const normalizedIntermediateStops = useMemo(
    () =>
      (Array.isArray(intermediateStops) ? intermediateStops : [])
        .map((stop, index) => {
          const coords = Array.isArray(stop?.coords)
            ? stop.coords
            : [Number(stop?.latitude), Number(stop?.longitude)];
          if (
            !Array.isArray(coords) ||
            !Number.isFinite(coords[0]) ||
            !Number.isFinite(coords[1])
          )
            return null;

          return {
            id: stop?.id ?? `${index}-${coords.join(",")}`,
            label: stop?.label || `Parada ${index + 1}`,
            address: stop?.address || stop?.label || `Parada ${index + 1}`,
            coords,
            order: index + 1,
          };
        })
        .filter(Boolean),
    [intermediateStops],
  );
  const highlightedRouteIdSet = useMemo(
    () =>
      new Set(
        (Array.isArray(highlightedRouteIds) ? highlightedRouteIds : [])
          .map((routeId) => Number(routeId))
          .filter(Number.isFinite),
      ),
    [highlightedRouteIds],
  );
  const activeVehicleCoords = useMemo(
    () =>
      activeVehicles
        .filter(
          (vehicle) =>
            Number.isFinite(vehicle.latitude) &&
            Number.isFinite(vehicle.longitude),
        )
        .map((vehicle) => [
          Number(vehicle.latitude),
          Number(vehicle.longitude),
        ]),
    [activeVehicles],
  );
  const routeOverlayCoords = normalizedRouteOverlays.flatMap(
    (overlay) => overlay.polyline,
  );

  const fitCoords = useMemo(
    () =>
      focusAllVehicles
        ? [
            ...activeVehicleCoords,
            ...routeOverlayCoords,
            BUENAVENTURA_MAX_BOUNDS[0],
            BUENAVENTURA_MAX_BOUNDS[1],
          ]
        : plannedLine?.length > 1
          ? plannedLine
          : traveledLine?.length > 1
            ? traveledLine
            : [
                ...[originCoords, destinationCoords].filter(Boolean),
                ...normalizedIntermediateStops.map((stop) => stop.coords),
                ...[userCoords].filter(Boolean),
                ...activeVehicleCoords,
              ],
    [
      focusAllVehicles,
      activeVehicleCoords,
      routeOverlayCoords,
      plannedLine,
      traveledLine,
      originCoords,
      destinationCoords,
      normalizedIntermediateStops,
      userCoords,
    ],
  );

  const vehiclePoint = useMemo(() => {
    if (
      Number.isFinite(vehiclePosition?.latitude) &&
      Number.isFinite(vehiclePosition?.longitude)
    ) {
      return [
        Number(vehiclePosition.latitude),
        Number(vehiclePosition.longitude),
      ];
    }

    return latestPoint;
  }, [latestPoint, vehiclePosition?.latitude, vehiclePosition?.longitude]);
  const effectiveVehiclePoint = useMemo(
    () => animatedVehiclePoint || vehiclePoint,
    [animatedVehiclePoint, vehiclePoint],
  );

  // Debounce POI fetch when vehicle or map changes
  useEffect(() => {
    const coords = Array.isArray(vehiclePoint) ? vehiclePoint : null;
    const mapZoom = mapRef?.getZoom ? mapRef.getZoom() : 13;
    if (!coords) return undefined;
    const radius = zoomToRadius(mapZoom);
    console.debug("MapView POI effect: coords", coords, "zoom", mapZoom, "radius", radius, "currentPois", displayPois.length);
    if (poisTimerRef.current) clearTimeout(poisTimerRef.current);
    // If we don't have POIs yet, try an immediate fetch for debugging/first-load
    if (!Array.isArray(displayPois) || displayPois.length === 0) {
      fetchPOIs(coords[0], coords[1], radius);
    }
    // Schedule a debounce fetch for subsequent updates
    poisTimerRef.current = setTimeout(() => {
      fetchPOIs(coords[0], coords[1], radius);
    }, 1500);

    return () => {
      if (poisTimerRef.current) clearTimeout(poisTimerRef.current);
    };
  }, [vehiclePoint, mapRef]);

  const primaryVehicle = useMemo(
    () =>
      vehiclePoint
        ? {
            label: activeVehicles[0]?.label || "Vehiculo",
            status: activeVehicles[0]?.status || "En ruta",
            latitude: effectiveVehiclePoint?.[0] ?? vehiclePoint[0],
            longitude: effectiveVehiclePoint?.[1] ?? vehiclePoint[1],
          }
        : null,
    [activeVehicles, effectiveVehiclePoint, vehiclePoint],
  );
  const secondaryVehicles = useMemo(
    () =>
      primaryVehicle
        ? activeVehicles.filter((vehicle, index) => index > 0)
        : activeVehicles,
    [activeVehicles, primaryVehicle],
  );
  const vehicleDirectionLine =
    traveledLine?.length > 1
      ? traveledLine
      : plannedLine?.length > 1
        ? plannedLine
        : validPoints;
  const primaryVehicleRotation = useMemo(
    () =>
      getVehicleRotation(
        vehicleDirectionLine,
        effectiveVehiclePoint || vehiclePoint,
      ),
    [vehicleDirectionLine, effectiveVehiclePoint, vehiclePoint],
  );

  const hasLiveTrackings = validPoints.length > 0;

  // Calcula distancia total de una línea de coordenadas [lat,lng] en kilómetros
  function lineDistanceKm(line = []) {
    if (!Array.isArray(line) || line.length < 2) return 0;
    const toRad = (v) => (v * Math.PI) / 180;
    const earthKm = 6371;
    let total = 0;
    for (let i = 1; i < line.length; i += 1) {
      const [lat1, lng1] = line[i - 1];
      const [lat2, lng2] = line[i];
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

  const plannedKm = Math.round((plannedLine?.length > 1 ? lineDistanceKm(plannedLine) : 0) * 10) / 10;
  const traveledKm = Math.round((traveledLine?.length > 1 ? lineDistanceKm(traveledLine) : 0) * 10) / 10;
  const pendingKm = Math.round(Math.max(0, plannedKm - traveledKm) * 10) / 10;

  useEffect(() => {
    if (!Array.isArray(vehiclePoint)) return undefined;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const animationPath = buildAnimationPath(
      vehiclePoint,
      traveledLine,
      previousAnimatedPointRef.current,
      previousTraveledLineLengthRef.current,
    );
    previousTraveledLineLengthRef.current = Array.isArray(traveledLine)
      ? traveledLine.length
      : 0;

    if (animationPath.length <= 1) {
      setAnimatedVehiclePoint(vehiclePoint);
      previousAnimatedPointRef.current = vehiclePoint;
      return undefined;
    }

    const pathDistance = totalPathDistance(animationPath);
    const duration = Math.min(1800, Math.max(700, animationPath.length * 18));
    animationStartRef.current = 0;

    const animate = (timestamp) => {
      if (!animationStartRef.current) {
        animationStartRef.current = timestamp;
      }

      const elapsed = timestamp - animationStartRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      const nextPoint =
        getPointAtDistance(animationPath, pathDistance * easedProgress) ||
        vehiclePoint;
      setAnimatedVehiclePoint(nextPoint);
      previousAnimatedPointRef.current = nextPoint;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      setAnimatedVehiclePoint(vehiclePoint);
      previousAnimatedPointRef.current = vehiclePoint;
      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [traveledLine, vehiclePoint]);

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  return (
    <div
      style={{ position: "relative", height: mapHeight }}
      className="tracking-map-container"
    >
      {/* Filtro SVG — coloriza tiles: agua=azul, calles=blanco, bloques=teal */}
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <defs>
          <filter id="vt-map-colorize" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.95 0 -0.20 0 0.12  0.70 0.35 0.00 0 0.06  0.00 0.00 1.00 0 0.03  0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <MapContainer
        center={center}
        zoom={focusAllVehicles ? 12 : 14}
        maxBounds={BUENAVENTURA_MAX_BOUNDS}
        maxBoundsViscosity={1}
        style={{ height: "100%", width: "100%" }}
        className="vt-map-base"
        attributionControl={false}
        whenCreated={(m) => setMapRef(m)}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        {normalizedRouteOverlays.map((overlay) => {
          const isHighlighted = highlightedRouteIdSet.has(Number(overlay.id));
          const isDimmed = highlightedRouteIdSet.size > 0 && !isHighlighted;
          const shadowColor = isHighlighted ? "#93c5fd" : CORPORATE_ROUTE_HALO;
          const lineColor = CORPORATE_ROUTE_COLOR;

          return (
            <React.Fragment key={`route-overlay-${overlay.id}`}>
              <Polyline
                positions={overlay.polyline}
                color={shadowColor}
                weight={isHighlighted ? 6 : 5}
                opacity={isDimmed ? 0.06 : 0.18}
                smoothFactor={1.2}
              />
              <Polyline
                positions={overlay.polyline}
                color={lineColor}
                weight={3}
                opacity={isDimmed ? 0.16 : 0.7}
                lineCap="round"
                lineJoin="round"
                smoothFactor={1.2}
              />
            </React.Fragment>
          );
        })}

        {plannedLine?.length > 1 && !remainingLine && (
          <>
            <Polyline
              positions={plannedLine}
              pathOptions={{
                color: CORPORATE_ROUTE_HALO,
                weight: 6,
                opacity: 0.18,
              }}
              className="vt-planned-route-line-shadow"
            />
            <Polyline
              positions={plannedLine}
              pathOptions={{
                color: CORPORATE_ROUTE_COLOR,
                weight: 4,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
              className="vt-planned-route-line-main"
              smoothFactor={1.2}
            />
          </>
        )}

        {remainingLine?.length > 1 && (
          <>
            <Polyline
              positions={remainingLine}
              pathOptions={{ color: "#0891b2", weight: 6, opacity: 0.18 }}
              className="vt-remaining-route-line-shadow"
            />
            <Polyline
              positions={remainingLine}
              pathOptions={{
                color: "#0891b2",
                weight: 4,
                opacity: 0.95,
                dashArray: "8 6",
                lineCap: "round",
                lineJoin: "round",
              }}
              className="vt-remaining-route-line-main"
              smoothFactor={1.2}
            />
          </>
        )}

        {traveledLine?.length > 1 && (
          <>
            <Polyline
              positions={traveledLine}
              pathOptions={{
                color: CORPORATE_ROUTE_HALO,
                weight: 6,
                opacity: 0.14,
              }}
              className="vt-traveled-route-line-shadow"
            />
            <Polyline
              positions={traveledLine}
              pathOptions={{
                color: "#2563eb",
                weight: 5,
                opacity: 0.98,
                lineCap: "round",
                lineJoin: "round",
              }}
              className="vt-traveled-route-line-main"
              smoothFactor={1.2}
            />
          </>
        )}

        {originCoords && (
          <Marker
            position={originCoords}
            icon={originIcon}
            interactive={false}
          />
        )}
        {normalizedIntermediateStops.map((stop) => (
          <Marker
            key={`intermediate-stop-${stop.id}`}
            position={stop.coords}
            icon={createIntermediateStopIcon(stop.order)}
            title={stop.address}
            interactive={false}
          />
        ))}
        {destinationCoords && (
          <Marker
            position={destinationCoords}
            icon={destinationIcon}
            interactive={false}
          />
        )}

        {primaryVehicle && (
          <>
            <CircleMarker
              center={[primaryVehicle.latitude, primaryVehicle.longitude]}
              radius={14}
              pathOptions={{
                color: "#2563eb",
                weight: 6,
                opacity: 0.18,
                fillOpacity: 0,
              }}
              className="vt-current-point-ring"
              interactive={false}
            />
            <CircleMarker
              center={[primaryVehicle.latitude, primaryVehicle.longitude]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: "#2563eb",
                fillOpacity: 1,
              }}
              className="vt-current-point-core"
              interactive={false}
            />
            <Marker
              position={[primaryVehicle.latitude, primaryVehicle.longitude]}
              icon={createVehicleIcon(
                primaryVehicle.label,
                primaryVehicle.status,
                primaryVehicleRotation,
              )}
              interactive={false}
            />
          </>
        )}

        {secondaryVehicles.map((vehicle) => {
          if (
            !Number.isFinite(vehicle.latitude) ||
            !Number.isFinite(vehicle.longitude)
          ) {
            return null;
          }
          return (
            <Marker
              key={`${vehicle.label}-${vehicle.latitude}-${vehicle.longitude}`}
              position={[vehicle.latitude, vehicle.longitude]}
              icon={createVehicleIcon(vehicle.label, vehicle.status)}
              interactive={false}
            />
          );
        })}

        {/* POIs desde Overpass/TrackingMap */}
        {Array.isArray(displayPois) && (
          <>
            <button
              onClick={injectSamplePois}
              style={{ position: "absolute", top: 18, left: 18, zIndex: 800 }}
            >
              Inyectar POIs de prueba
            </button>
            <div style={{ position: "absolute", top: 18, left: 160, zIndex: 700, background: "rgba(255,255,255,0.65)", padding: "4px 6px", borderRadius: 6, fontSize: 11, color: "#0a2b3d", boxShadow: "none", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>
              POIs: {Array.isArray(displayPois) ? displayPois.length : 0}
            </div>
            {console.debug ? console.debug("MapView received POIs:", displayPois.length) : null}
            {displayPois.map((p) => {
            const lat = Number(p.lat);
            const lon = Number(p.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

            const tags = p.tags || {};
            const emoji = getPoiEmoji(tags);

            const poiIcon = L.divIcon({
              className: "",
              html: `<div class="vt-poi-marker">${emoji}</div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });

            return (
              <Marker
                key={`poi-${p.id}`}
                position={[lat, lon]}
                icon={poiIcon}
                interactive={false}
              />
            );
          })}
          </>
        )}

        {originCoords && (
          <Marker
            position={originCoords}
            icon={startLabelIcon}
            interactive={false}
          />
        )}
        {destinationCoords && (
          <Marker
            position={destinationCoords}
            icon={endLabelIcon}
            interactive={false}
          />
        )}

        <FitBounds
          coordinates={fitCoords}
          freezeAfterFirstFit={focusAllVehicles ? false : hasLiveTrackings}
        />
        <AutoFollowVehicle
          vehiclePoint={effectiveVehiclePoint || vehiclePoint}
          enabled={!focusAllVehicles && hasLiveTrackings}
        />
      </MapContainer>

      {/* Panel flotante ETA: se actualiza dinámicamente desde TrackingPage */}
      <div
        className={`floating-eta ${eta === null ? "floating-eta-hidden" : ""}`}
        aria-live="polite"
      >
        <div className="floating-eta-main">
          <div className="floating-eta-label">ETA</div>
          <div className="floating-eta-value">{eta === null ? "Sin datos" : `${eta} min`}</div>
        </div>
        {etaUpdated && (
          <div className="floating-eta-updated">
            Actualizado: {new Date(etaUpdated).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>

      {/* Panel de métricas de ruta (planificada/recorrida/pendiente) */}
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
          {/* 'Modo' removed - metrics simplified to Planif/Recorr/Pend */}
        </div>
      </div>

      {/* Leyenda del mapa */}
      <div className="map-legend">
        <div className="legend-title">Leyenda</div>
        {primaryVehicle && (
          <div className="legend-item">
            <div className="legend-marker current-dot"></div>
            <span>Punto actual</span>
          </div>
        )}
        {originCoords && (
          <div className="legend-item">
            <div className="legend-marker origin-dot"></div>
            <span>Origen</span>
          </div>
        )}
        {destinationCoords && (
          <div className="legend-item">
            <div className="legend-marker destination-dot"></div>
            <span>Destino</span>
          </div>
        )}
        {normalizedIntermediateStops.length > 0 && (
          <div className="legend-item">
            <div className="legend-marker stop-dot"></div>
            <span>Paradas intermedias</span>
          </div>
        )}
        {remainingLine?.length > 1 ? (
          <div className="legend-item">
            <div className="legend-line remaining"></div>
            <span>Tramo restante</span>
          </div>
        ) : (
          plannedLine?.length > 1 && (
            <div className="legend-item">
              <div className="legend-line planned"></div>
              <span>Ruta planificada</span>
            </div>
          )
        )}
        {traveledLine?.length > 1 && (
          <div className="legend-item">
            <div className="legend-line traveled"></div>
            <span>Tramo recorrido</span>
          </div>
        )}
        {focusAllVehicles && normalizedRouteOverlays.length > 0 && (
          <div className="legend-item">
            <div className="legend-line planned"></div>
            <span>Rutas monitoreadas</span>
          </div>
        )}
        {focusAllVehicles && highlightedRouteIdSet.size > 0 && (
          <div className="legend-item">
            <div className="legend-line traveled"></div>
            <span>Rutas resaltadas</span>
          </div>
        )}
      </div>
    </div>
  );
}

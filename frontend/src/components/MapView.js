// Mapa en tiempo real con estilo limpio tipo navegacion
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import React from "react";
import { GoogleMap, useJsApiLoader, Polyline, OverlayView } from "@react-google-maps/api";
import { FaUniversity, FaSchool, FaHospital, FaGasPump, FaTree, FaShoppingBag, FaMapMarkerAlt } from "react-icons/fa";
import "./map-styles.css";

// ---------------------------------------------------------------------------
// Helpers de coordenadas
// ---------------------------------------------------------------------------
function toLatLng(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lat, lng] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toLatLngArray(coordsArray) {
  if (!Array.isArray(coordsArray)) return [];
  return coordsArray
    .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map(([lat, lng]) => ({ lat, lng }));
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
const BUENAVENTURA_CENTER = [3.8785, -77.0200];
const CORPORATE_ROUTE_COLOR = "#2563EB";

// Stable reference — must not be defined inside the component
const GOOGLE_MAPS_LIBRARIES = ["places"];

const GOOGLE_MAPS_STYLES = [];

const GOOGLE_MAPS_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: false,
  fullscreenControl: false,
  gestureHandling: "greedy",
  styles: GOOGLE_MAPS_STYLES,
};

// Modo navegación GPS: mapa claro simplificado, sin POIs distractores
const GPS_NAV_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f2f1ec" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b3d4e8" }] },
];

// Modo noche GPS: mapa oscuro estilo conducción nocturna
const GPS_NIGHT_STYLES = [
  { featureType: "all", elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#a0aec0" }] },
  { featureType: "all", elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e", weight: 3 }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3748" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2c3e6b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0f1f3d" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2e" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#16213e" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#1e2535" }] },
];

function getArrowSvg(modifier, type, color = "#1a56db") {
  const C = color;
  // Ícono de llegada — pin de destino
  if (type === "arrive") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 4C15.03 4 11 8.03 11 13c0 7.25 9 20 9 20s9-12.75 9-20c0-4.97-4.03-9-9-9z" fill={C}/>
        <circle cx="20" cy="13" r="4" fill="#ffffff"/>
      </svg>
    );
  }
  const mod = (modifier || "straight").toLowerCase();

  // Giro a la izquierda — flecha curva izquierda
  if (mod === "left" || mod === "sharp left") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 12 10 12 10 18" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M5 14l6-5 1 10z" fill={C}/>
      </svg>
    );
  }
  // Giro a la derecha — flecha curva derecha
  if (mod === "right" || mod === "sharp right") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 12 30 12 30 18" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M35 14l-6-5-1 10z" fill={C}/>
      </svg>
    );
  }
  // Giro leve a la izquierda
  if (mod === "slight left") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 14 14 11 10 13" stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M5 9l6 1-1 8z" fill={C}/>
      </svg>
    );
  }
  // Giro leve a la derecha
  if (mod === "slight right") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="17" y="18" width="6" height="16" rx="3" fill={C}/>
        <path d="M20 18C20 14 26 11 30 13" stroke={C} strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M35 9l-6 1 1 8z" fill={C}/>
      </svg>
    );
  }
  // Media vuelta
  if (mod === "uturn") {
    return (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 34V18a6 6 0 0 0-12 0v2" stroke={C} strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M9 24l5-6 5 6" fill={C}/>
      </svg>
    );
  }
  // Continuar recto — flecha arriba estándar
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="17" y="16" width="6" height="20" rx="3" fill={C}/>
      <path d="M20 4L9 17h22z" fill={C}/>
    </svg>
  );
}

function buildVoiceInstruction(step) {
  const dirMap = {
    "left": "gire a la izquierda",
    "sharp left": "gire fuertemente a la izquierda",
    "slight left": "manténgase a la izquierda",
    "right": "gire a la derecha",
    "sharp right": "gire fuertemente a la derecha",
    "slight right": "manténgase a la derecha",
    "straight": "continúe recto",
    "uturn": "dé un giro en U",
  };
  if (step?.type === "arrive") return step.name ? `llegando al destino en ${step.name}` : "ha llegado al destino";
  const action = dirMap[(step?.modifier || "").toLowerCase()] || "continúe";
  return step?.name ? `${action} en ${step.name}` : action;
}

function buildInstructionText(step) {
  const dirMap = {
    "left": "Gira a la izquierda",
    "sharp left": "Gira a la izquierda",
    "slight left": "Mantente a la izquierda",
    "right": "Gira a la derecha",
    "sharp right": "Gira a la derecha",
    "slight right": "Mantente a la derecha",
    "straight": "Continúa recto",
    "uturn": "Da un giro en U",
  };

  if (step?.type === "arrive") return "Llegaste al destino";
  return dirMap[(step?.modifier || "").toLowerCase()] || "Continúa recto";
}


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

function getPoiIcon(tags = {}) {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();

  if (amenity === "university") return <FaUniversity />;
  if (amenity === "school") return <FaSchool />;
  if (amenity === "hospital") return <FaHospital />;
  if (amenity === "fuel") return <FaGasPump />;
  if (leisure === "park") return <FaTree />;
  if (shop && /mall|supermarket|department_store/.test(shop)) return <FaShoppingBag />;

  return <FaMapMarkerAlt />;
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
  gpsMode = false,
  navigationSteps = null,
  nearDestination = false,
  onExitGps = null,
  isAdmin = false,
  isDriver = false,
}) {
  const { isLoaded: mapsApiLoaded } = useJsApiLoader({
    id: "vialtros-google-map",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [displayPois, setDisplayPois] = useState(Array.isArray(pois) ? pois : []);
  const [animatedVehiclePoint, setAnimatedVehiclePoint] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [gpsMuted, setGpsMuted] = useState(false);
  const [gpsMenuOpen, setGpsMenuOpen] = useState(false);
  const [gpsNightMode, setGpsNightMode] = useState(false);
  const gpsMutedRef = useRef(false);
  const [gpsToast, setGpsToast] = useState(null);
  const gpsToastTimerRef = useRef(null);
  const prevGpsModeRef = useRef(false);
  const lastToastStepKeyRef = useRef(null);

  const animationFrameRef = useRef(null);
  const animationStartRef = useRef(0);
  const previousAnimatedPointRef = useRef(null);
  const previousTraveledLineLengthRef = useRef(0);
  const poisTimerRef = useRef(null);
  const lastPoisFetchCoordsRef = useRef(null);
  const fittedOnceRef = useRef(false);
  const lastFitLengthRef = useRef(-1);
  const firstFollowRef = useRef(true);
  const userMovedMapRef = useRef(true);
  const containerRef = useRef(null);
  const spokenWarningsRef = useRef(new Set());
  const lastSpokenStepKeyRef = useRef(null);

  const [clickedPlace, setClickedPlace] = useState(null); // { lat, lng, address, loading }
  const [, setFollowPaused] = useState(true);
  const suppressListenerRef = useRef(false);


  // Cerrar menú GPS al hacer click fuera
  useEffect(() => {
    if (!gpsMenuOpen) return undefined;
    const close = () => setGpsMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [gpsMenuOpen]);

  // Cuando el usuario arrastra o hace zoom, suspende el auto-seguimiento
  useEffect(() => {
    if (!mapRef) return undefined;
    const dragListener = mapRef.addListener("dragstart", () => {
      userMovedMapRef.current = true;
      setFollowPaused(true);
    });
    const zoomListener = mapRef.addListener("zoom_changed", () => {
      if (suppressListenerRef.current) return;
      userMovedMapRef.current = true;
      setFollowPaused(true);
    });
    return () => {
      dragListener.remove();
      zoomListener.remove();
    };
  }, [mapRef]);

  useEffect(() => {
    if (Array.isArray(pois) && pois.length > 0) {
      setDisplayPois(pois);
    }
  }, [pois]);

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
  const loadLocalPois = useCallback(async () => {
    try {
      const res = await fetch("/pois.json");
      if (!res.ok) {
        console.debug("MapView local pois not found (status)", res.status);
        

        return;
      }
      const data = await res.json();
      let parsed = [];
      if (Array.isArray(data)) {
        parsed = data.map((el, i) => ({ id: el.id ?? `local-${i}`, lat: el.lat, lon: el.lon, tags: el.tags || {} }));
      } else if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        parsed = data.features
          .map((f, i) => {
            const coords = f.geometry?.coordinates;
            if (!coords || coords.length < 2) return null;
            return { id: f.id ?? `local-${i}`, lat: coords[1], lon: coords[0], tags: f.properties || {} };
          })
          .filter(Boolean);
      }
      setDisplayPois(parsed);
      

      console.debug("MapView loaded local POIs:", parsed.length);
    } catch (err) {
      console.debug("MapView error loading local pois:", err);
      

    }
  }, []);

  const fetchPOIs = useCallback(async (lat, lng, radiusMeters = 2000) => {
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
      if (!parsed.length) {
        console.debug("MapView: Overpass returned 0 elements, attempting local fallback");
        await loadLocalPois();
      }
    } catch (err) {
      console.warn("MapView error fetching POIs:", err);
    }
  }, [loadLocalPois]);

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

  const hasLiveTrackings = validPoints.length > 0;


  // Fetch POIs solo una vez por sesión, o si el vehículo se movió más de 500m
  useEffect(() => {
    const coords = Array.isArray(vehiclePoint) ? vehiclePoint : null;
    if (!coords) return undefined;

    const last = lastPoisFetchCoordsRef.current;
    if (last) {
      const dLat = coords[0] - last[0];
      const dLng = coords[1] - last[1];
      const approxKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
      if (approxKm < 0.5) return undefined;
    }

    if (poisTimerRef.current) clearTimeout(poisTimerRef.current);
    poisTimerRef.current = setTimeout(() => {
      lastPoisFetchCoordsRef.current = coords;
      const mapZoom = mapRef?.getZoom ? mapRef.getZoom() : 13;
      const radius = Math.max(600, Math.round(2000 * Math.pow(2, 13 - (mapZoom || 13)) / 4));
      fetchPOIs(coords[0], coords[1], radius);
    }, 5000);
    return () => { if (poisTimerRef.current) clearTimeout(poisTimerRef.current); };
  }, [vehiclePoint, mapRef, fetchPOIs]);

  // FitBounds: ajusta el viewport cuando cambian las coordenadas de la ruta
  useEffect(() => {
    if (!mapRef || !fitCoords?.length) return;
    const freezeAfterFirstFit = !focusAllVehicles && hasLiveTrackings;
    if (freezeAfterFirstFit && fittedOnceRef.current) return;
    if (fitCoords.length === lastFitLengthRef.current) return;
    lastFitLengthRef.current = fitCoords.length;
    const valid = fitCoords.filter(
      (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (!valid.length) return;
    if (valid.length === 1) {
      suppressListenerRef.current = true;
      mapRef.setCenter({ lat: valid[0][0], lng: valid[0][1] });
      mapRef.setZoom(15);
      suppressListenerRef.current = false;
      fittedOnceRef.current = true;
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    valid.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    suppressListenerRef.current = true;
    mapRef.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
    suppressListenerRef.current = false;
    fittedOnceRef.current = true;
  }, [mapRef, fitCoords, focusAllVehicles, hasLiveTrackings]);

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

  const primaryVehicleRotationRef = useRef(0);
  primaryVehicleRotationRef.current = primaryVehicleRotation;

  // AutoFollowVehicle: centra el mapa en el vehiculo cuando el seguimiento está activo
  useEffect(() => {
    if (!mapRef || !effectiveVehiclePoint || focusAllVehicles || !hasLiveTrackings) return;
    const [lat, lng] = effectiveVehiclePoint;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (gpsMode) {
      if (firstFollowRef.current) {
        firstFollowRef.current = false;
        suppressListenerRef.current = true;
        mapRef.setCenter({ lat, lng });
        mapRef.setZoom(17);
        suppressListenerRef.current = false;
      }
      mapRef.panTo({ lat, lng });
      mapRef.setHeading(primaryVehicleRotationRef.current + 90);
      return;
    }

    if (userMovedMapRef.current) return;
    mapRef.panTo({ lat, lng });
  }, [mapRef, effectiveVehiclePoint, focusAllVehicles, hasLiveTrackings, gpsMode]);

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

  // Aplica estilos: en modo GPS usa mapa claro sin distracciones (como Google Maps nav)
  useEffect(() => {
    if (!mapRef) return;
    let styles;
    if (gpsMode) {
      styles = gpsNightMode ? GPS_NIGHT_STYLES : GPS_NAV_STYLES;
    } else {
      styles = GOOGLE_MAPS_STYLES;
    }
    mapRef.setOptions({
      styles,
      tilt: gpsMode ? 45 : 0,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    if (!gpsMode) mapRef.setHeading(0);
  }, [mapRef, gpsMode, gpsNightMode]);

  const nextStep = useMemo(() => {
    if (!gpsMode || !Array.isArray(navigationSteps) || !vehiclePoint) return null;
    const [vLat, vLng] = vehiclePoint;

    // Función haversine rápida en metros
    const distM = (lat1, lng1, lat2, lng2) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // Encontrar el paso más cercano que esté ADELANTE (dentro de 2500 m),
    // preferiendo el más próximo al vehículo (aún no superado).
    let closest = null;
    let minDist = Infinity;
    for (let i = 0; i < navigationSteps.length; i++) {
      const step = navigationSteps[i];
      const d = distM(vLat, vLng, step.location[0], step.location[1]);
      if (d < minDist && d < 2500) {
        minDist = d;
        closest = { ...step, distanceAway: Math.round(d) };
      }
    }
    return closest;
  }, [gpsMode, navigationSteps, vehiclePoint]);

  useEffect(() => {
    if (!gpsMode || !nextStep || !window.speechSynthesis) return;
    if (gpsMutedRef.current) return;
    const stepKey = `${nextStep.location[0].toFixed(5)},${nextStep.location[1].toFixed(5)}`;
    const dist = nextStep.distanceAway;

    if (lastSpokenStepKeyRef.current !== stepKey) {
      lastSpokenStepKeyRef.current = stepKey;
      spokenWarningsRef.current = new Set();
    }

    const announce = (prefix) => {
      const instruction = buildVoiceInstruction(nextStep);
      const utt = new window.SpeechSynthesisUtterance(`${prefix} ${instruction}`);
      utt.lang = "es-CO";
      utt.rate = 1.1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    };

    if (dist > 250 && dist < 400 && !spokenWarningsRef.current.has(`${stepKey}-300`)) {
      announce("En 300 metros,");
      spokenWarningsRef.current.add(`${stepKey}-300`);
    } else if (dist > 30 && dist < 80 && !spokenWarningsRef.current.has(`${stepKey}-now`)) {
      announce("Ahora,");
      spokenWarningsRef.current.add(`${stepKey}-now`);
    }
  }, [nextStep, gpsMode]);

  // Toast: notificación al iniciar GPS
  useEffect(() => {
    if (gpsMode && !prevGpsModeRef.current) {
      setGpsToast({ type: "start", text: "Navegación iniciada", sub: destinationName || "En ruta al destino" });
      if (gpsToastTimerRef.current) clearTimeout(gpsToastTimerRef.current);
      gpsToastTimerRef.current = setTimeout(() => setGpsToast(null), 4000);
      lastToastStepKeyRef.current = null;
    }
    if (!gpsMode) lastToastStepKeyRef.current = null;
    prevGpsModeRef.current = gpsMode;
  }, [gpsMode, destinationName]);

  // Toast: notificación al cambiar de paso (giro / nueva calle)
  useEffect(() => {
    if (!gpsMode || !nextStep) return;
    const stepKey = `${nextStep.location[0].toFixed(5)},${nextStep.location[1].toFixed(5)}`;
    if (lastToastStepKeyRef.current === null) { lastToastStepKeyRef.current = stepKey; return; }
    if (lastToastStepKeyRef.current === stepKey) return;
    lastToastStepKeyRef.current = stepKey;
    const text = buildInstructionText(nextStep);
    setGpsToast({ type: "turn", text, sub: nextStep.name || "", modifier: nextStep.modifier, stepType: nextStep.type });
    if (gpsToastTimerRef.current) clearTimeout(gpsToastTimerRef.current);
    gpsToastTimerRef.current = setTimeout(() => setGpsToast(null), 5000);
  }, [gpsMode, nextStep]);

  // Toast: notificación al acercarse al destino
  useEffect(() => {
    if (!gpsMode || !nearDestination) return;
    setGpsToast({ type: "arrive", text: "Llegando al destino", sub: destinationName || "" });
    if (gpsToastTimerRef.current) clearTimeout(gpsToastTimerRef.current);
    gpsToastTimerRef.current = setTimeout(() => setGpsToast(null), 8000);
  }, [gpsMode, nearDestination, destinationName]);

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

  useEffect(() => {
    // Eliminado: currentTime no se utiliza
  }, []);

  const handleMapClick = useCallback((e) => {
    if (gpsMode) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setClickedPlace({ lat, lng, address: null, loading: true });
    if (!window.google?.maps?.Geocoder) {
      setClickedPlace({ lat, lng, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, loading: false });
      return;
    }
    new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      const address =
        status === "OK" && results?.[0]
          ? results[0].formatted_address
          : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setClickedPlace({ lat, lng, address, loading: false });
    });
  }, [gpsMode]);

  const handleZoomIn = useCallback(() => {
    if (!mapRef) return;
    mapRef.setZoom((mapRef.getZoom() ?? 14) + 1);
    userMovedMapRef.current = true;
    setFollowPaused(true);
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    if (!mapRef) return;
    mapRef.setZoom((mapRef.getZoom() ?? 14) - 1);
    userMovedMapRef.current = true;
    setFollowPaused(true);
  }, [mapRef]);

  return (
    <div
      ref={containerRef}
      style={gpsMode
        ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }
        : { position: "relative", height: mapHeight }}
      className="tracking-map-container"
    >
      {!mapsApiLoaded ? (
        <div style={{ height: "100%", background: "#f0f9ff" }} />
      ) : (
      <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={toLatLng(center) || { lat: BUENAVENTURA_CENTER[0], lng: BUENAVENTURA_CENTER[1] }}
          zoom={focusAllVehicles ? 13 : 14}
          onLoad={(map) => setMapRef(map)}
          onClick={handleMapClick}
          options={GOOGLE_MAPS_OPTIONS}
        >
          {/* ---- Rutas superpuestas (modo admin / focus all) — solo cuando hay ruta resaltada ---- */}
          {highlightedRouteIdSet.size > 0 && normalizedRouteOverlays.map((overlay) => {
            const isHighlighted = highlightedRouteIdSet.has(Number(overlay.id));
            const isDimmed = highlightedRouteIdSet.size > 0 && !isHighlighted;
            const path = toLatLngArray(overlay.polyline);
            return (
              <React.Fragment key={`route-overlay-${overlay.id}`}>
                <Polyline
                  path={path}
                  options={{
                    strokeColor: "#FFFFFF",
                    strokeWeight: isHighlighted ? 10 : 8,
                    strokeOpacity: isDimmed ? 0.04 : isHighlighted ? 0.65 : 0.5,
                    geodesic: true,
                  }}
                />
                <Polyline
                  path={path}
                  options={{
                    strokeColor: isHighlighted ? "#3B82F6" : CORPORATE_ROUTE_COLOR,
                    strokeWeight: isHighlighted ? 6 : 4,
                    strokeOpacity: isDimmed ? 0.15 : 0.88,
                    geodesic: true,
                  }}
                />
              </React.Fragment>
            );
          })}

          {/* ---- Ruta planificada ---- */}
          {plannedLine?.length > 1 && !remainingLine && !isAdmin && (
            <>
              <Polyline
                path={toLatLngArray(plannedLine)}
                options={{ strokeColor: "#FFFFFF", strokeWeight: gpsMode ? 20 : 14, strokeOpacity: gpsMode ? 0.7 : 0.52, geodesic: true }}
              />
              <Polyline
                path={toLatLngArray(plannedLine)}
                options={{ strokeColor: gpsMode ? "#1a56db" : CORPORATE_ROUTE_COLOR, strokeWeight: gpsMode ? 14 : 8, strokeOpacity: 0.98, geodesic: true }}
              />
            </>
          )}

          {/* ---- Tramo restante ---- */}
          {remainingLine?.length > 1 && !isAdmin && (
            <>
              <Polyline
                path={toLatLngArray(remainingLine)}
                options={{ strokeColor: "#FFFFFF", strokeWeight: gpsMode ? 20 : 14, strokeOpacity: gpsMode ? 0.7 : 0.5, geodesic: true }}
              />
              <Polyline
                path={toLatLngArray(remainingLine)}
                options={{ strokeColor: "#1a56db", strokeWeight: gpsMode ? 14 : 8, strokeOpacity: 1.0, geodesic: true }}
              />
            </>
          )}

          {/* ---- Tramo recorrido ---- */}
          {traveledLine?.length > 1 && !isAdmin && (
            <>
              <Polyline
                path={toLatLngArray(traveledLine)}
                options={{ strokeColor: "#FFFFFF", strokeWeight: 10, strokeOpacity: 0.28, geodesic: true }}
              />
              <Polyline
                path={toLatLngArray(traveledLine)}
                options={{ strokeColor: "#64748b", strokeWeight: 6, strokeOpacity: 0.8, geodesic: true }}
              />
            </>
          )}

          {/* ---- Origen ---- */}
          {toLatLng(originCoords) && (
            <OverlayView position={toLatLng(originCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-point vt-route-point-start" />
              </div>
            </OverlayView>
          )}

          {/* ---- Paradas intermedias ---- */}
          {normalizedIntermediateStops.map((stop) => (
            <OverlayView
              key={`stop-${stop.id}`}
              position={toLatLng(stop.coords)}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-stop-marker">
                  <span className="vt-route-stop-ring" />
                  <span className="vt-route-stop-core">{stop.order}</span>
                </div>
              </div>
            </OverlayView>
          ))}

          {/* ---- Destino ---- */}
          {toLatLng(destinationCoords) && (
            <OverlayView position={toLatLng(destinationCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                <div className="vt-route-point vt-route-point-end" />
              </div>
            </OverlayView>
          )}

          {/* ---- Vehículo principal ---- */}
          {primaryVehicle && toLatLng([primaryVehicle.latitude, primaryVehicle.longitude]) && (
            gpsMode ? (
              <OverlayView
                position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                  <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                  <div
                    className="vt-gps-nav-arrow"
                    style={{ transform: `rotate(${primaryVehicleRotation + 90}deg)` }}
                  >
                    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Sombra / halo azul difuso */}
                      <circle cx="28" cy="28" r="27" fill="rgba(26,86,219,0.18)"/>
                      {/* Flecha azul estilo Google Maps — triángulo sólido apuntando al norte */}
                      <path d="M28 6 L44 46 L28 37 L12 46 Z" fill="#1a56db"/>
                      {/* Borde blanco fino para contraste */}
                      <path d="M28 6 L44 46 L28 37 L12 46 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </OverlayView>
            ) : (
              <>
                <OverlayView
                  position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                    <div
                      className="vt-current-point-ring"
                      style={{ width: 28, height: 28, borderRadius: "50%", border: "6px solid rgba(37,99,235,0.18)" }}
                    />
                  </div>
                </OverlayView>
                <OverlayView
                  position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                    <div
                      className="vt-current-point-core"
                      style={{ width: 12, height: 12, borderRadius: "50%", background: "#2563eb", border: "3px solid #ffffff" }}
                    />
                  </div>
                </OverlayView>
                <OverlayView
                  position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div style={{ transform: "translate(-50%, calc(-100% - 14px))", pointerEvents: "none" }}>
                    <div className={`vt-vehicle-chip vt-vehicle-chip-${primaryVehicle.status === "En ruta" ? "moving" : "idle"}`}>
                      <span className="vt-vehicle-icon" style={{ transform: `rotate(${primaryVehicleRotation}deg)` }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="16" height="12" rx="2" />
                          <path d="M17 8h3l3 4v4h-6V8z" />
                          <circle cx="5.5" cy="18.5" r="2.2" />
                          <circle cx="18.5" cy="18.5" r="2.2" />
                        </svg>
                      </span>
                      <span className="vt-vehicle-text">{primaryVehicle.label || "Vehiculo"}</span>
                    </div>
                  </div>
                </OverlayView>
              </>
            )
          )}

          {/* ---- Vehículos secundarios ---- */}
          {secondaryVehicles.map((vehicle) => {
            if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) return null;
            return (
              <OverlayView
                key={`${vehicle.label}-${vehicle.latitude}-${vehicle.longitude}`}
                position={{ lat: vehicle.latitude, lng: vehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{ transform: "translate(-50%, calc(-100% - 14px))", pointerEvents: "none" }}>
                  <div className={`vt-vehicle-chip vt-vehicle-chip-${vehicle.status === "En ruta" ? "moving" : "idle"}`}>
                    <span className="vt-vehicle-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="16" height="12" rx="2" />
                        <path d="M17 8h3l3 4v4h-6V8z" />
                        <circle cx="5.5" cy="18.5" r="2.2" />
                        <circle cx="18.5" cy="18.5" r="2.2" />
                      </svg>
                    </span>
                    <span className="vt-vehicle-text">{vehicle.label || "Vehiculo"}</span>
                  </div>
                </div>
              </OverlayView>
            );
          })}

          {/* ---- POIs ---- */}
          {!gpsMode && Array.isArray(displayPois) &&
            displayPois.map((p) => {
              const lat = Number(p.lat);
              const lon = Number(p.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              return (
                <OverlayView
                  key={`poi-${p.id}`}
                  position={{ lat, lng: lon }}
                  mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                >
                  <div style={{ transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                    <div className="vt-poi-marker">{getPoiIcon(p.tags || {})}</div>
                  </div>
                </OverlayView>
              );
            })}


          {/* ---- Popup de dirección al hacer click ---- */}
          {clickedPlace && toLatLng([clickedPlace.lat, clickedPlace.lng]) && (
            <OverlayView
              position={{ lat: clickedPlace.lat, lng: clickedPlace.lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div className="map-click-popup">
                <div className="map-click-popup-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#2563EB"/>
                  </svg>
                  <span className="map-click-popup-coords">
                    {clickedPlace.lat.toFixed(5)}, {clickedPlace.lng.toFixed(5)}
                  </span>
                  <button
                    className="map-click-popup-close"
                    onClick={(e) => { e.stopPropagation(); setClickedPlace(null); }}
                    aria-label="Cerrar"
                  >×</button>
                </div>
                <p className="map-click-popup-address">
                  {clickedPlace.loading ? "Buscando dirección…" : clickedPlace.address}
                </p>
              </div>
            </OverlayView>
          )}
        </GoogleMap>
      )}



      {/* ---- HUD GPS — overlays flotantes estilo Google Maps ---- */}
      {gpsMode && (() => {
        const arrivalTime = (() => {
          if (eta === null) return "--";
          const d = new Date(Date.now() + Number(eta) * 60000);
          return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        })();
        return (
          <>
            {/* Banner superior centrado — En Ruta */}
            <div className="gps-overlay-top" aria-live="polite">
              <div className="gps-overlay-top-left">
                <span className="gps-overlay-en-ruta">En Ruta:</span>
                <span className="gps-overlay-street">{destinationName || nextStep?.name || "Destino"}</span>
              </div>
              <div className="gps-overlay-top-right">
                <div className="gps-overlay-icon">
                  {getArrowSvg(nextStep?.modifier, nextStep?.type)}
                </div>
                <div className="gps-overlay-time-block">
                  <div className="gps-overlay-time-row">
                    <span className="gps-overlay-eta-big">{eta !== null ? eta : "--"}</span>
                    <span className="gps-overlay-min-label">MIN</span>
                  </div>
                  <span className="gps-overlay-arrival-top">{arrivalTime}</span>
                </div>
              </div>
            </div>

            {/* Toast GPS: inicio / giro / llegada */}
            {gpsToast && (
              <div className={`gps-toast gps-toast-${gpsToast.type}`} role="status" aria-live="polite"
                onClick={() => setGpsToast(null)}>
                <div className="gps-toast-icon">
                  {gpsToast.type === "turn" && (
                    <div style={{ width: 32, height: 32 }}>
                      {getArrowSvg(gpsToast.modifier, gpsToast.stepType)}
                    </div>
                  )}
                  {gpsToast.type === "start" && (
                    <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                      <circle cx="12" cy="12" r="10" fill="#1a56db" opacity="0.15"/>
                      <path d="M10 8l6 4-6 4V8z" fill="#1a56db"/>
                    </svg>
                  )}
                  {gpsToast.type === "arrive" && (
                    <svg viewBox="0 0 24 24" fill="none" width="28" height="28">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#1a56db"/>
                      <circle cx="12" cy="9" r="3" fill="white"/>
                    </svg>
                  )}
                </div>
                <div className="gps-toast-body">
                  <span className="gps-toast-text">{gpsToast.text}</span>
                  {gpsToast.sub && <span className="gps-toast-sub">{gpsToast.sub}</span>}
                </div>
              </div>
            )}

            {/* Banner inferior — resumen flotante */}
            <div className="gps-overlay-bottom" aria-live="polite">
              <div className="gps-overlay-col gps-overlay-col-eta">
                <span className="gps-overlay-eta-num">{eta !== null ? eta : "--"}</span>
                <span className="gps-overlay-label-sm">min</span>
              </div>
              <div className="gps-overlay-sep" aria-hidden="true" />
              <div className="gps-overlay-col gps-overlay-col-dist">
                <span className="gps-overlay-dist-num">{pendingKm} km</span>
                <span className="gps-overlay-label-sm">restantes</span>
                <span className="gps-overlay-arrival">Llegada: {arrivalTime}</span>
              </div>
              <div className="gps-overlay-sep" aria-hidden="true" />
              <div className="gps-overlay-col gps-overlay-col-actions">
                {/* Cancelar navegación */}
                <button
                  className="gps-action-btn gps-action-btn-cancel"
                  onClick={onExitGps || undefined}
                  aria-label="Cancelar navegación"
                  title="Cancelar navegación"
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* Silenciar / activar voz */}
                <button
                  className={`gps-action-btn${gpsMuted ? " gps-action-btn-muted" : ""}`}
                  onClick={() => {
                    const next = !gpsMuted;
                    setGpsMuted(next);
                    gpsMutedRef.current = next;
                    if (next && window.speechSynthesis) window.speechSynthesis.cancel();
                  }}
                  aria-label={gpsMuted ? "Activar voz" : "Silenciar voz"}
                  title={gpsMuted ? "Activar voz" : "Silenciar voz"}
                >
                  {gpsMuted ? (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M19.07 4.93a10 10 0 010 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </button>

                {/* Más opciones ⋮ */}
                <div className="gps-menu-wrapper">
                  <button
                    className={`gps-action-btn${gpsMenuOpen ? " gps-action-btn-active" : ""}`}
                    onClick={(e) => { e.stopPropagation(); setGpsMenuOpen((v) => !v); }}
                    aria-label="Más opciones"
                    title="Más opciones"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                      <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                    </svg>
                  </button>
                  {gpsMenuOpen && (
                    <div className="gps-menu-popup" role="menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="gps-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setGpsMenuOpen(false);
                          userMovedMapRef.current = false;
                          setFollowPaused(false);
                          if (mapRef && primaryVehicle) {
                            suppressListenerRef.current = true;
                            mapRef.panTo({ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude });
                            mapRef.setZoom(17);
                            suppressListenerRef.current = false;
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                        </svg>
                        Centrar en vehículo
                      </button>
                      <button
                        className="gps-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setGpsMenuOpen(false);
                          const next = !gpsMuted;
                          setGpsMuted(next);
                          gpsMutedRef.current = next;
                          if (next && window.speechSynthesis) window.speechSynthesis.cancel();
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                          <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          {gpsMuted
                            ? <><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>
                            : <path d="M15.54 8.46a5 5 0 010 7.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          }
                        </svg>
                        {gpsMuted ? "Activar voz" : "Silenciar voz"}
                      </button>
                      <div className="gps-menu-divider" />
                      <button
                        className="gps-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setGpsMenuOpen(false);
                          setGpsNightMode((v) => !v);
                        }}
                      >
                        {gpsNightMode ? (
                          <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                            <circle cx="12" cy="12" r="4" fill="currentColor"/>
                            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" fill="currentColor"/>
                          </svg>
                        )}
                        {gpsNightMode ? "Modo claro" : "Modo noche"}
                      </button>
                      <div className="gps-menu-divider" />
                      <button
                        className="gps-menu-item gps-menu-item-danger"
                        role="menuitem"
                        onClick={() => {
                          setGpsMenuOpen(false);
                          if (onExitGps) onExitGps();
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" width="17" height="17">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        </svg>
                        Salir del GPS
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ---- Panel flotante ETA ---- */}
      {!isAdmin && (gpsMode ? isDriver : !isDriver) && (
        <div
          className={`floating-eta ${eta === null ? "floating-eta-hidden" : ""}`}
          aria-live="polite"
        >
          <span className="floating-eta-label">ETA</span>
          <div className="floating-eta-main">
            <span className="floating-eta-number">{eta === null ? "—" : eta}</span>
            {eta !== null && <span className="floating-eta-unit">min</span>}
          </div>
          {etaUpdated && (
            <div className="floating-eta-updated">
              {new Date(etaUpdated).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
      )}


      {/* ---- Leyenda ---- */}
      {!isAdmin && !isDriver && !gpsMode && (
        <div className="map-legend">
          <div className="legend-title">Leyenda</div>
          {primaryVehicle && (
            <div className="legend-item">
              <div className="legend-marker current-dot" />
              <span>Punto actual</span>
            </div>
          )}
          {originCoords && (
            <div className="legend-item">
              <div className="legend-marker origin-dot" />
              <span>Origen</span>
            </div>
          )}
          {destinationCoords && (
            <div className="legend-item">
              <div className="legend-marker destination-dot" />
              <span>Destino</span>
            </div>
          )}
          {normalizedIntermediateStops.length > 0 && (
            <div className="legend-item">
              <div className="legend-marker stop-dot" />
              <span>Paradas intermedias</span>
            </div>
          )}
          {remainingLine?.length > 1 ? (
            <div className="legend-item">
              <div className="legend-line remaining" />
              <span>Tramo restante</span>
            </div>
          ) : (
            plannedLine?.length > 1 && (
              <div className="legend-item">
                <div className="legend-line planned" />
                <span>Ruta planificada</span>
              </div>
            )
          )}
          {traveledLine?.length > 1 && (
            <div className="legend-item">
              <div className="legend-line traveled" />
              <span>Tramo recorrido</span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

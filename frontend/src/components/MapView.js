// Mapa en tiempo real con estilo limpio tipo navegacion
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import React from "react";
import { GoogleMap, Polyline, OverlayView } from "@react-google-maps/api";
import { useGoogleMaps } from "../context/GoogleMapsContext";
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

function safeLatLngPath(coordsArray) {
  const path = toLatLngArray(coordsArray);
  return path.length > 1 ? path : null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
// Set REACT_APP_GOOGLE_MAPS_MAP_ID in .env to enable Vector Maps (heading + tilt in GPS mode)
const GOOGLE_MAPS_MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || "";
const USE_VECTOR_MAP = Boolean(GOOGLE_MAPS_MAP_ID);
const WORLD_CENTER = [0, 0];
const CORPORATE_ROUTE_COLOR = "#2563EB";
const ROUTE_COLOR = "#4285F4";
const ROUTE_COLOR_SHADOW = "#1558D6";
const ROUTE_TRAVELED_COLOR = "#1A73E8";

const GOOGLE_MAPS_STYLES = [];

// Cache de POIs para evitar llamadas repetidas a Overpass API
const _poiCache = new Map();
const POI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const GOOGLE_MAPS_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: false,
  fullscreenControl: false,
  rotateControl: false,
  panControl: false,
  gestureHandling: "greedy",
  ...(USE_VECTOR_MAP
    ? { mapId: GOOGLE_MAPS_MAP_ID }
    : { styles: GOOGLE_MAPS_STYLES }),
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

/**
 * Retorna los segmentos de la ruta planificada ADELANTE del vehículo
 * para calcular el bearing hacia donde va, no hacia donde fue.
 */
function getAheadDirectionLine(plannedLine, vehiclePoint) {
  if (!Array.isArray(plannedLine) || plannedLine.length < 2 || !Array.isArray(vehiclePoint))
    return plannedLine;

  let closestIndex = 0;
  let closestDist = Infinity;
  for (let i = 0; i < plannedLine.length - 1; i++) {
    const { distanceSquared } = projectPointOnSegment(vehiclePoint, plannedLine[i], plannedLine[i + 1]);
    if (distanceSquared < closestDist) {
      closestDist = distanceSquared;
      closestIndex = i;
    }
  }
  // Toma los proximos 5 segmentos adelante para suavizar el bearing
  const slice = plannedLine.slice(closestIndex, closestIndex + 6);
  return slice.length >= 2 ? slice : plannedLine;
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
  darkMode = false,
}) {
  const { isLoaded: mapsApiLoaded, loadError: mapsApiLoadError, authError: mapsApiAuthError } = useGoogleMaps();

  const [displayPois, setDisplayPois] = useState(Array.isArray(pois) ? pois : []);
  const [animatedVehiclePoint, setAnimatedVehiclePoint] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [isVectorMap, setIsVectorMap] = useState(false);
  const [gpsMuted, setGpsMuted] = useState(false);
  const [activeStopId, setActiveStopId] = useState(null);
  const [gpsMenuOpen, setGpsMenuOpen] = useState(false);
  const [gpsNightMode, setGpsNightMode] = useState(false);
  const gpsMutedRef = useRef(false);
  const [, setGpsToast] = useState(null);
  const gpsToastTimerRef = useRef(null);
  const prevGpsModeRef = useRef(false);
  const lastToastStepKeyRef = useRef(null);

  const animationFrameRef = useRef(null);
  const animationStartRef = useRef(0);
  const previousAnimatedPointRef = useRef(null);
  const previousTraveledLineLengthRef = useRef(0);
  const poisTimerRef = useRef(null);
  const lastPoisFetchCoordsRef = useRef(null);
  const lastPoiFetchTimeRef = useRef(0);
  const fittedOnceRef = useRef(false);
  const lastFitLengthRef = useRef(-1);
  const firstFollowRef = useRef(true);
  const userMovedMapRef = useRef(true);
  const containerRef = useRef(null);
  const canvasRef = useRef(null); // VIALTROS-GPS: ref para canvas animado
  const spokenWarningsRef = useRef(new Set());
  const lastSpokenStepKeyRef = useRef(null);
  const currentHeadingRef = useRef(0);

  const [clickedPlace, setClickedPlace] = useState(null); // { lat, lng, address, loading }
  const [, setFollowPaused] = useState(true);
  const suppressListenerRef = useRef(false);
  const [mapZoomLevel, setMapZoomLevel] = useState(14);
  const [selectedVehicleKey, setSelectedVehicleKey] = useState(null);


  const handleMapLoad = useCallback((map) => {
    setMapRef(map);

    const renderingTypeEnum = window.google?.maps?.RenderingType;
    const isVectorOnLoad = map.getRenderingType?.() === renderingTypeEnum?.VECTOR;
    setIsVectorMap(isVectorOnLoad);

    const tilesListener = map.addListener("tilesloaded", () => {
      tilesListener.remove();
      const isVectorAfterTiles = map.getRenderingType?.() === renderingTypeEnum?.VECTOR;
      if (isVectorAfterTiles !== isVectorOnLoad) {
        setIsVectorMap(isVectorAfterTiles);
      }
    });
  }, []);

  // Cerrar menú GPS al hacer click fuera
  useEffect(() => {
    if (!gpsMenuOpen) return undefined;
    const close = () => setGpsMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [gpsMenuOpen]);


  // VIALTROS-GPS: monta animación simple en <canvas> para modo conducción
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    let rafId = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Polyfill roundRect una sola vez
    if (!ctx.roundRect) {
      ctx.roundRect = function(x, y, w, h, r) {
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
      };
    }

    let start = performance.now();
    const loop = (t) => {
      const elapsed = (t - start) / 1000;
      // clear
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      // colors según modo
      const day = !gpsNightMode;
      const bg1 = day ? '#86c2ff' : '#081428';
      const bg2 = day ? '#cfe9ff' : '#0b2338';

      // sky / vignette
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, bg1);
      g.addColorStop(1, bg2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // road
      const roadH = h * 0.45;
      const roadY = h - roadH;
      ctx.fillStyle = day ? '#2f2f2f' : '#111827';
      const roadW = w * 0.95;
      const roadX = (w - roadW) / 2;
      const radius = 20;
      // rounded rect road
      ctx.beginPath();
      ctx.moveTo(roadX + radius, roadY);
      ctx.lineTo(roadX + roadW - radius, roadY);
      ctx.quadraticCurveTo(roadX + roadW, roadY, roadX + roadW, roadY + radius);
      ctx.lineTo(roadX + roadW, roadY + roadH - radius);
      ctx.quadraticCurveTo(roadX + roadW, roadY + roadH, roadX + roadW - radius, roadY + roadH);
      ctx.lineTo(roadX + radius, roadY + roadH);
      ctx.quadraticCurveTo(roadX, roadY + roadH, roadX, roadY + roadH - radius);
      ctx.lineTo(roadX, roadY + radius);
      ctx.quadraticCurveTo(roadX, roadY, roadX + radius, roadY);
      ctx.closePath();
      ctx.fill();

      // lane markings — moving dashes
      ctx.strokeStyle = day ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([30, 20]);
      const offset = (elapsed * 200) % 50;
      ctx.lineDashOffset = -offset;
      const lanes = 4;
      for (let i = 1; i < lanes; i++) {
        const x = roadX + (roadW / lanes) * i;
        ctx.beginPath();
        ctx.moveTo(x, roadY + 20);
        ctx.lineTo(x, roadY + roadH - 20);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // vehicle marker (bottom center)
      ctx.fillStyle = '#1b3fa0';
      const carW = 36;
      const carH = 18;
      ctx.beginPath();
      ctx.roundRect((w - carW) / 2, roadY + roadH - carH - 10, carW, carH, 6);
      ctx.fill();

      rafId = requestAnimationFrame(loop);
    };

    // start
    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [gpsMode, gpsNightMode]);

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
      setMapZoomLevel(mapRef.getZoom() || 14);
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
        ? userCoords || WORLD_CENTER
        : latestPoint ||
          originCoords ||
          destinationCoords ||
          userCoords ||
          WORLD_CENTER,
    [
      focusAllVehicles,
      latestPoint,
      originCoords,
      destinationCoords,
      userCoords,
    ],
  );
  const defaultZoom = useMemo(() => {
    if (focusAllVehicles) return 13;
    if (latestPoint || originCoords || destinationCoords || userCoords) return 14;
    return 2;
  }, [focusAllVehicles, latestPoint, originCoords, destinationCoords, userCoords]);
  const loadLocalPois = useCallback(async () => {
    try {
      const res = await fetch("/pois.json");
      if (!res.ok) {
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
    } catch {
      // ignorar errores al cargar POIs locales
    }
  }, []);

  const fetchPOIs = useCallback(async (lat, lng, radiusMeters = 2000) => {
    const now = Date.now();
    // Throttle: máximo una llamada a Overpass cada 30 segundos
    if (now - lastPoiFetchTimeRef.current < 30_000) return;
    lastPoiFetchTimeRef.current = now;

    // Caché: evitar llamadas repetidas para la misma zona
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters}`;
    const cached = _poiCache.get(cacheKey);
    if (cached && now - cached.ts < POI_CACHE_TTL_MS) {
      setDisplayPois(cached.data);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
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
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        console.warn(`[MapView] Overpass API ${res.status} — usando POIs locales`);
        await loadLocalPois();
        return;
      }
      const data = await res.json();
      const parsed = (data.elements || []).map((el) => ({
        id: el.id,
        lat: el.lat ?? el.center?.lat,
        lon: el.lon ?? el.center?.lon,
        tags: el.tags || {},
      }));
      _poiCache.set(cacheKey, { data: parsed, ts: now });
      setDisplayPois(parsed);
      if (!parsed.length) {
        await loadLocalPois();
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.warn("[MapView] Overpass API timeout (25 s) — usando POIs locales");
      } else {
        console.warn("[MapView] Error fetching POIs:", err);
      }
      await loadLocalPois();
    } finally {
      clearTimeout(timer);
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
  const plannedPath = useMemo(() => safeLatLngPath(plannedLine), [plannedLine]);
  const remainingPath = useMemo(() => safeLatLngPath(remainingLine), [remainingLine]);
  const traveledPath = useMemo(() => safeLatLngPath(traveledLine), [traveledLine]);
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
        ? activeVehicles.filter((_, index) => index > 0)
        : activeVehicles,
    [activeVehicles, primaryVehicle],
  );
  const vehicleDirectionLine = useMemo(() => {
    const vp = effectiveVehiclePoint || vehiclePoint;
    if (gpsMode && plannedLine?.length > 1) {
      // En modo GPS usamos los segmentos ADELANTE del vehículo para calcular
      // el bearing correcto (hacia donde va, no hacia donde fue)
      return getAheadDirectionLine(plannedLine, vp);
    }
    return traveledLine?.length > 1
      ? traveledLine
      : plannedLine?.length > 1
        ? plannedLine
        : validPoints;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsMode, plannedLine, traveledLine, validPoints, effectiveVehiclePoint, vehiclePoint]);
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
      const geoBearing = (primaryVehicleRotationRef.current + 90 + 360) % 360;
      const bearingRad = geoBearing * Math.PI / 180;

      // Interpolación suave del heading para evitar saltos bruscos de orientación
      let headingDiff = geoBearing - currentHeadingRef.current;
      if (headingDiff > 180) headingDiff -= 360;
      if (headingDiff < -180) headingDiff += 360;
      const smoothedHeading = (currentHeadingRef.current + headingDiff * 0.35 + 360) % 360;
      currentHeadingRef.current = smoothedHeading;

      // Zoom dinámico según velocidad: más zoom a baja velocidad para ver detalle
      const vehicleSpeed = activeVehicles[0]?.speedKmh ?? 0;
      const targetZoom = vehicleSpeed > 90 ? 14 : vehicleSpeed > 65 ? 15 : vehicleSpeed > 40 ? 16 : vehicleSpeed > 15 ? 17 : 18;

      // Posicionar el vehículo en el tercio inferior de la pantalla.
      // Se calcula cuántos metros adelante debe estar el centro del mapa para que
      // el vehículo aparezca a ~68% de la parte superior (no en el centro).
      const currentZoom = mapRef.getZoom ? (mapRef.getZoom() || targetZoom) : targetZoom;
      const metersPerPixel = (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, currentZoom);
      const containerHeight = containerRef.current?.clientHeight || 700;
      const forwardOffsetM = metersPerPixel * containerHeight * 0.12;
      const forwardOffsetDeg = forwardOffsetM / 111320;
      const cosLat = Math.cos(lat * Math.PI / 180) || 1;
      const aheadLat = lat + forwardOffsetDeg * Math.cos(bearingRad);
      const aheadLng = lng + (forwardOffsetDeg / cosLat) * Math.sin(bearingRad);

      if (firstFollowRef.current) {
        firstFollowRef.current = false;
        suppressListenerRef.current = true;
        mapRef.setCenter({ lat: aheadLat, lng: aheadLng });
        mapRef.setZoom(targetZoom);
        suppressListenerRef.current = false;
      }

      const cameraOptions = {
        center: { lat: aheadLat, lng: aheadLng },
        zoom: targetZoom,
      };

      // Heading y tilt solo disponibles si el mapa realmente cargo como Vector
      if (isVectorMap) {
        cameraOptions.heading = smoothedHeading;
        cameraOptions.tilt = 45;
      }

      mapRef.moveCamera(cameraOptions);
      return;
    }

    if (userMovedMapRef.current) return;
    mapRef.panTo({ lat, lng });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, effectiveVehiclePoint, focusAllVehicles, hasLiveTrackings, gpsMode, activeVehicles, isVectorMap]);

  const plannedKm = Math.round((plannedLine?.length > 1 ? lineDistanceKm(plannedLine) : 0) * 10) / 10;
  const traveledKm = Math.round((traveledLine?.length > 1 ? lineDistanceKm(traveledLine) : 0) * 10) / 10;
  const pendingKm = Math.round(Math.max(0, plannedKm - traveledKm) * 10) / 10;

  // Aplica estilos del mapa según modo (GPS/noche/normal)
  useEffect(() => {
    if (!mapRef) return;
    if (USE_VECTOR_MAP) {
      // Con mapId activo, styles está prohibido — usar colorScheme (Cloud Styling)
      const isDark = (gpsMode && gpsNightMode) || (!gpsMode && darkMode);
      try {
        const scheme = isDark
          ? window.google?.maps?.ColorScheme?.DARK
          : window.google?.maps?.ColorScheme?.LIGHT;
        if (scheme !== undefined) mapRef.setOptions({ colorScheme: scheme });
      } catch { /* colorScheme no disponible en esta versión de la API */ }
      return;
    }
    let styles;
    if (gpsMode) {
      styles = gpsNightMode ? GPS_NIGHT_STYLES : GPS_NAV_STYLES;
    } else {
      styles = darkMode ? GPS_NIGHT_STYLES : GOOGLE_MAPS_STYLES;
    }
    mapRef.setOptions({
      styles,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      rotateControl: false,
      panControl: false,
    });
  }, [mapRef, gpsMode, gpsNightMode, darkMode, isVectorMap]);

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

  const handleMapClick = useCallback((e) => {
    setSelectedVehicleKey(null);
    setActiveStopId(null);
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

  return (
    <div
      ref={containerRef}
      className={`tracking-map-container ${gpsMode ? "tracking-map-fixed" : "tracking-map-relative"}`}
      style={gpsMode ? undefined : { height: mapHeight }}
    >
      {(mapsApiLoadError || mapsApiAuthError) ? (
        <div className="map-error-placeholder">
          No se pudo cargar Google Maps. Verifica la clave y los referers en la consola de Google Cloud.
        </div>
      ) : !mapsApiLoaded ? (
        <div className="map-loading-placeholder" />
      ) : (
      <GoogleMap
          mapContainerClassName="tracking-map-google-container"
          center={toLatLng(center) || { lat: WORLD_CENTER[0], lng: WORLD_CENTER[1] }}
          zoom={defaultZoom}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
          options={GOOGLE_MAPS_OPTIONS}
        >
          {/* ---- Rutas superpuestas (modo admin / focus all) — solo cuando hay ruta resaltada ---- */}
          {highlightedRouteIdSet.size > 0 && normalizedRouteOverlays.map((overlay) => {
            const isHighlighted = highlightedRouteIdSet.has(Number(overlay.id));
            const isDimmed = highlightedRouteIdSet.size > 0 && !isHighlighted;
            const path = safeLatLngPath(overlay.polyline);
            if (!path) return null;
            return (
              <React.Fragment key={`route-overlay-${overlay.id}`}>
                {isHighlighted && (
                  <Polyline
                    path={path}
                    options={{ strokeColor: "#3B82F6", strokeWeight: 14, strokeOpacity: 0.07, geodesic: true }}
                  />
                )}
                <Polyline
                  path={path}
                  options={{
                    strokeColor: "#FFFFFF",
                    strokeWeight: isHighlighted ? 9 : 6,
                    strokeOpacity: isDimmed ? 0.04 : isHighlighted ? 0.60 : 0.45,
                    geodesic: true,
                  }}
                />
                <Polyline
                  path={path}
                  options={{
                    strokeColor: isHighlighted ? "#1D4ED8" : CORPORATE_ROUTE_COLOR,
                    strokeWeight: isHighlighted ? 5 : 3,
                    strokeOpacity: isDimmed ? 0.15 : isHighlighted ? 0.95 : 0.85,
                    geodesic: true,
                  }}
                />
              </React.Fragment>
            );
          })}

          {/* ---- Ruta planificada (cuando no hay segmento restante calculado) ---- */}
          {plannedPath && !remainingPath && !isAdmin && (
            <>
              <Polyline
                path={plannedPath}
                options={{ strokeColor: ROUTE_COLOR_SHADOW, strokeWeight: 10, strokeOpacity: 0.06, geodesic: true }}
              />
              <Polyline
                path={plannedPath}
                options={{ strokeColor: "#FFFFFF", strokeWeight: 7, strokeOpacity: 0.55, geodesic: true }}
              />
              <Polyline
                path={plannedPath}
                options={{ strokeColor: ROUTE_COLOR, strokeWeight: 5, strokeOpacity: 1.0, geodesic: true }}
              />
            </>
          )}

          {/* ---- Tramo restante — azul Google Maps, grosor profesional ---- */}
          {remainingPath && !isAdmin && (
            <>
              <Polyline
                path={remainingPath}
                options={{ strokeColor: ROUTE_COLOR_SHADOW, strokeWeight: 10, strokeOpacity: 0.06, geodesic: true }}
              />
              <Polyline
                path={remainingPath}
                options={{ strokeColor: "#FFFFFF", strokeWeight: 7, strokeOpacity: 0.55, geodesic: true }}
              />
              <Polyline
                path={remainingPath}
                options={{ strokeColor: ROUTE_COLOR, strokeWeight: 5, strokeOpacity: 1.0, geodesic: true }}
              />
            </>
          )}

          {/* ---- Tramo recorrido — azul intenso diferenciado, misma familia visual ---- */}
          {traveledPath && !isAdmin && (
            <>
              <Polyline
                path={traveledPath}
                options={{ strokeColor: "#FFFFFF", strokeWeight: 5, strokeOpacity: 0.18, geodesic: true }}
              />
              <Polyline
                path={traveledPath}
                options={{ strokeColor: ROUTE_TRAVELED_COLOR, strokeWeight: 5, strokeOpacity: 0.55, geodesic: true }}
              />
            </>
          )}

          {/* ---- Origen ---- */}
          {toLatLng(originCoords) && (
            <OverlayView position={toLatLng(originCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div className="vt-map-overlay-center">
                <div className="vt-route-point vt-route-point-start" />
              </div>
            </OverlayView>
          )}

          {/* ---- Paradas intermedias ---- */}
          {normalizedIntermediateStops.map((stop) => {
            const isActiveStop = activeStopId === stop.id;
            return (
              <OverlayView
                key={`stop-${stop.id}`}
                position={toLatLng(stop.coords)}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div className="vt-map-overlay-center">
                  <div
                    className={`vt-route-stop-marker${isActiveStop ? " vt-route-stop-marker--active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveStopId(isActiveStop ? null : stop.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <span className="vt-route-stop-ring" />
                    <span className="vt-route-stop-core">{stop.order}</span>
                    {isActiveStop && (
                      <div className="vt-stop-tooltip">
                        <span className="vt-stop-tooltip-name">{stop.label || `Parada ${stop.order}`}</span>
                        {stop.address && stop.address !== stop.label && (
                          <span className="vt-stop-tooltip-addr">{stop.address}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </OverlayView>
            );
          })}

          {/* ---- Destino — pin de navegación ---- */}
          {toLatLng(destinationCoords) && (
            <OverlayView position={toLatLng(destinationCoords)} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
              <div style={{ transform: "translate(-50%, -100%)" }}>
                <div className="vt-dest-pin">
                  <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 1C7.37 1 2 6.37 2 13c0 8.63 12 22 12 22S26 21.63 26 13C26 6.37 20.63 1 14 1z" fill="#1d4ed8" stroke="white" strokeWidth="1.8"/>
                    <circle cx="14" cy="13" r="5" fill="white"/>
                    <circle cx="14" cy="13" r="2.5" fill="#1d4ed8"/>
                  </svg>
                </div>
              </div>
            </OverlayView>
          )}

          {/* ---- Vehículo principal ---- */}
          {primaryVehicle && toLatLng([primaryVehicle.latitude, primaryVehicle.longitude]) && (
            <OverlayView
              position={{ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div className="vt-map-overlay-center">
                <div
                  className="vt-marker-root"
                  onClick={(e) => { e.stopPropagation(); setSelectedVehicleKey(selectedVehicleKey === "primary" ? null : "primary"); }}
                >
                  {(() => {
                    const isMoving = primaryVehicle.status === "En ruta";
                    const dotColor = isMoving ? "#2563eb" : "#64748b";
                    const wedgeColor = isMoving ? "rgba(37,99,235,0.42)" : "rgba(100,116,139,0.35)";
                    const geoHeading = (primaryVehicleRotation + 90 + 360) % 360;
                    if (gpsMode) {
                      return (
                        <div className="vt-marker-gps-wrap">
                          <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g transform={`rotate(${geoHeading}, 26, 26)`}>
                              <path d="M26 26 L20 8 L32 8 Z" fill={wedgeColor}/>
                            </g>
                            <circle cx="26" cy="26" r="13.5" fill="white"/>
                            <circle cx="26" cy="26" r="10.5" fill={dotColor}/>
                            <circle cx="26" cy="26" r="4" fill="white" opacity="0.4"/>
                          </svg>
                        </div>
                      );
                    }
                    if (mapZoomLevel <= 12) {
                      return (
                        <div className="vt-marker-dot-wrap">
                          <div className={`vt-marker-dot-halo${!isMoving ? " vt-marker-dot-halo-idle" : ""}`} />
                          <div className={`vt-marker-dot-core${!isMoving ? " vt-marker-dot-core-idle" : ""}`} />
                        </div>
                      );
                    }
                    if (mapZoomLevel <= 15) {
                      return (
                        <div className="vt-marker-arrow-wrap">
                          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g transform={`rotate(${geoHeading}, 18, 18)`}>
                              <path d="M18 18 L13 5 L23 5 Z" fill={wedgeColor}/>
                            </g>
                            <circle cx="18" cy="18" r="9.5" fill="white"/>
                            <circle cx="18" cy="18" r="7.5" fill={dotColor}/>
                          </svg>
                        </div>
                      );
                    }
                    return (
                      <div className="vt-marker-vehicle-wrap">
                        <div className={`vt-marker-vehicle-halo${!isMoving ? " vt-marker-vehicle-halo-idle" : ""}`} />
                        <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", zIndex: 1 }}>
                          <g transform={`rotate(${geoHeading}, 23, 23)`}>
                            <path d="M23 23 L18 8 L28 8 Z" fill={wedgeColor}/>
                          </g>
                          <circle cx="23" cy="23" r="12" fill="white"/>
                          <circle cx="23" cy="23" r="9.5" fill={dotColor}/>
                          <circle cx="23" cy="23" r="3.5" fill="white" opacity="0.4"/>
                        </svg>
                      </div>
                    );
                  })()}
                  {selectedVehicleKey === "primary" && (
                    <div className="vt-vehicle-tooltip">
                      <span className="vt-vehicle-tooltip-plate">{primaryVehicle.label || "Vehiculo"}</span>
                      <span className="vt-vehicle-tooltip-status">{primaryVehicle.status}</span>
                    </div>
                  )}
                </div>
              </div>
            </OverlayView>
          )}

          {/* ---- Vehículos secundarios ---- */}
          {secondaryVehicles.map((vehicle) => {
            if (!Number.isFinite(vehicle.latitude) || !Number.isFinite(vehicle.longitude)) return null;
            const vKey = `sec-${vehicle.label}`;
            return (
              <OverlayView
                key={`${vehicle.label}-${vehicle.latitude}-${vehicle.longitude}`}
                position={{ lat: vehicle.latitude, lng: vehicle.longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div className="vt-map-overlay-center">
                  <div
                    className="vt-marker-root"
                    onClick={(e) => { e.stopPropagation(); setSelectedVehicleKey(selectedVehicleKey === vKey ? null : vKey); }}
                  >
                    {(() => {
                      const isMoving = vehicle.status === "En ruta";
                      const dotColor = isMoving ? "#2563eb" : "#64748b";
                      if (mapZoomLevel <= 12) {
                        return (
                          <div className="vt-marker-dot-wrap">
                            <div className={`vt-marker-dot-halo${!isMoving ? " vt-marker-dot-halo-idle" : ""}`} />
                            <div className={`vt-marker-dot-core${!isMoving ? " vt-marker-dot-core-idle" : ""}`} />
                          </div>
                        );
                      }
                      if (mapZoomLevel <= 15) {
                        return (
                          <div className="vt-marker-arrow-wrap">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="16" cy="16" r="8.5" fill="white"/>
                              <circle cx="16" cy="16" r="6.5" fill={dotColor}/>
                            </svg>
                          </div>
                        );
                      }
                      return (
                        <div className="vt-marker-vehicle-wrap">
                          <div className={`vt-marker-vehicle-halo${!isMoving ? " vt-marker-vehicle-halo-idle" : ""}`} />
                          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", zIndex: 1 }}>
                            <circle cx="20" cy="20" r="10.5" fill="white"/>
                            <circle cx="20" cy="20" r="8" fill={dotColor}/>
                            <circle cx="20" cy="20" r="3" fill="white" opacity="0.4"/>
                          </svg>
                        </div>
                      );
                    })()}
                    {selectedVehicleKey === vKey && (
                      <div className="vt-vehicle-tooltip">
                        <span className="vt-vehicle-tooltip-plate">{vehicle.label || "Vehiculo"}</span>
                        <span className="vt-vehicle-tooltip-status">{vehicle.status}</span>
                      </div>
                    )}
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
                  <div className="vt-map-overlay-center">
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
        // VIALTROS-GPS: nuevo HUD visual inspirado en diseño adjunto
        const arrivalTime = (() => {
          if (eta === null) return "--";
          const d = new Date(Date.now() + Number(eta) * 60000);
          return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
        })();

        const displaySpeed = Math.round((activeVehicles[0]?.speedKmh ?? 0) || 0);
        const licenseTag = primaryVehicle?.label || "LIC-000000";

        return (
          <div className="vt-gps-shell" aria-live="polite">

            {/* Barra superior: volver + etiqueta GPS + progreso + menu */}
            <div className="gps-topbar">
              <button className="top-back" onClick={() => { if (onExitGps) onExitGps(); else window.history.back(); }} title="Salir del GPS">
                ←
              </button>
              <div className="top-pill">GPS</div>
              <div className="top-pill top-pill-percent">{Math.round((plannedKm > 0 ? ((plannedKm - pendingKm) / plannedKm) * 100 : 0))}%</div>
              <div className="gps-topbar-menu">
                <button
                  className={`gps-action-btn${gpsMenuOpen ? ' gps-action-btn-active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setGpsMenuOpen((v) => !v); }}
                  aria-label="Más opciones"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
                </button>
                {gpsMenuOpen && (
                  <div className="gps-menu-popup" role="menu" onClick={(e) => e.stopPropagation()}>
                    <button className="gps-menu-item" onClick={() => { setGpsMenuOpen(false); userMovedMapRef.current = false; setFollowPaused(false); if (mapRef && primaryVehicle) { suppressListenerRef.current = true; mapRef.panTo({ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }); mapRef.setZoom(17); suppressListenerRef.current = false; } }}>Centrar en vehículo</button>
                    <button className="gps-menu-item" onClick={() => { setGpsMenuOpen(false); const next = !gpsMuted; setGpsMuted(next); gpsMutedRef.current = next; if (next && window.speechSynthesis) window.speechSynthesis.cancel(); }}>{gpsMuted ? 'Activar voz' : 'Silenciar voz'}</button>
                    <div className="gps-menu-divider" />
                    <button className="gps-menu-item" onClick={() => { setGpsMenuOpen(false); setGpsNightMode((v) => !v); }}>{gpsNightMode ? 'Modo claro' : 'Modo noche'}</button>
                    <div className="gps-menu-divider" />
                    <button className="gps-menu-item gps-menu-item-danger" onClick={() => { setGpsMenuOpen(false); if (onExitGps) onExitGps(); }}>Salir del GPS</button>
                  </div>
                )}
              </div>
            </div>

            {/* Tarjeta de giro: icono + distancia + nombre de calle */}
            <div className="turn-banner">
              <div id="turn-icon-box">{getArrowSvg(nextStep?.modifier, nextStep?.type, "#ffffff")}</div>
              <div id="turn-body">
                <div id="turn-dist">
                  {nextStep?.distanceAway
                    ? `en ${nextStep.distanceAway >= 1000 ? `${(nextStep.distanceAway / 1000).toFixed(1)} km` : `${Math.round(nextStep.distanceAway)} m`}`
                    : 'En ruta'}
                </div>
                <div id="turn-name">
                  {nextStep
                    ? (() => {
                        const instr = buildInstructionText(nextStep);
                        const street = nextStep.name && nextStep.name.length < 50 &&
                          !/^(Turn|Continue|Head|Keep|Take|Gira|Continúa|Contin|Siga|Tome)/i.test(nextStep.name)
                          ? nextStep.name : null;
                        return street ? `${instr} en ${street}` : instr;
                      })()
                    : destinationName || 'Hacia el destino'}
                </div>
              </div>
            </div>

            {/* Badge de velocidad: independiente, arriba-derecha */}
            <div id="spd-box">
              <div id="spd-val">{displaySpeed}</div>
              <div id="spd-lbl">km/h</div>
            </div>

            {/* Placa del vehículo */}
            {licenseTag && licenseTag !== 'LIC-000000' && (
              <div id="lic-tag">{licenseTag}</div>
            )}

            {/* Botones de acción: centrar, audio, zoom */}
            <div id="right-btns">
              <button className="rbtn" aria-label="Centrar en vehículo" title="Centrar" onClick={() => { setFollowPaused(false); if (mapRef && primaryVehicle) { suppressListenerRef.current = true; mapRef.panTo({ lat: primaryVehicle.latitude, lng: primaryVehicle.longitude }); mapRef.setZoom(17); suppressListenerRef.current = false; } }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>
              </button>
              <button className="rbtn" aria-label={gpsMuted ? 'Activar voz' : 'Silenciar voz'} title={gpsMuted ? 'Activar voz' : 'Silenciar voz'} onClick={() => { const next = !gpsMuted; setGpsMuted(next); gpsMutedRef.current = next; if (next && window.speechSynthesis) window.speechSynthesis.cancel(); }}>
                {gpsMuted
                  ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                }
              </button>
              <button className="rbtn" aria-label="Acercar" title="+" onClick={() => { if (mapRef?.getZoom) mapRef.setZoom((mapRef.getZoom() ?? 16) + 1); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button className="rbtn" aria-label="Alejar" title="−" onClick={() => { if (mapRef?.getZoom) mapRef.setZoom((mapRef.getZoom() ?? 16) - 1); }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>

            {/* Panel ETA inferior */}
            <div id="eta-panel">
              <div className="ep-block">
                <div className="ep-val">{eta === null ? '—' : `${eta} min`}</div>
                <div className="ep-lbl">Tiempo est.</div>
              </div>
              <div className="ep-block">
                <div className="ep-val">{pendingKm > 0 ? `${pendingKm} km` : '—'}</div>
                <div className="ep-lbl">Restante</div>
              </div>
              <div className="ep-block">
                <div className="ep-val">{arrivalTime}</div>
                <div className="ep-lbl">Llegada</div>
              </div>
              <button id="stop-nav" onClick={() => { if (onExitGps) onExitGps(); }}>
                Detener
              </button>
            </div>

          </div>
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

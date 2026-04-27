// TrackingPage.js — Vista principal de seguimiento en tiempo real
// Roles: admin (múltiples rutas activas), driver (ruta individual), user (ruta individual)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRoute, getRoutes } from "../services/admin";
import {
  getDriverAssignedRoutes,
  getDriverTrackings,
  getUserAssignedRoute,
} from "../services/dashboard";
import { loadGoogleMapsCore } from "../services/googleMapsLoader";
import { getStreetRouteThroughPoints, haversineKm } from "../services/routing";
import { connectTrackingWS } from "../services/ws";

const BUS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect x="2" y="6" width="28" height="18" rx="4" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>
  <rect x="4" y="8" width="10" height="7" rx="1" fill="#bfdbfe"/>
  <rect x="16" y="8" width="10" height="7" rx="1" fill="#bfdbfe"/>
  <circle cx="7" cy="27" r="3" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/>
  <circle cx="25" cy="27" r="3" fill="#1e3a8a" stroke="#fff" stroke-width="1.5"/>
  <rect x="12" y="17" width="8" height="4" rx="1" fill="#bfdbfe"/>
</svg>
`;

const ROUTE_COLORS = [
  "#3b82f6",
  "#14b8a6",
  "#60a5fa",
  "#0ea5e9",
  "#22c55e",
  "#38bdf8",
  "#2dd4bf",
  "#93c5fd",
];

function createBusMarkerIcon(google) {
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(BUS_SVG),
    scaledSize: new google.maps.Size(24, 24),
    anchor: new google.maps.Point(12, 12),
  };
}

function createDriverBusMarkerIcon(google, heading = 0) {
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 5,
    fillColor: "#2563eb",
    fillOpacity: 1,
    strokeColor: "#1d4ed8",
    strokeWeight: 1.5,
    rotation: heading,
    anchor: new google.maps.Point(0, 2),
  };
}

function passengerMarkerIcon(google, picked) {
  const color = picked ? "#16a34a" : "#6b7280";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="9" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="11" cy="8" r="3" fill="#fff"/>
    <path d="M5 18c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#fff"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(28, 28),
    anchor: new google.maps.Point(14, 14),
  };
}

function getRouteDriverName(route) {
  return (
    route?.driver_name ||
    route?.driver_detail?.user_detail?.username ||
    route?.driver ||
    "—"
  );
}

function getRoutePassengerCount(route) {
  if (Number.isFinite(Number(route?.passenger_count))) {
    return Number(route.passenger_count);
  }
  return Array.isArray(route?.passenger_details) ? route.passenger_details.length : 0;
}

function getRoutePoints(route) {
  const originLat = Number(route?.origin_lat);
  const originLng = Number(route?.origin_lng);
  const destLat = Number(route?.destination_lat);
  const destLng = Number(route?.destination_lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destLat) ||
    !Number.isFinite(destLng)
  ) {
    return [];
  }

  const intermediateStops = Array.isArray(route?.intermediate_stops)
    ? route.intermediate_stops
    : [];

  const stops = intermediateStops
    .filter(
      (stop) =>
        Number.isFinite(Number(stop?.latitude)) &&
        Number.isFinite(Number(stop?.longitude))
    )
    .map((stop) => [Number(stop.latitude), Number(stop.longitude)]);

  return [
    [originLat, originLng],
    ...stops,
    [destLat, destLng],
  ];
}

function getRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function getLatestTrackingsByRoute(trackings) {
  return (Array.isArray(trackings) ? trackings : []).reduce((acc, tracking) => {
    if (tracking?.passenger != null && tracking?.passenger !== "") {
      return acc;
    }

    const routeKey = Number(tracking?.route);
    if (!Number.isFinite(routeKey)) {
      return acc;
    }

    const current = acc[routeKey];
    if (!current) {
      acc[routeKey] = tracking;
      return acc;
    }

    const currentTime = new Date(current.timestamp || 0).getTime();
    const nextTime = new Date(tracking.timestamp || 0).getTime();
    if (nextTime > currentTime) {
      acc[routeKey] = tracking;
      return acc;
    }

    if (nextTime === currentTime && Number(tracking.id || 0) > Number(current.id || 0)) {
      acc[routeKey] = tracking;
    }

    return acc;
  }, {});
}

function buildLiveDataFromTrackings(trackings) {
  const latestByRoute = getLatestTrackingsByRoute(trackings);
  return Object.entries(latestByRoute).reduce((acc, [routeKey, tracking]) => {
    const lat = Number(tracking?.latitude);
    const lng = Number(tracking?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return acc;
    }

    acc[routeKey] = {
      busPosition: [lat, lng],
      busSpeed: tracking?.speed_kmh != null ? Number(tracking.speed_kmh) : null,
      busTimestamp: tracking?.timestamp || null,
    };
    return acc;
  }, {});
}

function fitMapToPoints(google, map, points) {
  if (!google || !map || !Array.isArray(points) || points.length === 0) {
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  points.forEach(([lat, lng]) => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      bounds.extend({ lat, lng });
    }
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { top: 60, right: 24, bottom: 24, left: 24 });
  }
}

function createMapForContainer(container, google) {
  return new google.maps.Map(container, {
    center: { lat: 4.5709, lng: -74.2973 },
    zoom: 6,
    mapTypeId: "roadmap",
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
    ],
  });
}

// Estilos oscuros para modo GPS de navegación
const GPS_DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#0a0e13" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e13" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#60a5fa" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2634" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f1820" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#93c5fd" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e3a52" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#0d2a40" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#1a2f47" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#93c5fd" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#1a2634" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#60a5fa" }] },
];

const MAP_LIGHT_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

// Devuelve el índice del punto más cercano de la polilínea a una posición dada
function findClosestPointIndex(coords, position) {
  let minDist = Infinity;
  let idx = 0;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineKm(position, coords[i]);
    if (d < minDist) { minDist = d; idx = i; }
  }
  return idx;
}

// Suma las distancias entre puntos consecutivos de la polilínea
function polylineDistanceKm(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i]);
  }
  return total;
}

function isRecentTimestamp(timestamp, maxMinutes = 10) {
  if (!timestamp) return false;
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed <= maxMinutes * 60 * 1000;
}

function isPickupCompleted(status) {
  return ["picked", "picked_up", "on_board"].includes(String(status || "").toLowerCase());
}

function getLatestPassengerTrackings(trackings) {
  return (Array.isArray(trackings) ? trackings : []).reduce((acc, tracking) => {
    if (tracking?.passenger == null || tracking?.passenger === "") {
      return acc;
    }

    const passengerKey = Number(tracking.passenger);
    if (!Number.isFinite(passengerKey)) {
      return acc;
    }

    const current = acc[passengerKey];
    if (!current) {
      acc[passengerKey] = tracking;
      return acc;
    }

    const currentTime = new Date(current.timestamp || 0).getTime();
    const nextTime = new Date(tracking.timestamp || 0).getTime();
    if (nextTime > currentTime) {
      acc[passengerKey] = tracking;
      return acc;
    }

    if (nextTime === currentTime && Number(tracking.id || 0) > Number(current.id || 0)) {
      acc[passengerKey] = tracking;
    }

    return acc;
  }, {});
}

function getHeadingDegrees(from, to) {
  if (!Array.isArray(from) || !Array.isArray(to)) return 0;

  const lat1 = (from[0] * Math.PI) / 180;
  const lng1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const lng2 = (to[1] * Math.PI) / 180;
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const heading = (Math.atan2(y, x) * 180) / Math.PI;
  return (heading + 360) % 360;
}

function getStreetNameFromResult(result) {
  const routeComponent = result?.address_components?.find((component) =>
    Array.isArray(component.types) && component.types.includes("route")
  );

  if (routeComponent?.long_name) {
    return routeComponent.long_name;
  }

  return String(result?.formatted_address || "").split(",")[0] || "Ubicación actual";
}

function formatMeters(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return "—";
  }

  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function getWsAggregateStatus(statusByRoute) {
  const statuses = Object.values(statusByRoute || {});
  if (statuses.some((status) => status === "open")) {
    return "open";
  }
  if (statuses.some((status) => status === "connecting")) {
    return "connecting";
  }
  return "closed";
}

function getAdminRouteState(route, liveData, wsStatus) {
  if (!route?.driver && !route?.driver_detail) {
    return { label: "Sin conductor", color: "bg-gray-100 text-gray-500" };
  }
  if (liveData?.busPosition && isRecentTimestamp(liveData?.busTimestamp)) {
    return { label: "Activo", color: "bg-green-100 text-green-700" };
  }
  if (liveData?.busPosition) {
    return { label: "Inactivo", color: "bg-amber-100 text-amber-700" };
  }
  if (wsStatus === "connecting") {
    return { label: "Conectando", color: "bg-yellow-100 text-yellow-700" };
  }
  return { label: "Sin señal", color: "bg-red-100 text-red-600" };
}

function cleanupAdminTrackingResources({ socketClientsRef, routeObjectsRef, busMarkersRef }) {
  socketClientsRef.current.forEach((client) => client.close());
  routeObjectsRef.current.forEach((objects) => {
    objects.polyline?.setMap(null);
    objects.originMarker?.setMap(null);
    objects.destinationMarker?.setMap(null);
  });
  busMarkersRef.current.forEach((marker) => marker.setMap(null));
}

const APPROACH_THRESHOLD_METERS = 200;

export default function TrackingPage({ role }) {
  if (role === "admin") {
    return <AdminTrackingPage />;
  }

  return <SingleRouteTrackingPage role={role} />;
}

function AdminTrackingPage() {
  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeObjectsRef = useRef(new Map());
  const busMarkersRef = useRef(new Map());
  const socketClientsRef = useRef(new Map());

  const [routes, setRoutes] = useState([]);
  const [routeTrackings, setRouteTrackings] = useState([]);
  const [liveDataByRoute, setLiveDataByRoute] = useState({});
  const [wsStatusByRoute, setWsStatusByRoute] = useState({});
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mapLoadError, setMapLoadError] = useState(null);

  const activeRoutes = useMemo(
    () => routes.filter((route) => getRoutePoints(route).length >= 2),
    [routes]
  );
  const aggregateWsStatus = getWsAggregateStatus(wsStatusByRoute);

  useEffect(() => {
    setLoadingRoutes(true);
    setLoadError(null);

    Promise.all([
      getRoutes().catch(() => []),
      getDriverTrackings({ summary: true }).catch(() => []),
    ])
      .then(([allRoutes, trackings]) => {
        setRoutes(Array.isArray(allRoutes) ? allRoutes : []);
        setRouteTrackings(Array.isArray(trackings) ? trackings : []);
      })
      .catch((err) => setLoadError(err?.message || "Error al cargar las rutas"))
      .finally(() => setLoadingRoutes(false));
  }, []);

  useEffect(() => {
    setLiveDataByRoute(buildLiveDataFromTrackings(routeTrackings));
  }, [routeTrackings]);

  useEffect(() => {
    let cancelled = false;
    setMapReady(false);
    setMapLoadError(null);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (!window.google?.maps) {
        setMapLoadError(
          "No se pudo inicializar Google Maps en 10 segundos. Verifica la API key, la red y la consola del navegador."
        );
      }
    }, 10000);

    loadGoogleMapsCore()
      .then(async (google) => {
        clearTimeout(timeoutId);
        if (cancelled || !mapRef.current) return;
        googleRef.current = google;
        console.log("Inicializando mapa en el div...");
        const mapsLibrary = typeof google.maps.importLibrary === "function"
          ? await google.maps.importLibrary("maps")
          : null;
        const MapConstructor = mapsLibrary?.Map || google.maps.Map;
        if (typeof MapConstructor !== "function") {
          throw new Error("Google Maps cargó pero la librería maps no se inicializó correctamente.");
        }

        mapInstanceRef.current = createMapForContainer(mapRef.current, google);
        setMapReady(true);
        setMapLoadError(null);
        console.log("Mapa listo");
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        setMapLoadError(
          err?.message || "No se pudo cargar Google Maps. Revisa la API key y la conexión."
        );
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !googleRef.current) return;

    const google = googleRef.current;
    const map = mapInstanceRef.current;
    const nextRouteObjects = new Map();
    const allPoints = [];

    routeObjectsRef.current.forEach((objects) => {
      objects.polyline?.setMap(null);
      objects.originMarker?.setMap(null);
      objects.destinationMarker?.setMap(null);
    });

    activeRoutes.forEach((route, index) => {
      const routeId = Number(route.id);
      const points = getRoutePoints(route);
      const color = getRouteColor(index);
      const faded = selectedRouteId != null && Number(selectedRouteId) !== routeId;

      const originMarker = new google.maps.Marker({
        position: { lat: points[0][0], lng: points[0][1] },
        map,
        title: `Origen: ${route.name || `Ruta #${routeId}`}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#dbeafe",
          fillOpacity: faded ? 0.3 : 0.9,
          strokeColor: color,
          strokeWeight: 2,
        },
        opacity: faded ? 0.4 : 1,
        zIndex: 5,
      });

      const destinationMarker = new google.maps.Marker({
        position: { lat: points[points.length - 1][0], lng: points[points.length - 1][1] },
        map,
        title: `Destino: ${route.name || `Ruta #${routeId}`}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: faded ? 0.3 : 0.9,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        opacity: faded ? 0.4 : 1,
        zIndex: 5,
      });

      nextRouteObjects.set(routeId, {
        polyline: null,
        originMarker,
        destinationMarker,
        points,
      });

      allPoints.push(...points);
    });

    routeObjectsRef.current = nextRouteObjects;

    if (selectedRouteId == null) {
      fitMapToPoints(google, map, allPoints);
    }
  }, [activeRoutes, mapReady, selectedRouteId]);

  useEffect(() => {
    if (!mapReady || !googleRef.current || selectedRouteId == null) return;

    const selectedRoute = activeRoutes.find(
      (route) => Number(route.id) === Number(selectedRouteId)
    );
    if (!selectedRoute) return;

    fitMapToPoints(googleRef.current, mapInstanceRef.current, getRoutePoints(selectedRoute));
  }, [activeRoutes, mapReady, selectedRouteId]);

  useEffect(() => {
    const nextStatuses = activeRoutes.reduce((acc, route) => {
      acc[route.id] = "connecting";
      return acc;
    }, {});
    setWsStatusByRoute(nextStatuses);

    const timers = [];
    const currentClients = new Map();
    let cancelled = false;

    activeRoutes.forEach((route) => {
      const timer = setTimeout(() => {
        if (cancelled) return;

        const client = connectTrackingWS(
          route.id,
          (payload) => {
            const data = payload?.data || payload;
            const lat = Number(data?.latitude);
            const lng = Number(data?.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            setLiveDataByRoute((prev) => ({
              ...prev,
              [route.id]: {
                busPosition: [lat, lng],
                busSpeed: data?.speed_kmh != null ? Number(data.speed_kmh) : null,
                busTimestamp: data?.timestamp || null,
              },
            }));
          },
          {
            onOpen: () => {
              setWsStatusByRoute((prev) => ({ ...prev, [route.id]: "open" }));
            },
            onClose: () => {
              setWsStatusByRoute((prev) => ({ ...prev, [route.id]: "closed" }));
            },
            onError: () => {
              setWsStatusByRoute((prev) => ({ ...prev, [route.id]: "closed" }));
            },
          }
        );

        currentClients.set(route.id, client);
        socketClientsRef.current.set(route.id, client);
      }, 0);

      timers.push(timer);
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
      currentClients.forEach((client) => client.close());
      socketClientsRef.current = new Map();
    };
  }, [activeRoutes]);

  useEffect(() => {
    if (!mapReady || !googleRef.current) return;

    const google = googleRef.current;
    const map = mapInstanceRef.current;
    const activeRouteIds = new Set(activeRoutes.map((route) => Number(route.id)));

    busMarkersRef.current.forEach((marker, routeId) => {
      if (!activeRouteIds.has(Number(routeId))) {
        marker.setMap(null);
        busMarkersRef.current.delete(routeId);
      }
    });

    activeRoutes.forEach((route) => {
      const liveData = liveDataByRoute[route.id];
      const position = liveData?.busPosition;
      const existingMarker = busMarkersRef.current.get(route.id);

      if (!position) {
        if (existingMarker) {
          existingMarker.setMap(null);
          busMarkersRef.current.delete(route.id);
        }
        return;
      }

      const latLng = new google.maps.LatLng(position[0], position[1]);
      if (!existingMarker) {
        const marker = new google.maps.Marker({
          position: latLng,
          map,
          title: `${route.name || `Ruta #${route.id}`} - Bus en camino`,
          icon: createBusMarkerIcon(google),
          opacity: Number(selectedRouteId) === Number(route.id) || selectedRouteId == null ? 1 : 0.38,
          zIndex: Number(selectedRouteId) === Number(route.id) ? 12 : 10,
        });
        busMarkersRef.current.set(route.id, marker);
        return;
      }

      existingMarker.setPosition(latLng);
      existingMarker.setZIndex(Number(selectedRouteId) === Number(route.id) ? 12 : 10);
      existingMarker.setOpacity(
        Number(selectedRouteId) === Number(route.id) || selectedRouteId == null ? 1 : 0.38
      );
    });
  }, [activeRoutes, liveDataByRoute, mapReady, selectedRouteId]);

  useEffect(() => {
    return () => {
      cleanupAdminTrackingResources({
        socketClientsRef,
        routeObjectsRef,
        busMarkersRef,
      });
    };
  }, []);

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center max-w-sm">
          <p className="text-red-600 font-semibold mb-4">{loadError}</p>
          <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
            ← Panel
          </Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-base font-semibold text-gray-800">
            Tracking general de rutas
          </h1>
        </div>
        <WsStatusBadge status={aggregateWsStatus} />
      </header>

      <div className="flex flex-1 overflow-hidden p-6 gap-5" style={{ height: "calc(100vh - 57px)" }}>
        <aside className="w-72 bg-white border border-gray-200 rounded-xl overflow-y-auto flex-shrink-0 shadow-sm">
          <AdminRoutesPanel
            routes={activeRoutes}
            liveDataByRoute={liveDataByRoute}
            wsStatusByRoute={wsStatusByRoute}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(routeId) => setSelectedRouteId(routeId)}
          />
        </aside>

        <div className="flex-1 relative rounded-xl overflow-hidden">
          <div ref={mapRef} className="w-full" style={{ height: "100%" }} />
          {loadingRoutes && (
            <div className="absolute top-3 left-3 z-10 bg-white/95 border border-gray-200 rounded-lg shadow-sm px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                <span>Cargando rutas activas...</span>
              </div>
            </div>
          )}
          {!mapReady && !mapLoadError && (
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Cargando mapa...</p>
              </div>
            </div>
          )}
          {mapLoadError && (
            <div className="absolute inset-0 bg-white flex items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-red-600 font-semibold mb-2">Error al cargar el mapa</p>
                <p className="text-sm text-gray-500">{mapLoadError}</p>
              </div>
            </div>
          )}
          <MapLegend />
        </div>
      </div>
    </div>
  );
}

function SingleRouteTrackingPage({ role }) {
  const { routeId } = useParams();
  const navigate = useNavigate();

  const mapRef = useRef(null);
  const googleRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const traveledPolylineRef = useRef(null);
  const remainingPolylineRef = useRef(null);
  const streetRouteCoordsRef = useRef(null);
  const busMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const passengerMarkersRef = useRef([]);
  const stopMarkersRef = useRef(new Map());
  const wsRef = useRef(null);
  const routeDrawVersionRef = useRef(0);
  const lastBootstrappedRouteIdRef = useRef(null);
  const lastBusPositionRef = useRef(null);
  const lastStreetLookupRef = useRef(null);

  const [routeData, setRouteData] = useState(null);
  const [trackings, setTrackings] = useState([]);
  const [busPosition, setBusPosition] = useState(null);
  const [busSpeed, setBusSpeed] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [mapReady, setMapReady] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [mapLoadError, setMapLoadError] = useState(null);
  const [eta, setEta] = useState(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [driverStreetName, setDriverStreetName] = useState("");
  const [resolvedRouteId, setResolvedRouteId] = useState(routeId || null);
  const [resolvingAssignedRoute, setResolvingAssignedRoute] = useState(
    !routeId && (role === "driver" || role === "user" || role === "passenger")
  );
  // Driver-specific: multiple routes selector & GPS mode
  const [driverRoutes, setDriverRoutes] = useState(null); // null = not loaded yet
  const [gpsMode, setGpsMode] = useState(false);
  const [approachingStop, setApproachingStop] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveAssignedRoute() {
      if (routeId) {
        setResolvedRouteId(routeId);
        setResolvingAssignedRoute(false);
        setLoadError(null);
        return;
      }

      if (role !== "driver" && role !== "user" && role !== "passenger") {
        setResolvedRouteId(null);
        setResolvingAssignedRoute(false);
        setLoadingRoute(false);
        return;
      }

      setResolvingAssignedRoute(true);
      setLoadingRoute(true);
      setLoadError(null);

      try {
        let assignedRouteId = null;

        if (role === "driver") {
          const routes = await getDriverAssignedRoutes();
          const validRoutes = Array.isArray(routes) ? routes.filter((r) => getRoutePoints(r).length >= 2) : [];

          if (validRoutes.length > 1) {
            // Let driver choose from multiple scheduled routes
            setDriverRoutes(validRoutes);
            setResolvingAssignedRoute(false);
            setLoadingRoute(false);
            return;
          }

          assignedRouteId = validRoutes[0]?.id ?? routes?.[0]?.id ?? null;
        } else {
          const payload = await getUserAssignedRoute();
          assignedRouteId = payload?.route?.id ?? null;
        }

        if (cancelled) return;

        if (!assignedRouteId) {
          setResolvedRouteId(null);
          setResolvingAssignedRoute(false);
          setRouteData(null);
          setTrackings([]);
          setBusPosition(null);
          setBusSpeed(null);
          setLoadingRoute(false);
          setLoadError(
            role === "driver"
              ? "No tienes una ruta asignada actualmente."
              : "No tienes una ruta asignada actualmente."
          );
          return;
        }

        const resolvedId = String(assignedRouteId);
        setResolvedRouteId(resolvedId);
        setResolvingAssignedRoute(false);
        navigate(`/tracking/${resolvedId}`, { replace: true });
      } catch (err) {
        if (cancelled) return;
        setResolvedRouteId(null);
        setResolvingAssignedRoute(false);
        setLoadingRoute(false);
        setLoadError(err?.message || "No se pudo resolver la ruta asignada");
      }
    }

    void resolveAssignedRoute();

    return () => {
      cancelled = true;
    };
  }, [navigate, role, routeId]);

  useEffect(() => {
    if (resolvingAssignedRoute) {
      return;
    }

    if (!resolvedRouteId) {
      setLoadingRoute(false);
      return;
    }

    setLoadingRoute(true);
    setLoadError(null);
    lastBootstrappedRouteIdRef.current = null;

    Promise.all([
      getRoute(resolvedRouteId).catch(() => null),
      getDriverTrackings({ routeId: resolvedRouteId, summary: true }).catch(() => []),
    ])
      .then(([route, driverTrackings]) => {
        setRouteData(route);
        setTrackings(Array.isArray(driverTrackings) ? driverTrackings : []);
      })
      .catch((err) => setLoadError(err?.message || "Error al cargar la ruta"))
      .finally(() => setLoadingRoute(false));
  }, [resolvedRouteId, resolvingAssignedRoute]);

  useEffect(() => {
    if (!resolvedRouteId) return;

    const currentRouteId = Number(resolvedRouteId);
    if (!Number.isFinite(currentRouteId) || !Array.isArray(trackings) || trackings.length === 0) {
      return;
    }
    if (lastBootstrappedRouteIdRef.current === currentRouteId) return;

    const latestTracking = getLatestTrackingsByRoute(trackings)[currentRouteId];
    const lat = Number(latestTracking?.latitude);
    const lng = Number(latestTracking?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    lastBootstrappedRouteIdRef.current = currentRouteId;
    setBusPosition([lat, lng]);
    setBusSpeed(
      latestTracking?.speed_kmh != null ? Number(latestTracking.speed_kmh) : null
    );
  }, [resolvedRouteId, trackings]);

  useEffect(() => {
    let cancelled = false;
    setMapReady(false);
    setMapLoadError(null);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (!window.google?.maps) {
        setMapLoadError(
          "No se pudo inicializar Google Maps en 10 segundos. Verifica la API key, la red y la consola del navegador."
        );
      }
    }, 10000);

    loadGoogleMapsCore()
      .then(async (google) => {
        clearTimeout(timeoutId);
        if (cancelled || !mapRef.current) return;
        googleRef.current = google;
        console.log("Inicializando mapa en el div...");
        const mapsLibrary = typeof google.maps.importLibrary === "function"
          ? await google.maps.importLibrary("maps")
          : null;
        const MapConstructor = mapsLibrary?.Map || google.maps.Map;
        if (typeof MapConstructor !== "function") {
          throw new Error("Google Maps cargó pero la librería maps no se inicializó correctamente.");
        }

        mapInstanceRef.current = createMapForContainer(mapRef.current, google);
        setMapReady(true);
        setMapLoadError(null);
        console.log("Mapa listo");
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (cancelled) return;
        setMapLoadError(
          err?.message || "No se pudo cargar Google Maps. Revisa la API key y la conexión."
        );
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !routeData || !googleRef.current) return;

    routeDrawVersionRef.current += 1;
    const currentDrawVersion = routeDrawVersionRef.current;
    const google = googleRef.current;
    const map = mapInstanceRef.current;
    const allPoints = getRoutePoints(routeData);
    if (allPoints.length < 2) return;

    // Reset street coords and progress polylines when route changes
    streetRouteCoordsRef.current = null;
    if (traveledPolylineRef.current) { traveledPolylineRef.current.setMap(null); traveledPolylineRef.current = null; }
    if (remainingPolylineRef.current) { remainingPolylineRef.current.setMap(null); remainingPolylineRef.current = null; }
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    // Draw initial full route as remaining (placeholder until street route loads)
    remainingPolylineRef.current = new google.maps.Polyline({
      path: allPoints.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: "#0066ff",
      strokeWeight: 6,
      strokeOpacity: 0.8,
      geodesic: true,
      map,
      zIndex: 2,
    });

    fitMapToPoints(google, map, allPoints);

    if (originMarkerRef.current) originMarkerRef.current.setMap(null);
    originMarkerRef.current = new google.maps.Marker({
      position: { lat: allPoints[0][0], lng: allPoints[0][1] },
      map,
      title: `Origen: ${routeData.origin || "Inicio de ruta"}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 9,
        fillColor: "#93c5fd",
        fillOpacity: 1,
        strokeColor: "#1d4ed8",
        strokeWeight: 2,
      },
      zIndex: 5,
    });

    if (destinationMarkerRef.current) destinationMarkerRef.current.setMap(null);
    destinationMarkerRef.current = new google.maps.Marker({
      position: { lat: allPoints[allPoints.length - 1][0], lng: allPoints[allPoints.length - 1][1] },
      map,
      title: `Destino: ${routeData.destination || "Destino"}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#1e40af",
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: 2,
      },
      zIndex: 5,
    });

    passengerMarkersRef.current.forEach((marker) => marker.setMap(null));
    passengerMarkersRef.current = (routeData.passenger_details || [])
      .filter(
        (passenger) =>
          Number.isFinite(Number(passenger.pickup_lat)) &&
          Number.isFinite(Number(passenger.pickup_lng))
      )
      .map((passenger) => new google.maps.Marker({
        position: {
          lat: Number(passenger.pickup_lat),
          lng: Number(passenger.pickup_lng),
        },
        map,
        title: `${passenger.user_detail?.username || "Pasajero"} — ${passenger.pickup_address || ""}`,
        icon: passengerMarkerIcon(google, false),
        zIndex: 4,
      }));

    getStreetRouteThroughPoints(allPoints)
      .then((streetRoute) => {
        if (currentDrawVersion !== routeDrawVersionRef.current) return;
        if (streetRoute?.coordinates?.length > 1) {
          // Store street coords for progress tracking
          streetRouteCoordsRef.current = streetRoute.coordinates;
          // Redraw remaining polyline with actual street route
          if (remainingPolylineRef.current) remainingPolylineRef.current.setMap(null);
          remainingPolylineRef.current = new google.maps.Polyline({
            path: streetRoute.coordinates.map(([lat, lng]) => ({ lat, lng })),
            strokeColor: "#0066ff",
            strokeWeight: 6,
            strokeOpacity: 0.95,
            geodesic: true,
            map: mapInstanceRef.current,
            zIndex: 2,
          });
        }
      })
      .catch(() => {});
  }, [mapReady, routeData]);

  useEffect(() => {
    if (!resolvedRouteId) return;

    let cancelled = false;
    let socketClient = null;

    const timer = setTimeout(() => {
      if (cancelled) return;

      socketClient = connectTrackingWS(
        resolvedRouteId,
        (payload) => {
          const data = payload?.data || payload;
          const lat = Number(data?.latitude);
          const lng = Number(data?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          setBusPosition([lat, lng]);
          setBusSpeed(data?.speed_kmh != null ? Number(data.speed_kmh) : null);
        },
        {
          onOpen: () => setWsStatus("open"),
          onClose: () => setWsStatus("closed"),
          onError: () => setWsStatus("closed"),
        }
      );

      wsRef.current = socketClient;
      setWsStatus("connecting");
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (socketClient) {
        socketClient.close();
      }
      wsRef.current = null;
    };
  }, [resolvedRouteId]);

  useEffect(() => {
    if (!busPosition || !mapReady || !googleRef.current) return;
    const google = googleRef.current;
    const map = mapInstanceRef.current;
    const latLng = new google.maps.LatLng(busPosition[0], busPosition[1]);
    const previousPosition = lastBusPositionRef.current;
    const heading = previousPosition ? getHeadingDegrees(previousPosition, busPosition) : driverHeading;

    if (role === "driver" && gpsMode) {
      setDriverHeading(heading);
      map.panTo(latLng);
      map.setHeading(heading);
      if (map.getZoom() < 16) {
        map.setZoom(17);
      }
    } else if (role === "driver") {
      setDriverHeading(heading);
    }

    if (!busMarkerRef.current) {
      busMarkerRef.current = new google.maps.Marker({
        position: latLng,
        map,
        title: "Bus en camino",
        icon:
          role === "driver"
            ? createDriverBusMarkerIcon(google, heading)
            : createBusMarkerIcon(google),
        zIndex: 10,
      });
      lastBusPositionRef.current = busPosition;
      return;
    }

    busMarkerRef.current.setPosition(latLng);
    if (role === "driver") {
      busMarkerRef.current.setIcon(createDriverBusMarkerIcon(google, heading));
    }
    lastBusPositionRef.current = busPosition;
  }, [busPosition, driverHeading, gpsMode, mapReady, role]);

  // Efecto: al activar/desactivar GPS mode → cambiar estilo del mapa, tilt y zoom
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (gpsMode) {
      map.setOptions({
        styles: GPS_DARK_STYLES,
        tilt: 45,
        rotateControl: true,
        zoomControl: false,
        fullscreenControl: false,
      });
      map.setZoom(18);
      if (busPosition) {
        map.panTo({ lat: busPosition[0], lng: busPosition[1] });
      }
    } else {
      map.setOptions({
        styles: MAP_LIGHT_STYLES,
        tilt: 0,
        rotateControl: false,
        zoomControl: true,
        fullscreenControl: true,
      });
    }
  }, [gpsMode, mapReady, busPosition]);

  useEffect(() => {
    if (role !== "driver" || !busPosition || !googleRef.current) return;

    const lastLookup = lastStreetLookupRef.current;
    if (lastLookup && haversineKm(lastLookup, busPosition) < 0.03) {
      return;
    }

    let alive = true;
    const geocoder = new googleRef.current.maps.Geocoder();
    geocoder.geocode(
      { location: { lat: busPosition[0], lng: busPosition[1] } },
      (results, status) => {
        if (!alive || status !== "OK" || !Array.isArray(results) || results.length === 0) {
          return;
        }

        lastStreetLookupRef.current = busPosition;
        setDriverStreetName(getStreetNameFromResult(results[0]));
      }
    );

    return () => {
      alive = false;
    };
  }, [busPosition, role]);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      [polylineRef, traveledPolylineRef, remainingPolylineRef, busMarkerRef, originMarkerRef, destinationMarkerRef].forEach((ref) => {
        if (ref.current) ref.current.setMap(null);
      });
      passengerMarkersRef.current.forEach((marker) => marker.setMap(null));
    };
  }, []);

  // Progreso de ruta en tiempo real: tramo recorrido (gris) + tramo restante (azul) + ETA
  useEffect(() => {
    if (!busPosition || !mapReady || !googleRef.current) return;
    const google = googleRef.current;
    const map = mapInstanceRef.current;
    const coords = streetRouteCoordsRef.current;

    if (!coords || coords.length < 2) {
      // Sin ruta de calle aún → ETA simple por distancia al destino
      if (routeData) {
        const destLat = Number(routeData.destination_lat);
        const destLng = Number(routeData.destination_lng);
        if (Number.isFinite(destLat) && Number.isFinite(destLng)) {
          const distKm = haversineKm(busPosition, [destLat, destLng]);
          const speedKmh = busSpeed && busSpeed > 2 ? busSpeed : 25;
          setEta(Math.ceil((distKm / speedKmh) * 60));
        }
      }
      return;
    }

    const closestIdx = findClosestPointIndex(coords, busPosition);
    const traveled = coords.slice(0, closestIdx + 1);
    const remaining = coords.slice(closestIdx);

    // En modo GPS: colores más visibles y contrastantes
    if (gpsMode) {
      // Tramo recorrido (gris oscuro con borde)
      if (traveledPolylineRef.current) traveledPolylineRef.current.setMap(null);
      if (traveled.length > 1) {
        traveledPolylineRef.current = new google.maps.Polyline({
          path: traveled.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: "#64748b",
          strokeWeight: 8,
          strokeOpacity: 0.9,
          geodesic: true,
          map,
          zIndex: 3,
        });
      }

      // Tramo restante (azul brillante)
      if (remainingPolylineRef.current) remainingPolylineRef.current.setMap(null);
      if (remaining.length > 1) {
        remainingPolylineRef.current = new google.maps.Polyline({
          path: remaining.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: "#3b82f6",
          strokeWeight: 8,
          strokeOpacity: 1,
          geodesic: true,
          map,
          zIndex: 4,
        });
      }
    } else {
      // Modo normal: colores sutiles
      const traveledColor = "#9ca3af";
      const remainingColor = "#0066ff";

      if (traveledPolylineRef.current) traveledPolylineRef.current.setMap(null);
      if (traveled.length > 1) {
        traveledPolylineRef.current = new google.maps.Polyline({
          path: traveled.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: traveledColor,
          strokeWeight: 6,
          strokeOpacity: 0.6,
          geodesic: true,
          map,
          zIndex: 3,
        });
      }

      if (remainingPolylineRef.current) remainingPolylineRef.current.setMap(null);
      if (remaining.length > 1) {
        remainingPolylineRef.current = new google.maps.Polyline({
          path: remaining.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: remainingColor,
          strokeWeight: 6,
          strokeOpacity: 0.95,
          geodesic: true,
          map,
          zIndex: 4,
        });
      }
    }

    // ETA a partir de distancia restante sobre la ruta y velocidad actual
    const remainingKm = polylineDistanceKm(remaining);
    if (remainingKm < 0.05) {
      setEta(0);
      return;
    }
    const speedKmh = busSpeed && busSpeed > 2 ? busSpeed : 25;
    setEta(Math.ceil((remainingKm / speedKmh) * 60));
  }, [busPosition, busSpeed, gpsMode, mapReady, routeData]);

  // Detect approaching passenger stops (driver only)
  useEffect(() => {
    if (role !== "driver" || !busPosition || !routeData) {
      return;
    }

    const passengers = Array.isArray(routeData.passenger_details)
      ? routeData.passenger_details
      : [];

    const latestPassengerTrackings = getLatestPassengerTrackings(trackings);

    const nearest = passengers
      .filter(
        (p) =>
          Number.isFinite(Number(p.pickup_lat)) &&
          Number.isFinite(Number(p.pickup_lng)) &&
          !isPickupCompleted(latestPassengerTrackings[Number(p.id)]?.status)
      )
      .map((p) => ({
        id: p.id,
        label: p.pickup_address || p.user_detail?.username || `Pasajero ${p.id}`,
        distanceMeters:
          haversineKm(busPosition, [Number(p.pickup_lat), Number(p.pickup_lng)]) * 1000,
      }))
      .filter((p) => p.distanceMeters <= APPROACH_THRESHOLD_METERS)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;

    setApproachingStop(nearest);
  }, [busPosition, role, routeData, trackings]);

  const currentUserPassenger = routeData?.passenger_details?.find((passenger) => {
    const stored = localStorage.getItem("userId");
    return stored && String(passenger.user) === String(stored);
  });

  const driverStops = useMemo(() => {
    if (role !== "driver" || !routeData) {
      return [];
    }

    const latestPassengerTrackings = getLatestPassengerTrackings(trackings);
    const passengers = Array.isArray(routeData.passenger_details)
      ? routeData.passenger_details
      : [];

    return passengers
      .map((passenger) => {
        const tracking = latestPassengerTrackings[Number(passenger.id)];
        const distanceMeters =
          busPosition &&
          Number.isFinite(Number(passenger.pickup_lat)) &&
          Number.isFinite(Number(passenger.pickup_lng))
            ? haversineKm(busPosition, [Number(passenger.pickup_lat), Number(passenger.pickup_lng)]) * 1000
            : null;

        return {
          id: passenger.id,
          label:
            passenger.pickup_address ||
            passenger.user_detail?.username ||
            `Parada ${passenger.id}`,
          status: tracking?.status || "not_picked",
          distanceMeters,
          hasCoords:
            Number.isFinite(Number(passenger.pickup_lat)) &&
            Number.isFinite(Number(passenger.pickup_lng)),
        };
      })
      .filter((stop) => !isPickupCompleted(stop.status))
      .sort((a, b) => {
        if (Number.isFinite(a.distanceMeters) && Number.isFinite(b.distanceMeters)) {
          return a.distanceMeters - b.distanceMeters;
        }
        if (Number.isFinite(a.distanceMeters)) return -1;
        if (Number.isFinite(b.distanceMeters)) return 1;
        return a.label.localeCompare(b.label, "es");
      });
  }, [busPosition, role, routeData, trackings]);

  const nextStop = driverStops[0] || null;

  // Show route selection screen for drivers with multiple routes
  if (role === "driver" && driverRoutes !== null && !resolvedRouteId) {
    return (
      <DriverRouteSelector
        routes={driverRoutes}
        onSelect={(id) => {
          setDriverRoutes(null);
          setResolvedRouteId(String(id));
          setResolvingAssignedRoute(false);
          navigate(`/tracking/${id}`, { replace: true });
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow text-center max-w-sm">
          <p className="text-red-600 font-semibold mb-4">{loadError}</p>
          <Link to="/dashboard" className="text-blue-600 hover:underline text-sm">
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  // Single layout — map div is always in the DOM so Google Maps stays attached.
  // GPS mode just hides the header/aside and overlays the GPS HUD on top of the map.
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header — hidden in GPS mode */}
      {!gpsMode && (
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
              ← Panel
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-base font-semibold text-gray-800">
              {routeData?.name || (resolvedRouteId ? `Ruta #${resolvedRouteId}` : "Tracking")}
            </h1>
          </div>
          <WsStatusBadge status={wsStatus} />
        </header>
      )}

      <div
        className="flex flex-1 overflow-hidden gap-5"
        style={{
          height: gpsMode ? "100vh" : "calc(100vh - 57px)",
          padding: gpsMode ? 0 : "1.5rem",
        }}
      >
        {/* Side panel — hidden in GPS mode */}
        {!gpsMode && (
          <aside className="w-80 bg-white border border-gray-200 rounded-xl overflow-y-auto flex-shrink-0 shadow-sm">
            {!loadingRoute && role === "driver" && (
              <DriverPanel
                routeData={routeData}
                busSpeed={busSpeed}
                eta={eta}
                nextStop={nextStop}
                pendingStops={driverStops}
                gpsMode={gpsMode}
                onToggleGps={() => setGpsMode((prev) => !prev)}
              />
            )}
            {!loadingRoute && (role === "user" || role === "passenger" || !role) && (
              <UserPanel
                routeData={routeData}
                currentPassenger={currentUserPassenger}
                eta={eta}
                busPosition={busPosition}
              />
            )}
          </aside>
        )}

        {/* Map container — always in DOM, Google Maps stays attached */}
        <div
          className="relative overflow-hidden"
          style={{
            flex: 1,
            borderRadius: gpsMode ? 0 : "0.75rem",
          }}
        >
          <div ref={mapRef} className="w-full h-full" />

          {/* GPS mode overlays */}
          {gpsMode && (
            <>
              <GpsNavHeader
                nextStop={nextStop}
                heading={driverHeading}
                streetName={driverStreetName}
                onExit={() => setGpsMode(false)}
              />
              <GpsBottomHUD
                busSpeed={busSpeed}
                eta={eta}
                routeData={routeData}
                pendingCount={driverStops.length}
                totalPassengers={routeData?.passenger_details?.length ?? 0}
                wsStatus={wsStatus}
              />
            </>
          )}

          {approachingStop && (
            <ApproachingStopAlert
              stop={approachingStop}
              onDismiss={() => setApproachingStop(null)}
            />
          )}

          {(loadingRoute || resolvingAssignedRoute) && (
            <div className="absolute top-3 left-3 z-10 bg-white/95 border border-gray-200 rounded-lg shadow-sm px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                <span>{resolvingAssignedRoute ? "Resolviendo ruta asignada..." : "Cargando ruta..."}</span>
              </div>
            </div>
          )}
          {!mapReady && !mapLoadError && (
            <div className="absolute inset-0 bg-white flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Cargando mapa...</p>
              </div>
            </div>
          )}
          {mapLoadError && (
            <div className="absolute inset-0 bg-white flex items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-red-600 font-semibold mb-2">Error al cargar el mapa</p>
                <p className="text-sm text-gray-500">{mapLoadError}</p>
              </div>
            </div>
          )}
          {!gpsMode && <MapLegend />}
        </div>
      </div>
    </div>
  );
}

function WsStatusBadge({ status }) {
  const map = {
    connecting: { label: "Conectando...", color: "bg-yellow-100 text-yellow-700" },
    open: { label: "En vivo", color: "bg-green-100 text-green-700" },
    closed: { label: "Sin conexión", color: "bg-red-100 text-red-600" },
  };
  const state = map[status] || map.closed;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${state.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "open" ? "bg-green-500 animate-pulse" : status === "connecting" ? "bg-yellow-500" : "bg-red-400"}`} />
      {state.label}
    </span>
  );
}

function MapLegend() {
  return (
    <div className="absolute bottom-8 left-3 bg-white rounded-lg shadow-md px-4 py-3 text-xs text-gray-600 space-y-2 border border-gray-100">
      <div className="pb-2 border-b border-gray-200">
        <p className="font-semibold text-gray-800 text-xs mb-1">ESTADO DE LA RUTA</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 h-2.5 rounded-sm bg-blue-500 inline-block" />
        <span className="font-medium">Ruta pendiente</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-5 h-2.5 rounded-sm bg-gray-400 inline-block" />
        <span className="font-medium">Ruta recorrida</span>
      </div>
      <div className="py-1 border-t border-gray-200 mt-2">
        <p className="font-semibold text-gray-800 text-xs mb-1">MARCADORES</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-blue-300 border-2 border-blue-700 inline-block" />
        Origen (inicio)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-blue-800 border-2 border-white inline-block" />
        Destino (final)
      </div>
    </div>
  );
}

function AdminRoutesPanel({
  routes,
  liveDataByRoute,
  wsStatusByRoute,
  selectedRouteId,
  onSelectRoute,
}) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Rutas activas
        </h2>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {routes.length}
        </span>
      </div>

      {routes.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
          No hay rutas con coordenadas listas para monitoreo.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {routes.map((route, index) => {
            const liveData = liveDataByRoute[route.id];
            const state = getAdminRouteState(route, liveData, wsStatusByRoute[route.id]);
            const isSelected = Number(selectedRouteId) === Number(route.id);

            return (
              <li key={route.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectRoute(route.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectRoute(route.id);
                    }
                  }}
                  className={`w-full cursor-pointer text-left rounded-lg border px-2.5 py-2 transition ${isSelected ? "border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-100" : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getRouteColor(index) }}
                      />
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {route.name || `Ruta #${route.id}`}
                      </p>
                    </div>
                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${state.color}`}>
                      {state.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-400 truncate mt-0.5 pl-3.5">
                    {route.origin || "—"} → {route.destination || "—"}
                  </p>

                  <div className="mt-1.5 pl-3.5 flex items-center gap-3 text-[11px] text-gray-500">
                    <span className="truncate max-w-[110px]">
                      <span className="text-gray-400">Cond. </span>
                      <span className="font-medium text-gray-600">{getRouteDriverName(route)}</span>
                    </span>
                    <span className="flex-shrink-0">
                      <span className="text-gray-400">Pasj. </span>
                      <span className="font-medium text-gray-600">{getRoutePassengerCount(route)}</span>
                    </span>
                    {liveData?.busTimestamp && (
                      <span className="ml-auto flex-shrink-0 text-[10px] text-gray-400">
                        {new Date(liveData.busTimestamp).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DriverPanel({ routeData, busSpeed, eta, nextStop, pendingStops, gpsMode, onToggleGps }) {
  const allPassengers = Array.isArray(routeData?.passenger_details)
    ? routeData.passenger_details
    : [];
  const totalPassengers = allPassengers.length;
  const pendingCount = Array.isArray(pendingStops) ? pendingStops.length : 0;
  const pickedCount = totalPassengers - pendingCount;

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mi ruta</h2>

      {routeData ? (
        <>
          <div className="bg-blue-50 rounded-lg p-3 space-y-1 border border-blue-200">
            <p className="font-semibold text-blue-900 text-sm">{routeData.name}</p>
            <p className="text-xs text-blue-700">
              {routeData.origin || "—"} → {routeData.destination || "—"}
            </p>
            {routeData.departure_time && (
              <p className="text-xs text-blue-600 font-medium mt-2">
                Salida: {routeData.departure_time.slice(0, 5)}
              </p>
            )}
          </div>

          <button
            onClick={onToggleGps}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
          >
            Iniciar ruta
          </button>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3 text-center bg-blue-50 text-blue-800 border border-blue-200">
              <p className="text-3xl font-bold">{busSpeed != null ? Math.round(busSpeed) : "—"}</p>
              <p className="text-xs text-blue-600 mt-1">km/h</p>
            </div>
            <div className="rounded-lg p-3 text-center bg-blue-100 text-blue-900 border border-blue-300">
              <p className="text-3xl font-bold">{eta != null ? eta : "—"}</p>
              <p className="text-xs text-blue-700 mt-1">min</p>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm border border-blue-200">
            <p className="font-medium text-blue-900">Próxima parada</p>
            <p className="text-xs text-blue-700">{nextStop?.label || "—"}</p>
            <p className="text-xs text-blue-600">{formatMeters(nextStop?.distanceMeters ?? null)}</p>
          </div>

          <div className="border-t border-gray-200" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pasajeros</p>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{pickedCount}/{totalPassengers}</span>
            </div>
            {totalPassengers > 0 ? (
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${totalPassengers > 0 ? (pickedCount / totalPassengers) * 100 : 0}%` }}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-500">—</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paradas pendientes</p>
            </div>
            {pendingCount === 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 font-medium">
                Ruta completada
              </div>
            ) : (
              <div className="space-y-2">
                {pendingStops.map((stop, index) => (
                  <div key={stop.id} className="bg-blue-50 rounded-lg p-2 flex items-start justify-between gap-2 border border-blue-200">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-blue-900 truncate">{stop.label}</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        {stop.hasCoords ? formatMeters(stop.distanceMeters) : "—"}
                      </p>
                    </div>
                    {index === 0 && (
                      <span className="inline-flex px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-600 text-white flex-shrink-0">
                        Próx.
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">Sin ruta activa</p>
      )}
    </div>
  );
}

function GpsNavHeader({ nextStop, heading, streetName, onExit }) {
  const distanceMeters = nextStop?.distanceMeters ?? null;
  const stopLabel = nextStop?.label ?? null;
  const displayDistance = distanceMeters != null
    ? distanceMeters < 1000
      ? `${Math.round(distanceMeters)} m`
      : `${(distanceMeters / 1000).toFixed(1)} km`
    : "—";

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20, padding: "12px 12px 0" }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        background: "#0A2B3D",
        borderRadius: 14, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.65)",
        border: "1px solid rgba(56,189,248,0.2)",
      }}>
        <div style={{
          width: 60, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRight: "1px solid rgba(56,189,248,0.2)",
          background: "rgba(15,28,41,0.8)",
        }}>
          <span style={{
            transform: `rotate(${heading}deg)`,
            transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            display: "inline-flex",
          }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <path d="M18 4L30 28H6L18 4Z" fill="#38BDF8" />
            </svg>
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0, padding: "12px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{
            color: "#38BDF8",
            fontWeight: 700,
            fontSize: 28,
            lineHeight: 1,
            margin: "0 0 2px 0",
          }}>
            {displayDistance}
          </p>
          <p style={{
            color: "#60A5FA",
            fontWeight: 600,
            fontSize: 12,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {stopLabel || streetName || "En ruta"}
          </p>
        </div>

        <button
          onClick={onExit}
          style={{
            flexShrink: 0, alignSelf: "center", margin: "0 12px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            color: "#fff",
            padding: "7px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            lineHeight: 1,
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.target.style.background = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background = "rgba(255,255,255,0.1)";
          }}
          aria-label="Salir del modo GPS"
        >
          Salir
        </button>
      </div>
    </div>
  );
}

function GpsBottomHUD({ busSpeed, eta, routeData, pendingCount, totalPassengers, wsStatus }) {
  const now = new Date();
  const etaTime = eta != null && eta > 0
    ? new Date(now.getTime() + eta * 60 * 1000).toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, padding: "0 12px 12px" }}>
      <div style={{
        background: "#0f1c2b",
        borderRadius: 14,
        boxShadow: "0 -8px 32px rgba(0,0,0,0.7)",
        border: "1px solid rgba(56,189,248,0.2)",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 14 }}>
          <div style={{
            flexShrink: 0, width: 52, height: 52, borderRadius: "50%",
            border: "2.5px solid #38BDF8", background: "rgba(56,189,248,0.06)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
              {busSpeed != null ? Math.round(busSpeed) : "—"}
            </span>
            <span style={{ fontSize: 8, color: "#64748b", marginTop: 1, fontWeight: 600 }}>km/h</span>
          </div>

          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ color: "#38BDF8", fontWeight: 800, fontSize: 24, lineHeight: 1, margin: 0 }}>
              {etaTime || (eta === 0 ? "Llegando" : "—")}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
              {eta != null && eta > 0 && (
                <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>{eta} min</span>
              )}
              {pendingCount > 0 && (
                <>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#60a5fa", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "#60a5fa", fontWeight: 600 }}>
                    {pendingCount} parada{pendingCount === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <WsStatusBadge status={wsStatus} />
          </div>
        </div>

        {routeData?.destination && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderTop: "1px solid rgba(56,189,248,0.2)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38BDF8", flexShrink: 0, display: "inline-block" }} />
            <p style={{ fontSize: 12, color: "#60a5fa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
              {routeData.destination}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
function ApproachingStopAlert({ stop, onDismiss }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-30 w-80" style={{ bottom: "calc(5rem + 80px)" }}>
      <div className="bg-[#F59E0B] text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 border border-amber-400">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="8" r="3.5" fill="white" />
            <path d="M5 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Llegando a parada</p>
          <p className="text-sm font-bold leading-tight mt-0.5 truncate">{stop.label}</p>
          <p className="text-xs mt-0.5 opacity-80 font-medium">{Math.round(stop.distanceMeters)} m</p>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-base leading-none transition"
          aria-label="Cerrar alerta"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function DriverRouteSelector({ routes, onSelect }) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = [...routes].sort((a, b) => {
    const toMin = (t) => {
      if (!t) return Infinity;
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    return toMin(a.departure_time) - toMin(b.departure_time);
  });

  const activeRoute = sorted.find((r) => {
    if (!r.departure_time) return false;
    const [h, m] = r.departure_time.split(":").map(Number);
    const depMin = h * 60 + m;
    // Within ±60 minutes of departure time
    return Math.abs(depMin - currentMinutes) <= 60;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium text-sm">
          ← Panel
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-semibold text-gray-800">Seleccionar ruta</h1>
      </header>
      <div className="flex-1 p-6 max-w-lg mx-auto w-full">
        <p className="text-sm text-gray-500 mb-4">
          Tienes {routes.length} rutas asignadas. Selecciona la que vas a operar.
        </p>
        <div className="space-y-3">
          {sorted.map((route) => {
            const isActive = activeRoute?.id === route.id;
            return (
              <button
                key={route.id}
                onClick={() => onSelect(route.id)}
                className={`w-full text-left rounded-xl border p-4 transition shadow-sm ${
                  isActive
                    ? "border-green-300 bg-green-50 ring-1 ring-green-200"
                    : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{route.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {route.origin || "—"} → {route.destination || "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {route.passenger_count ?? 0} pasajero{route.passenger_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {route.departure_time && (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        🕐 {route.departure_time.slice(0, 5)}
                      </span>
                    )}
                    {isActive && (
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        Activa ahora
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UserPanel({ routeData, currentPassenger, eta, busPosition }) {
  const picked = currentPassenger?.status === "picked_up" || currentPassenger?.status === "on_board";
  return (
    <div className="p-4 space-y-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mi Seguimiento</h2>

      {eta != null && (
        <div className="bg-blue-600 text-white rounded-xl p-4 text-center shadow">
          <p className="text-xs uppercase tracking-wide mb-1 opacity-80">El bus llega en</p>
          <p className="text-4xl font-bold">{eta}</p>
          <p className="text-sm opacity-80 mt-1">minutos</p>
        </div>
      )}

      {currentPassenger ? (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
          <p className="font-medium text-gray-700">Mi parada</p>
          <p className="text-gray-600 text-xs">{currentPassenger.pickup_address || "Dirección no disponible"}</p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${picked ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {picked ? "✓ Recogido" : "⏳ Esperando"}
          </span>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
          No se encontró tu parada registrada en esta ruta.
        </div>
      )}

      {routeData && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
          <p><span className="font-medium">Conductor:</span> {getRouteDriverName(routeData)}</p>
          <p><span className="font-medium">Ruta:</span> {routeData.name || "—"}</p>
          {busPosition && (
            <p><span className="font-medium">Bus:</span> En seguimiento</p>
          )}
        </div>
      )}
    </div>
  );
}
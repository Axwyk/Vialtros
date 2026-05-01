import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import MapView from "../components/MapView";
import { connectTrackingWS } from "../services/ws";
import { connectAdminMonitoring } from "../services/adminWs";
import { getTrackingsByRoute } from "../services/tracking";
import { getRoute, getRouteMonitoringSummary } from "../services/admin";
import {
  getDriverAssignedRoutes,
  getUserAssignedRoute,
} from "../services/dashboard";
import { sendDriverLocation } from "../services/driverLocation";
import {
  geocodeAddress,
  getStreetRouteThroughPoints,
  getETAMinutes,
  getTrackedStreetRoute,
  isWithinBuenaventuraZone,
  snapPointToRoad,
  buildRoadPathBetweenPoints,
} from "../services/routing";
import "./TrackingPage.css";


const LIVE_WINDOW_MINUTES = 20;
const ETA_REFRESH_DISTANCE_KM = 0.08;
const ROUTE_MATCH_MIN_NEW_POINTS = 2;
const ROUTE_MATCH_REFRESH_DISTANCE_KM = 0.06;
const GUIDED_ROUTE_SPEED_KMH = 24;
const GUIDED_ROUTE_STEP_MS = 4500;
const GUIDED_ROUTE_MAX_POINTS = 28;
const BUENAVENTURA_BOUNDS = {
  minLat: 3.65,
  maxLat: 4.05,
  minLng: -77.25,
  maxLng: -76.75,
};

function dedupeConsecutivePoints(points) {
  return (Array.isArray(points) ? points : []).reduce((acc, point) => {
    if (!Array.isArray(point) || point.length !== 2) return acc;
    const last = acc[acc.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) return acc;
    acc.push(point);
    return acc;
  }, []);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sampleGuidedRoute(points, maxPoints = GUIDED_ROUTE_MAX_POINTS) {
  if (!Array.isArray(points) || points.length <= maxPoints)
    return Array.isArray(points) ? points : [];

  const sampled = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maxPoints; index += 1) {
    const pointIndex = Math.round((index * lastIndex) / (maxPoints - 1));
    const point = points[pointIndex];
    const previous = sampled[sampled.length - 1];
    if (
      point &&
      (!previous || previous[0] !== point[0] || previous[1] !== point[1])
    ) {
      sampled.push(point);
    }
  }
  return sampled;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthKm * c;
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
    const distanceSquared = (pointX - startX) ** 2 + (pointY - startY) ** 2;
    return { t: 0, distanceSquared };
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

function remainingRouteDistanceKm(routeCoordinates, vehiclePoint) {
  if (
    !Array.isArray(routeCoordinates) ||
    routeCoordinates.length < 2 ||
    !Array.isArray(vehiclePoint)
  ) {
    return null;
  }

  let closestSegmentIndex = 0;
  let closestProjection = { t: 0, distanceSquared: Number.POSITIVE_INFINITY };

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    if (!start || !end) continue;

    const projection = projectPointOnSegment(vehiclePoint, start, end);
    if (projection.distanceSquared < closestProjection.distanceSquared) {
      closestProjection = projection;
      closestSegmentIndex = index;
    }
  }

  const start = routeCoordinates[closestSegmentIndex];
  const end = routeCoordinates[closestSegmentIndex + 1];
  const projectedPoint = [
    start[0] + (end[0] - start[0]) * closestProjection.t,
    start[1] + (end[1] - start[1]) * closestProjection.t,
  ];

  let totalKm = distanceKm(
    projectedPoint[0],
    projectedPoint[1],
    end[0],
    end[1],
  );
  for (
    let index = closestSegmentIndex + 2;
    index < routeCoordinates.length;
    index += 1
  ) {
    const previous = routeCoordinates[index - 1];
    const current = routeCoordinates[index];
    totalKm += distanceKm(previous[0], previous[1], current[0], current[1]);
  }

  return totalKm;
}

function splitRouteByVehiclePoint(routeCoordinates, vehiclePoint) {
  if (
    !Array.isArray(routeCoordinates) ||
    routeCoordinates.length < 2 ||
    !Array.isArray(vehiclePoint)
  ) {
    return {
      traveled: [],
      remaining: Array.isArray(routeCoordinates) ? routeCoordinates : [],
      projectedPoint: Array.isArray(vehiclePoint) ? vehiclePoint : null,
    };
  }

  let closestSegmentIndex = 0;
  let closestProjection = { t: 0, distanceSquared: Number.POSITIVE_INFINITY };

  for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
    const start = routeCoordinates[index];
    const end = routeCoordinates[index + 1];
    if (!start || !end) continue;

    const projection = projectPointOnSegment(vehiclePoint, start, end);
    if (projection.distanceSquared < closestProjection.distanceSquared) {
      closestProjection = projection;
      closestSegmentIndex = index;
    }
  }

  const start = routeCoordinates[closestSegmentIndex];
  const end = routeCoordinates[closestSegmentIndex + 1];
  const projectedPoint = [
    start[0] + (end[0] - start[0]) * closestProjection.t,
    start[1] + (end[1] - start[1]) * closestProjection.t,
  ];

  const traveled = [
    ...routeCoordinates.slice(0, closestSegmentIndex + 1),
    projectedPoint,
  ];
  const remaining = [
    projectedPoint,
    ...routeCoordinates.slice(closestSegmentIndex + 1),
  ];

  return {
    traveled: dedupeConsecutivePoints(traveled),
    remaining: dedupeConsecutivePoints(remaining),
    projectedPoint,
  };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function polylineDistanceKm(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;

  let totalKm = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];
    if (!previous || !current) continue;
    totalKm += distanceKm(previous[0], previous[1], current[0], current[1]);
  }
  return totalKm;
}

function normalizeTracking(raw, fallbackTimestamp) {
  const latitude = toNumber(raw.latitude ?? raw.lat);
  const longitude = toNumber(raw.longitude ?? raw.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return {
    ...raw,
    latitude,
    longitude,
    timestamp: raw.timestamp || fallbackTimestamp,
  };
}

function trackingKey(t) {
  if (t?.id != null) return `id:${t.id}`;
  return `geo:${t?.latitude}:${t?.longitude}:${t?.timestamp}`;
}

function normalizeIntermediateStops(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s, idx) => {
      const lat = toNumber(s?.latitude ?? s?.lat ?? s?.coords?.[0]);
      const lng = toNumber(s?.longitude ?? s?.lng ?? s?.coords?.[1]);
      const coords = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      return {
        id: s?.id ?? `stop-${idx}`,
        passenger_id: s?.passenger_id ?? null,
        label: s?.label ?? s?.address ?? `Parada ${idx + 1}`,
        address: s?.address ?? s?.label ?? null,
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
        coords,
      };
    })
    .filter(Boolean);
}

function buildRouteWaypointCoordinates(from, to, intermediateStops) {
  const waypoints = [];
  if (Array.isArray(from) && from.length === 2) waypoints.push(from);
  const stops = normalizeIntermediateStops(intermediateStops || []);
  stops.forEach((s) => {
    if (Array.isArray(s.coords) && s.coords.length === 2) waypoints.push(s.coords);
    else if (Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
      waypoints.push([s.latitude, s.longitude]);
  });
  if (Array.isArray(to) && to.length === 2) waypoints.push(to);
  return dedupeConsecutivePoints(waypoints);
}

function buildRouteSignature(route) {
  if (!route) return "";
  const origin = Number.isFinite(route.origin_lat) && Number.isFinite(route.origin_lng)
    ? `${route.origin_lat},${route.origin_lng}`
    : String(route.origin || "");
  const destination = Number.isFinite(route.destination_lat) && Number.isFinite(route.destination_lng)
    ? `${route.destination_lat},${route.destination_lng}`
    : String(route.destination || "");
  const stops = (Array.isArray(route.intermediate_stops) ? route.intermediate_stops : [])
    .map((s) => {
      const lat = s?.latitude ?? s?.lat ?? (s?.coords ? s.coords[0] : "");
      const lng = s?.longitude ?? s?.lng ?? (s?.coords ? s.coords[1] : "");
      return `${lat || ""},${lng || ""},${s?.address || s?.label || ""}`;
    })
    .join("|");
  return `${origin}->${destination}|${stops}`;
}

function mergeTrackings(prev, incoming) {
  const map = new Map(prev.map((t) => [trackingKey(t), t]));
  incoming.forEach((t) => {
    map.set(trackingKey(t), t);
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });
}

const initialTrackingState = {
  trackings: [],
  vehiclePosition: null,
  liveRouteHistory: [],
};

function trackingReducer(state, action) {
  switch (action.type) {
    case "SET_TRACKINGS":
      return { ...state, trackings: action.payload };
    case "MERGE_TRACKINGS":
      return {
        ...state,
        trackings: mergeTrackings(state.trackings, action.payload),
      };
    case "SET_VEHICLE_POSITION":
      return { ...state, vehiclePosition: action.payload };
    case "SET_ROUTE_HISTORY":
      return { ...state, liveRouteHistory: action.payload };
    case "APPEND_ROUTE_POINT":
      return {
        ...state,
        liveRouteHistory: appendHistoryPoint(
          state.liveRouteHistory,
          action.payload,
        ),
      };
    case "BATCH_POSITION_UPDATE": {
      const { tracking, vehiclePosition, routePoint } = action.payload;
      return {
        ...state,
        trackings: mergeTrackings(state.trackings, [tracking]),
        vehiclePosition,
        liveRouteHistory: appendHistoryPoint(state.liveRouteHistory, routePoint),
      };
    }
    default:
      return state;
  }
}

function appendHistoryPoint(prev, point) {
  if (!Array.isArray(point) || point.length !== 2) return prev;
  const [lat, lng] = point;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return prev;

  const last = prev[prev.length - 1];
  if (last && last[0] === lat && last[1] === lng) {
    return prev;
  }
  return [...prev, [lat, lng]];
}

function extractPositionPayload(rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const eventName = String(
    rawData.event || rawData.type || rawData.action || "",
  ).toLowerCase();
  if (!eventName) return rawData;

  if (eventName === "position_update") {
    return rawData.data || rawData.payload || rawData.position || rawData;
  }

  return null;
}

function isRecentTimestamp(timestamp, minutes = LIVE_WINDOW_MINUTES) {
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= minutes * 60 * 1000;
}

function isWithinBuenaventura(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BUENAVENTURA_BOUNDS.minLat &&
    lat <= BUENAVENTURA_BOUNDS.maxLat &&
    lng >= BUENAVENTURA_BOUNDS.minLng &&
    lng <= BUENAVENTURA_BOUNDS.maxLng
  );
}

export default function TrackingPage({ routeId: routeIdProp }) {
  const params = useParams();
  const navigate = useNavigate();
  const rawRouteId = routeIdProp ?? params.routeId;
  const selectedRouteId = rawRouteId != null ? Number(rawRouteId) : Number.NaN;
  const currentRole = localStorage.getItem("role") || "user";
  const isAdminView = currentRole === "admin";
  const [driverRoutes, setDriverRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sharingWatchIdRef = useRef(null);

  // Auto-resolución dinámica: si no hay routeId, redirigir a la ruta asignada según el rol
  useEffect(() => {
    if (Number.isFinite(selectedRouteId)) return;
    // For admin view, do not auto-redirect to a single route — admin monitors all routes
    if (currentRole === "admin") return undefined;

    let cancelled = false;

    async function resolveDefaultRoute() {
      try {
        let resolvedId = null;

        if (currentRole === "driver") {
          const routes = await getDriverAssignedRoutes().catch(() => []);
          resolvedId = (Array.isArray(routes) ? routes : [])[0]?.id ?? null;
        } else if (currentRole === "user") {
          const payload = await getUserAssignedRoute().catch(() => null);
          resolvedId = payload?.route?.id ?? null;
        }

        if (cancelled) return;

        if (resolvedId) {
          navigate(`/tracking/${resolvedId}`, { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        if (!cancelled) navigate("/dashboard", { replace: true });
      }
    }

    void resolveDefaultRoute();
    return () => {
      cancelled = true;
    };
  }, [currentRole, navigate, selectedRouteId]);

  const [trackingState, dispatch] = useReducer(
    trackingReducer,
    initialTrackingState,
  );
  const { trackings, vehiclePosition, liveRouteHistory } = trackingState;
  const [routeInfo, setRouteInfo] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);

  const [routePolyline, setRoutePolyline] = useState(null);
  const [routeGeometryMode, setRouteGeometryMode] = useState("pending");
  const [matchedLiveRouteHistory, setMatchedLiveRouteHistory] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [eta, setEta] = useState(null);
  const [etaUpdated, setEtaUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const [forceBuenaventuraDemo, setForceBuenaventuraDemo] = useState(false);
  const [showLiveTransition, setShowLiveTransition] = useState(false);
  const [showLiveToast, setShowLiveToast] = useState(false);
  const [showRouteFinishedToast, setShowRouteFinishedToast] = useState(false);
  const [guidedRouteLoading, setGuidedRouteLoading] = useState(false);
  const [guidedRouteRunning, setGuidedRouteRunning] = useState(false);
  const [guidedRouteError, setGuidedRouteError] = useState("");
  const [guidedRouteDisplayPath, setGuidedRouteDisplayPath] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminRouteSummaries, setAdminRouteSummaries] = useState([]);
  const [adminActiveVehicles, setAdminActiveVehicles] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [adminRouteFilterIds, setAdminRouteFilterIds] = useState([]);
  const [adminRouteOverlays, setAdminRouteOverlays] = useState([]);
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [routesCollapsed, setRoutesCollapsed] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);

  const resolveRouteInfo = useCallback(
    async (routeId) => {
      // Resolve by role first to avoid unnecessary 403s on admin-only endpoints
      if (currentRole === "driver") {
        const assignedRoutes = await getDriverAssignedRoutes().catch(() => []);
        const found = (
          Array.isArray(assignedRoutes) ? assignedRoutes : []
        ).find((route) => Number(route.id) === routeId);
        if (found) return found;
      }

      if (currentRole === "user") {
        const assignedRouteData = await getUserAssignedRoute().catch(
          () => null,
        );
        const assignedRoute = assignedRouteData?.route || null;
        if (Number(assignedRoute?.id) === routeId) return assignedRoute;
      }

      // Admin or fallback: direct route fetch
      return getRoute(routeId).catch(() => null);
    },
    [currentRole],
  );

  const trackingsCountRef = useRef(0);
  const liveTransitionTimerRef = useRef(null);
  const liveToastTimerRef = useRef(null);
  const lastEtaRequestRef = useRef({ point: null, destinationKey: "" });
  const lastMatchedRouteRef = useRef({ historyLength: 0, lastPoint: null });
  const guidedRouteTimerRef = useRef(null);
  const guidedRoutePointsRef = useRef([]);
  const guidedRouteIndexRef = useRef(0);
  const guidedRouteFullPathRef = useRef([]);
  const routeEndNotifiedRef = useRef(false);
  const routeFinishedTimerRef = useRef(null);
  const userCoordsRef = useRef(userCoords);
  const wsStatusRef = useRef(wsStatus);
  const trackingsRef = useRef(trackings);
  const lastSnapTimeRef = useRef(0);

  useEffect(() => {
    trackingsCountRef.current = trackings.length;
  }, [trackings]);

  useEffect(() => {
    userCoordsRef.current = userCoords;
  }, [userCoords]);

  useEffect(() => {
    wsStatusRef.current = wsStatus;
  }, [wsStatus]);

  useEffect(() => {
    trackingsRef.current = trackings;
  }, [trackings]);

  useEffect(() => {
    setGuidedRouteDisplayPath([]);
    guidedRouteFullPathRef.current = [];
    guidedRoutePointsRef.current = [];
    guidedRouteIndexRef.current = 0;
    setGuidedRouteLoading(false);
    setGuidedRouteRunning(false);
    setGuidedRouteError("");
  }, [selectedRouteId]);

  useEffect(
    () => () => {
      if (guidedRouteTimerRef.current)
        clearTimeout(guidedRouteTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!navigator.geolocation) return undefined;

    const success = (position) => {
      const coords = [position.coords.latitude, position.coords.longitude];
      if (isWithinBuenaventuraZone(coords)) {
        setUserCoords(coords);
      }
    };

    navigator.geolocation.getCurrentPosition(success, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 10000,
    });

    const watchId = navigator.geolocation.watchPosition(success, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    });

    return () => navigator.geolocation?.clearWatch(watchId);
  }, []);

  // Cargar rutas asignadas al conductor para selección rápida
  useEffect(() => {
    if (currentRole !== "driver") return undefined;
    let cancelled = false;
    setLoadingRoutes(true);
    getDriverAssignedRoutes()
      .then((routes) => {
        if (!cancelled) setDriverRoutes(Array.isArray(routes) ? routes : []);
      })
      .catch(() => {
        if (!cancelled) setDriverRoutes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoutes(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentRole]);

  // Cleanup global: detener watch de geolocalizacion al desmontar
  useEffect(
    () => () => {
      if (sharingWatchIdRef.current) {
        try {
          navigator.geolocation.clearWatch(sharingWatchIdRef.current);
        } catch (e) {
          /* ignore */
        }
        sharingWatchIdRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!isAdminView) {
      setAdminStats(null);
      setAdminRouteSummaries([]);
      setAdminActiveVehicles([]);
      setAdminAlerts([]);
      setAdminRouteFilterIds([]);
      setAdminRouteOverlays([]);
      return undefined;
    }

    let cancelled = false;

    const loadAdminData = async () => {
      try {
        const summary = await getRouteMonitoringSummary().catch(() => null);
        if (cancelled) return;

        setAdminStats(summary?.stats || null);
        setAdminRouteSummaries(
          Array.isArray(summary?.routes) ? summary.routes : [],
        );
        setAdminActiveVehicles(
          Array.isArray(summary?.active_vehicles)
            ? summary.active_vehicles
            : [],
        );
        setAdminAlerts(Array.isArray(summary?.alerts) ? summary.alerts : []);
      } catch {
        if (!cancelled) {
          setAdminStats(null);
          setAdminRouteSummaries([]);
          setAdminActiveVehicles([]);
          setAdminAlerts([]);
        }
      }
    };

    loadAdminData();
    const intervalId = setInterval(() => {
      void loadAdminData();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isAdminView]);

  // For admin: reflect monitoring updates as live connection when there are active vehicles or live routes
  useEffect(() => {
    if (!isAdminView) return undefined;

    const client = connectAdminMonitoring(
      (msg) => {
        try {
          const event = String(msg.event || "").toLowerCase();
          const data = msg.data || msg.payload || msg;
          if (event === "position_update" && data) {
            // upsert active vehicle by route+vehicle or driver
            setAdminActiveVehicles((prev) => {
              const copy = Array.isArray(prev) ? [...prev] : [];
              const key = `${data.route}:${data.driver || data.vehicle || data.id || ""}`;
              const idx = copy.findIndex(
                (v) =>
                  `${v.route}:${v.driver || v.vehicle || v.id || ""}` === key,
              );
              const entry = {
                route: data.route,
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: data.timestamp,
                raw: data,
              };
              if (idx >= 0) {
                copy[idx] = { ...copy[idx], ...entry };
              } else {
                copy.push(entry);
              }
              return copy.slice(0, 200);
            });
          }
          if (event === "route_state" && data) {
            // update summaries if payload includes route summary info
            setAdminRouteSummaries((prev) => {
              const copy = Array.isArray(prev) ? [...prev] : [];
              const idx = copy.findIndex(
                (r) => Number(r.id) === Number(data.id),
              );
              if (idx >= 0) {
                copy[idx] = { ...copy[idx], ...data };
              } else if (data.id) {
                copy.push(data);
              }
              return copy.slice(0, 500);
            });
          }
        } catch (e) {
          // ignore parse errors
        }
      },
      {
        onOpen: () => {
          setWsStatus("live");
          setIsPollingFallback(false);
        },
        onClose: () => {
          setWsStatus("offline");
        },
        onError: () => {
          setWsStatus("offline");
        },
      },
    );

    // Cleanup
    return () => {
      try {
        client.close();
      } catch (e) {
        /* ignore */
      }
    };
  }, [isAdminView]);

  useEffect(() => {
    if (!isAdminView || adminRouteSummaries.length === 0) {
      setAdminRouteOverlays([]);
      return undefined;
    }

    let cancelled = false;

    const buildAdminRouteOverlays = async () => {
      const overlays = await Promise.all(
        adminRouteSummaries.map(async (route) => {
          if (!route.origin || !route.destination) {
            return { id: route.id, polyline: [] };
          }

          try {
            // Prefer stored coordinates
            const hasStoredOrigin =
              Number.isFinite(route.origin_lat) &&
              Number.isFinite(route.origin_lng);
            const hasStoredDest =
              Number.isFinite(route.destination_lat) &&
              Number.isFinite(route.destination_lng);

            const [from, to] = await Promise.all([
              hasStoredOrigin
                ? Promise.resolve([route.origin_lat, route.origin_lng])
                : geocodeAddress(route.origin),
              hasStoredDest
                ? Promise.resolve([
                    route.destination_lat,
                    route.destination_lng,
                  ])
                : geocodeAddress(route.destination),
            ]);

            if (!Array.isArray(from) || !Array.isArray(to)) {
              return { id: route.id, polyline: [] };
            }

            const waypointCoords = buildRouteWaypointCoordinates(
              from,
              to,
              route.intermediate_stops,
            );
            const streetRoute =
              await getStreetRouteThroughPoints(waypointCoords);
            if (streetRoute?.coordinates?.length > 1) {
              return { id: route.id, polyline: streetRoute.coordinates };
            }

            return {
              id: route.id,
              polyline: waypointCoords.length > 1 ? waypointCoords : [from, to],
            };
          } catch {
            return { id: route.id, polyline: [] };
          }
        }),
      );

      if (!cancelled) {
        setAdminRouteOverlays(
          overlays.filter((overlay) => overlay.polyline.length > 1),
        );
      }
    };

    void buildAdminRouteOverlays();

    return () => {
      cancelled = true;
    };
  }, [adminRouteSummaries, isAdminView]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!Number.isFinite(selectedRouteId)) {
        setLoading(false);
        return;
      }

      try {
        const [route, initialTrackings] = await Promise.all([
          resolveRouteInfo(selectedRouteId),
          getTrackingsByRoute(selectedRouteId).catch(() => []),
        ]);

        if (!mounted) return;
        setRouteInfo(route);

        const normalizedInitial = initialTrackings
          .map((t) => normalizeTracking(t, new Date().toISOString()))
          .filter(Boolean)
          .filter(
            (t) =>
              isRecentTimestamp(t.timestamp) &&
              isWithinBuenaventura(t.latitude, t.longitude),
          );
        dispatch({ type: "SET_TRACKINGS", payload: normalizedInitial });

        if (normalizedInitial.length > 0) {
          const latest = normalizedInitial[normalizedInitial.length - 1];
          dispatch({
            type: "SET_VEHICLE_POSITION",
            payload: {
              latitude: latest.latitude,
              longitude: latest.longitude,
              timestamp: latest.timestamp,
            },
          });

          const historyPoints = normalizedInitial.map((t) => [
            t.latitude,
            t.longitude,
          ]);
          dispatch({ type: "SET_ROUTE_HISTORY", payload: historyPoints });
        } else {
          dispatch({ type: "SET_VEHICLE_POSITION", payload: null });
          dispatch({ type: "SET_ROUTE_HISTORY", payload: [] });
        }

        if (route?.origin && route?.destination) {
          // Prefer stored coordinates from Route model (precise, pre-resolved)
          const hasStoredOrigin =
            Number.isFinite(route.origin_lat) &&
            Number.isFinite(route.origin_lng);
          const hasStoredDest =
            Number.isFinite(route.destination_lat) &&
            Number.isFinite(route.destination_lng);

          let from = hasStoredOrigin
            ? [route.origin_lat, route.origin_lng]
            : null;
          let to = hasStoredDest
            ? [route.destination_lat, route.destination_lng]
            : null;

          // Fallback: geocode if no stored coordinates
          if (!from || !to) {
            const [geocodedFrom, geocodedTo] = await Promise.all([
              from
                ? Promise.resolve(from)
                : geocodeAddress(route.origin, { fallbackCoords: userCoordsRef.current }),
              to
                ? Promise.resolve(to)
                : geocodeAddress(route.destination, {
                    fallbackCoords: userCoordsRef.current,
                  }),
            ]);
            from = from || geocodedFrom;
            to = to || geocodedTo;
          }

          if (!mounted) return;
          if (Array.isArray(from) && Array.isArray(to)) {
            setOriginCoords(from);
            setDestinationCoords(to);
            setForceBuenaventuraDemo(false);
            setRouteGeometryMode("pending");

            // getStreetRoute includes retry+cache; fallback to straight line only as last resort
            const waypointCoords = buildRouteWaypointCoordinates(
              from,
              to,
              route.intermediate_stops,
            );
            const streetRoute =
              await getStreetRouteThroughPoints(waypointCoords);
            if (!mounted) return;
            if (streetRoute && streetRoute.coordinates?.length > 1) {
              setRoutePolyline(streetRoute.coordinates);
              if (!streetRoute.isStraightLine) {
                setRouteGeometryMode("verified");
                setEta(Math.ceil(streetRoute.duration / 60));
                setEtaUpdated(new Date());
              } else {
                setRouteGeometryMode("alternate");
              }
            } else {
              setRoutePolyline(null);
              setRouteGeometryMode("pending");
            }
          } else {
            // Geocoding devolvió null → usar demo
            setOriginCoords(null);
            setDestinationCoords(null);
            setRoutePolyline(null);
            setRouteGeometryMode("pending");
            setForceBuenaventuraDemo(true);
          }
        } else {
          setRouteGeometryMode("pending");
          setForceBuenaventuraDemo(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [resolveRouteInfo, selectedRouteId]);

  // Periodic route info refresh: detect admin changes to origin/destination
  const lastRouteVersionRef = useRef(null);
  const routeInfoRef = useRef(routeInfo);
  useEffect(() => { routeInfoRef.current = routeInfo; }, [routeInfo]);
  useEffect(() => {
    if (!Number.isFinite(selectedRouteId)) return undefined;

    const ROUTE_REFRESH_INTERVAL_MS = 20000; // 20s

    const checkRouteUpdate = async () => {
      try {
        const freshRoute = await resolveRouteInfo(selectedRouteId);
        if (!freshRoute) return;

        const key = buildRouteSignature(freshRoute);

        if (
          lastRouteVersionRef.current &&
          lastRouteVersionRef.current !== key
        ) {
          // Route changed — update state and re-resolve polyline
          setRouteInfo(freshRoute);

          const hasOrigin =
            Number.isFinite(freshRoute.origin_lat) &&
            Number.isFinite(freshRoute.origin_lng);
          const hasDest =
            Number.isFinite(freshRoute.destination_lat) &&
            Number.isFinite(freshRoute.destination_lng);

          let from = hasOrigin
            ? [freshRoute.origin_lat, freshRoute.origin_lng]
            : null;
          let to = hasDest
            ? [freshRoute.destination_lat, freshRoute.destination_lng]
            : null;

          if (!from || !to) {
            const [geoFrom, geoTo] = await Promise.all([
              from
                ? Promise.resolve(from)
                : geocodeAddress(freshRoute.origin, {
                    fallbackCoords: userCoordsRef.current,
                  }),
              to
                ? Promise.resolve(to)
                : geocodeAddress(freshRoute.destination, {
                    fallbackCoords: userCoordsRef.current,
                  }),
            ]);
            from = from || geoFrom;
            to = to || geoTo;
          }

          if (Array.isArray(from) && Array.isArray(to)) {
            setOriginCoords(from);
            setDestinationCoords(to);
            setForceBuenaventuraDemo(false);
            setRouteGeometryMode("pending");
            const waypointCoords = buildRouteWaypointCoordinates(
              from,
              to,
              freshRoute.intermediate_stops,
            );
            const streetRoute =
              await getStreetRouteThroughPoints(waypointCoords);
            if (streetRoute && streetRoute.coordinates?.length > 1) {
              setRoutePolyline(streetRoute.coordinates);
              if (!streetRoute.isStraightLine) {
                setRouteGeometryMode("verified");
                setEta(Math.ceil(streetRoute.duration / 60));
                setEtaUpdated(new Date());
              } else {
                setRouteGeometryMode("alternate");
              }
            } else {
              setRoutePolyline(null);
              setRouteGeometryMode("pending");
            }
          }
        }

        lastRouteVersionRef.current = key;
      } catch {
        /* ignore transient errors */
      }
    };

    // Initialize version key from current routeInfo
    if (routeInfoRef.current) {
      lastRouteVersionRef.current = buildRouteSignature(routeInfoRef.current);
    }

    const intervalId = setInterval(checkRouteUpdate, ROUTE_REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [resolveRouteInfo, selectedRouteId]);

  useEffect(() => {
    if (!Number.isFinite(selectedRouteId)) return undefined;

    setWsStatus("connecting");
    let opened = false;

    const openingTimeoutId = setTimeout(() => {
      setWsStatus((current) =>
        current === "connecting" ? "offline" : current,
      );
    }, 7000);

    const socketClient = connectTrackingWS(
      selectedRouteId,
      (rawData) => {
        const payload = extractPositionPayload(rawData);
        if (!payload) return;

        const normalized = normalizeTracking(payload, new Date().toISOString());
        if (!normalized) return;

        if (trackingsCountRef.current === 0) {
          setShowLiveTransition(true);
          setShowLiveToast(true);

          if (liveTransitionTimerRef.current)
            clearTimeout(liveTransitionTimerRef.current);
          if (liveToastTimerRef.current)
            clearTimeout(liveToastTimerRef.current);

          liveTransitionTimerRef.current = setTimeout(
            () => setShowLiveTransition(false),
            1800,
          );
          liveToastTimerRef.current = setTimeout(
            () => setShowLiveToast(false),
            2600,
          );
        }

        // Snap GPS point to nearest road (throttled: máximo 1 llamada cada 3s)
        const now = Date.now();
        const snapPromise =
          now - lastSnapTimeRef.current >= 3000
            ? (lastSnapTimeRef.current = now,
               snapPointToRoad([normalized.latitude, normalized.longitude]))
            : Promise.resolve([normalized.latitude, normalized.longitude]);

        snapPromise
          .then((snapped) => {
            const lat = snapped[0];
            const lng = snapped[1];
            dispatch({
              type: "BATCH_POSITION_UPDATE",
              payload: {
                tracking: { ...normalized, latitude: lat, longitude: lng },
                vehiclePosition: { latitude: lat, longitude: lng, timestamp: normalized.timestamp },
                routePoint: [lat, lng],
              },
            });
          })
          .catch(() => {
            dispatch({
              type: "BATCH_POSITION_UPDATE",
              payload: {
                tracking: normalized,
                vehiclePosition: { latitude: normalized.latitude, longitude: normalized.longitude, timestamp: normalized.timestamp },
                routePoint: [normalized.latitude, normalized.longitude],
              },
            });
          });
      },
      {
        onOpen: () => {
          opened = true;
          clearTimeout(openingTimeoutId);
          setWsStatus("live");
          setIsPollingFallback(false);
        },
        onClose: () => {
          setWsStatus((current) => {
            if (current === "live" || opened) return "connecting";
            return "offline";
          });
        },
        onError: () => setWsStatus("offline"),
      },
    );

    return () => {
      clearTimeout(openingTimeoutId);
      socketClient.close();
      if (liveTransitionTimerRef.current)
        clearTimeout(liveTransitionTimerRef.current);
      if (liveToastTimerRef.current) clearTimeout(liveToastTimerRef.current);
    };
  }, [selectedRouteId]);

  useEffect(() => {
    if (!Number.isFinite(selectedRouteId)) return undefined;

    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const latest = await getTrackingsByRoute(selectedRouteId).catch(
          () => [],
        );
        if (cancelled || !Array.isArray(latest) || latest.length === 0) return;

        const normalized = latest
          .map((t) => normalizeTracking(t, new Date().toISOString()))
          .filter(Boolean)
          .filter(
            (t) =>
              isRecentTimestamp(t.timestamp) &&
              isWithinBuenaventura(t.latitude, t.longitude),
          );

        if (normalized.length === 0) return;

        dispatch({ type: "MERGE_TRACKINGS", payload: normalized });
        const latestPoint = normalized[normalized.length - 1];
        dispatch({
          type: "SET_VEHICLE_POSITION",
          payload: {
            latitude: latestPoint.latitude,
            longitude: latestPoint.longitude,
            timestamp: latestPoint.timestamp,
          },
        });
        dispatch({
          type: "SET_ROUTE_HISTORY",
          payload: normalized.reduce(
            (acc, t) => appendHistoryPoint(acc, [t.latitude, t.longitude]),
            [],
          ),
        });

        // mark that polling provided recent data only when websocket isn't the primary source
        if (wsStatusRef.current !== "live") setIsPollingFallback(true);
      } catch {
        // ignore transient network errors
      }
    };

    // Poll faster when websocket is not live; otherwise poll less frequently as backup
    const intervalMs = wsStatusRef.current === "live" ? 10000 : 5000;

    fetchLatest();
    const id = setInterval(fetchLatest, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedRouteId]);

  useEffect(() => {
    if (!destinationCoords || trackings.length === 0) return;
    const latest = trackings[trackings.length - 1];
    const latestPoint = [latest.latitude, latest.longitude];
    const fallbackSpeedKmh =
      toNumber(latest.speed ?? latest.speed_kmh ?? latest.velocity) ||
      GUIDED_ROUTE_SPEED_KMH;

    if (Array.isArray(routePolyline) && routePolyline.length > 1) {
      const remainingKm = remainingRouteDistanceKm(routePolyline, latestPoint);
      if (Number.isFinite(remainingKm)) {
        const minutes =
          remainingKm <= 0.03
            ? 0
            : Math.max(
                1,
                Math.ceil((remainingKm / Math.max(fallbackSpeedKmh, 12)) * 60),
              );
        setEta(minutes);
        setEtaUpdated(new Date());
        lastEtaRequestRef.current = {
          point: latestPoint,
          destinationKey: destinationCoords.join(","),
        };
        return;
      }
    }

    const destinationKey = destinationCoords.join(",");
    const previousEtaRequest = lastEtaRequestRef.current;
    if (
      previousEtaRequest.destinationKey === destinationKey &&
      Array.isArray(previousEtaRequest.point) &&
      distanceKm(
        previousEtaRequest.point[0],
        previousEtaRequest.point[1],
        latest.latitude,
        latest.longitude,
      ) < ETA_REFRESH_DISTANCE_KM
    ) {
      return;
    }

    getETAMinutes([latest.latitude, latest.longitude], destinationCoords)
      .then((minutes) => {
        if (minutes === null) return;
        lastEtaRequestRef.current = {
          point: [latest.latitude, latest.longitude],
          destinationKey,
        };
        setEta(minutes);
        setEtaUpdated(new Date());
      })
      .catch(() => {});
  }, [trackings, destinationCoords, routePolyline]);

  useEffect(() => {
    if (guidedRouteRunning && guidedRouteDisplayPath.length > 1) {
      setMatchedLiveRouteHistory(guidedRouteDisplayPath);
      return undefined;
    }

    if (liveRouteHistory.length < 2) {
      setMatchedLiveRouteHistory([]);
      lastMatchedRouteRef.current = { historyLength: 0, lastPoint: null };
      return undefined;
    }

    const latestPoint = liveRouteHistory[liveRouteHistory.length - 1];
    const lastMatchedRoute = lastMatchedRouteRef.current;
    const newPointsSinceLastMatch =
      liveRouteHistory.length - lastMatchedRoute.historyLength;
    const movedDistanceSinceLastMatch = Array.isArray(
      lastMatchedRoute.lastPoint,
    )
      ? distanceKm(
          lastMatchedRoute.lastPoint[0],
          lastMatchedRoute.lastPoint[1],
          latestPoint[0],
          latestPoint[1],
        )
      : Number.POSITIVE_INFINITY;

    if (
      lastMatchedRoute.historyLength > 0 &&
      newPointsSinceLastMatch < ROUTE_MATCH_MIN_NEW_POINTS &&
      movedDistanceSinceLastMatch < ROUTE_MATCH_REFRESH_DISTANCE_KM
    ) {
      return undefined;
    }

    let cancelled = false;

    const timerId = setTimeout(() => {
      getTrackedStreetRoute(trackingsRef.current)
        .then(async (matchedRoute) => {
          if (cancelled) return;
          lastMatchedRouteRef.current = {
            historyLength: liveRouteHistory.length,
            lastPoint: latestPoint,
          };
          if (matchedRoute?.coordinates?.length > 1) {
            setMatchedLiveRouteHistory(matchedRoute.coordinates);
            return;
          }
          // Fallback: build road path between sparse GPS points
          try {
            const roadPath = await buildRoadPathBetweenPoints(liveRouteHistory);
            if (!cancelled && roadPath?.length > 1) {
              setMatchedLiveRouteHistory(roadPath);
              return;
            }
          } catch {
            /* use raw points */
          }
          if (!cancelled) setMatchedLiveRouteHistory(liveRouteHistory);
        })
        .catch(async () => {
          if (cancelled) return;
          lastMatchedRouteRef.current = {
            historyLength: liveRouteHistory.length,
            lastPoint: latestPoint,
          };
          // Fallback: build road path
          try {
            const roadPath = await buildRoadPathBetweenPoints(liveRouteHistory);
            if (!cancelled && roadPath?.length > 1) {
              setMatchedLiveRouteHistory(roadPath);
              return;
            }
          } catch {
            /* use raw points */
          }
          if (!cancelled) setMatchedLiveRouteHistory(liveRouteHistory);
        });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [guidedRouteDisplayPath, guidedRouteRunning, liveRouteHistory]);

  const statusBadge = useMemo(() => {
    const badges = {
      connecting: { label: "Conectando", color: "connecting" },
      live: { label: "En vivo", color: "live" },
      offline: { label: "Sin conexion", color: "offline" },
      fallback: { label: "En vivo (respaldo)", color: "live" },
    };
    if (isPollingFallback && wsStatus !== "live") return badges.fallback;
    return badges[wsStatus] || badges.connecting;
  }, [wsStatus, isPollingFallback]);

  const hasLiveData = trackings.length > 0;
  const showEmptyCityCanvas = !hasLiveData;
  const hasPlannedRoute =
    Array.isArray(routePolyline) && routePolyline.length > 1;
  const hasResolvedStops =
    Array.isArray(originCoords) && Array.isArray(destinationCoords);
  const showRouteContext =
    !forceBuenaventuraDemo && (hasResolvedStops || hasPlannedRoute);
  const canManageGuidedRoute = currentRole === "driver";
  const routeIsLive = guidedRouteRunning || hasLiveData;

  const displayOriginCoords = showRouteContext ? originCoords : null;
  const displayDestinationCoords = showRouteContext ? destinationCoords : null;
  const displayIntermediateStops = useMemo(
    () =>
      showRouteContext
        ? normalizeIntermediateStops(routeInfo?.intermediate_stops)
        : [],
    [showRouteContext, routeInfo],
  );
  const displayPlannedRoutePolyline =
    showRouteContext && Array.isArray(routePolyline) && routePolyline.length > 1
      ? routePolyline
      : null;
  const displayTrackings = useMemo(
    () => (hasLiveData ? trackings : []),
    [hasLiveData, trackings],
  );
  const rawVehicleRoutePoint = useMemo(() => {
    if (guidedRouteDisplayPath.length > 0) {
      return guidedRouteDisplayPath[guidedRouteDisplayPath.length - 1];
    }

    if (matchedLiveRouteHistory.length > 0) {
      return matchedLiveRouteHistory[matchedLiveRouteHistory.length - 1];
    }

    if (
      Number.isFinite(vehiclePosition?.latitude) &&
      Number.isFinite(vehiclePosition?.longitude)
    ) {
      return [
        Number(vehiclePosition.latitude),
        Number(vehiclePosition.longitude),
      ];
    }

    return null;
  }, [
    guidedRouteDisplayPath,
    matchedLiveRouteHistory,
    vehiclePosition?.latitude,
    vehiclePosition?.longitude,
  ]);
  const plannedRouteProgress = useMemo(() => {
    if (
      !Array.isArray(displayPlannedRoutePolyline) ||
      displayPlannedRoutePolyline.length < 2
    ) {
      return { traveled: null, remaining: null, projectedPoint: null };
    }

    if (!Array.isArray(rawVehicleRoutePoint)) {
      return {
        traveled: null,
        remaining: displayPlannedRoutePolyline,
        projectedPoint: null,
      };
    }

    const { traveled, remaining, projectedPoint } = splitRouteByVehiclePoint(
      displayPlannedRoutePolyline,
      rawVehicleRoutePoint,
    );

    return {
      traveled:
        Array.isArray(traveled) && traveled.length > 1 ? traveled : null,
      remaining:
        Array.isArray(remaining) && remaining.length > 1 ? remaining : null,
      projectedPoint,
    };
  }, [displayPlannedRoutePolyline, rawVehicleRoutePoint]);
  const displayTraveledRoutePolyline =
    guidedRouteDisplayPath.length > 1
      ? guidedRouteDisplayPath
      : plannedRouteProgress.traveled?.length > 1
        ? plannedRouteProgress.traveled
        : hasLiveData && matchedLiveRouteHistory.length > 1
          ? matchedLiveRouteHistory
          : null;
  const snappedVehiclePoint = useMemo(() => {
    if (Array.isArray(plannedRouteProgress.projectedPoint)) {
      return plannedRouteProgress.projectedPoint;
    }

    if (
      !Array.isArray(displayTraveledRoutePolyline) ||
      displayTraveledRoutePolyline.length === 0
    )
      return null;
    return displayTraveledRoutePolyline[
      displayTraveledRoutePolyline.length - 1
    ];
  }, [displayTraveledRoutePolyline, plannedRouteProgress.projectedPoint]);
  const plannedDistanceKm = useMemo(
    () => polylineDistanceKm(displayPlannedRoutePolyline),
    [displayPlannedRoutePolyline],
  );
  const traveledDistanceKm = useMemo(
    () => polylineDistanceKm(displayTraveledRoutePolyline),
    [displayTraveledRoutePolyline],
  );
  const remainingDistanceKm = useMemo(() => {
    if (
      !Array.isArray(displayPlannedRoutePolyline) ||
      displayPlannedRoutePolyline.length < 2
    ) {
      return null;
    }

    const routePoint =
      snappedVehiclePoint ||
      (Number.isFinite(vehiclePosition?.latitude) &&
      Number.isFinite(vehiclePosition?.longitude)
        ? [Number(vehiclePosition.latitude), Number(vehiclePosition.longitude)]
        : null);

    if (!Array.isArray(routePoint)) {
      return plannedDistanceKm > 0 ? plannedDistanceKm : null;
    }

    const remainingKm = remainingRouteDistanceKm(
      displayPlannedRoutePolyline,
      routePoint,
    );
    if (!Number.isFinite(remainingKm)) {
      return plannedDistanceKm > 0 ? plannedDistanceKm : null;
    }

    return Math.max(0, remainingKm);
  }, [
    displayPlannedRoutePolyline,
    plannedDistanceKm,
    snappedVehiclePoint,
    vehiclePosition?.latitude,
    vehiclePosition?.longitude,
  ]);
  const routeProgressSegments = useMemo(() => {
    if (
      !Array.isArray(displayPlannedRoutePolyline) ||
      displayPlannedRoutePolyline.length < 2
    ) {
      return { remaining: null };
    }

    if (Array.isArray(plannedRouteProgress.remaining)) {
      return {
        remaining: plannedRouteProgress.remaining,
      };
    }

    return {
      remaining: displayPlannedRoutePolyline,
    };
  }, [displayPlannedRoutePolyline, plannedRouteProgress.remaining]);
  const routeProgressPercent = useMemo(() => {
    if (!(plannedDistanceKm > 0) || remainingDistanceKm === null) {
      return 0;
    }

    return clampPercent(
      ((plannedDistanceKm - remainingDistanceKm) / plannedDistanceKm) * 100,
    );
  }, [plannedDistanceKm, remainingDistanceKm]);

  const vehicleLabel = useMemo(() => {
    const driverDetail = routeInfo?.driver_detail;
    if (driverDetail?.license_number) return driverDetail.license_number;
    if (driverDetail?.user_detail?.username)
      return driverDetail.user_detail.username;
    if (routeInfo?.name) return routeInfo.name;
    return "Vehiculo";
  }, [routeInfo]);

  const vehicleSummary = useMemo(() => {
    if (displayTrackings.length === 0) {
      return {
        label: vehicleLabel,
        latitude: null,
        longitude: null,
        speedKmh: 0,
        studentsOnboard: 0,
        status: "Detenido",
      };
    }

    const latest = displayTrackings[displayTrackings.length - 1];
    const previous =
      displayTrackings.length > 1
        ? displayTrackings[displayTrackings.length - 2]
        : null;

    let speedKmh =
      toNumber(latest.speed ?? latest.speed_kmh ?? latest.velocity) || 0;
    if (!speedKmh && previous?.timestamp && latest.timestamp) {
      const t1 = new Date(previous.timestamp).getTime();
      const t2 = new Date(latest.timestamp).getTime();
      const deltaH = (t2 - t1) / 3600000;
      if (deltaH > 0) {
        const dist = distanceKm(
          previous.latitude,
          previous.longitude,
          latest.latitude,
          latest.longitude,
        );
        speedKmh = Math.max(0, Math.round(dist / deltaH));
      }
    }

    const latestByPassenger = new Map();
    displayTrackings.forEach((t) => {
      if (t.passenger == null) return;
      latestByPassenger.set(String(t.passenger), t);
    });
    const studentsOnboard = Array.from(latestByPassenger.values()).filter(
      (t) => t.status === "picked",
    ).length;

    return {
      label: vehicleLabel,
      latitude: latest.latitude,
      longitude: latest.longitude,
      speedKmh,
      studentsOnboard,
      status: speedKmh > 3 ? "En ruta" : "Detenido",
    };
  }, [displayTrackings, vehicleLabel]);

  // Derivar estado legible de la ruta: 'en_curso' | 'finalizada' | 'detenida'
  const routeState = useMemo(() => {
    if (routeIsLive) {
      if (Number.isFinite(remainingDistanceKm) && remainingDistanceKm <= 0.03)
        return "finalizada";
      return "en_curso";
    }
    if (vehicleSummary?.status === "Detenido") return "detenida";
    return "detenida";
  }, [routeIsLive, remainingDistanceKm, vehicleSummary]);

  const routeBadge = useMemo(() => {
    if (routeState === "finalizada") {
      return {
        className: "verified",
        label: "Recorrido finalizado",
        statusLabel: "Finalizada",
      };
    }

    if (routeIsLive) {
      if (routeGeometryMode === "verified") {
        return {
          className: "verified",
          label: "Trazado verificado",
          statusLabel: "En ruta",
        };
      }
      if (routeGeometryMode === "alternate") {
        return {
          className: "alternate",
          label: "Modo alterno",
          statusLabel: "En ruta",
        };
      }
      return {
        className: "pending",
        label: "Monitoreo activo",
        statusLabel: "En ruta",
      };
    }

    if (routeGeometryMode === "verified") {
      return {
        className: "verified",
        label: "Trazado verificado",
        statusLabel: "Trazada",
      };
    }
    if (routeGeometryMode === "alternate") {
      return {
        className: "alternate",
        label: "Modo alterno",
        statusLabel: "Alterna",
      };
    }
    return {
      className: "pending",
      label: "Pendiente de ubicar",
      statusLabel: "Buscando",
    };
  }, [routeGeometryMode, routeIsLive, routeState]);

  const activeVehicles = useMemo(() => {
    if (!hasLiveData) return [];

    if (
      Number.isFinite(vehiclePosition?.latitude) &&
      Number.isFinite(vehiclePosition?.longitude)
    ) {
      return [
        {
          ...vehicleSummary,
          latitude: vehiclePosition.latitude,
          longitude: vehiclePosition.longitude,
        },
      ];
    }

    const latestByPassenger = new Map();
    displayTrackings.forEach((t) => {
      if (t.passenger == null) return;
      latestByPassenger.set(String(t.passenger), t);
    });

    if (latestByPassenger.size > 0) {
      const groupedVehicles = Array.from(latestByPassenger.entries())
        .map(([passengerId, t], idx) => {
          const speed = toNumber(t.speed ?? t.speed_kmh ?? t.velocity) || 0;
          return {
            label: `${vehicleLabel}-P${String(passengerId).padStart(2, "0")}`,
            latitude: t.latitude,
            longitude: t.longitude,
            speedKmh: speed,
            studentsOnboard: t.status === "picked" ? 1 : 0,
            status: speed > 3 ? "En ruta" : "Detenido",
            _order: idx,
          };
        })
        .filter(
          (v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude),
        );

      if (groupedVehicles.length > 0) {
        return groupedVehicles
          .slice(0, 4)
          .sort((a, b) => b.speedKmh - a.speedKmh || a._order - b._order);
      }
    }

    if (
      !Number.isFinite(vehicleSummary.latitude) ||
      !Number.isFinite(vehicleSummary.longitude)
    ) {
      return [];
    }
    return [vehicleSummary];
  }, [
    displayTrackings,
    hasLiveData,
    vehicleLabel,
    vehiclePosition,
    vehicleSummary,
  ]);

  const displayVehiclePosition = useMemo(() => {
    if (!snappedVehiclePoint) return vehiclePosition;
    return {
      latitude: snappedVehiclePoint[0],
      longitude: snappedVehiclePoint[1],
      timestamp: vehiclePosition?.timestamp || null,
    };
  }, [snappedVehiclePoint, vehiclePosition]);

  const normalizedAdminRouteFilterIds = useMemo(
    () =>
      adminRouteFilterIds
        .map((routeId) => Number(routeId))
        .filter(Number.isFinite),
    [adminRouteFilterIds],
  );

  const hasAdminRouteFilter =
    isAdminView && normalizedAdminRouteFilterIds.length > 0;

  const filteredAdminRouteSummaries = useMemo(() => {
    if (!hasAdminRouteFilter) return adminRouteSummaries;
    const routeIdSet = new Set(normalizedAdminRouteFilterIds);
    return adminRouteSummaries.filter((route) =>
      routeIdSet.has(Number(route.id)),
    );
  }, [adminRouteSummaries, hasAdminRouteFilter, normalizedAdminRouteFilterIds]);

  const highlightedAdminRouteIds = useMemo(
    () => (hasAdminRouteFilter ? normalizedAdminRouteFilterIds : []),
    [hasAdminRouteFilter, normalizedAdminRouteFilterIds],
  );

  const displayActiveVehicles = useMemo(() => {
    if (isAdminView) return adminActiveVehicles;
    if (!snappedVehiclePoint || activeVehicles.length === 0)
      return activeVehicles;

    return activeVehicles.map((vehicle, index) => {
      if (index !== 0) return vehicle;
      return {
        ...vehicle,
        latitude: snappedVehiclePoint[0],
        longitude: snappedVehiclePoint[1],
      };
    });
  }, [activeVehicles, adminActiveVehicles, isAdminView, snappedVehiclePoint]);

  const totalStudents = adminStats?.students_total ?? 0;
  const contextualAdminAlerts = useMemo(() => {
    if (!isAdminView) return [];

    const selectedRouteSummary = adminRouteSummaries.find(
      (route) => Number(route.id) === selectedRouteId,
    );
    if (!selectedRouteSummary || selectedRouteSummary.is_live) {
      return adminAlerts;
    }

    return [
      ...adminAlerts,
      {
        id: "selected-route-without-live-monitoring",
        tone: "info",
        title: "Ruta abierta sin monitoreo vivo",
        detail: `La ruta ${selectedRouteSummary.name} aparece como ${selectedRouteSummary.state_label.toLowerCase()}.`,
        route_ids: [selectedRouteSummary.id],
      },
    ].slice(0, 5);
  }, [adminAlerts, adminRouteSummaries, isAdminView, selectedRouteId]);

  const handleAdminAlertAction = (alert) => {
    const routeIds = Array.isArray(alert?.route_ids)
      ? alert.route_ids
          .map((routeId) => Number(routeId))
          .filter(Number.isFinite)
      : [];

    if (routeIds.length === 1) {
      setAdminRouteFilterIds([]);
      navigate(`/tracking/${routeIds[0]}`);
      return;
    }

    if (routeIds.length > 1) {
      const isSameFilter =
        routeIds.length === normalizedAdminRouteFilterIds.length &&
        routeIds.every((routeId) =>
          normalizedAdminRouteFilterIds.includes(routeId),
        );
      setAdminRouteFilterIds(isSameFilter ? [] : routeIds);
      return;
    }

    setAdminRouteFilterIds([]);
  };

  const getAdminAlertActionLabel = (alert) => {
    const routeIds = Array.isArray(alert?.route_ids) ? alert.route_ids : [];
    if (routeIds.length === 1) return "Abrir ruta";
    if (routeIds.length > 1) {
      const normalizedRouteIds = routeIds
        .map((routeId) => Number(routeId))
        .filter(Number.isFinite);
      const isSameFilter =
        normalizedRouteIds.length === normalizedAdminRouteFilterIds.length &&
        normalizedRouteIds.every((routeId) =>
          normalizedAdminRouteFilterIds.includes(routeId),
        );
      return isSameFilter ? "Limpiar filtro" : "Filtrar mapa";
    }
    return "Ver impacto";
  };




  const stopGuidedRoute = () => {
    if (guidedRouteTimerRef.current) {
      clearTimeout(guidedRouteTimerRef.current);
      guidedRouteTimerRef.current = null;
    }
    guidedRoutePointsRef.current = [];
    guidedRouteIndexRef.current = 0;
    setGuidedRouteLoading(false);
    setGuidedRouteRunning(false);
  };

  const pushGuidedTrackingPoint = async (point) => {
    const timestamp = new Date().toISOString();
    const payload = {
      route: selectedRouteId,
      latitude: point[0],
      longitude: point[1],
      speed_kmh: GUIDED_ROUTE_SPEED_KMH,
      timestamp,
      source: "tracking-guided-route",
      status: "picked",
    };

    const normalized = normalizeTracking(payload, timestamp);
    if (normalized) {
      dispatch({ type: "MERGE_TRACKINGS", payload: [normalized] });
      dispatch({
        type: "SET_VEHICLE_POSITION",
        payload: {
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          timestamp: normalized.timestamp,
        },
      });
      dispatch({
        type: "APPEND_ROUTE_POINT",
        payload: [normalized.latitude, normalized.longitude],
      });
    }

    await sendDriverLocation(payload);
  };

  const runGuidedRouteStep = async () => {
    const currentStepIndex = guidedRouteIndexRef.current;
    const point = guidedRoutePointsRef.current[currentStepIndex];
    if (!point) {
      stopGuidedRoute();
      return;
    }

    try {
      const fullPath = guidedRouteFullPathRef.current;
      const sampledPath = guidedRoutePointsRef.current;
      if (fullPath.length > 1 && sampledPath.length > 0) {
        const exactIndex =
          sampledPath.length === 1
            ? fullPath.length - 1
            : Math.round(
                (currentStepIndex / (sampledPath.length - 1)) *
                  (fullPath.length - 1),
              );
        setGuidedRouteDisplayPath(fullPath.slice(0, exactIndex + 1));
      }

      await pushGuidedTrackingPoint(point);
      guidedRouteIndexRef.current += 1;
      if (guidedRouteIndexRef.current >= guidedRoutePointsRef.current.length) {
        if (guidedRouteFullPathRef.current.length > 1) {
          setGuidedRouteDisplayPath(guidedRouteFullPathRef.current);
        }
        stopGuidedRoute();
        return;
      }
      guidedRouteTimerRef.current = setTimeout(() => {
        void runGuidedRouteStep();
      }, GUIDED_ROUTE_STEP_MS);
    } catch {
      stopGuidedRoute();
      setGuidedRouteError("No se pudo iniciar o continuar la ruta guiada.");
    }
  };

  const startGuidedRoute = async () => {
    if (
      guidedRouteLoading ||
      guidedRouteRunning ||
      !Number.isFinite(selectedRouteId)
    )
      return;
    if (!canManageGuidedRoute) {
      setGuidedRouteError(
        "Solo el conductor puede iniciar la ruta. El seguimiento del usuario se activara cuando el conductor empiece el recorrido.",
      );
      return;
    }

    setGuidedRouteError("");
    setGuidedRouteLoading(true);

    try {
      let playbackRoute =
        Array.isArray(routePolyline) && routePolyline.length > 1
          ? routePolyline
          : null;
      if (!playbackRoute && routeInfo?.origin && routeInfo?.destination) {
        const [from, to] = await Promise.all([
          geocodeAddress(routeInfo.origin, { fallbackCoords: userCoords }),
          geocodeAddress(routeInfo.destination, { fallbackCoords: userCoords }),
        ]);
        const waypointCoords = buildRouteWaypointCoordinates(
          from,
          to,
          routeInfo?.intermediate_stops,
        );
        const streetRoute =
          waypointCoords.length > 1
            ? await getStreetRouteThroughPoints(waypointCoords)
            : null;
        let routeCoordinates =
          streetRoute && !streetRoute.isStraightLine
            ? streetRoute.coordinates
            : null;

        // If OSRM route failed, build road path between endpoints as last resort
        if (!routeCoordinates && waypointCoords.length > 1) {
          try {
            const roadPath = await buildRoadPathBetweenPoints(waypointCoords);
            if (roadPath?.length > 2) routeCoordinates = roadPath;
          } catch {
            /* use straight line as last resort */
          }
        }

        playbackRoute =
          routeCoordinates ||
          (waypointCoords.length > 1 ? waypointCoords : null);
        if (routeCoordinates?.length > 1) {
          setRoutePolyline(playbackRoute);
          setOriginCoords(from);
          setDestinationCoords(to);
          setForceBuenaventuraDemo(false);
          setRouteGeometryMode(
            streetRoute && !streetRoute.isStraightLine
              ? "verified"
              : "alternate",
          );
        } else if (Array.isArray(from) && Array.isArray(to)) {
          setRouteGeometryMode("alternate");
        }
      }

      const exactRoute = dedupeConsecutivePoints(playbackRoute);
      const sampledRoute = sampleGuidedRoute(exactRoute);
      if (!sampledRoute || sampledRoute.length < 2) {
        throw new Error("guided-route-unavailable");
      }

      // notify start immediately so backend/admin views mark route as live
      try {
        const startPoint =
          (exactRoute && exactRoute.length > 0 && exactRoute[0]) ||
          (Number.isFinite(vehiclePosition?.latitude) &&
            Number.isFinite(vehiclePosition?.longitude) && [
              Number(vehiclePosition.latitude),
              Number(vehiclePosition.longitude),
            ]) ||
          (Array.isArray(originCoords) && originCoords);
        if (
          startPoint &&
          Number.isFinite(startPoint[0]) &&
          Number.isFinite(startPoint[1])
        ) {
          await sendDriverLocation({
            route: selectedRouteId,
            latitude: startPoint[0],
            longitude: startPoint[1],
            speed_kmh: 0,
            timestamp: new Date().toISOString(),
            source: "route-start",
          }).catch(() => {});
        }
      } catch {
        // ignore send errors
      }

      stopGuidedRoute();
      guidedRouteFullPathRef.current = exactRoute;
      guidedRoutePointsRef.current = sampledRoute;
      guidedRouteIndexRef.current = 0;
      setGuidedRouteDisplayPath([exactRoute[0]]);
      setGuidedRouteRunning(true);
      setGuidedRouteLoading(false);
      routeEndNotifiedRef.current = false;
      void runGuidedRouteStep();
    } catch {
      stopGuidedRoute();
      setGuidedRouteError(
        "No fue posible preparar la ruta guiada para esta ruta.",
      );
    } finally {
      setGuidedRouteLoading(false);
    }
  };

  // Notificar fin de ruta cuando el estado derive a 'finalizada'
  useEffect(() => {
    if (routeState !== "finalizada") return undefined;
    if (routeEndNotifiedRef.current) {
      // Show toast for users even if already notified to backend
      if (currentRole !== "driver") {
        setShowRouteFinishedToast(true);
        if (routeFinishedTimerRef.current)
          clearTimeout(routeFinishedTimerRef.current);
        routeFinishedTimerRef.current = setTimeout(
          () => setShowRouteFinishedToast(false),
          3600,
        );
      }
      return undefined;
    }

    routeEndNotifiedRef.current = true;

    // Mostrar toast para usuarios
    if (currentRole !== "driver") {
      setShowRouteFinishedToast(true);
      if (routeFinishedTimerRef.current)
        clearTimeout(routeFinishedTimerRef.current);
      routeFinishedTimerRef.current = setTimeout(
        () => setShowRouteFinishedToast(false),
        3600,
      );
    }

    // Si somos conductor, enviar notificación final al backend
    if (currentRole === "driver" && Number.isFinite(selectedRouteId)) {
      (async () => {
        try {
          const endPoint =
            Number.isFinite(vehiclePosition?.latitude) &&
            Number.isFinite(vehiclePosition?.longitude)
              ? [
                  Number(vehiclePosition.latitude),
                  Number(vehiclePosition.longitude),
                ]
              : Array.isArray(destinationCoords)
                ? destinationCoords
                : null;
          if (endPoint) {
            await sendDriverLocation({
              route: selectedRouteId,
              latitude: endPoint[0],
              longitude: endPoint[1],
              speed_kmh: 0,
              timestamp: new Date().toISOString(),
              source: "route-end",
            }).catch(() => {});
          }
        } catch {
          // ignore
        }
      })();
    }

    // Stop any guided playback
    if (guidedRouteRunning) stopGuidedRoute();

    return () => {
      if (routeFinishedTimerRef.current) {
        clearTimeout(routeFinishedTimerRef.current);
        routeFinishedTimerRef.current = null;
      }
    };
  }, [
    routeState,
    currentRole,
    selectedRouteId,
    vehiclePosition,
    destinationCoords,
    guidedRouteRunning,
  ]);

  // Transmisión en vivo (conductor) se controla con `sharingWatchIdRef` y `stopSharing`.

  const stopSharing = async () => {
    if (sharingWatchIdRef.current) {
      try {
        navigator.geolocation.clearWatch(sharingWatchIdRef.current);
      } catch (e) {
        /* ignore */
      }
      sharingWatchIdRef.current = null;
    }
    setSharing(false);

    try {
      const pos = displayVehiclePosition;
      if (
        Number.isFinite(selectedRouteId) &&
        pos &&
        Number.isFinite(pos.latitude) &&
        Number.isFinite(pos.longitude)
      ) {
        await sendDriverLocation({
          route: selectedRouteId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          speed_kmh: 0,
          timestamp: new Date().toISOString(),
          source: "transmission-stop",
        }).catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const handleStopAll = async () => {
    try {
      stopGuidedRoute();
    } catch (e) {
      // ignore
    }
    try {
      await stopSharing();
    } catch (e) {
      // ignore
    }
  };

  const nearDestination = useMemo(
    () =>
      Number.isFinite(remainingDistanceKm) &&
      remainingDistanceKm <= 0.3 &&
      routeState === "en_curso",
    [remainingDistanceKm, routeState],
  );

  const [showArrivalNotif, setShowArrivalNotif] = useState(false);
  const arrivalNotifTimerRef = useRef(null);
  const arrivalNotifiedRef = useRef(false);

  useEffect(() => {
    if (nearDestination && !arrivalNotifiedRef.current) {
      arrivalNotifiedRef.current = true;
      setShowArrivalNotif(true);
      if (arrivalNotifTimerRef.current) clearTimeout(arrivalNotifTimerRef.current);
      arrivalNotifTimerRef.current = setTimeout(() => setShowArrivalNotif(false), 10000);
    }
    if (!nearDestination && routeState === "detenida") {
      arrivalNotifiedRef.current = false;
    }
    return () => {
      if (arrivalNotifTimerRef.current) clearTimeout(arrivalNotifTimerRef.current);
    };
  }, [nearDestination, routeState]);

  return (
    <div className="tracking-layout">
      {/* ---- Toasts globales ---- */}
      {showRouteFinishedToast && (
        <div className="route-finished-toast" role="status" aria-live="polite">
          ✓ Recorrido finalizado
        </div>
      )}
      {showArrivalNotif && (
        <div className="arrival-notif" role="alert" aria-live="assertive">
          <span className="arrival-notif-icon">🚏</span>
          <div>
            <strong className="arrival-notif-title">Llegando al destino</strong>
            <p className="arrival-notif-sub">
              {remainingDistanceKm !== null
                ? `${remainingDistanceKm.toFixed(2)} km restantes`
                : "Próxima parada"}
            </p>
          </div>
        </div>
      )}

      <div className="tracking-dashboard">
        {/* ======================================================
            SIDEBAR
        ====================================================== */}
        <aside className="tracking-analytics-panel">
          {/* Cabecera sidebar */}
          <div className="sidebar-top">
            <button
              type="button"
              className="sidebar-back"
              onClick={() => navigate("/dashboard")}
              aria-label="Volver al dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Volver
            </button>
            <div className="sidebar-top-right">
              <span className={`status-badge ${statusBadge.color}`}>
                <span className="status-dot" />
                {statusBadge.label}
              </span>
              {isAdminView && contextualAdminAlerts.length > 0 && (
                <button
                  type="button"
                  className="alert-bell-btn"
                  onClick={() => setShowAlertsPanel((v) => !v)}
                  aria-label={`${contextualAdminAlerts.length} alertas activas`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="alert-bell-badge">{contextualAdminAlerts.length}</span>
                </button>
              )}
            </div>
          </div>

          {/* ---- Panel de alertas inline (admin) ---- */}
          {isAdminView && showAlertsPanel && contextualAdminAlerts.length > 0 && (
            <div className="alerts-popover" role="dialog" aria-label="Panel de alertas">
              <div className="alerts-popover-header">
                <span className="alerts-popover-title">Alertas activas</span>
                <button
                  type="button"
                  className="alerts-popover-close"
                  onClick={() => setShowAlertsPanel(false)}
                  aria-label="Cerrar alertas"
                >
                  ✕
                </button>
              </div>
              <div className="admin-alert-list alerts-popover-body">
                {contextualAdminAlerts.map((alert) => (
                  <article
                    key={alert.id || `${alert.title}-${alert.detail}`}
                    className={`admin-alert-row ${alert.tone}`}
                  >
                    <div className="admin-alert-row-body">
                      <p className="admin-alert-title">{alert.title}</p>
                      <p className="admin-alert-detail">{alert.detail}</p>
                    </div>
                    <button
                      type="button"
                      className="admin-alert-action"
                      onClick={() => { handleAdminAlertAction(alert); setShowAlertsPanel(false); }}
                    >
                      {getAdminAlertActionLabel(alert)}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {showLiveToast && (
            <div className="sidebar-live-toast" role="status" aria-live="polite">
              <span className="live-toast-dot" /> Conectado en vivo
            </div>
          )}

          {/* ==================== ADMIN ==================== */}
          {isAdminView && (
            <>
              {/* KPI compacto con toggle */}
              <div className="admin-kpi-bar">
                {!kpiCollapsed && (
                  <div className="admin-kpi-pills">
                    <div className="admin-kpi-pill">
                      <span className="admin-kpi-pill-num">{displayActiveVehicles.length}</span>
                      <span className="admin-kpi-pill-label">Vehículos</span>
                    </div>
                    <div className="admin-kpi-divider" />
                    <div className="admin-kpi-pill">
                      <span className="admin-kpi-pill-num">{filteredAdminRouteSummaries.length}</span>
                      <span className="admin-kpi-pill-label">Rutas</span>
                    </div>
                    <div className="admin-kpi-divider" />
                    <div className="admin-kpi-pill">
                      <span className="admin-kpi-pill-num">{totalStudents}</span>
                      <span className="admin-kpi-pill-label">Estudiantes</span>
                    </div>
                  </div>
                )}
                {kpiCollapsed && (
                  <span className="admin-kpi-collapsed-summary">
                    {displayActiveVehicles.length} veh · {filteredAdminRouteSummaries.length} rutas · {totalStudents} est.
                  </span>
                )}
                <button
                  type="button"
                  className="section-collapse-btn"
                  onClick={() => setKpiCollapsed((v) => !v)}
                  aria-label={kpiCollapsed ? "Expandir estadísticas" : "Minimizar estadísticas"}
                >
                  {kpiCollapsed ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>

              {/* Rutas activas con toggle */}
              <section className="sidebar-section">
                <div className="sidebar-section-head">
                  <span className="sidebar-section-title">Rutas activas</span>
                  <div className="sidebar-head-actions">
                    <span className="panel-counter">{filteredAdminRouteSummaries.length}</span>
                    <button
                      type="button"
                      className="section-collapse-btn"
                      onClick={() => setRoutesCollapsed((v) => !v)}
                      aria-label={routesCollapsed ? "Expandir rutas" : "Minimizar rutas"}
                    >
                      {routesCollapsed ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 8l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                {!routesCollapsed && (
                  <>
                    {hasAdminRouteFilter && (
                      <div className="admin-filter-row">
                        <span className="admin-filter-text">
                          Filtro: {filteredAdminRouteSummaries.length} ruta(s)
                        </span>
                        <button
                          type="button"
                          className="admin-filter-clear"
                          onClick={() => setAdminRouteFilterIds([])}
                        >
                          Limpiar
                        </button>
                      </div>
                    )}
                    {filteredAdminRouteSummaries.length === 0 ? (
                      <p className="panel-muted">No hay rutas para mostrar.</p>
                    ) : (
                      <div className="admin-route-list" role="list">
                        {filteredAdminRouteSummaries.map((route) => (
                          <article key={route.id} className="admin-route-row" role="listitem">
                            <div className="admin-route-row-head">
                              <span className={`admin-route-dot ${route.is_live ? "live" : "idle"}`} />
                              <div className="admin-route-row-info">
                                <span className="admin-route-row-name">{route.name}</span>
                                <span className="admin-route-row-driver">{route.driver_name}</span>
                              </div>
                              <span className={`admin-route-state ${route.is_live ? "live" : "idle"}`}>
                                {route.state_label}
                              </span>
                            </div>
                            <div className="admin-route-progress-bar mini" aria-hidden="true">
                              <span style={{ width: `${Math.min(route.progress_percent ?? 0, 100)}%` }} />
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {/* ==================== CONDUCTOR ==================== */}
          {currentRole === "driver" && (
            <>
              {driverRoutes.length > 0 && (
                <div className="driver-route-select-wrap">
                  <label className="sidebar-label">Ruta asignada</label>
                  <select
                    value={Number.isFinite(selectedRouteId) ? selectedRouteId : ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val)) navigate(`/tracking/${val}`);
                    }}
                    disabled={loadingRoutes || guidedRouteRunning}
                    className="route-select"
                  >
                    <option value="">Selecciona una ruta</option>
                    {driverRoutes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name || `Ruta ${r.id}`}</option>
                    ))}
                  </select>
                </div>
              )}

              {guidedRouteRunning && (
                <div className="gps-mode-banner">
                  <span className="gps-mode-dot" />
                  <span>Modo GPS activo</span>
                </div>
              )}

              <section className="sidebar-section">
                <div className="sidebar-section-head">
                  <span className="sidebar-section-title">
                    {routeInfo?.name ||
                      (Number.isFinite(selectedRouteId)
                        ? `Ruta #${selectedRouteId}`
                        : "Sin ruta")}
                  </span>
                  <span className={`route-auth-badge ${routeBadge.className}`}>
                    {routeBadge.statusLabel}
                  </span>
                </div>

                <div className="route-stop-stack">
                  <div className="route-stop-row">
                    <span className="route-stop-dot start" />
                    <div>
                      <p className="stop-label">Origen</p>
                      <p className="stop-value">{routeInfo?.origin || "—"}</p>
                    </div>
                  </div>
                  {displayIntermediateStops.map((stop) => (
                    <div key={stop.id} className="route-stop-row">
                      <span className="route-stop-dot intermediate" />
                      <div>
                        <p className="stop-label">Parada {stop.order}</p>
                        <p className="stop-value">{stop.label}</p>
                      </div>
                    </div>
                  ))}
                  <div className="route-stop-row">
                    <span className="route-stop-dot end" />
                    <div>
                      <p className="stop-label">Destino</p>
                      <p className="stop-value">{routeInfo?.destination || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="progress-row">
                  <span className="progress-label">Progreso</span>
                  <strong className="progress-pct">{routeProgressPercent}%</strong>
                </div>
                <div className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${routeProgressPercent}%` }} />
                </div>
              </section>

              <div className="driver-actions">
                <button
                  type="button"
                  onClick={() => {
                    setGuidedRouteError("");
                    void startGuidedRoute();
                  }}
                  disabled={loading || guidedRouteLoading || guidedRouteRunning}
                  className={`action-btn primary${guidedRouteRunning || routeState === "en_curso" ? " active" : ""}`}
                >
                  {guidedRouteLoading
                    ? "Preparando..."
                    : guidedRouteRunning
                      ? "Ruta en curso"
                      : routeState === "finalizada"
                        ? "Finalizada"
                        : "Iniciar Ruta"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStopAll()}
                  disabled={
                    (!sharing && !guidedRouteRunning && !guidedRouteLoading) ||
                    routeState === "finalizada"
                  }
                  className="action-btn secondary"
                >
                  Detener
                </button>
              </div>

              {nearDestination && (
                <div className="near-destination-alert">
                  <span>🚏</span>
                  <div>
                    <strong>Llegando al destino</strong>
                    <p>
                      {remainingDistanceKm !== null
                        ? `${remainingDistanceKm.toFixed(2)} km restantes`
                        : "Próxima parada"}
                    </p>
                  </div>
                </div>
              )}

              {guidedRouteError && (
                <p className="panel-error">{guidedRouteError}</p>
              )}
            </>
          )}

          {/* ==================== USUARIO ==================== */}
          {currentRole === "user" && (
            <>
              <section className="sidebar-section">
                <div className="sidebar-section-head">
                  <span className="sidebar-section-title">
                    {routeInfo?.name ||
                      (Number.isFinite(selectedRouteId)
                        ? `Ruta #${selectedRouteId}`
                        : "Sin ruta")}
                  </span>
                  <span className={`route-auth-badge ${routeBadge.className}`}>
                    {routeBadge.statusLabel}
                  </span>
                </div>

                <div className="route-stop-stack">
                  <div className="route-stop-row">
                    <span className="route-stop-dot start" />
                    <div>
                      <p className="stop-label">Origen</p>
                      <p className="stop-value">{routeInfo?.origin || "—"}</p>
                    </div>
                  </div>
                  {displayIntermediateStops.map((stop) => (
                    <div key={stop.id} className="route-stop-row">
                      <span className="route-stop-dot intermediate" />
                      <div>
                        <p className="stop-label">Parada {stop.order}</p>
                        <p className="stop-value">{stop.label}</p>
                      </div>
                    </div>
                  ))}
                  <div className="route-stop-row">
                    <span className="route-stop-dot end" />
                    <div>
                      <p className="stop-label">Destino</p>
                      <p className="stop-value">{routeInfo?.destination || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="progress-row">
                  <span className="progress-label">Progreso del recorrido</span>
                  <strong className="progress-pct">{routeProgressPercent}%</strong>
                </div>
                <div className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${routeProgressPercent}%` }} />
                </div>

                {routeState === "finalizada" ? (
                  <div className="user-finished">
                    <p className="panel-muted">
                      El recorrido ha finalizado. Gracias por usar el servicio.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate("/dashboard")}
                      className="action-btn primary compact"
                    >
                      Ver historial
                    </button>
                  </div>
                ) : routeState === "en_curso" ? (
                  <div className="user-in-progress">
                    <span className="user-status-dot live" />
                    <span className="user-status-text">Ruta en progreso</span>
                  </div>
                ) : (
                  <p className="panel-muted">
                    Esperando inicio por parte del conductor.
                  </p>
                )}

              </section>

              {nearDestination && (
                <div className="near-destination-alert">
                  <span>🚏</span>
                  <div>
                    <strong>Llegando al destino</strong>
                    <p>
                      {remainingDistanceKm !== null
                        ? `${remainingDistanceKm.toFixed(2)} km restantes`
                        : "Próxima parada"}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* ======================================================
            MAPA
        ====================================================== */}
        <main
          className={`map-container-wrapper${showLiveTransition ? " map-live-transition" : ""}`}
        >
          <div className="map-frame">
            <MapView
              trackings={displayTrackings}
              plannedRoutePolyline={displayPlannedRoutePolyline}
              remainingRoutePolyline={routeProgressSegments.remaining}
              traveledRoutePolyline={displayTraveledRoutePolyline}
              originCoords={displayOriginCoords}
              destinationCoords={displayDestinationCoords}
              originName={routeInfo?.origin || "Centro"}
              destinationName={
                routeInfo?.destination || "Seminario San Buenaventura"
              }
              intermediateStops={displayIntermediateStops}
              activeVehicles={displayActiveVehicles}
              vehiclePosition={showEmptyCityCanvas ? null : displayVehiclePosition}
              userCoords={userCoords}
              mapHeight="100%"
              focusAllVehicles={isAdminView}
              routeOverlays={isAdminView ? adminRouteOverlays : []}
              highlightedRouteIds={isAdminView ? highlightedAdminRouteIds : []}
              eta={eta}
              etaUpdated={etaUpdated}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

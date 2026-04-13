import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import MapView from '../components/MapView';
import { connectTrackingWS } from '../services/ws';
import { getTrackingsByRoute } from '../services/tracking';
import { getRoute } from '../services/admin';
import { geocodeAddress, getStreetRoute, getETAMinutes, getTrackedStreetRoute } from '../services/routing';
import TrackingHero from '../components/tracking/TrackingHero';
import './TrackingPage.css';

const LIVE_WINDOW_MINUTES = 20;
const BUENAVENTURA_BOUNDS = {
  minLat: 3.65,
  maxLat: 4.05,
  minLng: -77.25,
  maxLng: -76.75,
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthKm * c;
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
  if (!rawData || typeof rawData !== 'object') return rawData;

  const eventName = String(rawData.event || rawData.type || rawData.action || '').toLowerCase();
  if (!eventName) return rawData;

  if (eventName === 'position_update') {
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
    Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= BUENAVENTURA_BOUNDS.minLat
    && lat <= BUENAVENTURA_BOUNDS.maxLat
    && lng >= BUENAVENTURA_BOUNDS.minLng
    && lng <= BUENAVENTURA_BOUNDS.maxLng
  );
}

export default function TrackingPage({ routeId: routeIdProp }) {
  const params = useParams();
  const selectedRouteId = Number(routeIdProp ?? params.routeId);

  const [trackings, setTrackings] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [vehiclePosition, setVehiclePosition] = useState(null);
  const [liveRouteHistory, setLiveRouteHistory] = useState([]);
  const [matchedLiveRouteHistory, setMatchedLiveRouteHistory] = useState([]);
  const [eta, setEta] = useState(null);
  const [etaUpdated, setEtaUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [isPollingFallback, setIsPollingFallback] = useState(false);
  const [forceBuenaventuraDemo, setForceBuenaventuraDemo] = useState(false);
  const [showLiveTransition, setShowLiveTransition] = useState(false);
  const [showLiveToast, setShowLiveToast] = useState(false);

  const trackingsCountRef = useRef(0);
  const liveTransitionTimerRef = useRef(null);
  const liveToastTimerRef = useRef(null);

  useEffect(() => {
    trackingsCountRef.current = trackings.length;
  }, [trackings]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!Number.isFinite(selectedRouteId)) {
        setLoading(false);
        return;
      }

      try {
        const [route, initialTrackings] = await Promise.all([
          getRoute(selectedRouteId).catch(() => null),
          getTrackingsByRoute(selectedRouteId).catch(() => []),
        ]);

        if (!mounted) return;
        setRouteInfo(route);

        const normalizedInitial = initialTrackings
          .map((t) => normalizeTracking(t, new Date().toISOString()))
          .filter(Boolean)
          .filter((t) => isRecentTimestamp(t.timestamp) && isWithinBuenaventura(t.latitude, t.longitude));
        setTrackings(normalizedInitial);

        if (normalizedInitial.length > 0) {
          const latest = normalizedInitial[normalizedInitial.length - 1];
          setVehiclePosition({
            latitude: latest.latitude,
            longitude: latest.longitude,
            timestamp: latest.timestamp,
          });

          const historyPoints = normalizedInitial.map((t) => [t.latitude, t.longitude]);
          setLiveRouteHistory(historyPoints);
        } else {
          setVehiclePosition(null);
          setLiveRouteHistory([]);
        }

        if (route?.origin && route?.destination) {
          const [from, to] = await Promise.all([
            geocodeAddress(route.origin),
            geocodeAddress(route.destination),
          ]);

          if (!mounted) return;

          // Confiamos en el geocoder con contexto de ciudad;
          // solo forzamos demo si no se pudo geocodificar ninguno de los dos extremos.
          if (Array.isArray(from) && Array.isArray(to)) {
            setOriginCoords(from);
            setDestinationCoords(to);
            setForceBuenaventuraDemo(false);

            // getStreetRoute incluye fallback a línea recta (islas / rutas sin asfalto)
            const streetRoute = await getStreetRoute(from, to);
            if (!mounted) return;
            if (streetRoute) {
              setRoutePolyline(streetRoute.coordinates);
              setEta(Math.ceil(streetRoute.duration / 60));
              setEtaUpdated(new Date());
            }
          } else {
            // Geocoding devolvió null → usar demo
            setOriginCoords(null);
            setDestinationCoords(null);
            setRoutePolyline(null);
            setForceBuenaventuraDemo(true);
          }
        } else {
          setForceBuenaventuraDemo(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [selectedRouteId]);

  useEffect(() => {
    if (!Number.isFinite(selectedRouteId)) return undefined;

    setWsStatus('connecting');
    let opened = false;

    const openingTimeoutId = setTimeout(() => {
      setWsStatus((current) => (current === 'connecting' ? 'offline' : current));
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

          if (liveTransitionTimerRef.current) clearTimeout(liveTransitionTimerRef.current);
          if (liveToastTimerRef.current) clearTimeout(liveToastTimerRef.current);

          liveTransitionTimerRef.current = setTimeout(() => setShowLiveTransition(false), 1800);
          liveToastTimerRef.current = setTimeout(() => setShowLiveToast(false), 2600);
        }

        setTrackings((prev) => mergeTrackings(prev, [normalized]));
        setVehiclePosition({
          latitude: normalized.latitude,
          longitude: normalized.longitude,
          timestamp: normalized.timestamp,
        });
        setLiveRouteHistory((prev) => appendHistoryPoint(prev, [normalized.latitude, normalized.longitude]));
      },
      {
        onOpen: () => {
          opened = true;
          clearTimeout(openingTimeoutId);
          setWsStatus('live');
          setIsPollingFallback(false);
        },
        onClose: () => {
          setWsStatus((current) => {
            if (current === 'live' || opened) return 'connecting';
            return 'offline';
          });
        },
        onError: () => setWsStatus('offline'),
      },
    );

    return () => {
      clearTimeout(openingTimeoutId);
      socketClient.close();
      if (liveTransitionTimerRef.current) clearTimeout(liveTransitionTimerRef.current);
      if (liveToastTimerRef.current) clearTimeout(liveToastTimerRef.current);
    };
  }, [selectedRouteId]);

  useEffect(() => {
    if (!Number.isFinite(selectedRouteId)) return undefined;
    if (wsStatus === 'live') return undefined;

    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const latest = await getTrackingsByRoute(selectedRouteId);
        if (cancelled || !Array.isArray(latest) || latest.length === 0) return;

        const normalized = latest
          .map((t) => normalizeTracking(t, new Date().toISOString()))
          .filter(Boolean)
          .filter((t) => isRecentTimestamp(t.timestamp) && isWithinBuenaventura(t.latitude, t.longitude));

        if (normalized.length === 0) return;

        setTrackings((prev) => mergeTrackings(prev, normalized));
        const latestPoint = normalized[normalized.length - 1];
        setVehiclePosition({
          latitude: latestPoint.latitude,
          longitude: latestPoint.longitude,
          timestamp: latestPoint.timestamp,
        });
        setLiveRouteHistory((prev) => normalized.reduce(
          (acc, t) => appendHistoryPoint(acc, [t.latitude, t.longitude]),
          prev,
        ));
        setIsPollingFallback(true);
      } catch {
        // En fallback, ignoramos errores intermitentes de red.
      }
    };

    fetchLatest();
    const id = setInterval(fetchLatest, 5000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedRouteId, wsStatus]);

  useEffect(() => {
    if (!destinationCoords || trackings.length === 0) return;
    const latest = trackings[trackings.length - 1];
    getETAMinutes([latest.latitude, latest.longitude], destinationCoords)
      .then((minutes) => {
        if (minutes === null) return;
        setEta(minutes);
        setEtaUpdated(new Date());
      })
      .catch(() => {});
  }, [trackings, destinationCoords]);

  useEffect(() => {
    if (liveRouteHistory.length < 2) {
      setMatchedLiveRouteHistory([]);
      return undefined;
    }

    let cancelled = false;

    const timerId = setTimeout(() => {
      getTrackedStreetRoute(liveRouteHistory)
        .then((matchedRoute) => {
          if (cancelled) return;
          if (matchedRoute?.coordinates?.length > 1) {
            setMatchedLiveRouteHistory(matchedRoute.coordinates);
            return;
          }
          setMatchedLiveRouteHistory(liveRouteHistory);
        })
        .catch(() => {
          if (!cancelled) setMatchedLiveRouteHistory(liveRouteHistory);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [liveRouteHistory]);

  const statusBadge = useMemo(() => {
    const badges = {
      connecting: { label: 'Conectando', color: 'connecting' },
      live: { label: 'En vivo', color: 'live' },
      offline: { label: 'Sin conexion', color: 'offline' },
      fallback: { label: 'En vivo (respaldo)', color: 'live' },
    };
    if (isPollingFallback && wsStatus !== 'live') return badges.fallback;
    return badges[wsStatus] || badges.connecting;
  }, [wsStatus, isPollingFallback]);

  const hasLiveData = trackings.length > 0;
  const showEmptyCityCanvas = !hasLiveData;
  const hasPlannedRoute = Array.isArray(routePolyline) && routePolyline.length > 1;
  const hasResolvedStops = Array.isArray(originCoords) && Array.isArray(destinationCoords);
  const showRouteContext = !forceBuenaventuraDemo && (hasResolvedStops || hasPlannedRoute);

  const displayOriginCoords = showRouteContext ? originCoords : null;
  const displayDestinationCoords = showRouteContext ? destinationCoords : null;
  const displayPlannedRoutePolyline = showRouteContext && Array.isArray(routePolyline) && routePolyline.length > 1
    ? routePolyline
    : null;
  const displayTraveledRoutePolyline = hasLiveData && matchedLiveRouteHistory.length > 1
    ? matchedLiveRouteHistory
    : null;
  const displayTrackings = useMemo(
    () => (hasLiveData ? trackings : []),
    [hasLiveData, trackings],
  );
  const plannedDistanceKm = useMemo(
    () => polylineDistanceKm(displayPlannedRoutePolyline),
    [displayPlannedRoutePolyline],
  );
  const traveledDistanceKm = useMemo(
    () => polylineDistanceKm(displayTraveledRoutePolyline),
    [displayTraveledRoutePolyline],
  );

  const vehicleSummary = useMemo(() => {
    if (displayTrackings.length === 0) {
      return {
        label: routeInfo?.driver_detail?.license_number || `B-${selectedRouteId || 0}`,
        latitude: null,
        longitude: null,
        speedKmh: 0,
        studentsOnboard: 0,
        status: 'Detenido',
      };
    }

    const latest = displayTrackings[displayTrackings.length - 1];
    const previous = displayTrackings.length > 1 ? displayTrackings[displayTrackings.length - 2] : null;

    let speedKmh = toNumber(latest.speed ?? latest.speed_kmh ?? latest.velocity) || 0;
    if (!speedKmh && previous?.timestamp && latest.timestamp) {
      const t1 = new Date(previous.timestamp).getTime();
      const t2 = new Date(latest.timestamp).getTime();
      const deltaH = (t2 - t1) / 3600000;
      if (deltaH > 0) {
        const dist = distanceKm(previous.latitude, previous.longitude, latest.latitude, latest.longitude);
        speedKmh = Math.max(0, Math.round(dist / deltaH));
      }
    }

    const latestByPassenger = new Map();
    displayTrackings.forEach((t) => {
      if (t.passenger == null) return;
      latestByPassenger.set(String(t.passenger), t);
    });
    const studentsOnboard = Array.from(latestByPassenger.values())
      .filter((t) => t.status === 'picked')
      .length;

    return {
      label: routeInfo?.driver_detail?.license_number || `B-${selectedRouteId || 101}`,
      latitude: latest.latitude,
      longitude: latest.longitude,
      speedKmh,
      studentsOnboard,
      status: speedKmh > 3 ? 'En ruta' : 'Detenido',
    };
  }, [displayTrackings, routeInfo, selectedRouteId]);

  const activeVehicles = useMemo(() => {
    if (!hasLiveData) return [];

    if (Number.isFinite(vehiclePosition?.latitude) && Number.isFinite(vehiclePosition?.longitude)) {
      return [{
        ...vehicleSummary,
        latitude: vehiclePosition.latitude,
        longitude: vehiclePosition.longitude,
      }];
    }

    const latestByPassenger = new Map();
    displayTrackings.forEach((t) => {
      if (t.passenger == null) return;
      latestByPassenger.set(String(t.passenger), t);
    });

    if (latestByPassenger.size > 0) {
      const groupedVehicles = Array.from(latestByPassenger.entries()).map(([passengerId, t], idx) => {
        const speed = toNumber(t.speed ?? t.speed_kmh ?? t.velocity) || 0;
        return {
          label: `B-${String(passengerId).padStart(2, '0')}`,
          latitude: t.latitude,
          longitude: t.longitude,
          speedKmh: speed,
          studentsOnboard: t.status === 'picked' ? 1 : 0,
          status: speed > 3 ? 'En ruta' : 'Detenido',
          _order: idx,
        };
      }).filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude));

      if (groupedVehicles.length > 0) {
        return groupedVehicles.slice(0, 4).sort((a, b) => b.speedKmh - a.speedKmh || a._order - b._order);
      }
    }

    if (!Number.isFinite(vehicleSummary.latitude) || !Number.isFinite(vehicleSummary.longitude)) {
      return [];
    }
    return [vehicleSummary];
  }, [displayTrackings, hasLiveData, vehiclePosition, vehicleSummary]);

  const snappedVehiclePoint = useMemo(() => {
    if (!Array.isArray(displayTraveledRoutePolyline) || displayTraveledRoutePolyline.length === 0) return null;
    return displayTraveledRoutePolyline[displayTraveledRoutePolyline.length - 1];
  }, [displayTraveledRoutePolyline]);

  const displayVehiclePosition = useMemo(() => {
    if (!snappedVehiclePoint) return vehiclePosition;
    return {
      latitude: snappedVehiclePoint[0],
      longitude: snappedVehiclePoint[1],
      timestamp: vehiclePosition?.timestamp || null,
    };
  }, [snappedVehiclePoint, vehiclePosition]);

  const displayActiveVehicles = useMemo(() => {
    if (!snappedVehiclePoint || activeVehicles.length === 0) return activeVehicles;

    return activeVehicles.map((vehicle, index) => {
      if (index !== 0) return vehicle;
      return {
        ...vehicle,
        latitude: snappedVehiclePoint[0],
        longitude: snappedVehiclePoint[1],
      };
    });
  }, [activeVehicles, snappedVehiclePoint]);

  const etaLabel = eta === null ? 'Sin ETA' : `${eta} min`;

  return (
    <div className="tracking-layout min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans">
      <div className="tracking-page-header px-4 md:px-8 pt-4 md:pt-6 pb-0 max-w-[1400px] mx-auto">
        <TrackingHero
          backTo="/dashboard"
          backAriaLabel="Volver al dashboard"
          eyebrow="Sistema activo"
          title="Tracking en tiempo real"
          description="Monitorea rutas activas, localiza conductores y sigue cada recorrido en tiempo real."
          subtitle={routeInfo?.name || `Ruta #${selectedRouteId}`}
          meta={(
            <>
              <span className={`status-badge ${statusBadge.color}`}>
                <span className="status-dot" />
                {statusBadge.label}
              </span>
              <span className="tracking-page-hero-updates">{trackings.length} actualizaciones</span>
            </>
          )}
        />
      </div>

      <div className="tracking-dashboard px-4 md:px-8 py-5 max-w-[1400px] mx-auto">
        <aside className="tracking-analytics-panel">
          <section className="kpi-card">
            <div className="route-summary-topbar">
              <p className="kpi-label mb-0">Ruta real</p>
              <span className={`route-auth-badge ${showRouteContext ? 'verified' : 'pending'}`}>
                {showRouteContext ? 'Puntos verificados' : 'Pendiente de ubicar'}
              </span>
            </div>
            <div className="route-stop-stack">
              <div className="route-stop-card start">
                <span className="route-stop-dot" aria-hidden="true" />
                <div>
                  <p className="kpi-label">Origen</p>
                  <p className="kpi-value">{routeInfo?.origin || 'Centro, Buenaventura'}</p>
                </div>
              </div>
              <div className="route-stop-divider" aria-hidden="true" />
              <div className="route-stop-card end">
                <span className="route-stop-dot" aria-hidden="true" />
                <div>
                  <p className="kpi-label">Destino</p>
                  <p className="kpi-value">{routeInfo?.destination || 'Seminario San Buenaventura'}</p>
                </div>
              </div>
            </div>
            <div className="route-metrics-grid">
              <div className="route-metric-tile">
                <span className="route-metric-label">ETA</span>
                <strong className="route-metric-value">{etaLabel}</strong>
              </div>
              <div className="route-metric-tile">
                <span className="route-metric-label">Planificada</span>
                <strong className="route-metric-value">{plannedDistanceKm > 0 ? `${plannedDistanceKm.toFixed(1)} km` : 'Sin trazo'}</strong>
              </div>
              <div className="route-metric-tile">
                <span className="route-metric-label">Recorrida</span>
                <strong className="route-metric-value">{traveledDistanceKm > 0 ? `${traveledDistanceKm.toFixed(1)} km` : '0.0 km'}</strong>
              </div>
            </div>
            <div className="kpi-eta-row">
              <span className="kpi-label">Estado de ruta</span>
              <strong className="kpi-eta-value">{showRouteContext ? 'Trazada' : 'Buscando'}</strong>
            </div>
            {etaUpdated && (
              <p className="kpi-updated">
                Actualizado: {etaUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </section>

          <section className="kpi-card">
            <div className="panel-title-row">
              <h2 className="panel-title">Vehiculos activos</h2>
              <span className="panel-counter">{displayActiveVehicles.length}</span>
            </div>

            {loading ? (
              <p className="panel-muted">Cargando datos...</p>
            ) : displayActiveVehicles.length === 0 ? (
              <p className="panel-muted">Aun no hay posicion activa para esta ruta.</p>
            ) : (
              <div className="vehicle-list">
                {displayActiveVehicles.map((vehicle) => (
                  <article key={vehicle.label} className="vehicle-item">
                    <div className="vehicle-chip">
                      <span className="vehicle-chip-icon" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="4" width="16" height="12" rx="2" />
                          <path d="M17 8h3l3 4v4h-6V8z" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                      </span>
                      {vehicle.label}
                    </div>
                    <div className="vehicle-stats">
                      <div>
                        <p className="stat-label">Velocidad</p>
                        <p className="stat-value">{vehicle.speedKmh} km/h</p>
                      </div>
                      <div>
                        <p className="stat-label">A bordo</p>
                        <p className="stat-value">{vehicle.studentsOnboard}</p>
                      </div>
                    </div>
                    <span className={`vehicle-status ${vehicle.status === 'En ruta' ? 'moving' : 'idle'}`}>
                      {vehicle.status}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </aside>

        <main className={`map-container-wrapper h-[640px] ${showLiveTransition ? 'map-live-transition' : ''}`}>
          {showLiveToast && (
            <div className="live-toast" role="status" aria-live="polite">
              <span className="live-toast-dot" /> Conectado en vivo
            </div>
          )}
          <MapView
            trackings={displayTrackings}
            plannedRoutePolyline={displayPlannedRoutePolyline}
            traveledRoutePolyline={displayTraveledRoutePolyline}
            originCoords={displayOriginCoords}
            destinationCoords={displayDestinationCoords}
            originName={routeInfo?.origin || 'Centro'}
            destinationName={routeInfo?.destination || 'Seminario San Buenaventura'}
            activeVehicles={displayActiveVehicles}
            vehiclePosition={showEmptyCityCanvas ? null : displayVehiclePosition}
            mapHeight="640px"
          />
        </main>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MapView from '../components/MapView';
import { connectTrackingWS } from '../services/ws';
import { getTrackingsByRoute } from '../services/tracking';
import { getRoute } from '../services/admin';
import { geocodeAddress, getStreetRoute, getETAMinutes } from '../services/routing';
import './TrackingPage.css';

const LIVE_WINDOW_MINUTES = 20;
const BUENAVENTURA_BOUNDS = {
  minLat: 3.75,
  maxLat: 3.98,
  minLng: -77.15,
  maxLng: -76.9,
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

const DEMO_ORIGIN = [3.8806, -77.0319];
const DEMO_DESTINATION = [3.8896, -77.0427];
const DEMO_ROUTE_POLYLINE = [
  [3.8806, -77.0319],
  [3.8822, -77.0338],
  [3.8841, -77.0361],
  [3.8863, -77.0389],
  [3.8877, -77.0407],
  [3.8896, -77.0427],
];

const DEMO_TRACKINGS = [
  {
    latitude: 3.8852,
    longitude: -77.0377,
    timestamp: '2026-04-13T09:05:00Z',
    speed_kmh: 24,
    passenger: 1,
    status: 'picked',
  },
  {
    latitude: 3.8869,
    longitude: -77.0393,
    timestamp: '2026-04-13T09:08:00Z',
    speed_kmh: 26,
    passenger: 2,
    status: 'picked',
  },
];

// Buses cercanos visibles en el mapa durante el modo demo
const DEMO_VEHICLES = [
  { label: 'B-03', latitude: 3.8863, longitude: -77.0389, status: 'En ruta', speedKmh: 26, studentsOnboard: 2 },
  { label: 'B-07', latitude: 3.8822, longitude: -77.0338, status: 'En ruta', speedKmh: 21, studentsOnboard: 1 },
  { label: 'B-12', latitude: 3.8877, longitude: -77.0407, status: 'Detenido', speedKmh: 0, studentsOnboard: 0 },
];

export default function TrackingPage({ routeId: routeIdProp }) {
  const params = useParams();
  const selectedRouteId = Number(routeIdProp ?? params.routeId);

  const [trackings, setTrackings] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
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

        if (route?.origin && route?.destination) {
          const [from, to] = await Promise.all([
            geocodeAddress(route.origin),
            geocodeAddress(route.destination),
          ]);

          if (!mounted) return;
          const geocodeInBuenaventura =
            Array.isArray(from)
            && Array.isArray(to)
            && isWithinBuenaventura(from[0], from[1])
            && isWithinBuenaventura(to[0], to[1]);

          if (geocodeInBuenaventura) {
            setOriginCoords(from);
            setDestinationCoords(to);
            setForceBuenaventuraDemo(false);
          } else {
            setOriginCoords(null);
            setDestinationCoords(null);
            setRoutePolyline(null);
            setForceBuenaventuraDemo(true);
          }

          if (geocodeInBuenaventura && from && to) {
            const streetRoute = await getStreetRoute(from, to);
            if (!mounted) return;
            if (streetRoute) {
              setRoutePolyline(streetRoute.coordinates);
              setEta(Math.ceil(streetRoute.duration / 60));
              setEtaUpdated(new Date());
            }
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

    const socketClient = connectTrackingWS(
      selectedRouteId,
      (rawData) => {
        const normalized = normalizeTracking(rawData, new Date().toISOString());
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
      },
      {
        onOpen: () => {
          setWsStatus('live');
          setIsPollingFallback(false);
        },
        onClose: () => setWsStatus('connecting'),
        onError: () => setWsStatus('offline'),
      },
    );

    return () => {
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
  const isDemoMode = !hasLiveData;
  const useBuenaventuraDemo = isDemoMode || forceBuenaventuraDemo;

  const displayOriginCoords = useBuenaventuraDemo || !originCoords ? DEMO_ORIGIN : originCoords;
  const displayDestinationCoords = useBuenaventuraDemo || !destinationCoords ? DEMO_DESTINATION : destinationCoords;
  const displayRoutePolyline = useBuenaventuraDemo || !(routePolyline?.length > 1)
    ? DEMO_ROUTE_POLYLINE
    : routePolyline;
  const displayTrackings = hasLiveData ? trackings : DEMO_TRACKINGS;

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
    if (useBuenaventuraDemo) return DEMO_VEHICLES;

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
  }, [vehicleSummary, useBuenaventuraDemo, displayTrackings]);

  const etaLabel = eta === null ? (useBuenaventuraDemo ? '9 min' : 'Sin ETA') : `${eta} min`;

  return (
    <div className="tracking-layout min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 font-sans">
      <div className="tracking-page-header px-4 md:px-8 py-4 md:py-5 sticky top-0 z-40 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 max-w-[1400px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 transition shrink-0 text-slate-600"
              aria-label="Volver al dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">Dashboard analitico</p>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight truncate">
                {routeInfo?.name || `Ruta #${selectedRouteId}`}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`status-badge ${statusBadge.color}`}>
              <span className="status-dot" />
              {statusBadge.label}
            </span>
            {useBuenaventuraDemo && <span className="demo-badge">Modo demo</span>}
            <span className="text-xs text-slate-500">{trackings.length} actualizaciones</span>
          </div>
        </div>
      </div>

      <div className="tracking-dashboard px-4 md:px-8 py-5 max-w-[1400px] mx-auto">
        <aside className="tracking-analytics-panel">
          <section className="kpi-card">
            <p className="kpi-label">Origen</p>
            <p className="kpi-value">{useBuenaventuraDemo ? 'Centro, Buenaventura' : (routeInfo?.origin || 'Centro, Buenaventura')}</p>
            <p className="kpi-label mt-3">Destino</p>
            <p className="kpi-value">{useBuenaventuraDemo ? 'Seminario San Buenaventura' : (routeInfo?.destination || 'Seminario San Buenaventura')}</p>
            <div className="kpi-eta-row">
              <span className="kpi-label">ETA</span>
              <strong className="kpi-eta-value">{etaLabel}</strong>
            </div>
            {useBuenaventuraDemo && (
              <p className="kpi-updated">Vista inicial con datos de prueba para validar el diseno del mapa.</p>
            )}
            {etaUpdated && (
              <p className="kpi-updated">
                Actualizado: {etaUpdated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </section>

          <section className="kpi-card">
            <div className="panel-title-row">
              <h2 className="panel-title">Vehiculos activos</h2>
              <span className="panel-counter">{activeVehicles.length}</span>
            </div>

            {loading ? (
              <p className="panel-muted">Cargando datos...</p>
            ) : activeVehicles.length === 0 ? (
              <p className="panel-muted">Aun no hay posicion activa para esta ruta.</p>
            ) : (
              <div className="vehicle-list">
                {activeVehicles.map((vehicle) => (
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
            routePolyline={displayRoutePolyline}
            originCoords={displayOriginCoords}
            destinationCoords={displayDestinationCoords}
            originName={useBuenaventuraDemo ? 'Centro' : (routeInfo?.origin || 'Centro')}
            destinationName={useBuenaventuraDemo ? 'Seminario San Buenaventura' : (routeInfo?.destination || 'Seminario San Buenaventura')}
            activeVehicles={activeVehicles}
            mapHeight="640px"
          />
        </main>
      </div>
    </div>
  );
}

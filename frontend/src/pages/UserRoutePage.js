import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { icons } from "../components/dashboard/icons";
import TrackingHero from "../components/tracking/TrackingHero";
import MapView from "../components/MapView";
import { getUserAssignedRoute, getDriverTrackings } from "../services/dashboard";
import { geocodeAddress, getStreetRouteThroughPoints } from "../services/routing";
import { connectTrackingWS } from "../services/ws";

// --- Constantes de notificación ---
const NOTIFY_APPROACHING_KM = 1.5;  // ~5 min a 18 km/h
const NOTIFY_AT_STOP_KM = 0.35;     // bus en la parada del usuario
const NOTIFY_AT_DEST_KM = 0.5;      // bus llegó al destino
const DEFAULT_SPEED_KMH = 18;
const NEAR_DISTANCE_KM = 0.8;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeTracking(raw) {
  const latitude = Number(raw?.latitude ?? raw?.lat);
  const longitude = Number(raw?.longitude ?? raw?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { ...raw, latitude, longitude };
}

function sendBrowserNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" }); // eslint-disable-line no-new
  } catch (_) {
    // ignorar si las notificaciones están bloqueadas
  }
}

export default function UserRoutePage({ role, onLogout }) {
  const [data, setData] = useState(null);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Coords geocodificadas
  const [originCoords, setOriginCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [myPickupCoords, setMyPickupCoords] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);

  // Live tracking vía WebSocket
  const [livePosition, setLivePosition] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");

  // Banners in-app
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);
  const [showArrivingBanner, setShowArrivingBanner] = useState(false);

  // Refs para notificaciones (evitan duplicados entre renders)
  const notifiedApproachingRef = useRef(false);
  const notifiedAtStopRef = useRef(false);
  const notifiedAtDestRef = useRef(false);

  // Carga inicial
  useEffect(() => {
    Promise.all([getUserAssignedRoute(), getDriverTrackings()])
      .then(([routeData, trackingData]) => {
        setData(routeData);
        setTrackings(
          (trackingData || []).map(normalizeTracking).filter(Boolean),
        );
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError("Todavía no tienes una ruta asignada.");
          return;
        }
        setError("No se pudo cargar tu ruta en este momento.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Solicitar permiso de notificaciones
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Geocodificar origen, destino y parada del usuario
  useEffect(() => {
    const route = data?.route;
    if (!route) return;

    if (route.origin_lat && route.origin_lng) {
      setOriginCoords([Number(route.origin_lat), Number(route.origin_lng)]);
    } else if (route.origin) {
      geocodeAddress(route.origin).then((coords) => {
        if (Array.isArray(coords) && coords.length === 2) setOriginCoords(coords);
      }).catch(() => {});
    }

    if (route.destination_lat && route.destination_lng) {
      setDestinationCoords([Number(route.destination_lat), Number(route.destination_lng)]);
    } else if (route.destination) {
      geocodeAddress(route.destination).then((coords) => {
        if (Array.isArray(coords) && coords.length === 2) setDestinationCoords(coords);
      }).catch(() => {});
    }

    // Identificar la parada del usuario actual
    const currentUsername = localStorage.getItem("username");
    if (currentUsername && Array.isArray(route.passenger_details)) {
      const myPassenger = route.passenger_details.find(
        (p) => p.user_detail?.username === currentUsername,
      );
      if (myPassenger?.pickup_lat && myPassenger?.pickup_lng) {
        setMyPickupCoords([Number(myPassenger.pickup_lat), Number(myPassenger.pickup_lng)]);
      }
    }
  }, [data]);

  // Construir polilínea de ruta por calles
  useEffect(() => {
    if (!originCoords || !destinationCoords) return;
    const stops = data?.route?.intermediate_stops || [];
    const points = [
      originCoords,
      ...stops
        .filter((s) => s.latitude && s.longitude)
        .map((s) => [Number(s.latitude), Number(s.longitude)]),
      destinationCoords,
    ];
    getStreetRouteThroughPoints(points)
      .then((result) => {
        if (result?.coordinates?.length > 1) setRoutePolyline(result.coordinates);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originCoords, destinationCoords, data?.route?.intermediate_stops]);

  // Conectar WebSocket cuando la ruta esté disponible
  useEffect(() => {
    const routeId = data?.route?.id;
    if (!routeId) return;

    setWsStatus("connecting");

    const ws = connectTrackingWS(
      routeId,
      (payload) => {
        const lat = Number(payload?.latitude ?? payload?.lat);
        const lng = Number(payload?.longitude ?? payload?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        const newPos = { latitude: lat, longitude: lng, speed_kmh: payload?.speed_kmh ?? null };
        setLivePosition(newPos);
        setTrackings((prev) => {
          const next = [...prev, { ...newPos, route: routeId }];
          return next.slice(-60);
        });
      },
      {
        onOpen: () => setWsStatus("connected"),
        onClose: () => setWsStatus("disconnected"),
        onError: () => setWsStatus("disconnected"),
        reconnectDelayMs: 3000,
        maxReconnectAttempts: 30,
      },
    );

    return () => { ws.close(); };
  }, [data?.route?.id]);

  // Lógica de notificaciones basada en posición en tiempo real
  useEffect(() => {
    if (!livePosition) return;
    const speed = livePosition.speed_kmh > 2 ? livePosition.speed_kmh : DEFAULT_SPEED_KMH;

    // Notificaciones hacia la parada personal del usuario
    if (myPickupCoords) {
      const km = distanceKm(
        livePosition.latitude, livePosition.longitude,
        myPickupCoords[0], myPickupCoords[1],
      );

      if (km <= NOTIFY_AT_STOP_KM && !notifiedAtStopRef.current) {
        notifiedAtStopRef.current = true;
        setShowArrivingBanner(true);
        sendBrowserNotification(
          "¡El bus está en tu parada!",
          "Tu conductor está llegando ahora a tu punto de recogida.",
        );
      } else if (km <= NOTIFY_APPROACHING_KM && !notifiedApproachingRef.current) {
        notifiedApproachingRef.current = true;
        setShowNearbyBanner(true);
        const etaMins = Math.max(1, Math.round((km / speed) * 60));
        sendBrowserNotification(
          "Tu bus se acerca",
          `El bus está a aproximadamente ${etaMins} min de tu parada. ¡Prepárate!`,
        );
      }

      // Resetear banners si el bus se aleja (inicio de recorrido o retroceso)
      if (km > NOTIFY_APPROACHING_KM + 0.5) {
        notifiedApproachingRef.current = false;
        notifiedAtStopRef.current = false;
        setShowNearbyBanner(false);
        setShowArrivingBanner(false);
      }
    }

    // Notificación cuando el bus llega al destino final
    if (destinationCoords) {
      const km = distanceKm(
        livePosition.latitude, livePosition.longitude,
        destinationCoords[0], destinationCoords[1],
      );
      if (km <= NOTIFY_AT_DEST_KM && !notifiedAtDestRef.current) {
        notifiedAtDestRef.current = true;
        sendBrowserNotification(
          "El bus llegó al destino",
          "El recorrido de hoy ha finalizado.",
        );
      }
    }
  }, [livePosition, myPickupCoords, destinationCoords]);

  const route = data?.route;
  const driver = data?.driver;

  const latestTracking = useMemo(() => {
    if (livePosition) return livePosition;
    if (!trackings.length) return null;
    return trackings[trackings.length - 1];
  }, [livePosition, trackings]);

  const vehiclePosition = useMemo(() => {
    if (!latestTracking) return null;
    return [latestTracking.latitude, latestTracking.longitude];
  }, [latestTracking]);

  const etaMinutes = useMemo(() => {
    if (!livePosition || !myPickupCoords) return null;
    const speed = livePosition.speed_kmh > 2 ? livePosition.speed_kmh : DEFAULT_SPEED_KMH;
    const km = distanceKm(
      livePosition.latitude, livePosition.longitude,
      myPickupCoords[0], myPickupCoords[1],
    );
    return Math.max(1, Math.round((km / speed) * 60));
  }, [livePosition, myPickupCoords]);

  const isVehicleNearby = useMemo(() => {
    if (!latestTracking || !destinationCoords) return false;
    const km = distanceKm(
      latestTracking.latitude,
      latestTracking.longitude,
      destinationCoords[0],
      destinationCoords[1],
    );
    return km <= NEAR_DISTANCE_KM;
  }, [latestTracking, destinationCoords]);

  const pickupStatus = useMemo(() => {
    const t = trackings.find((t) => Number(t.route) === Number(route?.id));
    return t?.status || "not_picked";
  }, [trackings, route?.id]);

  const WS_UI = {
    connecting: { label: "Conectando...", dot: "bg-amber-500 animate-pulse", badge: "bg-amber-100 text-amber-700" },
    connected:   { label: "En vivo",       dot: "bg-emerald-500 animate-pulse", badge: "bg-emerald-100 text-emerald-700" },
    disconnected:{ label: "Sin conexión",  dot: "bg-red-400",                   badge: "bg-red-100 text-red-600" },
  };
  const { label: wsLabel, dot: wsDotClass, badge: wsBadgeClass } = WS_UI[wsStatus] ?? WS_UI.disconnected;

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">

        {/* Banner: bus llegando a la parada del usuario */}
        {showArrivingBanner && (
          <div className="fixed top-6 right-6 z-50 max-w-sm rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-lg flex items-start gap-3">
            <div className="mt-0.5 h-3 w-3 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">¡El bus está en tu parada!</p>
              <p className="mt-1 text-xs text-blue-700">Tu conductor está llegando ahora a tu punto de recogida.</p>
              <button
                className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline"
                onClick={() => setShowArrivingBanner(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Banner: bus acercándose */}
        {!showArrivingBanner && showNearbyBanner && (
          <div className="fixed top-6 right-6 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg flex items-start gap-3">
            <div className="mt-0.5 h-3 w-3 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">
                Tu bus se acerca{etaMinutes ? ` · ${etaMinutes} min` : ""}
              </p>
              <p className="mt-1 text-xs text-emerald-700">Prepárate, el conductor está próximo a tu parada.</p>
              <button
                className="mt-2 text-xs text-emerald-500 hover:text-emerald-700 underline"
                onClick={() => setShowNearbyBanner(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        <div className="mb-6">
          <TrackingHero
            backTo="/dashboard"
            backAriaLabel="Volver al panel"
            eyebrow="Ruta personal"
            title="Tu ruta asignada"
            description="Seguimiento en vivo de tu conductor y trayecto."
            subtitle={route?.name || "Pendiente de asignacion"}
            meta={
              route ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${wsBadgeClass}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${wsDotClass}`} />
                    {wsLabel}
                  </span>
                  <span className="tracking-hero-chip">
                    {route?.passenger_count ?? route?.passenger_details?.length ?? 0} estudiantes
                  </span>
                </div>
              ) : null
            }
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center text-sm text-gray-400">
            Cargando tu ruta...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
            <p className="text-base font-medium text-gray-700">{error}</p>
            <p className="text-sm text-gray-400 mt-2">
              Cuando un administrador te asigne una ruta, la verás aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-5">

            {/* Mapa en vivo */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Seguimiento en vivo</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Posición actual del bus
                    {etaMinutes && myPickupCoords
                      ? ` · ETA a tu parada: ${etaMinutes} min`
                      : vehiclePosition
                      ? " · Bus en ruta"
                      : " · Esperando señal del conductor"}
                  </p>
                </div>
                {isVehicleNearby && (
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full flex-shrink-0">
                    Cerca del destino
                  </span>
                )}
              </div>
              <MapView
                trackings={trackings}
                vehiclePosition={vehiclePosition}
                routePolyline={routePolyline}
                originCoords={originCoords}
                destinationCoords={destinationCoords}
                originName={route?.origin}
                destinationName={route?.destination}
                intermediateStops={route?.intermediate_stops || []}
                userCoords={myPickupCoords}
                mapHeight="420px"
              />
            </section>

            {/* Grid: info de ruta + compañeros */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold mb-2">
                      Ruta
                    </p>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {route?.name}
                    </h2>
                  </div>
                  <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                    {route?.passenger_count ?? route?.passenger_details?.length ?? 0}{" "}
                    estudiantes
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Origen</p>
                    <div className="flex items-start gap-3 text-gray-800">
                      <span className="text-blue-600">{icons.mapPin({ size: 18, strokeWidth: 2.2 })}</span>
                      <p className="text-sm font-medium">{route?.origin}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Destino</p>
                    <div className="flex items-start gap-3 text-gray-800">
                      <span className="text-emerald-600">{icons.navigation({ size: 18, strokeWidth: 2.2 })}</span>
                      <p className="text-sm font-medium">{route?.destination}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4 mb-4">
                  <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-2">
                    Conductor asignado
                  </p>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {driver?.user_detail?.username || "Sin conductor asignado"}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {driver?.user_detail?.email || "Sin correo disponible"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-gray-300">Licencia</p>
                      <p className="text-sm font-medium text-gray-700">
                        {driver?.license_number || "No disponible"}
                      </p>
                    </div>
                  </div>
                  {route?.id && (
                    <div className="mt-4 flex justify-end">
                      <Link
                        to={`/tracking/${route.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                      >
                        Ver tracking completo
                      </Link>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-2">
                    Estado de Recogida
                  </p>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                        pickupStatus === "picked"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {pickupStatus === "picked"
                        ? "✓ Ya fuiste recogido"
                        : "✗ Aún no has sido recogido"}
                    </span>
                    <p className="text-xs text-gray-400">
                      {pickupStatus === "picked"
                        ? "Tu conductor te ha marcado como recogido."
                        : "Espera a que tu conductor te marque como recogido."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Tus compañeros de ruta
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Lista de estudiantes asignados al mismo trayecto
                    </p>
                  </div>
                </div>

                {route?.passenger_details?.length > 0 ? (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {route.passenger_details.map((passenger) => (
                      <div
                        key={passenger.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {passenger.user_detail?.username || `Estudiante #${passenger.id}`}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {passenger.user_detail?.email || "Sin correo registrado"}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                          {passenger.phone || "Sin teléfono"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                    No hay más estudiantes registrados en esta ruta.
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

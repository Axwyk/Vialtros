import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getDriverAssignedRoutes } from "../services/dashboard";
import { getRoutes } from "../services/admin";
import { sendDriverLocation } from "../services/driverLocation";
import {
  geocodeAddress,
  getStreetRoute,
  snapPointToRoad,
} from "../services/routing";

const GUIDED_ROUTE_SPEED_KMH = 24;
const GUIDED_ROUTE_STEP_MS = 4500;
const GUIDED_ROUTE_MAX_POINTS = 28;

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

function formatTimestamp(value) {
  if (!value) return "Sin envios";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin envios";
  return date.toLocaleString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export default function DriverLocationPage({ role }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);
  const [guidedRouteLoading, setGuidedRouteLoading] = useState(false);
  const [sharingMode, setSharingMode] = useState("idle");
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState(
    "Listo para compartir ubicacion.",
  );
  const [lastSentAt, setLastSentAt] = useState("");
  const [lastCoords, setLastCoords] = useState(null);
  const watchIdRef = useRef(null);
  const guidedRouteTimerRef = useRef(null);
  const guidedRoutePointsRef = useRef([]);
  const guidedRouteIndexRef = useRef(0);
  const lastSentMsRef = useRef(0);

  const isAdminPreview = role === "admin";

  async function loadAvailableRoutes(currentRole) {
    if (currentRole === "driver") {
      return getDriverAssignedRoutes();
    }

    if (currentRole === "admin") {
      return getRoutes();
    }

    return [];
  }

  useEffect(() => {
    let mounted = true;
    setLoadingRoutes(true);
    setError("");

    loadAvailableRoutes(role)
      .then((data) => {
        if (!mounted) return;
        setRoutes(data);
        if (data[0]?.id) setSelectedRouteId(String(data[0].id));
        if (!data.length && role === "driver") {
          setStatusText(
            "Aun no tienes rutas asignadas para compartir ubicacion.",
          );
        }
        if (!data.length && role === "admin") {
          setStatusText(
            "No hay rutas cargadas para probar el envio de ubicacion.",
          );
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setRoutes([]);
        if (
          err?.response?.status === 403 &&
          role !== "driver" &&
          role !== "admin"
        ) {
          setError(
            "Solo un conductor o un administrador pueden usar esta pantalla.",
          );
        } else if (role === "admin") {
          setError(
            "No se pudieron cargar las rutas disponibles para la prueba de ubicacion.",
          );
        } else {
          setError("No se pudieron cargar las rutas del conductor.");
        }
      })
      .finally(() => {
        if (mounted) setLoadingRoutes(false);
      });

    return () => {
      mounted = false;
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
      if (guidedRouteTimerRef.current != null) {
        clearTimeout(guidedRouteTimerRef.current);
      }
    };
  }, [role]);

  const selectedRoute = useMemo(
    () =>
      routes.find((route) => String(route.id) === String(selectedRouteId)) ||
      null,
    [routes, selectedRouteId],
  );
  const statusBadge = useMemo(() => {
    if (sharing && sharingMode === "guided") {
      return {
        dot: "bg-blue-500",
        pill: "border-blue-200 bg-blue-50 text-blue-700",
        label: "Ruta guiada activa",
      };
    }

    if (sharing) {
      return {
        dot: "bg-sky-500",
        pill: "border-sky-200 bg-sky-50 text-sky-700",
        label: "GPS transmitiendo",
      };
    }

    return {
      dot: "bg-slate-400",
      pill: "border-slate-200 bg-slate-50 text-slate-600",
      label: "En espera",
    };
  }, [sharing, sharingMode]);

  const stopSharing = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (guidedRouteTimerRef.current != null) {
      clearTimeout(guidedRouteTimerRef.current);
      guidedRouteTimerRef.current = null;
    }
    guidedRoutePointsRef.current = [];
    guidedRouteIndexRef.current = 0;
    setSharing(false);
    setSending(false);
    setGuidedRouteLoading(false);
    setSharingMode("idle");
    setStatusText("Ubicacion en pausa.");
  };

  const transmitPosition = async ({
    routeId,
    latitude,
    longitude,
    speedKmh,
    source,
  }) => {
    const now = Date.now();
    if (now - lastSentMsRef.current < 4000) {
      return false;
    }

    lastSentMsRef.current = now;
    setSending(true);
    setError("");

    const payload = {
      route: Number(routeId),
      latitude,
      longitude,
      speed_kmh: Number.isFinite(speedKmh)
        ? Number(speedKmh.toFixed(1))
        : undefined,
      timestamp: new Date(now).toISOString(),
      source,
      status: "picked",
    };

    try {
      await sendDriverLocation(payload);
      setLastCoords({
        latitude: payload.latitude,
        longitude: payload.longitude,
        speed_kmh: payload.speed_kmh ?? 0,
      });
      setLastSentAt(payload.timestamp);
      setStatusText(
        source === "guided-route"
          ? "Bus recorriendo la ruta guiada en tiempo real."
          : "Ubicacion enviada al mapa en tiempo real.",
      );
      return true;
    } catch {
      setError(
        "No se pudo enviar la ubicacion. Revisa sesion, backend o conectividad.",
      );
      setStatusText("Error al transmitir la ubicacion.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const postPosition = async (position, routeId) => {
    // Snap GPS to nearest road before transmitting
    const rawLat = position.coords.latitude;
    const rawLng = position.coords.longitude;
    const snapped = await snapPointToRoad([rawLat, rawLng]).catch(() => [
      rawLat,
      rawLng,
    ]);
    return transmitPosition({
      routeId,
      latitude: snapped[0],
      longitude: snapped[1],
      speedKmh:
        Number.isFinite(position.coords.speed) && position.coords.speed !== null
          ? position.coords.speed * 3.6
          : undefined,
      source: "driver-mobile-web",
    });
  };

  const playGuidedRoutePoint = async (routeId) => {
    const point = guidedRoutePointsRef.current[guidedRouteIndexRef.current];
    if (!point) {
      stopSharing();
      setStatusText("Recorrido guiado finalizado.");
      return;
    }

    const sent = await transmitPosition({
      routeId,
      latitude: point[0],
      longitude: point[1],
      speedKmh: GUIDED_ROUTE_SPEED_KMH,
      source: "guided-route",
    });

    if (!sent) {
      guidedRouteTimerRef.current = setTimeout(() => {
        void playGuidedRoutePoint(routeId);
      }, GUIDED_ROUTE_STEP_MS);
      return;
    }

    guidedRouteIndexRef.current += 1;

    if (guidedRouteIndexRef.current >= guidedRoutePointsRef.current.length) {
      stopSharing();
      setStatusText("Recorrido guiado finalizado.");
      return;
    }

    guidedRouteTimerRef.current = setTimeout(() => {
      void playGuidedRoutePoint(routeId);
    }, GUIDED_ROUTE_STEP_MS);
  };

  const startSharing = () => {
    if (!selectedRouteId) {
      setError("Selecciona una ruta antes de iniciar.");
      return;
    }

    if (!navigator.geolocation) {
      setError("Este dispositivo no soporta geolocalizacion en el navegador.");
      return;
    }

    setError("");
    setSharingMode("gps");
    setStatusText("Solicitando permiso de ubicacion...");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setSharing(true);
        void postPosition(position, selectedRouteId);
      },
      (geoError) => {
        setSharing(false);
        setStatusText("No se pudo acceder a la ubicacion.");
        setError(geoError.message || "Permiso denegado o GPS no disponible.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      },
    );
  };

  const startGuidedRoute = async () => {
    if (!selectedRouteId) {
      setError("Selecciona una ruta antes de iniciar.");
      return;
    }

    if (!selectedRoute?.origin || !selectedRoute?.destination) {
      setError("La ruta seleccionada no tiene origen y destino configurados.");
      return;
    }

    stopSharing();
    setError("");
    setGuidedRouteLoading(true);
    setSharing(true);
    setSharingMode("guided");
    setStatusText("Calculando la ruta real para iniciar el recorrido...");

    try {
      const [originCoords, destinationCoords] = await Promise.all([
        geocodeAddress(selectedRoute.origin),
        geocodeAddress(selectedRoute.destination),
      ]);

      const streetRoute =
        originCoords && destinationCoords
          ? await getStreetRoute(originCoords, destinationCoords)
          : null;

      const playbackPoints = sampleGuidedRoute(streetRoute?.coordinates || []);
      if (playbackPoints.length < 2) {
        throw new Error("No se pudo generar el recorrido guiado.");
      }

      guidedRoutePointsRef.current = playbackPoints;
      guidedRouteIndexRef.current = 0;
      lastSentMsRef.current = 0;
      setStatusText(
        "Recorrido guiado listo. Iniciando desde el primer punto de la ruta.",
      );
      await playGuidedRoutePoint(selectedRouteId);
    } catch {
      setSharing(false);
      setSharingMode("idle");
      setError("No se pudo iniciar el recorrido guiado con la ruta real.");
      setStatusText("No fue posible calcular la ruta guiada.");
    } finally {
      setGuidedRouteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              {isAdminPreview ? "Modo prueba" : "Modo conductor"}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              Compartir ubicacion
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Abre esta pantalla desde el celular del conductor y deja la
              transmision activa para alimentar el mapa en vivo.
            </p>
            {isAdminPreview && (
              <p className="mt-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Vista de prueba para administrador
              </p>
            )}
          </div>
          <Link
            to="/dashboard"
            className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
          >
            Volver
          </Link>
        </div>

        <section className="rounded-[28px] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/60 sm:p-7">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/70 to-slate-50 p-5 shadow-sm shadow-blue-100/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700/80">
                    Ruta activa
                  </p>
                  <h2 className="mt-2 text-lg font-black text-slate-900">
                    {selectedRoute?.name || "Selecciona una ruta"}
                  </h2>
                </div>
                <span className="inline-flex rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 shadow-sm">
                  {selectedRoute ? "Lista para salir" : "Pendiente"}
                </span>
              </div>
              <select
                value={selectedRouteId}
                onChange={(event) => setSelectedRouteId(event.target.value)}
                disabled={loadingRoutes || sharing}
                className="mt-4 w-full rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Selecciona una ruta</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Origen
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedRoute?.origin ||
                      "Selecciona una ruta para ver el origen"}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white/90 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Destino
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedRoute?.destination ||
                      "Selecciona una ruta para ver el destino"}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {selectedRoute
                  ? "Puedes transmitir la ubicacion real del conductor o iniciar un recorrido guiado sobre la ruta calculada."
                  : isAdminPreview
                    ? "Selecciona cualquier ruta para probar el envio."
                    : "Selecciona la ruta asignada al conductor."}
              </p>
            </div>

            <div className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-white to-blue-50/80 p-5 shadow-sm shadow-blue-100/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700/80">
                    Estado
                  </p>
                  <div
                    className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${statusBadge.pill}`}
                  >
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${statusBadge.dot}`}
                    />
                    {statusBadge.label}
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white px-3 py-2 text-right shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Modo
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {sharing
                      ? sharingMode === "guided"
                        ? "Guiado"
                        : "GPS"
                      : "Manual"}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-blue-100 bg-white/90 p-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-3 w-3 rounded-full ${statusBadge.dot}`}
                  />
                  <p className="text-sm font-semibold text-slate-800">
                    {sharing
                      ? sharingMode === "guided"
                        ? "Recorriendo ruta guiada"
                        : "Transmitiendo al mapa"
                      : "En espera"}
                  </p>
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Ultimo envio
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  {formatTimestamp(lastSentAt)}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {statusText}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-white/80 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Canal
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {sharingMode === "guided"
                      ? "Ruta inteligente"
                      : "Ubicacion en vivo"}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white/80 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Ruta
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedRoute ? "Configurada" : "Pendiente"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {lastCoords && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm shadow-blue-100/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Latitud
                </p>
                <p className="mt-2 text-lg font-bold text-blue-700">
                  {lastCoords.latitude.toFixed(6)}
                </p>
              </div>
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm shadow-blue-100/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Longitud
                </p>
                <p className="mt-2 text-lg font-bold text-blue-700">
                  {lastCoords.longitude.toFixed(6)}
                </p>
              </div>
              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm shadow-blue-100/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Velocidad
                </p>
                <p className="mt-2 text-lg font-bold text-blue-700">
                  {Math.round(lastCoords.speed_kmh || 0)} km/h
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 rounded-[24px] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-slate-50 p-4 shadow-inner shadow-blue-100/40">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700/80">
                  Acciones
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Controla el envio en vivo o inicia el recorrido guiado con el
                  mismo lenguaje visual de la app.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startSharing}
                disabled={
                  loadingRoutes ||
                  sharing ||
                  guidedRouteLoading ||
                  !selectedRouteId
                }
                className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-blue-200 transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:bg-none disabled:text-slate-500"
              >
                {sending ? "Enviando..." : "Iniciar transmision"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void startGuidedRoute();
                }}
                disabled={
                  loadingRoutes ||
                  sharing ||
                  guidedRouteLoading ||
                  !selectedRouteId
                }
                className="rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {guidedRouteLoading
                  ? "Calculando ruta..."
                  : "Iniciar ruta guiada"}
              </button>
              <button
                type="button"
                onClick={stopSharing}
                disabled={!sharing && !guidedRouteLoading}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Detener
              </button>
              <Link
                to={
                  selectedRouteId
                    ? `/tracking/${selectedRouteId}`
                    : "/dashboard"
                }
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                Ver mapa
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

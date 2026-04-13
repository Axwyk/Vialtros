import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDriverAssignedRoutes } from '../services/dashboard';
import { sendDriverLocation } from '../services/driverLocation';

function formatTimestamp(value) {
  if (!value) return 'Sin envios';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin envios';
  return date.toLocaleString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function DriverLocationPage() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [loadingRoutes, setLoadingRoutes] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Listo para compartir ubicacion.');
  const [lastSentAt, setLastSentAt] = useState('');
  const [lastCoords, setLastCoords] = useState(null);
  const watchIdRef = useRef(null);
  const lastSentMsRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    setLoadingRoutes(true);

    getDriverAssignedRoutes()
      .then((data) => {
        if (!mounted) return;
        setRoutes(data);
        if (data[0]?.id) setSelectedRouteId(String(data[0].id));
      })
      .catch(() => {
        if (!mounted) return;
        setRoutes([]);
        setError('No se pudieron cargar las rutas del conductor.');
      })
      .finally(() => {
        if (mounted) setLoadingRoutes(false);
      });

    return () => {
      mounted = false;
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const selectedRoute = useMemo(
    () => routes.find((route) => String(route.id) === String(selectedRouteId)) || null,
    [routes, selectedRouteId],
  );

  const stopSharing = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    setSending(false);
    setStatusText('Ubicacion en pausa.');
  };

  const postPosition = async (position, routeId) => {
    const now = Date.now();
    if (now - lastSentMsRef.current < 4000) {
      return;
    }

    lastSentMsRef.current = now;
    setSending(true);
    setError('');

    const payload = {
      route: Number(routeId),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      speed_kmh: Number.isFinite(position.coords.speed) && position.coords.speed !== null
        ? Number((position.coords.speed * 3.6).toFixed(1))
        : undefined,
      timestamp: new Date(position.timestamp).toISOString(),
      source: 'driver-mobile-web',
      status: 'picked',
    };

    try {
      await sendDriverLocation(payload);
      setLastCoords({
        latitude: payload.latitude,
        longitude: payload.longitude,
        speed_kmh: payload.speed_kmh ?? 0,
      });
      setLastSentAt(payload.timestamp);
      setStatusText('Ubicacion enviada al mapa en tiempo real.');
    } catch {
      setError('No se pudo enviar la ubicacion. Revisa sesion, backend o conectividad.');
      setStatusText('Error al transmitir la ubicacion.');
    } finally {
      setSending(false);
    }
  };

  const startSharing = () => {
    if (!selectedRouteId) {
      setError('Selecciona una ruta antes de iniciar.');
      return;
    }

    if (!navigator.geolocation) {
      setError('Este dispositivo no soporta geolocalizacion en el navegador.');
      return;
    }

    setError('');
    setStatusText('Solicitando permiso de ubicacion...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setSharing(true);
        void postPosition(position, selectedRouteId);
      },
      (geoError) => {
        setSharing(false);
        setStatusText('No se pudo acceder a la ubicacion.');
        setError(geoError.message || 'Permiso denegado o GPS no disponible.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      },
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Modo conductor</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Compartir ubicacion</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Abre esta pantalla desde el celular del conductor y deja la transmision activa para alimentar el mapa en vivo.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Volver
          </Link>
        </div>

        <section className="rounded-[28px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/70 p-5 shadow-2xl shadow-cyan-950/30 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ruta activa</p>
              <select
                value={selectedRouteId}
                onChange={(event) => setSelectedRouteId(event.target.value)}
                disabled={loadingRoutes || sharing}
                className="mt-3 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              >
                <option value="">Selecciona una ruta</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.name}</option>
                ))}
              </select>
              <p className="mt-3 text-xs text-slate-400">
                {selectedRoute ? `${selectedRoute.origin} -> ${selectedRoute.destination}` : 'Selecciona la ruta asignada al conductor.'}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Estado</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`inline-flex h-3 w-3 rounded-full ${sharing ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <p className="text-sm font-semibold text-slate-100">{sharing ? 'Transmitiendo al mapa' : 'En espera'}</p>
              </div>
              <p className="mt-3 text-xs text-slate-400">Ultimo envio: {formatTimestamp(lastSentAt)}</p>
              <p className="mt-1 text-xs text-slate-400">{statusText}</p>
            </div>
          </div>

          {lastCoords && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Latitud</p>
                <p className="mt-2 text-lg font-bold text-cyan-300">{lastCoords.latitude.toFixed(6)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Longitud</p>
                <p className="mt-2 text-lg font-bold text-cyan-300">{lastCoords.longitude.toFixed(6)}</p>
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Velocidad</p>
                <p className="mt-2 text-lg font-bold text-cyan-300">{Math.round(lastCoords.speed_kmh || 0)} km/h</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSharing}
              disabled={loadingRoutes || sharing || !selectedRouteId}
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {sending ? 'Enviando...' : 'Iniciar transmision'}
            </button>
            <button
              type="button"
              onClick={stopSharing}
              disabled={!sharing}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Detener
            </button>
            <Link
              to={selectedRouteId ? `/tracking/${selectedRouteId}` : '/dashboard'}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
            >
              Ver mapa
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
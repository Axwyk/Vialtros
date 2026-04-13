import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDriverAssignedRoutes } from '../services/dashboard';
import { getRoutes } from '../services/admin';
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

export default function DriverLocationPage({ role }) {
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

  const isAdminPreview = role === 'admin';

  async function loadAvailableRoutes(currentRole) {
    if (currentRole === 'driver') {
      return getDriverAssignedRoutes();
    }

    if (currentRole === 'admin') {
      return getRoutes();
    }

    return [];
  }

  useEffect(() => {
    let mounted = true;
    setLoadingRoutes(true);
    setError('');

    loadAvailableRoutes(role)
      .then((data) => {
        if (!mounted) return;
        setRoutes(data);
        if (data[0]?.id) setSelectedRouteId(String(data[0].id));
        if (!data.length && role === 'driver') {
          setStatusText('Aun no tienes rutas asignadas para compartir ubicacion.');
        }
        if (!data.length && role === 'admin') {
          setStatusText('No hay rutas cargadas para probar el envio de ubicacion.');
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setRoutes([]);
        if (err?.response?.status === 403 && role !== 'driver' && role !== 'admin') {
          setError('Solo un conductor o un administrador pueden usar esta pantalla.');
        } else if (role === 'admin') {
          setError('No se pudieron cargar las rutas disponibles para la prueba de ubicacion.');
        } else {
          setError('No se pudieron cargar las rutas del conductor.');
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
    };
  }, [role]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
              {isAdminPreview ? 'Modo prueba' : 'Modo conductor'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Compartir ubicacion</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Abre esta pantalla desde el celular del conductor y deja la transmision activa para alimentar el mapa en vivo.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ruta activa</p>
              <select
                value={selectedRouteId}
                onChange={(event) => setSelectedRouteId(event.target.value)}
                disabled={loadingRoutes || sharing}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-400"
              >
                <option value="">Selecciona una ruta</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>{route.name}</option>
                ))}
              </select>
              <p className="mt-3 text-xs text-slate-500">
                {selectedRoute ? `${selectedRoute.origin} -> ${selectedRoute.destination}` : (isAdminPreview ? 'Selecciona cualquier ruta para probar el envio.' : 'Selecciona la ruta asignada al conductor.')}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Estado</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`inline-flex h-3 w-3 rounded-full ${sharing ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <p className="text-sm font-semibold text-slate-800">{sharing ? 'Transmitiendo al mapa' : 'En espera'}</p>
              </div>
              <p className="mt-3 text-xs text-slate-500">Ultimo envio: {formatTimestamp(lastSentAt)}</p>
              <p className="mt-1 text-xs text-slate-500">{statusText}</p>
            </div>
          </div>

          {lastCoords && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-blue-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Latitud</p>
                <p className="mt-2 text-lg font-bold text-blue-700">{lastCoords.latitude.toFixed(6)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-blue-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Longitud</p>
                <p className="mt-2 text-lg font-bold text-blue-700">{lastCoords.longitude.toFixed(6)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-blue-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Velocidad</p>
                <p className="mt-2 text-lg font-bold text-blue-700">{Math.round(lastCoords.speed_kmh || 0)} km/h</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSharing}
              disabled={loadingRoutes || sharing || !selectedRouteId}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {sending ? 'Enviando...' : 'Iniciar transmision'}
            </button>
            <button
              type="button"
              onClick={stopSharing}
              disabled={!sharing}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Detener
            </button>
            <Link
              to={selectedRouteId ? `/tracking/${selectedRouteId}` : '/dashboard'}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50"
            >
              Ver mapa
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import {
  getDriverAssignedRoutes,
  getDriverTrackings,
} from "../services/dashboard";
import {
  updateTrackingStatus,
  updateTrackingStatusByPassenger,
} from "../services/tracking";
import { icons } from "../components/dashboard/icons";

export default function DriverRoutesPage({ onLogout }) {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [trackings, setTrackings] = useState([]);
  const [statusError, setStatusError] = useState("");
  const usernameRaw = localStorage.getItem("username") || "Usuario";
  const username =
    usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1).toLowerCase();

  useEffect(() => {
    setRoutesLoading(true);
    getDriverAssignedRoutes()
      .then(setRoutes)
      .catch(() => setRoutes([]))
      .finally(() => setRoutesLoading(false));

    getDriverTrackings()
      .then(setTrackings)
      .catch(() => setTrackings([]));
  }, []);

  const handleUpdateStatus = async (
    trackingId,
    routeId,
    passengerId,
    newStatus,
  ) => {
    setStatusError("");
    try {
      if (trackingId) {
        await updateTrackingStatus(trackingId, newStatus);
      } else {
        await updateTrackingStatusByPassenger(routeId, passengerId, newStatus);
      }
      const updatedTrackings = await getDriverTrackings();
      setTrackings(updatedTrackings);
    } catch {
      setStatusError("No se pudo actualizar el estado. Intenta de nuevo.");
    }
  };

  const totalAssignedStudents = routes.reduce(
    (total, route) =>
      total + (route.passenger_count ?? route.passenger_details?.length ?? 0),
    0,
  );

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role="driver" onLogout={onLogout} />

      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mis rutas asignadas, {username}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gestiona el estado de recogida de tus pasajeros
            </p>
          </div>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-all duration-150"
          >
            {icons.arrowLeft({ size: 14, strokeWidth: 2.5 })}
            Volver al dashboard
          </Link>
        </div>

        {statusError && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {statusError}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Rutas activas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {routes.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Estudiantes totales
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {totalAssignedStudents}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Trackings activos
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {trackings.length}
            </p>
          </div>
        </div>

        {/* Routes */}
        {routesLoading ? (
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
            Cargando rutas...
          </div>
        ) : routes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No tienes rutas asignadas
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cuando un administrador te asigne una ruta, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {routes.map((route) => (
              <article
                key={route.id}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:border-blue-200 transition-colors"
              >
                {/* Cabecera: nombre + badge estado + botones */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      {icons.routes({ size: 18, strokeWidth: 2 })}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-base font-bold text-slate-900">{route.name}</h3>
                        {route.status === "completed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Completada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            Pendiente
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {route.passenger_count ?? route.passenger_details?.length ?? 0} estudiantes asignados
                      </p>
                    </div>
                  </div>
                </div>

                {/* Origen / Destino */}
                <div className="flex flex-col gap-0 rounded-xl border border-slate-100 bg-slate-50/80 mb-4 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-600">Origen</p>
                      <p className="text-sm font-medium text-slate-800 truncate">{route.origin || '—'}</p>
                    </div>
                  </div>
                  <div className="mx-4 h-px bg-slate-200" />
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Destino</p>
                      <p className="text-sm font-medium text-slate-800 truncate">{route.destination || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Botones de acción principales */}
                <div className="flex gap-2 mb-5">
                  <Link
                    to={`/tracking/${route.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    {icons.mapPin({ size: 13, strokeWidth: 2.2 })}
                    Ver en mapa
                  </Link>
                  <button
                    type="button"
                    onClick={() => navigate(`/tracking/${route.id}`)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition-colors"
                  >
                    {icons.navigation({ size: 13, strokeWidth: 2.2 })}
                    Iniciar esta ruta
                  </button>
                </div>

                {/* Pasajeros y estado de recogida */}
                {route.passenger_details?.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Estado de recogida
                        </p>
                        <p className="text-xs text-slate-400">
                          Actualiza el estado de cada estudiante
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {route.passenger_details.map((passenger) => {
                        const tracking = trackings.find(
                          (t) =>
                            Number(t.route) === Number(route.id) &&
                            Number(t.passenger) === Number(passenger.id),
                        );
                        const studentStatus = tracking?.status || "not_picked";
                        const isPicked = studentStatus === "picked";
                        const statusLabel = isPicked ? "Recogido" : "No recogido";
                        const statusDot = isPicked
                          ? "bg-green-100 border-green-300 text-green-600"
                          : "bg-slate-100 border-slate-200 text-slate-400";
                        return (
                          <div
                            key={passenger.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${statusDot}`}
                              >
                                {isPicked ? "✓" : "—"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {passenger.user_detail?.username ||
                                    `Estudiante #${passenger.id}`}
                                </p>
                                <p className="text-xs text-slate-400">{statusLabel}</p>
                              </div>
                            </div>
                            <div className="flex items-center shrink-0">
                              <button
                                title={isPicked ? "Ya recogido" : "Marcar como recogido"}
                                onClick={() => handleUpdateStatus(tracking?.id, route.id, passenger.id, "picked")}
                                disabled={isPicked}
                                className={`flex items-center justify-center w-8 h-8 rounded-full border transition ${
                                  isPicked
                                    ? "border-green-200 bg-green-50 text-green-400 cursor-default"
                                    : "border-slate-200 bg-white text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                                }`}
                              >
                                {icons.arrowRight({ size: 14, strokeWidth: 2 })}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-xs text-slate-400">
                    Esta ruta no tiene estudiantes asignados.
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

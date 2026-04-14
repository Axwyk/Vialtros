import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const [routes, setRoutes] = useState([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [trackings, setTrackings] = useState([]);
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
    try {
      if (trackingId) {
        await updateTrackingStatus(trackingId, newStatus);
      } else {
        await updateTrackingStatusByPassenger(routeId, passengerId, newStatus);
      }
      const updatedTrackings = await getDriverTrackings();
      setTrackings(updatedTrackings);
    } catch (error) {
      console.error("Error updating status:", error);
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
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                        {icons.routes({ size: 17, strokeWidth: 2.1 })}
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Ruta asignada
                        </p>
                        <h3 className="text-lg font-bold text-slate-900">
                          {route.name}
                        </h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Origen
                        </p>
                        <div className="mt-2 flex items-start gap-2 text-slate-700">
                          <span className="mt-0.5 text-blue-600">
                            {icons.mapPin({ size: 15, strokeWidth: 2.2 })}
                          </span>
                          <span className="text-sm font-medium leading-5">
                            {route.origin}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Destino
                        </p>
                        <div className="mt-2 flex items-start gap-2 text-slate-700">
                          <span className="mt-0.5 text-emerald-600">
                            {icons.navigation({ size: 15, strokeWidth: 2.2 })}
                          </span>
                          <span className="text-sm font-medium leading-5">
                            {route.destination}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
                      {route.passenger_count ??
                        route.passenger_details?.length ??
                        0}{" "}
                      estudiante
                      {(route.passenger_count ??
                        route.passenger_details?.length ??
                        0) !== 1
                        ? "s"
                        : ""}
                    </span>
                    <Link
                      to={`/tracking/${route.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      Ver tracking
                    </Link>
                  </div>
                </div>

                {/* Passengers and Status */}
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
                        const status = tracking?.status || "not_picked";
                        return (
                          <div
                            key={passenger.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${
                                  status === "picked"
                                    ? "bg-green-100 border-green-300 text-green-700"
                                    : "bg-red-100 border-red-300 text-red-700"
                                }`}
                              >
                                {status === "picked" ? "✓" : "✗"}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {passenger.user_detail?.username ||
                                    `Estudiante #${passenger.id}`}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {status === "picked"
                                    ? "Recogido"
                                    : "No recogido"}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    tracking?.id,
                                    route.id,
                                    passenger.id,
                                    "picked",
                                  )
                                }
                                disabled={status === "picked"}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                                  status === "picked"
                                    ? "bg-blue-100 text-blue-700 cursor-not-allowed"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                }`}
                              >
                                Marcar recogido
                              </button>
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    tracking?.id,
                                    route.id,
                                    passenger.id,
                                    "not_picked",
                                  )
                                }
                                disabled={status === "not_picked"}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                                  status === "not_picked"
                                    ? "bg-red-100 text-red-700 cursor-not-allowed"
                                    : "bg-red-600 text-white hover:bg-red-700"
                                }`}
                              >
                                Marcar no recogido
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

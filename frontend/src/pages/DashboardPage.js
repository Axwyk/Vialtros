import React, { useEffect, useState } from 'react';
import Sidebar from '../components/dashboard/Sidebar';
import StatCard from '../components/dashboard/StatCard';
import HeroCard from '../components/dashboard/HeroCard';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import { Link } from 'react-router-dom';
import { getDashboardStats, getDriverAssignedRoutes, getDriverTrackings } from '../services/dashboard';
import { updateTrackingStatus, updateTrackingStatusByPassenger } from '../services/tracking';
import { icons } from '../components/dashboard/icons';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getInitials(name) {
  if (!name) return 'ST';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getPassengerStatusConfig(status) {
  const statusMap = {
    picked: {
      label: 'Recogido',
      className: 'bg-blue-600 text-white border border-blue-600',
    },
    not_picked: {
      label: 'Pendiente',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
  };

  return statusMap[status] || {
    label: 'Sin estado',
    className: 'bg-white text-slate-600 border border-blue-100',
  };
}

function buildWeeklyActivityFromTrackings(trackings = []) {
  const base = {
    L: 0,
    M: 0,
    X: 0,
    J: 0,
    V: 0,
    S: 0,
    D: 0,
  };

  const dayMap = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  trackings.forEach((item) => {
    const rawDate = item.timestamp || item.created_at || item.updated_at || item.date;
    if (!rawDate) return;

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    if (date < sevenDaysAgo) return;

    const label = dayMap[date.getDay()];
    if (base[label] !== undefined) {
      base[label] += 1;
    }
  });

  return [
    { day: 'L', value: base.L },
    { day: 'M', value: base.M },
    { day: 'X', value: base.X },
    { day: 'J', value: base.J },
    { day: 'V', value: base.V },
    { day: 'S', value: base.S },
    { day: 'D', value: base.D },
  ];
}

export default function DashboardPage({ role, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverRoutes, setDriverRoutes] = useState([]);
  const [driverRoutesLoading, setDriverRoutesLoading] = useState(false);
  const [driverTrackings, setDriverTrackings] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState([
    { day: 'L', value: 0 },
    { day: 'M', value: 0 },
    { day: 'X', value: 0 },
    { day: 'J', value: 0 },
    { day: 'V', value: 0 },
    { day: 'S', value: 0 },
    { day: 'D', value: 0 },
  ]);

  const usernameRaw = localStorage.getItem('username') || 'Usuario';
  const username = usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1).toLowerCase();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (role !== 'driver') return;

    setDriverRoutesLoading(true);
    getDriverAssignedRoutes()
      .then(setDriverRoutes)
      .catch(() => setDriverRoutes([]))
      .finally(() => setDriverRoutesLoading(false));
  }, [role]);

  useEffect(() => {
    if (role !== 'driver') {
      setDriverTrackings([]);
      setWeeklyActivity(buildWeeklyActivityFromTrackings([]));
      return;
    }

    getDriverTrackings()
      .then((trackings) => {
        setDriverTrackings(trackings);
        setWeeklyActivity(buildWeeklyActivityFromTrackings(trackings));
      })
      .catch(() => {
        setDriverTrackings([]);
        setWeeklyActivity(buildWeeklyActivityFromTrackings([]));
      });
  }, [role]);

  const handleUpdateStatus = async (trackingId, routeId, passengerId, newStatus) => {
    try {
      if (trackingId) {
        await updateTrackingStatus(trackingId, newStatus);
      } else {
        await updateTrackingStatusByPassenger(routeId, passengerId, newStatus);
      }

      const updatedTrackings = await getDriverTrackings();
      setDriverTrackings(updatedTrackings);
      setWeeklyActivity(buildWeeklyActivityFromTrackings(updatedTrackings));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const totalAssignedStudents = driverRoutes.reduce(
    (total, route) => total + (route.passenger_count ?? route.passenger_details?.length ?? 0),
    0,
  );

  let roleLabel = 'Usuario';

  if (role === 'driver') {
    roleLabel = 'Conductor';
  } else if (role === 'admin') {
    roleLabel = 'Administrador';
  } else if (role === 'user') {
    roleLabel = 'Usuario';
  }

  const maxWeeklyValue = Math.max(...weeklyActivity.map((item) => item.value), 1);

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />

      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1 capitalize">
              {formatDate()}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              {getGreeting()}, <span className="text-blue-600">{username}</span>
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Aquí está el resumen de hoy en Vialtros</p>
          </div>

          {role === 'admin' && (
            <div className="flex gap-2 flex-shrink-0">
              <Link
                to="/admin/users"
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all duration-150"
              >
                {icons.addUser({ size: 15, strokeWidth: 2 })}
                Nuevo usuario
              </Link>
              <Link
                to="/admin/routes"
                className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-gray-50 active:scale-95 transition-all duration-150"
              >
                {icons.routes({ size: 15, strokeWidth: 2 })}
                Nueva ruta
              </Link>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={icons.routes}
            value={loading ? '—' : (stats?.routes ?? 0)}
            label="Rutas activas"
            color="blue"
            trend="up"
            trendLabel="+2 hoy"
          />
          <StatCard
            icon={icons.users}
            value={loading ? '—' : (stats?.users ?? 0)}
            label="Usuarios registrados"
            color="green"
          />
          <StatCard
            icon={icons.tracking}
            value={loading ? '—' : (stats?.trackings ?? 0)}
            label="Tracking activos"
            color="purple"
            trend="up"
            trendLabel="En vivo"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-5 mb-6">
          <div className="flex flex-col gap-5">
            <HeroCard role={role} />

            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Rutas por día</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Últimos 7 días</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Datos reales
                </span>
              </div>

              <div className="flex items-end justify-center gap-4 h-44 mt-6">
                {weeklyActivity.map((item) => {
                  const height = `${(item.value / maxWeeklyValue) * 100}%`;

                  return (
                    <div key={item.day} className="flex flex-col items-center gap-2">
                      <span className="text-xs text-slate-400 font-semibold">{item.value}</span>
                      <div className="relative h-28 w-8 rounded-xl bg-slate-100 overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-xl bg-blue-500 transition-all duration-500"
                          style={{ height }}
                        />
                      </div>
                      <span className="text-sm text-slate-500 font-medium">{item.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <ActivityFeed />
          </div>
        </div>

        {role === 'driver' && (
          <section className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 md:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between mb-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  Operación del {roleLabel.toLowerCase()}
                </span>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-900">Tus rutas y estudiantes</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  Consulta las rutas que tienes asignadas y los alumnos registrados en cada una con una vista más clara para operar durante la jornada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-auto sm:min-w-[320px]">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Rutas activas</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{driverRoutes.length}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Estudiantes</p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">{totalAssignedStudents}</p>
                </div>
              </div>
            </div>

            {driverRoutesLoading ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
                Cargando rutas del conductor...
              </div>
            ) : driverRoutes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">Todavía no tienes rutas asignadas</p>
                <p className="mt-1 text-xs text-slate-400">
                  Cuando un administrador te asigne una ruta, aparecerá aquí con su lista de estudiantes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                {driverRoutes.map((route) => (
                  <article key={route.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                            {icons.routes({ size: 17, strokeWidth: 2.1 })}
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Ruta asignada</p>
                            <h4 className="text-base font-bold text-slate-900">{route.name}</h4>
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full bg-gray-50 border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
                        {route.passenger_count ?? route.passenger_details?.length ?? 0} estudiante
                        {(route.passenger_count ?? route.passenger_details?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Origen</p>
                        <div className="mt-2 flex items-start gap-2 text-slate-700">
                          <span className="mt-0.5 text-blue-600">{icons.mapPin({ size: 15, strokeWidth: 2.2 })}</span>
                          <span className="text-sm font-medium leading-5">{route.origin}</span>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Destino</p>
                        <div className="mt-2 flex items-start gap-2 text-slate-700">
                          <span className="mt-0.5 text-emerald-600">{icons.navigation({ size: 15, strokeWidth: 2.2 })}</span>
                          <span className="text-sm font-medium leading-5">{route.destination}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      <Link
                        to={`/tracking/${route.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-sm transition hover:bg-blue-700"
                      >
                        Ver mapa
                      </Link>
                      <Link
                        to="/driver/location"
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 shadow-sm transition hover:bg-cyan-100"
                      >
                        Compartir ubicacion
                      </Link>
                    </div>

                    {route.passenger_details?.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Estudiantes asignados</p>
                            <p className="text-xs text-slate-400">Lista actual del recorrido</p>
                          </div>
                        </div>

                        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                          {route.passenger_details.map((passenger) => (
                            <div
                              key={passenger.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 transition hover:bg-gray-50"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-blue-700 shadow-sm">
                                  {getInitials(passenger.user_detail?.username)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">
                                    {passenger.user_detail?.username || `Estudiante #${passenger.id}`}
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {passenger.user_detail?.email || 'Sin correo registrado'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right ml-2 shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Contacto</p>
                                <p className="text-xs font-mono text-slate-500">{passenger.phone || 'Sin teléfono'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-xs text-slate-400">
                        Esta ruta no tiene estudiantes asignados.
                      </div>
                    )}

                    {(() => {
                      const routeTrackings = driverTrackings.filter((t) => Number(t.route) === Number(route.id));
                      if (!route.passenger_details || route.passenger_details.length === 0) return null;

                      return (
                        <div className="mt-5">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Estado de recogida</p>
                              <p className="text-xs text-slate-400">Actualiza el estado de cada estudiante</p>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {route.passenger_details.map((passenger) => {
                              const tracking = routeTrackings.find((t) => Number(t.passenger) === Number(passenger.id));
                              const status = tracking?.status || 'not_picked';
                              const statusConfig = getPassengerStatusConfig(status);

                              return (
                                <div
                                  key={passenger.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${
                                        status === 'picked'
                                          ? 'bg-blue-600 border-blue-700 text-white'
                                          : 'bg-blue-50 border-blue-200 text-blue-700'
                                      }`}
                                    >
                                      {status === 'picked' ? '✓' : '✗'}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-800 truncate">
                                        {passenger.user_detail?.username || `Estudiante #${passenger.id}`}
                                      </p>
                                      <div className="mt-1 flex items-center gap-2">
                                        <span
                                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusConfig.className}`}
                                        >
                                          {statusConfig.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 shrink-0">
                                    <button
                                      onClick={() => handleUpdateStatus(tracking?.id, route.id, passenger.id, 'picked')}
                                      disabled={status === 'picked'}
                                      className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                                        status === 'picked'
                                          ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                                          : 'bg-blue-600 text-white hover:bg-blue-700'
                                      }`}
                                    >
                                      Marcar recogido
                                    </button>
                                    <button
                                      onClick={() => handleUpdateStatus(tracking?.id, route.id, passenger.id, 'not_picked')}
                                      disabled={status === 'not_picked'}
                                      className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                                        status === 'not_picked'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-not-allowed'
                                          : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
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
                      );
                    })()}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {role === 'user' && (
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Tu ruta asignada</h3>
              <p className="text-xs text-gray-400">Consulta tu conductor y el recorrido en tiempo real</p>
            </div>
            <Link
              to="/user/route"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-all duration-150 whitespace-nowrap"
            >
              Ver mi ruta
              {icons.arrowRight({ size: 14, strokeWidth: 2.5 })}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import StatCard from "../components/dashboard/StatCard";
import HeroCard from "../components/dashboard/HeroCard";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import { Link } from "react-router-dom";
import {
  getDashboardStats,
  getDriverAssignedRoutes,
  getDriverTrackings,
  getRecentActivity,
  getWeeklyActivity,
} from "../services/dashboard";
import {
  updateTrackingStatus,
  updateTrackingStatusByPassenger,
} from "../services/tracking";
import { icons } from "../components/dashboard/icons";

const EMPTY_WEEKLY_ACTIVITY = [
  { day: "L", value: 0 },
  { day: "M", value: 0 },
  { day: "X", value: 0 },
  { day: "J", value: 0 },
  { day: "V", value: 0 },
  { day: "S", value: 0 },
  { day: "D", value: 0 },
];

const ROLE_LABELS = {
  admin: "Administrador",
  driver: "Conductor",
  user: "Usuario",
};

const ROLE_BADGE_CONFIG = {
  admin: {
    label: "Centro administrativo",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  driver: {
    label: "Operación en ruta",
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
  },
  user: {
    label: "Seguimiento personal",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

const ROLE_QUICK_ACTIONS = {
  admin: [
    {
      to: "/admin/users",
      label: "Gestionar usuarios",
      icon: icons.users,
      style: "primary",
    },
    {
      to: "/admin/routes",
      label: "Ver rutas y estado",
      icon: icons.routes,
      style: "secondary",
    },
  ],
  driver: [
    {
      to: "/driver/routes",
      label: "Revisar mis rutas",
      icon: icons.routes,
      style: "primary",
    },
    {
      to: "/driver/location",
      label: "Compartir ubicación",
      icon: icons.navigation,
      style: "secondary",
    },
  ],
  user: [
    {
      to: "/user/route",
      label: "Ver mi ruta",
      icon: icons.routes,
      style: "primary",
    },
    {
      to: "/profile",
      label: "Actualizar perfil",
      icon: icons.profile,
      style: "secondary",
    },
  ],
};

const ROLE_SUMMARY_CONFIG = {
  admin: {
    title: "Centro de control administrativo",
    body: "Gestiona usuarios, conductores, estudiantes y rutas desde un único punto de control con visibilidad inmediata.",
    highlights: ["Rutas activas", "Vehículos", "Estado de rutas"],
  },
  driver: {
    title: "Operación diaria del conductor",
    body: "Consulta asignaciones, revisa el estado de recogida y comparte tu ubicación sin perder tiempo en bloques vacíos.",
    highlights: ["Rutas activas", "Estados de recogida", "Ubicación en vivo"],
  },
  user: {
    title: "Seguimiento de tu recorrido",
    body: "Revisa tu ruta asignada y sigue el recorrido en tiempo real con una vista más clara, directa y útil.",
    highlights: ["Ruta asignada", "Tracking en vivo", "Perfil actualizado"],
  },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

function formatDate() {
  return new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name) {
  if (!name) return "ST";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getPassengerStatusConfig(status) {
  const statusMap = {
    picked: {
      label: "Recogido",
      className: "bg-blue-600 text-white border border-blue-600",
    },
    not_picked: {
      label: "Pendiente",
      className: "bg-blue-50 text-blue-700 border border-blue-200",
    },
  };

  return (
    statusMap[status] || {
      label: "Sin estado",
      className: "bg-white text-slate-600 border border-blue-100",
    }
  );
}

function getRoleBadgeConfig(role) {
  return (
    ROLE_BADGE_CONFIG[role] || {
      label: "Seguimiento personal",
      className: "border-slate-200 bg-slate-100 text-slate-700",
    }
  );
}

function buildDashboardContent({
  role,
  loading,
  stats,
  driverRoutesCount,
  totalAssignedStudents,
  roleLabel,
}) {
  const quickActions = ROLE_QUICK_ACTIONS[role] || [];
  const summaryConfig = ROLE_SUMMARY_CONFIG[role] || {
    title: "Resumen operativo",
    body: "Consulta la información principal del día desde una vista más clara.",
    highlights: ["Panel activo"],
  };

  if (role === "admin") {
    return {
      quickActions,
      summaryConfig,
      headlineStats: [
        {
          label: "Rutas activas",
          value: loading ? "—" : (stats?.routes ?? 0),
          accent: "text-blue-700",
        },
        {
          label: "Vehículos",
          value: loading ? "—" : (stats?.vehicles ?? 0),
          accent: "text-cyan-700",
        },
        {
          label: "Tracking activos",
          value: loading ? "—" : (stats?.trackings ?? 0),
          accent: "text-emerald-700",
        },
      ],
      metricCards: [
        {
          icon: icons.routes,
          value: loading ? "—" : (stats?.routes ?? 0),
          label: "Rutas activas",
          color: "blue",
          trend: "up",
          trendLabel: "Operativas",
        },
        {
          icon: icons.drivers,
          value: loading ? "—" : (stats?.vehicles ?? 0),
          label: "Vehículos",
          color: "green",
          trendLabel: "Disponibles",
        },
        {
          icon: icons.tracking,
          value: loading ? "—" : (stats?.trackings ?? 0),
          label: "Tracking activos",
          color: "purple",
          trend: "up",
          trendLabel: "En vivo",
        },
      ],
    };
  }

  return {
    quickActions,
    summaryConfig,
    headlineStats: [
      {
        label: "Rol activo",
        value: roleLabel,
        accent: "text-slate-900",
      },
      {
        label: role === "driver" ? "Rutas asignadas" : "Rutas activas",
        value:
          role === "driver"
            ? driverRoutesCount
            : loading
              ? "—"
              : (stats?.routes ?? 0),
        accent: "text-blue-700",
      },
      {
        label: role === "driver" ? "Estudiantes a bordo" : "Tracking activos",
        value:
          role === "driver"
            ? totalAssignedStudents
            : loading
              ? "—"
              : (stats?.trackings ?? 0),
        accent: role === "driver" ? "text-cyan-700" : "text-emerald-700",
      },
    ],
    metricCards: [
      {
        icon: icons.routes,
        value:
          role === "driver"
            ? driverRoutesCount
            : loading
              ? "—"
              : (stats?.routes ?? 0),
        label: role === "driver" ? "Rutas asignadas" : "Rutas activas",
        color: "blue",
        trend: "up",
        trendLabel: role === "driver" ? "Tu jornada" : "+2 hoy",
      },
      {
        icon: role === "driver" ? icons.clipboard : icons.users,
        value:
          role === "driver"
            ? totalAssignedStudents
            : loading
              ? "—"
              : (stats?.users ?? 0),
        label:
          role === "driver" ? "Estudiantes asignados" : "Usuarios registrados",
        color: "green",
        trendLabel: role === "driver" ? "Lista actual" : undefined,
      },
      {
        icon: icons.tracking,
        value: role === "user" ? "1" : loading ? "—" : (stats?.trackings ?? 0),
        label: role === "user" ? "Ruta vinculada" : "Tracking activos",
        color: "purple",
        trend: "up",
        trendLabel: role === "user" ? "Asignada" : "En vivo",
      },
    ],
  };
}

export default function DashboardPage({ role, onLogout }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverRoutes, setDriverRoutes] = useState([]);
  const [driverRoutesLoading, setDriverRoutesLoading] = useState(false);
  const [driverTrackings, setDriverTrackings] = useState([]);
  const [weeklyActivity, setWeeklyActivity] = useState(EMPTY_WEEKLY_ACTIVITY);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);

  const usernameRaw = localStorage.getItem("username") || "Usuario";
  const username =
    usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1).toLowerCase();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshWeeklyActivity = useCallback(async () => {
    try {
      const activity = await getWeeklyActivity();
      setWeeklyActivity(
        Array.isArray(activity) && activity.length > 0
          ? activity
          : EMPTY_WEEKLY_ACTIVITY,
      );
      return activity;
    } catch {
      setWeeklyActivity(EMPTY_WEEKLY_ACTIVITY);
      return [];
    }
  }, []);

  const refreshRecentActivity = useCallback(async () => {
    setRecentActivityLoading(true);
    try {
      const activity = await getRecentActivity();
      setRecentActivity(Array.isArray(activity) ? activity : []);
      return activity;
    } catch {
      setRecentActivity([]);
      return [];
    } finally {
      setRecentActivityLoading(false);
    }
  }, []);

  const refreshDriverTrackingData = useCallback(async () => {
    try {
      const trackings = await getDriverTrackings();
      setDriverTrackings(trackings);
      return trackings;
    } catch {
      setDriverTrackings([]);
      return [];
    }
  }, []);

  useEffect(() => {
    void refreshWeeklyActivity();
  }, [refreshWeeklyActivity, role]);

  useEffect(() => {
    void refreshRecentActivity();
  }, [refreshRecentActivity, role]);

  useEffect(() => {
    if (role !== "driver") return;

    setDriverRoutesLoading(true);
    getDriverAssignedRoutes()
      .then(setDriverRoutes)
      .catch(() => setDriverRoutes([]))
      .finally(() => setDriverRoutesLoading(false));
  }, [role]);

  useEffect(() => {
    if (role !== "driver") {
      setDriverTrackings([]);
      return;
    }

    void refreshDriverTrackingData();
  }, [role, refreshDriverTrackingData]);

  const handleUpdateStatus = useCallback(
    async (trackingId, routeId, passengerId, newStatus) => {
      try {
        if (trackingId) {
          await updateTrackingStatus(trackingId, newStatus);
        } else {
          await updateTrackingStatusByPassenger(
            routeId,
            passengerId,
            newStatus,
          );
        }

        await Promise.all([
          refreshDriverTrackingData(),
          refreshRecentActivity(),
          refreshWeeklyActivity(),
        ]);
      } catch (error) {
        console.error("Error updating status:", error);
      }
    },
    [refreshDriverTrackingData, refreshRecentActivity, refreshWeeklyActivity],
  );

  const totalAssignedStudents = driverRoutes.reduce(
    (total, route) =>
      total + (route.passenger_count ?? route.passenger_details?.length ?? 0),
    0,
  );

  const roleLabel = ROLE_LABELS[role] || "Usuario";

  const maxWeeklyValue = Math.max(
    ...weeklyActivity.map((item) => item.value),
    1,
  );
  const roleBadge = getRoleBadgeConfig(role);
  const { quickActions, headlineStats, metricCards, summaryConfig } = useMemo(
    () =>
      buildDashboardContent({
        role,
        loading,
        stats,
        driverRoutesCount: driverRoutes.length,
        totalAssignedStudents,
        roleLabel,
      }),
    [
      role,
      loading,
      stats,
      driverRoutes.length,
      totalAssignedStudents,
      roleLabel,
    ],
  );

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans">
      <Sidebar role={role} onLogout={onLogout} />

      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">
        <section className="mb-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${roleBadge.className}`}
                  >
                    {roleBadge.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 capitalize">
                    {formatDate()}
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-[2rem]">
                  {getGreeting()},{" "}
                  <span className="text-blue-700">{username}</span>
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Supervisa la operación diaria de Vialtros desde un panel más
                  limpio, compacto y enfocado en lo que necesitas resolver hoy.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-3 xl:max-w-xl">
                {headlineStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3.5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </p>
                    <p
                      className={`mt-2 text-xl font-bold tracking-tight ${item.accent}`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 px-5 py-4.5">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Plataforma operativa
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
                    {icons.trendUp({ size: 14, strokeWidth: 2.2 })}
                    Actualización centralizada del día
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_210px]">
                  <div className="rounded-2xl border border-white/70 bg-white/75 px-4 py-4 shadow-sm backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Resumen operativo
                    </p>
                    <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-900">
                      {summaryConfig.title}
                    </h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                      {summaryConfig.body}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {summaryConfig.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Estado del panel
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                      En línea
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Información lista para operar.
                    </p>
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                      Sincronización estable
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {quickActions.map((action) => {
                  const isPrimary = action.style === "primary";
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.to}
                      to={action.to}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-4 shadow-sm transition ${
                        isPrimary
                          ? "border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${isPrimary ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          <Icon size={18} strokeWidth={2.1} />
                        </span>
                        <span>
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                            Acción rápida
                          </span>
                          <span className="block text-sm font-semibold">
                            {action.label}
                          </span>
                        </span>
                      </span>
                      {icons.arrowRight({
                        size: 15,
                        strokeWidth: 2.4,
                        className: isPrimary ? "text-white" : "text-slate-400",
                      })}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Indicadores clave
              </h2>
              <p className="text-sm text-slate-500">
                Métricas principales del día con lectura rápida.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {metricCards.map((card) => (
              <StatCard
                key={card.label}
                icon={card.icon}
                value={card.value}
                label={card.label}
                color={card.color}
                trend={card.trend}
                trendLabel={card.trendLabel}
              />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 mb-6">
          <div className="flex flex-col gap-5">
            <HeroCard role={role} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Actividad semanal
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Últimos 7 días de seguimiento registrado
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Datos reales
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                <div className="flex items-end justify-center gap-4 h-44 mt-2">
                  {weeklyActivity.map((item) => {
                    const height = `${(item.value / maxWeeklyValue) * 100}%`;

                    return (
                      <div
                        key={item.day}
                        className="flex flex-col items-center gap-2"
                      >
                        <span className="text-xs text-slate-400 font-semibold">
                          {item.value}
                        </span>
                        <div className="relative h-28 w-8 rounded-xl bg-slate-100 overflow-hidden">
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-xl bg-blue-500 transition-all duration-500"
                            style={{ height }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 font-medium">
                          {item.day}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Lectura rápida
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {weeklyActivity.reduce(
                      (total, item) => total + item.value,
                      0,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    movimientos registrados durante la última semana
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-slate-200">
                      <span>Pico diario</span>
                      <span className="font-semibold text-slate-900">
                        {maxWeeklyValue}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 border border-slate-200">
                      <span>Estado</span>
                      <span className="font-semibold text-emerald-700">
                        Monitoreo activo
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <ActivityFeed
              activities={recentActivity}
              loading={recentActivityLoading}
              role={role}
            />
          </div>
        </div>

        {role === "driver" && (
          <section className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 md:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between mb-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">
                  Operación del {roleLabel.toLowerCase()}
                </span>
                <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                  Tus rutas y estudiantes
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                  Consulta las rutas que tienes asignadas y los alumnos
                  registrados en cada una con una vista más clara para operar
                  durante la jornada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:w-auto sm:min-w-[320px]">
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Rutas activas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {driverRoutes.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                    Estudiantes
                  </p>
                  <p className="mt-2 text-2xl font-bold text-blue-700">
                    {totalAssignedStudents}
                  </p>
                </div>
              </div>
            </div>

            {driverRoutesLoading ? (
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
                Cargando rutas del conductor...
              </div>
            ) : driverRoutes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Todavía no tienes rutas asignadas
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Cuando un administrador te asigne una ruta, aparecerá aquí con
                  su lista de estudiantes.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
                {driverRoutes.map((route) => (
                  <article
                    key={route.id}
                    className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
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
                            <h4 className="text-base font-bold text-slate-900">
                              {route.name}
                            </h4>
                          </div>
                        </div>
                      </div>
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
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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
                            <p className="text-sm font-semibold text-slate-900">
                              Estudiantes asignados
                            </p>
                            <p className="text-xs text-slate-400">
                              Lista actual del recorrido
                            </p>
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
                                    {passenger.user_detail?.username ||
                                      `Estudiante #${passenger.id}`}
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {passenger.user_detail?.email ||
                                      "Sin correo registrado"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right ml-2 shrink-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                                  Contacto
                                </p>
                                <p className="text-xs font-mono text-slate-500">
                                  {passenger.phone || "Sin teléfono"}
                                </p>
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
                      const routeTrackings = driverTrackings.filter(
                        (t) => Number(t.route) === Number(route.id),
                      );
                      if (
                        !route.passenger_details ||
                        route.passenger_details.length === 0
                      )
                        return null;

                      return (
                        <div className="mt-5">
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
                              const tracking = routeTrackings.find(
                                (t) =>
                                  Number(t.passenger) === Number(passenger.id),
                              );
                              const status = tracking?.status || "not_picked";
                              const statusConfig =
                                getPassengerStatusConfig(status);

                              return (
                                <div
                                  key={passenger.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${
                                        status === "picked"
                                          ? "bg-blue-600 border-blue-700 text-white"
                                          : "bg-blue-50 border-blue-200 text-blue-700"
                                      }`}
                                    >
                                      {status === "picked" ? "✓" : "✗"}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-800 truncate">
                                        {passenger.user_detail?.username ||
                                          `Estudiante #${passenger.id}`}
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
                                          ? "bg-blue-50 text-blue-700 border border-blue-200 cursor-not-allowed"
                                          : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"
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

        {role === "user" && (
          <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
                Tu ruta asignada
              </h3>
              <p className="text-xs text-gray-400">
                Consulta tu conductor y el recorrido en tiempo real
              </p>
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

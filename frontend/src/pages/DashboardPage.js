import React, { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import StatCard from "../components/dashboard/StatCard";
import HeroCard from "../components/dashboard/HeroCard";
import ActivityFeed from "../components/dashboard/ActivityFeed";
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

// Funciones eliminadas: formatDate, getInitials, getPassengerStatusConfig no se utilizan actualmente


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


  useEffect(() => {
    void refreshWeeklyActivity();
  }, [refreshWeeklyActivity, role]);

  useEffect(() => {
    void refreshRecentActivity();
  }, [refreshRecentActivity, role]);

  useEffect(() => {
    if (role !== "driver") return;

    getDriverAssignedRoutes()
      .then(setDriverRoutes)
      .catch(() => setDriverRoutes([]))
      .finally(() => {}); // Removed driverRoutesLoading
  }, [role]);



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
          refreshRecentActivity(),
          refreshWeeklyActivity(),
        ]);
      } catch (error) {
        console.error("Error updating status:", error);
      }
    },
    [refreshRecentActivity, refreshWeeklyActivity],
  );
  // handleUpdateStatus se comenta ya que no se utiliza en el componente
  void handleUpdateStatus;

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
  // roleBadge se comenta ya que no se utiliza en el componente
  void roleBadge;
  
  const { metricCards } = useMemo(
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
      <section className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {getGreeting()}, <span className="text-blue-700">{username}</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500">Panel de control</p>
      </section>

      <section className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {metricCards.map((card) => (
            <StatCard
              key={card.label}
              icon={card.icon}
              value={card.value}
              label={card.label}
              color="blue"
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

              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                Datos reales
              </span>
            </div>

            <div className="flex items-end justify-center gap-4 h-44 mt-2">
              {weeklyActivity.map((item) => {
                const height = `${(item.value / maxWeeklyValue) * 100}%`;

                return (
                  <div key={item.day} className="flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold">
                      {item.value}
                    </span>
                    <div className="relative h-28 w-8 rounded-xl bg-blue-50 overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-xl bg-blue-600 transition-all duration-500"
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
          </div>
        </div>

        <ActivityFeed
          activities={recentActivity}
          loading={recentActivityLoading}
          role={role}
        />
      </div>
    </main>
  </div>
);
}
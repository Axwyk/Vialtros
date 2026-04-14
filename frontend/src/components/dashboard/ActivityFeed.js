import React from "react";
import { icons } from "./icons";

const colorMap = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-500" },
  red: { bg: "bg-red-50", text: "text-red-500" },
};

function formatRelativeTime(value) {
  if (!value) return "Sin hora";

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Sin hora";

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;

  return timestamp.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
  });
}

function getEmptyMessage(role) {
  if (role === "admin")
    return "Aun no hay actividad reciente del sistema para mostrar.";
  if (role === "driver")
    return "Aun no hay novedades recientes en tus rutas asignadas.";
  return "Aun no hay novedades recientes en tu ruta asignada.";
}

export default function ActivityFeed({
  activities = [],
  loading = false,
  role = "user",
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/70">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">
            Actividad reciente
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Movimientos destacados de la jornada
          </p>
        </div>
        <span className="text-xs text-slate-400 font-medium">Hoy</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-400">
            Cargando actividad reciente...
          </div>
        ) : activities.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">
            {getEmptyMessage(role)}
          </div>
        ) : (
          activities.map((activity) => {
            const c = colorMap[activity.tone] || colorMap.blue;
            const Icon = icons[activity.icon] || icons.activity;
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors duration-100"
              >
                <div
                  className={`${c.bg} rounded-xl p-2 flex-shrink-0 mt-0.5 border border-white shadow-sm`}
                >
                  <Icon size={14} strokeWidth={2} className={c.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-tight truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {activity.subtitle}
                  </p>
                </div>
                <span className="text-xs text-slate-300 whitespace-nowrap flex-shrink-0 mt-0.5">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0 bg-white">
        <button className="inline-flex items-center gap-2 text-xs text-blue-600 font-semibold hover:text-blue-700 transition-colors">
          Ver todo el historial
          {icons.arrowRight({ size: 13, strokeWidth: 2.4 })}
        </button>
      </div>
    </div>
  );
}

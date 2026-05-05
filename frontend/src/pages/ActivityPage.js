import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentActivity } from "../services/dashboard";


function getIcon(type = "") {
  const text = type.toLowerCase();

  if (text.includes("usuario")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c2-4 14-4 16 0" />
      </svg>
    );
  }

  if (text.includes("ruta")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17l6-6 4 4 8-8" />
      </svg>
    );
  }

  if (text.includes("tracking")) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
        <circle cx="12" cy="9" r="2" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function getActivityStyle(title = "") {
  const text = title.toLowerCase();

  if (text.includes("usuario")) {
    return "bg-blue-100 text-blue-700";
  }

  if (text.includes("ruta")) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (text.includes("tracking")) {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    getRecentActivity()
      .then(() =>
  setActivities([
    { title: "Usuario creado", time: "Hace 2 min" },
    { title: "Ruta actualizada", time: "Hace 5 min" },
    { title: "Tracking iniciado", time: "Hace 10 min" }
  ])
)
      .catch(() => setActivities([]));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Vista administrativa
            </span>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Historial de actividad
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Consulta los movimientos recientes registrados en la plataforma.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ← Volver al dashboard
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Movimientos recientes
            </h2>
            <p className="text-xs text-slate-400">
              Información actualizada desde el panel administrativo.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {activities.length === 0 ? (
              <p className="px-6 py-6 text-sm text-slate-400">
                No hay actividad registrada.
              </p>
            ) : (
              [...activities]
  .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  .map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 px-6 py-5 hover:bg-slate-50 transition-all duration-200"
                >
                  <div className="flex gap-4">
  <div
  className={`flex h-10 w-10 items-center justify-center rounded-full ${getActivityStyle(
    item.title || item.action || ""
  )}`}
>
  {getIcon(item.title || item.action || "")}
</div>

  <div>
    <h3 className="text-base font-semibold text-slate-900">
      {item.title || item.action || "Actividad registrada"}
    </h3>
    <p className="mt-1 text-sm text-slate-500">
      {item.description ||
        item.detail ||
        "Movimiento del sistema"}
    </p>
  </div>
</div>

                  <span className="whitespace-nowrap text-xs font-medium text-slate-400">
                    {item.created_at
  ? new Date(item.created_at).toLocaleString()
  : item.time || "Reciente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
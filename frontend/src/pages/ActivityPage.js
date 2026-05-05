import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRecentActivity } from "../services/dashboard";

export default function ActivityPage() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    getRecentActivity()
      .then((data) => setActivities(Array.isArray(data) ? data : []))
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

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
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
              activities.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 px-6 py-5 hover:bg-slate-50"
                >
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      ✓
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
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
                    {item.time || item.created_at || "Reciente"}
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
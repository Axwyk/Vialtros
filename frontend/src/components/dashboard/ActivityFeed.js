import React from "react";
import { icons } from "./icons";

const ACTIVITIES = [
  {
    id: 1,
    icon: "checkCircle",
    text: "Ruta #12 iniciada",
    sub: "Conductor: Carlos M.",
    time: "Hace 5 min",
    color: "emerald",
  },
  {
    id: 2,
    icon: "addUser",
    text: "Nuevo usuario registrado",
    sub: "Maria González",
    time: "Hace 23 min",
    color: "blue",
  },
  {
    id: 3,
    icon: "checkCircle",
    text: "Ruta #8 completada",
    sub: "14 pasajeros entregados",
    time: "Hace 1h",
    color: "emerald",
  },
  {
    id: 4,
    icon: "alertTriangle",
    text: "Retraso en Ruta #5",
    sub: "Estimado: 8 min adicionales",
    time: "Hace 2h",
    color: "orange",
  },
  {
    id: 5,
    icon: "addUser",
    text: "Conductor asignado",
    sub: "Jorge R. → Ruta #3",
    time: "Hace 3h",
    color: "blue",
  },
  {
    id: 6,
    icon: "checkCircle",
    text: "Ruta #2 completada",
    sub: "10 pasajeros entregados",
    time: "Ayer",
    color: "emerald",
  },
];

const colorMap = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  blue:    { bg: "bg-blue-50",    text: "text-blue-600" },
  orange:  { bg: "bg-orange-50",  text: "text-orange-500" },
  red:     { bg: "bg-red-50",     text: "text-red-500" },
};

export default function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-gray-900 text-sm">Actividad reciente</h3>
        <span className="text-xs text-gray-400 font-medium">Hoy</span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {ACTIVITIES.map((a) => {
          const c = colorMap[a.color] || colorMap.blue;
          const Icon = icons[a.icon] || icons.activity;
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors duration-100"
            >
              <div className={`${c.bg} rounded-lg p-2 flex-shrink-0 mt-0.5`}>
                <Icon size={14} strokeWidth={2} className={c.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 leading-tight truncate">
                  {a.text}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{a.sub}</p>
              </div>
              <span className="text-xs text-gray-300 whitespace-nowrap flex-shrink-0 mt-0.5">
                {a.time}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
        <button className="text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors">
          Ver todo el historial →
        </button>
      </div>
    </div>
  );
}

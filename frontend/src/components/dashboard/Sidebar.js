
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { icons } from "./icons";
import { Logo } from "../Logo";

const navItems = [
  { to: "/dashboard", icon: icons.dashboard, label: "Inicio" },
  { to: "/admin/users", icon: icons.users, label: "Usuarios", admin: true },
  { to: "/admin/drivers", icon: icons.drivers, label: "Conductores", admin: true },
  { to: "/admin/routes", icon: icons.routes, label: "Rutas", admin: true },
  { to: "/tracking/1", icon: icons.tracking, label: "Tracking" },
  { to: "/profile", icon: icons.profile, label: "Mi Perfil" },
];

export default function Sidebar({ role, onLogout }) {
  const location = useLocation();
  return (
    <aside className="hidden md:flex flex-col bg-white border-r border-gray-200 shadow-sm min-h-screen w-60 py-8 px-4 sticky top-0">
      <div className="mb-10 px-2">
        <Logo variant="default" iconSize={30} />
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.filter(item => !item.admin || role === 'admin').map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150 hover:bg-blue-50 hover:text-blue-700 ${location.pathname === item.to ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600'}`}
            >
              <Icon size={18} strokeWidth={2} className={location.pathname === item.to ? "text-blue-600" : "text-gray-400"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition mt-4"
        >
          {icons.logout({ size: 18, strokeWidth: 2, className: "text-gray-400" })}
          <span>Cerrar sesión</span>
        </button>
      )}
    </aside>
  );
}

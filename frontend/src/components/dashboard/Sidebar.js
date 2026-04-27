import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { icons } from "./icons";
import { Logo } from "../Logo";
import useTrackingRoute from "./useTrackingRoute";

export default function Sidebar({ role, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { trackingLink, trackingEnabled } = useTrackingRoute(role);

  const navItems = [
    { to: "/dashboard", icon: icons.dashboard, label: "Inicio" },
    {
      to: "/driver/routes",
      icon: icons.routes,
      label: "Mis rutas",
      driver: true,
    },
    { to: "/admin/users", icon: icons.users, label: "Usuarios", admin: true },
    {
      to: "/admin/drivers",
      icon: icons.drivers,
      label: "Conductores",
      admin: true,
    },
    { to: "/admin/routes", icon: icons.routes, label: "Rutas", admin: true },
    {
      to: "/admin/passengers",
      icon: icons.clipboard,
      label: "Estudiantes",
      admin: true,
    },
    {
      to: trackingEnabled ? trackingLink : "/dashboard",
      icon: icons.tracking,
      label: "Tracking",
      disabled: !trackingEnabled,
      tracking: true,
    },
    { to: "/profile", icon: icons.profile, label: "Mi Perfil" },
  ];

  return (
    <aside className="hidden md:flex flex-col bg-white border-r border-gray-200 shadow-sm min-h-screen w-60 py-8 px-4 sticky top-0">
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mb-10 px-2 text-left cursor-pointer bg-transparent border-0 p-0"
      >
        <Logo variant="default" iconSize={30} />
      </button>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems
          .filter(
            (item) =>
              (!item.admin || role === "admin") &&
              (!item.driver || role === "driver"),
          )
          .map((item, index) => {
            const Icon = item.icon;
            const isActive = item.tracking
              ? location.pathname.startsWith("/tracking/")
              : location.pathname === item.to;
            return (
              <Link
                key={index}
                to={item.to}
                onClick={
                  item.disabled ? (event) => event.preventDefault() : undefined
                }
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150 ${item.disabled ? "opacity-50 cursor-not-allowed text-gray-400" : "hover:bg-blue-50 hover:text-blue-700"} ${isActive ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600"}`}
              >
                <Icon
                  size={18}
                  strokeWidth={2}
                  className={isActive ? "text-blue-600" : "text-gray-400"}
                />
                <span>
                  {item.disabled ? "Tracking (sin ruta)" : item.label}
                </span>
              </Link>
            );
          })}
      </nav>
      {onLogout && (
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition mt-4"
        >
          {icons.logout({
            size: 18,
            strokeWidth: 2,
            className: "text-gray-400",
          })}
          <span>Cerrar sesión</span>
        </button>
      )}
    </aside>
  );
}

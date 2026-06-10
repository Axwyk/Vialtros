import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogoIcon } from "../components/Logo";
import { isAuthenticated } from "../services/auth";

// ── Iconos Lucide inline ──────────────────────────────────────────────────────
const IcoLocation = () => (
  <svg
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IcoBus = () => (
  <svg
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <rect x="2" y="4" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M7 18v2" />
    <path d="M17 18v2" />
    <circle cx="7" cy="14" r="1" />
    <circle cx="17" cy="14" r="1" />
  </svg>
);
const IcoShield = () => (
  <svg
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);
const IcoMap = () => (
  <svg
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
    <line x1="9" y1="3" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="21" />
  </svg>
);
const IcoCheck = () => (
  <svg
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IcoSchool = () => (
  <svg
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const IcoBuilding = () => (
  <svg
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path d="M8 3v18M16 3v18M2 9h20M2 15h20" />
  </svg>
);
const IcoTruck = () => (
  <svg
    width="26"
    height="26"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IcoUsers = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IcoSettings = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IcoRoute = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <circle cx="6" cy="19" r="3" />
    <circle cx="18" cy="5" r="3" />
    <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H12" />
  </svg>
);
const IcoClipboard = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);
const IcoBell = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const IcoHistory = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);
const IcoAlert = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);
const IcoBarChart = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

// ── Datos ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <IcoLocation />,
    color: "bg-blue-100 text-blue-600",
    title: "Tracking en tiempo real",
    desc: "Monitorea la ubicación exacta de cada vehículo en el mapa con actualizaciones en vivo. Sin retrasos, sin incertidumbre.",
  },
  {
    icon: <IcoBus />,
    color: "bg-indigo-100 text-indigo-600",
    title: "Panel centralizado",
    desc: "Administra rutas, horarios, conductores y pasajeros desde un solo lugar diseñado para operar con claridad.",
  },
  {
    icon: <IcoShield />,
    color: "bg-blue-100 text-blue-600",
    title: "Acceso seguro por roles",
    desc: "Cada usuario ve exactamente lo que necesita. Administradores, conductores y pasajeros con permisos diferenciados.",
  },
  {
    icon: <IcoMap />,
    color: "bg-indigo-100 text-indigo-600",
    title: "Control de asistencia",
    desc: "Registra qué pasajeros fueron atendidos en cada parada. Historial completo por ruta, conductor y fecha.",
  },
];

const SECTORS = [
  {
    icon: <IcoSchool />,
    color: "bg-blue-50 text-blue-600",
    name: "Instituciones educativas",
    desc: "Control de rutas escolares, asistencia de estudiantes y notificaciones a padres de familia en tiempo real.",
  },
  {
    icon: <IcoBuilding />,
    color: "bg-indigo-50 text-indigo-600",
    name: "Empresas corporativas",
    desc: "Transporte de empleados con visibilidad completa de la flota y reportes automáticos de operación.",
  },
  {
    icon: <IcoTruck />,
    color: "bg-blue-50 text-blue-600",
    name: "Operadores de transporte",
    desc: "Gestión de flotas completas, múltiples rutas y conductores desde un panel unificado y profesional.",
  },
];

const ROLES = [
  {
    badge: "Administrador",
    badgeClass: "bg-blue-50 text-blue-700",
    title: "Control total de la operación",
    desc: "Visión completa del sistema: rutas, conductores, reportes y configuración global.",
    perks: [
      { icon: <IcoBarChart />, label: "Panel de control y reportes" },
      { icon: <IcoUsers />, label: "Gestión de conductores y vehículos" },
      { icon: <IcoRoute />, label: "Configuración de rutas y paradas" },
      {
        icon: <IcoSettings />,
        label: "Analíticas y configuración del sistema",
      },
    ],
    hover: "hover:border-blue-300",
  },
  {
    badge: "Conductor",
    badgeClass: "bg-emerald-50 text-emerald-700",
    title: "Operación simple y eficiente",
    desc: "Interfaz clara para ejecutar la ruta asignada y registrar asistencia en cada parada.",
    perks: [
      { icon: <IcoRoute />, label: "Ver ruta y paradas del día" },
      { icon: <IcoClipboard />, label: "Registro de asistencia por parada" },
      { icon: <IcoAlert />, label: "Reporte de incidencias" },
      { icon: <IcoHistory />, label: "Historial de viajes" },
    ],
    hover: "hover:border-emerald-300",
  },
  {
    badge: "Pasajero",
    badgeClass: "bg-indigo-50 text-indigo-700",
    title: "Seguimiento en tiempo real",
    desc: "Consulta el estado del vehículo, horarios y tu registro de asistencia personal.",
    perks: [
      { icon: <IcoLocation />, label: "Ubicación del vehículo en vivo" },
      { icon: <IcoMap />, label: "Horarios y paradas de su ruta" },
      { icon: <IcoClipboard />, label: "Historial de asistencia personal" },
      { icon: <IcoBell />, label: "Notificaciones de llegada" },
    ],
    hover: "hover:border-indigo-300",
  },
];

const TRUST = ["Roles diferenciados", "Seguimiento en tiempo real"];

// ── Componente principal ──────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    setIsAuth(isAuthenticated());
  }, []);

  const handlePrimaryAction = () => {
    navigate(isAuth ? "/dashboard" : "/login");
  };

  const buttonLabel = isAuth ? "Ir al panel" : "Acceder al sistema";

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-r from-blue-100 to-indigo-200 font-sans">
      {/* NAV */}
      <nav className="w-full sticky top-0 z-50 bg-white/50 backdrop-blur border-b border-gray-100 px-8 md:px-20 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoIcon size={30} color="#2563eb" />
          <span className="font-bold text-gray-900 text-xl tracking-tight">
            Vialtros
          </span>
        </div>
        <ul className="hidden md:flex items-center gap-10 list-none m-0 p-0">
          <li>
            <a
              href="#sectores"
              className="text-gray-500 hover:text-gray-900 text-base transition-colors no-underline"
            >
              Sectores
            </a>
          </li>
          <li>
            <a
              href="#caracteristicas"
              className="text-gray-500 hover:text-gray-900 text-base transition-colors no-underline"
            >
              Características
            </a>
          </li>
          <li>
            <a
              href="#roles"
              className="text-gray-500 hover:text-gray-900 text-base transition-colors no-underline"
            >
              Roles
            </a>
          </li>
        </ul>
        <button
          onClick={handlePrimaryAction}
          className="bg-blue-600 hover:bg-blue-700 text-white text-base font-medium px-6 py-2.5 rounded-lg transition-all shadow-sm"
        >
          {buttonLabel}
        </button>
      </nav>

      {/* HERO */}
      <section className="w-full px-8 md:px-20 pt-20 pb-20 flex flex-col md:flex-row items-center gap-16 bg-gradient-to-r from-blue-100 to-indigo-200">
        <div className="flex-1 flex flex-col items-start">
          <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 text-sm font-medium px-4 py-1.5 rounded-full mb-7 uppercase tracking-wider">
            <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block"></span>
            Plataforma SaaS · En vivo
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
            El sistema que tu
            <br />
            flota necesitaba
            <br />
            <span className="text-blue-600">desde siempre</span>
          </h1>
          <p className="text-gray-500 text-xl mb-10 max-w-xl leading-relaxed font-normal">
            Vialtros centraliza el control de rutas, conductores y pasajeros
            para empresas, colegios e instituciones que necesitan visibilidad
            total de su operación.
          </p>
          <div className="flex gap-4 mb-10">
            <button
              onClick={handlePrimaryAction}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl shadow-md transition-all text-base flex items-center gap-2"
            >
              {buttonLabel} <span>→</span>
            </button>
            <a
              href="#caracteristicas"
              className="border border-gray-200 hover:border-blue-300 text-gray-600 hover:text-blue-700 font-medium px-8 py-4 rounded-xl bg-white transition-all text-base no-underline shadow-sm"
            >
              Ver características
            </a>
          </div>
          <div className="flex flex-wrap gap-6">
            {TRUST.map((t) => (
              <span
                key={t}
                className="flex items-center gap-2 text-sm text-gray-500"
              >
                <span className="text-emerald-500">
                  <IcoCheck />
                </span>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Dashboard card */}
        <div className="flex-1 w-full max-w-lg">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-50 rounded-full opacity-70"></div>
            <div className="flex items-center justify-between mb-5 relative z-10">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
                Rutas activas hoy
              </span>
              <span className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block"></span>
                En vivo
              </span>
            </div>
            <div className="flex flex-col gap-3 mb-5 relative z-10">
              {[
                {
                  color: "bg-blue-500",
                  name: "Ruta Norte — Centro",
                  stops: "12 paradas · 34 pasajeros",
                  status: "En curso",
                  statusClass: "bg-emerald-50 text-emerald-600",
                },
                {
                  color: "bg-amber-400",
                  name: "Ruta Sur — Terminal",
                  stops: "8 paradas · 21 pasajeros",
                  status: "Demorada",
                  statusClass: "bg-amber-50 text-amber-600",
                },
                {
                  color: "bg-gray-300",
                  name: "Ruta Este — Industrial",
                  stops: "6 paradas · 0 pasajeros",
                  status: "En espera",
                  statusClass: "bg-gray-100 text-gray-400",
                },
              ].map((r) => (
                <div
                  key={r.name}
                  className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${r.color}`}
                    ></span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 leading-none mb-1">
                        {r.name}
                      </p>
                      <p className="text-xs text-gray-400">{r.stops}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${r.statusClass}`}>{r.status}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-6 mt-6">
              {[
                { val: "247", lbl: "Pasajeros" },
                { val: "94%", lbl: "Puntualidad", accent: true },
              ].map((s) => (
                <div
                  key={s.lbl}
                  className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center"
                >
                  <span
                    className={`block text-2xl font-bold ${s.accent ? "text-emerald-500" : "text-gray-900"}`}
                  >
                    {s.val}
                  </span>
                  <span className="block text-xs text-gray-400 mt-1">
                    {s.lbl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTORS */}
      <section
        id="sectores"
        className="w-full px-8 md:px-20 py-24 bg-gradient-to-r from-blue-100 to-indigo-200"
      >
        <div className="w-12 h-0.5 bg-blue-600 mb-5"></div>
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">
          Sectores
        </p>
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Pensado para quien
          <br />
          mueve personas
        </h2>
        <p className="text-gray-500 mb-14 max-w-xl text-lg font-normal leading-relaxed">
          Vialtros se adapta a cualquier organización que necesite controlar su
          flota y garantizar la seguridad de sus pasajeros.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {SECTORS.map((s) => (
            <div
              key={s.name}
              className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${s.color}`}
              >
                {s.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-xl">{s.name}</h3>
              <p className="text-gray-500 text-base leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section
        id="caracteristicas"
        className="w-full px-8 md:px-20 py-24 bg-gradient-to-r from-blue-100 to-indigo-200"
      >
        <div className="w-12 h-0.5 bg-blue-600 mb-5"></div>
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">
          Características
        </p>
        <h2 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Todo en una sola
          <br />
          plataforma
        </h2>
        <p className="text-gray-500 mb-14 max-w-xl text-lg font-normal leading-relaxed">
          Sin hojas de Excel, sin llamadas al conductor. Control total de tu
          operación desde el navegador.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white p-10 hover:bg-blue-50/40 transition-colors"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${f.color}`}
              >
                {f.icon}
              </div>
              <h3 className="font-bold text-gray-900 mb-3 text-xl">
                {f.title}
              </h3>
              <p className="text-gray-500 text-base leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section
        id="roles"
        className="w-full px-8 md:px-20 py-24 bg-gradient-to-r from-blue-100 to-indigo-200"
      >
        <div className="w-12 h-0.5 bg-blue-600 mb-5"></div>
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">
          Roles
        </p>
        <h2 className="text-4xl font-extrabold text-gray-900 mb-14 tracking-tight">
          Cada perfil tiene
          <br />
          su propio espacio
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ROLES.map((r) => (
            <div
              key={r.badge}
              className={`bg-white border border-gray-200 rounded-2xl p-8 transition-all hover:-translate-y-1 hover:shadow-lg ${r.hover}`}
            >
              <span
                className={`inline-block text-sm font-semibold px-4 py-1.5 rounded-full mb-5 uppercase tracking-wide ${r.badgeClass}`}
              >
                {r.badge}
              </span>
              <h3 className="font-bold text-gray-900 mb-3 text-xl">
                {r.title}
              </h3>
              <p className="text-gray-500 text-base mb-7 leading-relaxed">
                {r.desc}
              </p>
              <ul className="space-y-3 list-none p-0 m-0">
                {r.perks.map((p) => (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 text-base text-gray-600"
                  >
                    <span className="text-blue-400 flex-shrink-0">
                      {p.icon}
                    </span>
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section className="w-full px-8 md:px-20 py-24 bg-gradient-to-r from-blue-100 to-indigo-200">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-14 md:p-20 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden">
          <div className="absolute -left-20 -top-20 w-80 h-80 bg-white/5 rounded-full"></div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full"></div>
          <div className="relative z-10">
            <h2 className="text-4xl font-extrabold text-white mb-3 leading-tight">
              Tu operación merece
              <br />
              más visibilidad
            </h2>
            <p className="text-blue-200 text-lg font-normal">
              Empieza hoy. Sin configuraciones complejas.
            </p>
          </div>
          <div className="flex gap-4 relative z-10 flex-shrink-0">
            <button
              onClick={handlePrimaryAction}
              className="bg-white hover:bg-blue-50 text-blue-700 font-semibold px-8 py-4 rounded-xl text-base transition-all shadow-md"
            >
              {buttonLabel} →
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER eliminado, ahora se usa el global */}
    </div>
  );
}

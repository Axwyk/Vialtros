

import React, { useEffect, useState } from 'react';
import Sidebar from '../components/dashboard/Sidebar';
import StatCard from '../components/dashboard/StatCard';
import HeroCard from '../components/dashboard/HeroCard';
import ActivityFeed from '../components/dashboard/ActivityFeed';
import MiniChart from '../components/dashboard/MiniChart';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../services/dashboard';
import { icons } from '../components/dashboard/icons';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

function formatDate() {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function DashboardPage({ role, onLogout }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const usernameRaw = localStorage.getItem('username') || 'Usuario';
  // Capitaliza solo la primera letra, el resto en minúsculas
  const username = usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1).toLowerCase();

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />

      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">

        {/* ── Header ── */}
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

        {/* ── Stats ── */}
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

        {/* ── Main grid: hero+chart | activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_272px] gap-5 mb-6">
          <div className="flex flex-col gap-5">
            <HeroCard />

            {/* Chart card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Rutas por día</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Últimos 7 días</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  ↑ 18% esta semana
                </span>
              </div>
              <MiniChart />
            </div>
          </div>

          {/* Activity feed */}
          <div>
            <ActivityFeed />
          </div>
        </div>

        {/* ── Role-specific banners ── */}
        {role === 'driver' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Tus rutas de hoy</h3>
              <p className="text-xs text-gray-400">Revisa tus pasajeros asignados y el estado del recorrido</p>
            </div>
            <Link
              to="/driver/routes"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-all duration-150 whitespace-nowrap"
            >
              Ver mis rutas
              {icons.arrowRight({ size: 14, strokeWidth: 2.5 })}
            </Link>
          </div>
        )}

        {role === 'user' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
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

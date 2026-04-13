import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { icons } from "./icons";
import { getDriverAssignedRoutes, getUserAssignedRoute } from "../../services/dashboard";
import { getRoutes } from "../../services/admin";

function MapPreview() {
  return (
    <div
      className="relative w-48 h-36 rounded-xl overflow-hidden flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 192 144"
        preserveAspectRatio="none"
      >
        <line x1="0" y1="72" x2="192" y2="72" stroke="white" strokeWidth="0.5" opacity="0.1" />
        <line x1="96" y1="0" x2="96" y2="144" stroke="white" strokeWidth="0.5" opacity="0.1" />
        <path d="M12 115 C40 90 75 60 115 44 L178 30" stroke="#93C5FD" strokeWidth="2" strokeDasharray="5 3" fill="none" opacity="0.85" />
        <path d="M12 128 C45 110 75 98 108 92 C138 87 162 100 178 114" stroke="#6EE7B7" strokeWidth="2" strokeDasharray="5 3" fill="none" opacity="0.85" />
      </svg>
      <div className="absolute" style={{ left: "57%", top: "27%", transform: "translate(-50%,-50%)" }}>
        <span className="absolute inline-flex h-3 w-3 rounded-full bg-blue-300 opacity-60 animate-ping" style={{ animationDuration: "2s" }} />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-400" />
      </div>
      <div className="absolute" style={{ left: "62%", top: "66%", transform: "translate(-50%,-50%)" }}>
        <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 opacity-60 animate-ping" style={{ animationDuration: "3s", animationDelay: "1s" }} />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </div>
    </div>
  );
}

export default function HeroCard({ role }) {
  const [trackingLink, setTrackingLink] = useState("/tracking/1");
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveTrackingRoute() {
      if (role === "driver") {
        try {
          const routes = await getDriverAssignedRoutes();
          const firstRouteId = routes?.[0]?.id;
          if (!mounted) return;
          if (firstRouteId) {
            setTrackingLink(`/tracking/${firstRouteId}`);
            setTrackingEnabled(true);
          } else {
            setTrackingEnabled(false);
          }
        } catch {
          if (mounted) setTrackingEnabled(false);
        }
        return;
      }

      if (role === "user") {
        try {
          const payload = await getUserAssignedRoute();
          const routeId = payload?.route?.id;
          if (!mounted) return;
          if (routeId) {
            setTrackingLink(`/tracking/${routeId}`);
            setTrackingEnabled(true);
          } else {
            setTrackingEnabled(false);
          }
        } catch {
          if (mounted) setTrackingEnabled(false);
        }
        return;
      }

      if (role === "admin") {
        try {
          const routes = await getRoutes();
          const firstRouteId = routes?.[0]?.id;
          if (!mounted) return;
          if (firstRouteId) {
            setTrackingLink(`/tracking/${firstRouteId}`);
            setTrackingEnabled(true);
          } else {
            setTrackingEnabled(false);
          }
        } catch {
          if (mounted) setTrackingEnabled(false);
        }
        return;
      }

      if (mounted) {
        setTrackingEnabled(false);
      }
    }

    resolveTrackingRoute();
    return () => {
      mounted = false;
    };
  }, [role]);

  return (
    <div
      className="rounded-2xl shadow-lg p-7 flex items-center justify-between gap-6 overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)" }}
    >
      <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
      <div className="absolute right-12 -bottom-8 w-32 h-32 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />

      <div className="relative z-10 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-emerald-300 uppercase tracking-widest">Sistema activo</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Tracking en tiempo real</h2>
        <p className="text-sm text-blue-100 mb-5 max-w-xs leading-relaxed" style={{ opacity: 0.9 }}>
          Monitorea rutas activas, localiza conductores y sigue cada recorrido en tiempo real.
        </p>
        {trackingEnabled ? (
          <Link
            to={trackingLink}
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-5 py-2.5 rounded-lg font-semibold text-sm shadow hover:bg-blue-50 active:scale-95 transition-all duration-150"
          >
            Abrir mapa
            {icons.arrowRight({ size: 14, strokeWidth: 2.5 })}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 bg-white/40 text-blue-100 px-5 py-2.5 rounded-lg font-semibold text-sm border border-white/20 cursor-not-allowed"
          >
            Sin ruta asignada
          </button>
        )}
      </div>

      <div className="relative z-10 hidden md:block">
        <MapPreview />
      </div>
    </div>
  );
}

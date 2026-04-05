import React from "react";

/**
 * Icono de Vialtros:
 * Dos puntos de origen (waypoints) arriba conectados
 * por dos trazos en forma de V hasta un pin de destino abajo.
 * Representa: red de rutas, transporte, movilidad.
 */
export function LogoIcon({ size = 26, color = "#2563EB" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Vialtros logo icon"
    >
      {/* Waypoint izquierdo */}
      <circle cx="4.5" cy="5.5" r="2.5" fill={color} />
      {/* Waypoint derecho */}
      <circle cx="19.5" cy="5.5" r="2.5" fill={color} />
      {/* Línea izquierda hacia destino */}
      <line
        x1="4.5" y1="7.8"
        x2="12"   y2="19.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Línea derecha hacia destino */}
      <line
        x1="19.5" y1="7.8"
        x2="12"    y2="19.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Pin de destino */}
      <circle cx="12" cy="21" r="2.2" fill={color} />
    </svg>
  );
}

/**
 * Logo completo: icono + wordmark "Vialtros"
 * variant:
 *   "default" → icono azul + texto oscuro (para fondos blancos/claros)
 *   "light"   → icono blanco + texto blanco (para fondos oscuros/azul)
 */
export function Logo({ variant = "default", iconSize = 26 }) {
  const iconColor  = variant === "light" ? "#ffffff" : "#2563EB";
  const textColor  = variant === "light" ? "#ffffff" : "#111827";

  return (
    <div
      className="flex items-center gap-2.5 select-none"
      aria-label="Vialtros"
    >
      <LogoIcon size={iconSize} color={iconColor} />
      <span
        style={{
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          fontWeight: 700,
          fontSize: "1.25rem",
          letterSpacing: "-0.03em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        Vialtros
      </span>
    </div>
  );
}

import React from "react";

const ITEMS = [
  { key: "bus", label: "Bus" },
  { key: "car", label: "Coche" },
  { key: "motorcycle", label: "Moto" },
  { key: "walk", label: "Caminando" },
];

function Icon({ type }) {
  switch (type) {
    case "bus":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path fill="currentColor" d="M4 16v-7a3 3 0 013-3h10a3 3 0 013 3v7a2 2 0 01-2 2v1a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H9v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-1a2 2 0 01-2-2zm3-6a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      );
    case "car":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path fill="currentColor" d="M3 11l1.5-4A2 2 0 016.4 5h11.2a2 2 0 011.9 2l1.5 4v5a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-5zM7 8a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      );
    case "motorcycle":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path fill="currentColor" d="M3 13a4 4 0 018 0h4l-1.5-3H13V8h3l1.5 3H21v2h-2a4 4 0 11-6.9 2H9a4 4 0 11-6-2z" />
        </svg>
      );
    case "walk":
      return (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path fill="currentColor" d="M13 5a1 1 0 11-2 0 1 1 0 012 0zm-1 4v6l-2 4v1h2v-1l1-2 2 2v1h2v-3l-3-3V9a1 1 0 10-2 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function TransportBar({ value = "car", onChange = () => {}, variant = "default" }) {
  if (variant === "compact") {
    const selected = ITEMS.find((i) => i.key === value) || ITEMS[1];
    return (
      <div className="inline-flex items-center bg-white border border-slate-100 rounded-md px-3 py-2 shadow-sm text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">Modo</span>
          <span className="inline-flex items-center gap-2 font-medium text-sm text-slate-800">
            <span className="w-5 h-5 text-slate-700" aria-hidden>
              <Icon type={selected.key} />
            </span>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div role="tablist" aria-label="Medio de transporte" className="inline-flex gap-2 bg-white border border-blue-50 p-1 rounded-xl items-center shadow-sm">
      {ITEMS.map((it) => {
        const selected = value === it.key;
        const btnClasses = `flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
          selected ? "bg-blue-50 ring-1 ring-blue-200 text-sky-600" : "text-slate-700 hover:bg-slate-50"
        }`;

        return (
          <button
            type="button"
            key={it.key}
            className={btnClasses}
            aria-pressed={selected}
            aria-label={it.label}
            onClick={() => onChange(it.key)}
          >
            <span className={`block w-5 h-5 ${selected ? 'text-sky-600' : 'text-slate-700'}`} aria-hidden>
              <Icon type={it.key} />
            </span>
            <span className="text-[11px] leading-none text-slate-600 mt-0.5">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TransportIcon({ type, className = "w-5 h-5 text-slate-800" }) {
  return (
    <span className={className} aria-hidden>
      <Icon type={type} />
    </span>
  );
}

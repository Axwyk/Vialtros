import React, { useEffect, useRef } from "react";
import {
  MdDirectionsBus,
  MdPersonAdd,
  MdPersonPin,
  MdLocationOn,
  MdFlag,
  MdWarning,
  MdOutlinedFlag,
  MdClose,
} from "react-icons/md";
import { useNotifications } from "../../context/NotificationContext";

const TOAST_DURATION_MS = 6000;

const TYPE_CONFIG = {
  route_started: {
    Icon: MdDirectionsBus,
    bg: "bg-blue-50",
    border: "border-blue-400",
    iconColor: "text-blue-600",
    bar: "bg-blue-500",
  },
  student_picked_up: {
    Icon: MdPersonAdd,
    bg: "bg-green-50",
    border: "border-green-400",
    iconColor: "text-green-600",
    bar: "bg-green-500",
  },
  student_dropped_off: {
    Icon: MdPersonPin,
    bg: "bg-emerald-50",
    border: "border-emerald-400",
    iconColor: "text-emerald-600",
    bar: "bg-emerald-500",
  },
  approaching_stop: {
    Icon: MdLocationOn,
    bg: "bg-amber-50",
    border: "border-amber-400",
    iconColor: "text-amber-600",
    bar: "bg-amber-500",
  },
  approaching_destination: {
    Icon: MdFlag,
    bg: "bg-indigo-50",
    border: "border-indigo-400",
    iconColor: "text-indigo-600",
    bar: "bg-indigo-500",
  },
  driver_near_stop: {
    Icon: MdWarning,
    bg: "bg-orange-50",
    border: "border-orange-400",
    iconColor: "text-orange-600",
    bar: "bg-orange-500",
  },
  driver_near_destination: {
    Icon: MdOutlinedFlag,
    bg: "bg-purple-50",
    border: "border-purple-400",
    iconColor: "text-purple-600",
    bar: "bg-purple-500",
  },
};

const FALLBACK_CONFIG = {
  Icon: MdDirectionsBus,
  bg: "bg-gray-50",
  border: "border-gray-300",
  iconColor: "text-gray-600",
  bar: "bg-gray-400",
};

function SingleToast({ toast, onDismiss }) {
  const config = TYPE_CONFIG[toast.type] || FALLBACK_CONFIG;
  const { Icon, bg, border, iconColor, bar } = config;
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast._toastId), TOAST_DURATION_MS);
    return () => clearTimeout(timerRef.current);
  }, [toast._toastId, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-xl border-l-4 shadow-lg px-4 py-3 ${bg} ${border} animate-slide-in`}
      role="alert"
    >
      <div className={`mt-0.5 shrink-0 text-xl ${iconColor}`}>
        <Icon />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-tight truncate">
          {toast.title}
        </p>
        <p className="text-xs text-gray-600 mt-0.5 leading-snug line-clamp-2">
          {toast.message}
        </p>
        <div className="mt-2 h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${bar} rounded-full`}
            style={{ animation: `shrink ${TOAST_DURATION_MS}ms linear forwards` }}
          />
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast._toastId)}
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
        aria-label="Cerrar notificacion"
      >
        <MdClose className="text-base" />
      </button>
    </div>
  );
}

export default function NotificationToast() {
  const { toastQueue, dismissToast } = useNotifications();
  const visible = toastQueue.slice(-5);

  if (!visible.length) return null;

  return (
    <>
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(2rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s ease-out;
        }
      `}</style>
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
      >
        {visible.map((toast) => (
          <div key={toast._toastId} className="pointer-events-auto">
            <SingleToast toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </>
  );
}

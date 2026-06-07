import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import NotificationDetailModal from "./NotificationDetailModal";
import {
  MdNotificationsActive as MdNotifications,
  MdDirectionsBus,
  MdPersonAdd,
  MdPersonPin,
  MdLocationOn,
  MdFlag,
  MdWarning,
  MdOutlinedFlag,
  MdDoneAll,
  MdInbox,
} from "react-icons/md";
import { useNotifications } from "../../context/NotificationContext";

const TYPE_ICON = {
  route_started: MdDirectionsBus,
  student_picked_up: MdPersonAdd,
  student_dropped_off: MdPersonPin,
  approaching_stop: MdLocationOn,
  approaching_destination: MdFlag,
  driver_near_stop: MdWarning,
  driver_near_destination: MdOutlinedFlag,
};

const TYPE_COLOR = {
  route_started: "text-blue-500",
  student_picked_up: "text-green-500",
  student_dropped_off: "text-emerald-500",
  approaching_stop: "text-amber-500",
  approaching_destination: "text-indigo-500",
  driver_near_stop: "text-orange-500",
  driver_near_destination: "text-purple-500",
};

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "Ahora mismo";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} d`;
}

export default function NotificationCenter({ sidebarMode = false }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [panelStyle, setPanelStyle] = useState({});
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  // Calcula posicion fija del panel al abrir para escapar cualquier overflow
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const PANEL_W = 384;
    const fitsRight = window.innerWidth - rect.left >= PANEL_W;
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: Math.max(8, fitsRight ? rect.left : rect.right - PANEL_W),
      width: PANEL_W,
      zIndex: 9999,
    });
  }, [open]);

  useEffect(() => {
    function handleClick(e) {
      if (!btnRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      {/* Boton disparador */}
      {sidebarMode ? (
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          className="relative w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150 text-gray-600 hover:bg-blue-50 hover:text-blue-700"
          aria-label="Notificaciones"
        >
          <MdNotifications size={18} className="text-gray-400 shrink-0" />
          <span className="flex-1 text-left">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          ref={btnRef}
          onClick={() => setOpen((v) => !v)}
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
          aria-label="Notificaciones"
        >
          <MdNotifications className="text-xl" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Modal de detalle */}
      {selectedNotif && (
        <NotificationDetailModal
          notification={selectedNotif}
          onClose={() => setSelectedNotif(null)}
        />
      )}

      {/* Panel — renderizado via portal para escapar overflow del contenedor */}
      {open && ReactDOM.createPortal(
        <div ref={panelRef} style={panelStyle} className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <MdDoneAll className="text-sm" />
                Marcar todo como leido
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                <MdInbox className="text-3xl" />
                <span className="text-sm">Sin notificaciones</span>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || MdDirectionsBus;
                const color = TYPE_COLOR[n.type] || "text-gray-500";
                return (
                  <button
                    key={n.id}
                    onClick={() => { markRead(n.id); setSelectedNotif(n); setOpen(false); }}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? "bg-blue-50/40" : ""}`}
                  >
                    <div className={`mt-0.5 shrink-0 text-lg ${color}`}>
                      <Icon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold truncate ${!n.read ? "text-gray-900" : "text-gray-700"}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 leading-snug line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

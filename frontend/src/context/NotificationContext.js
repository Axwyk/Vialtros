import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api from "../services/api";
import { connectNotificationWS } from "../services/notificationWs";

const NotificationContext = createContext(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications debe usarse dentro de NotificationProvider");
  return ctx;
}

const ACTIVE_ROLES = ["user", "driver"];

export function NotificationProvider({ children, isAuth, role }) {
  const [notifications, setNotifications] = useState([]);
  const [toastQueue, setToastQueue] = useState([]);
  const wsRef = useRef(null);

  const isActive = isAuth && ACTIVE_ROLES.includes(role);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Carga historial al iniciar sesion (solo para user/driver)
  useEffect(() => {
    if (!isActive) {
      setNotifications([]);
      return;
    }
    api
      .get("/notifications/")
      .then((res) => setNotifications(res.data || []))
      .catch(() => {});
  }, [isActive]);

  // Conexion WebSocket de notificaciones (solo para user/driver)
  useEffect(() => {
    if (!isActive) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }
    const ws = connectNotificationWS({
      onNotification: (notif) => {
        setNotifications((prev) => {
          const exists = prev.some((n) => n.id === notif.id);
          return exists ? prev : [notif, ...prev];
        });
        setToastQueue((prev) => [...prev, { ...notif, _toastId: Date.now() + Math.random() }]);
      },
    });
    wsRef.current = ws;
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isActive]);

  const markRead = useCallback((id) => {
    api.post(`/notifications/${id}/mark_read/`).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    api.post("/notifications/mark_all_read/").catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToastQueue((prev) => prev.filter((t) => t._toastId !== toastId));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toastQueue,
        markRead,
        markAllRead,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

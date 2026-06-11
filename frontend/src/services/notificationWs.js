import { resolveWsBaseUrl } from "./ws";

/**
 * Conecta al WebSocket de notificaciones del usuario autenticado.
 * El token JWT se pasa como query param ?token=... porque los headers
 * no estan disponibles en el handshake WebSocket del navegador.
 *
 * Retorna un objeto con close() para desconectar manualmente.
 */
export function connectNotificationWS(handlers = {}) {
  const {
    onNotification,
    onOpen,
    onClose,
    reconnectDelayMs = 2000,
    maxReconnectAttempts = 15,
  } = handlers;

  let socket = null;
  let closedManually = false;
  let wasConnected = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  const connect = () => {
    const token = localStorage.getItem("access") || "";
    const base = resolveWsBaseUrl();
    const url = `${base}/notifications/${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      wasConnected = true;
      reconnectAttempts = 0;
      if (onOpen) onOpen();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && onNotification) onNotification(data);
      } catch {
        // ignorar mensajes malformados
      }
    };

    socket.onerror = () => {};

    socket.onclose = () => {
      if (closedManually) return;
      if (onClose) onClose();
      const effectiveMax = wasConnected ? maxReconnectAttempts : 5;
      if (reconnectAttempts >= effectiveMax) return;
      reconnectAttempts += 1;
      const delay = Math.min(reconnectDelayMs * 2 ** reconnectAttempts, 30000);
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return {
    close: () => {
      closedManually = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState <= 1) socket.close();
    },
  };
}

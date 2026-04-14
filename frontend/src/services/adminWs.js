// Servicio para conexión WebSocket de monitoring administrativo
import { resolveWsBaseUrl } from './ws';

function parseMsg(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function connectAdminMonitoring(onMessage, handlers = {}) {
  const { onOpen, onClose, onError, reconnectDelayMs = 2000, maxReconnectAttempts = 20 } = handlers;
  let socket = null;
  let closedManually = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  if (typeof WebSocket === 'undefined') throw new Error('WebSocket no disponible');

  const connect = () => {
    const wsUrl = `${resolveWsBaseUrl()}/monitoring/`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempts = 0;
      if (onOpen) onOpen();
    };

    socket.onmessage = (ev) => {
      const data = parseMsg(ev.data);
      if (!data) return;
      if (onMessage) onMessage(data);
    };

    socket.onerror = () => { if (onError) onError(); };

    socket.onclose = () => {
      if (onClose) onClose();
      if (closedManually) return;
      if (reconnectAttempts >= maxReconnectAttempts) return;
      reconnectAttempts += 1;
      reconnectTimer = setTimeout(connect, reconnectDelayMs);
    };
  };

  connect();

  return {
    close: () => {
      closedManually = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState <= 1) socket.close();
    },
    send: (payload) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    },
    readyState: () => socket?.readyState ?? WebSocket.CLOSED,
  };
}

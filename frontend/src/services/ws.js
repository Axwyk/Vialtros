// Servicio para conexión WebSocket de tracking en tiempo real

function resolveWsBaseUrl() {
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL.replace(/\/+$/, '');
  }

  const apiUrl = process.env.REACT_APP_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}/ws`;
    } catch {
      // Si la URL es inválida, se usa fallback abajo.
    }
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    return `${protocol}//${host}:8000/ws`;
  }

  return 'ws://localhost:8000/ws';
}

export function connectTrackingWS(routeId, onMessage, handlers = {}) {
  const {
    onOpen,
    onClose,
    onError,
    reconnectDelayMs = 1500,
    maxReconnectAttempts = 20,
  } = handlers;

  let socket = null;
  let closedManually = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  const connect = () => {
    const wsUrl = `${resolveWsBaseUrl()}/tracking/${routeId}/`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      reconnectAttempts = 0;
      if (onOpen) onOpen();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        // Ignora mensajes malformados para no romper el stream.
      }
    };

    socket.onerror = () => {
      if (onError) onError();
    };

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
      if (socket && socket.readyState <= 1) {
        socket.close();
      }
    },
  };
}

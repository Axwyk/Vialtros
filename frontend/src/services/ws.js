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

function parseIncomingMessage(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function extractLocationUpdate(payload) {
  if (!payload || typeof payload !== 'object') return null;

  // Soporta formato por evento: { event: 'position_update', data: { ... } }
  const eventName = String(payload.event || payload.type || payload.action || '').toLowerCase();
  if (eventName === 'position_update' || eventName === 'tracking_update') {
    const nested = payload.data || payload.payload || payload.position;
    if (nested && typeof nested === 'object') {
      return nested;
    }
  }

  // Soporta payload plano: { latitude, longitude, ... }
  if (
    payload.latitude != null
    || payload.longitude != null
    || payload.lat != null
    || payload.lng != null
  ) {
    return payload;
  }

  return null;
}

export function connectTrackingWS(routeId, onMessage, handlers = {}) {
  const {
    onOpen,
    onClose,
    onError,
    onRawMessage,
    onLocationUpdate,
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
      const data = parseIncomingMessage(event.data);
      if (!data) return;

      if (onRawMessage) {
        onRawMessage(data);
      }

      const locationPayload = extractLocationUpdate(data);
      if (locationPayload && onLocationUpdate) {
        onLocationUpdate(locationPayload);
      }

      // Compatibilidad: el callback principal sigue recibiendo la mejor señal de ubicación.
      if (locationPayload) {
        onMessage(locationPayload);
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

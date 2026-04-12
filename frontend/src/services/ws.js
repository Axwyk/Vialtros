// Servicio para conexión WebSocket de tracking en tiempo real

export function connectTrackingWS(routeId, onMessage) {
  const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
  const wsUrl = `${WS_URL}/tracking/${routeId}/`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  return socket;
}

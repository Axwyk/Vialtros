// Página de tracking en tiempo real
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MapView from '../components/MapView';
import { connectTrackingWS } from '../services/ws';

/**
 * Página que muestra el tracking en tiempo real de una ruta.
 * Conecta al WebSocket y actualiza el mapa al recibir datos.
 */
export default function TrackingPage({ routeId }) {
  const [trackings, setTrackings] = useState([]);

  useEffect(() => {
    const socket = connectTrackingWS(routeId, (data) => {
      setTrackings((prev) => [...prev, data]);
    });
    return () => socket.close();
  }, [routeId]);

  return (
    <div className="min-h-[90vh] flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 font-sans">
      <div className="w-full max-w-2xl mx-auto bg-white/80 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-extrabold text-blue-900 drop-shadow">Tracking en tiempo real</h2>
          <Link to="/dashboard" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 transition text-sm">
            ← Volver al Dashboard
          </Link>
        </div>
        {trackings.length === 0 ? (
          <div className="text-gray-500 text-center py-16 text-lg">No hay datos de tracking para esta ruta.</div>
        ) : (
          <div className="rounded-xl overflow-hidden border border-blue-100 shadow-lg">
            <MapView trackings={trackings} />
          </div>
        )}
      </div>
    </div>
  );
}

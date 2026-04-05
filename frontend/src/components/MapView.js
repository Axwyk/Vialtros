// Componente de mapa en tiempo real usando React-Leaflet
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Muestra un mapa centrado en la ubicación y los marcadores de tracking.
 * @param {Object[]} trackings - Lista de objetos con lat, lng y estado.
 */
export default function MapView({ trackings = [] }) {
  const center = trackings.length > 0 ? [trackings[0].latitude, trackings[0].longitude] : [0, 0];
  return (
    <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {trackings.map((t, i) => (
        <Marker key={i} position={[t.latitude, t.longitude]}>
          <Popup>
            Estado: {t.status}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

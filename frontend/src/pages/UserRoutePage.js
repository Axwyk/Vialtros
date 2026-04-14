import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import { icons } from "../components/dashboard/icons";
import TrackingHero from "../components/tracking/TrackingHero";
import { getUserAssignedRoute } from "../services/dashboard";
import { getDriverTrackings } from "../services/dashboard";
import { geocodeAddress } from "../services/routing";

const NEAR_DISTANCE_KM = 0.8;

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return earthKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function normalizeTracking(raw) {
  const latitude = Number(raw?.latitude ?? raw?.lat);
  const longitude = Number(raw?.longitude ?? raw?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    ...raw,
    latitude,
    longitude,
  };
}
export default function UserRoutePage({ role, onLogout }) {
  const [data, setData] = useState(null);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);

  useEffect(() => {
    Promise.all([getUserAssignedRoute(), getDriverTrackings()])
      .then(([routeData, trackingData]) => {
        setData(routeData);
        setTrackings(
          (trackingData || []).map(normalizeTracking).filter(Boolean),
        );
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setError("Todavía no tienes una ruta asignada.");
          return;
        }
        setError("No se pudo cargar tu ruta en este momento.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data?.route?.destination) return;

    geocodeAddress(data.route.destination)
      .then((coords) => {
        if (Array.isArray(coords) && coords.length === 2) {
          setDestinationCoords(coords);
        }
      })
      .catch(() => {});
  }, [data]);

  const route = data?.route;
  const driver = data?.driver;

  const latestTracking = useMemo(() => {
    if (!trackings.length) return null;
    return trackings[trackings.length - 1];
  }, [trackings]);

  const isVehicleNearby = useMemo(() => {
    if (!latestTracking || !destinationCoords) return false;

    const km = distanceKm(
      latestTracking.latitude,
      latestTracking.longitude,
      destinationCoords[0],
      destinationCoords[1],
    );

    return km <= NEAR_DISTANCE_KM;
  }, [latestTracking, destinationCoords]);

  useEffect(() => {
    setShowNearbyBanner(isVehicleNearby);
  }, [isVehicleNearby]);

  const userTracking = trackings.find(
    (t) => Number(t.route) === Number(route?.id),
  );
  const pickupStatus = userTracking?.status || "not_picked";

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10 overflow-y-auto">
        {showNearbyBanner && (
          <div className="fixed top-6 right-6 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Tu vehículo está cerca
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Prepárate, el conductor ya está próximo a tu destino.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <TrackingHero
            backTo="/dashboard"
            backAriaLabel="Volver al panel"
            eyebrow="Ruta personal"
            title="Tu ruta asignada"
            description="Consulta tu conductor, el trayecto y los datos principales de tu recorrido desde una vista clara y consistente con el tracking en vivo."
            subtitle={route?.name || "Pendiente de asignacion"}
            meta={
              route ? (
                <span className="tracking-hero-chip">
                  {route?.passenger_count ??
                    route?.passenger_details?.length ??
                    0}{" "}
                  estudiantes
                </span>
              ) : null
            }
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center text-sm text-gray-400">
            Cargando tu ruta...
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
            <p className="text-base font-medium text-gray-700">{error}</p>
            <p className="text-sm text-gray-400 mt-2">
              Cuando un administrador te asigne una ruta, la verás aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold mb-2">
                    Ruta
                  </p>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {route?.name}
                  </h2>
                </div>
                <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  {route?.passenger_count ??
                    route?.passenger_details?.length ??
                    0}{" "}
                  estudiantes
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Origen
                  </p>
                  <div className="flex items-start gap-3 text-gray-800">
                    <span className="text-blue-600">
                      {icons.mapPin({ size: 18, strokeWidth: 2.2 })}
                    </span>
                    <p className="text-sm font-medium">{route?.origin}</p>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Destino
                  </p>
                  <div className="flex items-start gap-3 text-gray-800">
                    <span className="text-emerald-600">
                      {icons.navigation({ size: 18, strokeWidth: 2.2 })}
                    </span>
                    <p className="text-sm font-medium">{route?.destination}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-2">
                  Conductor asignado
                </p>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-gray-900">
                      {driver?.user_detail?.username ||
                        "Sin conductor asignado"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {driver?.user_detail?.email || "Sin correo disponible"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-gray-300">
                      Licencia
                    </p>
                    <p className="text-sm font-medium text-gray-700">
                      {driver?.license_number || "No disponible"}
                    </p>
                  </div>
                </div>
                {route?.id && (
                  <div className="mt-4 flex justify-end">
                    <Link
                      to={`/tracking/${route.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      Ver tracking en vivo
                    </Link>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-xs uppercase tracking-wide text-blue-500 font-semibold mb-2">
                  Estado de Recogida
                </p>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${
                      pickupStatus === "picked"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {pickupStatus === "picked"
                      ? "✓ Ya fuiste recogido"
                      : "✗ Aún no has sido recogido"}
                  </span>
                  <p className="text-xs text-gray-400">
                    {pickupStatus === "picked"
                      ? "Tu conductor te ha marcado como recogido."
                      : "Espera a que tu conductor te marque como recogido."}
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Tus compañeros de ruta
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Lista de estudiantes asignados al mismo trayecto
                  </p>
                </div>
              </div>

              {route?.passenger_details?.length > 0 ? (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {route.passenger_details.map((passenger) => (
                    <div
                      key={passenger.id}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {passenger.user_detail?.username ||
                            `Estudiante #${passenger.id}`}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {passenger.user_detail?.email ||
                            "Sin correo registrado"}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
                        {passenger.phone || "Sin teléfono"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                  No hay más estudiantes registrados en esta ruta.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

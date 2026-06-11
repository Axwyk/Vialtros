import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import Modal from "../components/Modal";
import { icons } from "../components/dashboard/icons";
import {
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getDrivers,
  getPassengers,
} from "../services/admin";
import { geocodeAddress, snapPointToRoad } from "../services/routing";
import LocationAutocomplete from "../components/LocationAutocomplete";

const EMPTY_FORM = {
  name: "",
  origin: "",
  destination: "",
  driver: "",
  passengers: [],
  origin_lat: null,
  origin_lng: null,
  destination_lat: null,
  destination_lng: null,
};

export default function AdminRoutesPage({ role, onLogout }) {
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [passengerListRoute, setPassengerListRoute] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const debounceRef = useRef(null);

  const load = useCallback((searchVal) => {
    setLoading(true);
    const params = searchVal ? { search: searchVal } : {};
    Promise.all([getRoutes(params), getDrivers(), getPassengers()])
      .then(([r, d, p]) => {
        setRoutes(r);
        setDrivers(d);
        setPassengers(p);
      })
      .catch(() => setError("No se pudo cargar los datos"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 350);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  };
  const openEdit = (r) => {
    setForm({
      name: r.name,
      origin: r.origin,
      destination: r.destination,
      driver: r.driver ?? "",
      passengers: r.passengers ?? [],
      origin_lat: r.origin_lat ?? null,
      origin_lng: r.origin_lng ?? null,
      destination_lat: r.destination_lat ?? null,
      destination_lng: r.destination_lng ?? null,
    });
    setFormError("");
    setModal(r);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }
    if (!form.origin.trim()) {
      setFormError("El origen es obligatorio");
      return;
    }
    if (!form.destination.trim()) {
      setFormError("El destino es obligatorio");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const originHadCoords =
        form.origin_lat != null && form.origin_lng != null;
      const destHadCoords =
        form.destination_lat != null && form.destination_lng != null;

      // Geocodificar en paralelo solo los campos sin coordenadas
      const [originResolved, destResolved] = await Promise.all([
        originHadCoords
          ? null
          : geocodeAddress(form.origin.trim()).catch(() => null),
        destHadCoords
          ? null
          : geocodeAddress(form.destination.trim()).catch(() => null),
      ]);

      let originLat = originHadCoords
        ? form.origin_lat
        : Array.isArray(originResolved)
          ? originResolved[0]
          : null;
      let originLng = originHadCoords
        ? form.origin_lng
        : Array.isArray(originResolved)
          ? originResolved[1]
          : null;
      let destLat = destHadCoords
        ? form.destination_lat
        : Array.isArray(destResolved)
          ? destResolved[0]
          : null;
      let destLng = destHadCoords
        ? form.destination_lng
        : Array.isArray(destResolved)
          ? destResolved[1]
          : null;

      // Snap solo si las coords se obtuvieron por geocoding (no por sugerencia)
      // Se ejecutan en paralelo
      const needSnapOrigin =
        !originHadCoords &&
        Number.isFinite(originLat) &&
        Number.isFinite(originLng);
      const needSnapDest =
        !destHadCoords &&
        Number.isFinite(destLat) &&
        Number.isFinite(destLng);

      const [snappedOrigin, snappedDest] = await Promise.all([
        needSnapOrigin
          ? snapPointToRoad([originLat, originLng]).catch(() => null)
          : null,
        needSnapDest
          ? snapPointToRoad([destLat, destLng]).catch(() => null)
          : null,
      ]);

      if (Array.isArray(snappedOrigin)) {
        originLat = snappedOrigin[0];
        originLng = snappedOrigin[1];
      }
      if (Array.isArray(snappedDest)) {
        destLat = snappedDest[0];
        destLng = snappedDest[1];
      }

      const payload = {
        ...form,
        driver: form.driver || null,
        passengers: form.passengers || [],
        origin_lat: originLat,
        origin_lng: originLng,
        destination_lat: destLat,
        destination_lng: destLng,
      };
      if (modal === "create") await createRoute(payload);
      else await updateRoute(modal.id, payload);
      setModal(null);
      load(search);
    } catch (e) {
      const d = e?.response?.data;
      setFormError(
        typeof d === "object" ? JSON.stringify(d) : "Error al guardar",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteRoute(confirmId);
    setConfirmId(null);
    load(search);
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const getRouteVal = (r, col) => {
    if (col === "driver") return r.driver_detail?.user_detail?.username ?? "";
    return r[col] ?? "";
  };

  const sorted = [...routes].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(getRouteVal(a, sortCol)).toLowerCase();
    const vb = String(getRouteVal(b, sortCol)).toLowerCase();
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const getPassengerPreview = (route) => {
    if (
      !Array.isArray(route.passenger_details) ||
      route.passenger_details.length === 0
    ) {
      return "Sin pasajeros";
    }

    const names = route.passenger_details
      .map((p) => p.user_detail?.username || `#${p.id}`)
      .filter(Boolean);

    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rutas</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gestiona las rutas escolares
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            {icons.routes({ size: 15 })}
            Nueva ruta
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, origen, destino..."
              value={search}
              onChange={handleSearchChange}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>
          {search && (
            <button
              onClick={() => { setSearch(""); load(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              Cargando...
            </div>
          ) : error ? (
            <div className="py-20 text-center text-red-500 text-sm">
              {error}
            </div>
          ) : routes.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No hay rutas registradas
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                  <th
                    onClick={() => toggleSort("name")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Nombre{" "}
                      {sortCol === "name" ? (
                        sortDir === "asc" ? (
                          "↑"
                        ) : (
                          "↓"
                        )
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("origin")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Origen{" "}
                      {sortCol === "origin" ? (
                        sortDir === "asc" ? (
                          "↑"
                        ) : (
                          "↓"
                        )
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("destination")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Destino{" "}
                      {sortCol === "destination" ? (
                        sortDir === "asc" ? (
                          "↑"
                        ) : (
                          "↓"
                        )
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </span>
                  </th>
                  <th
                    onClick={() => toggleSort("driver")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Conductor{" "}
                      {sortCol === "driver" ? (
                        sortDir === "asc" ? (
                          "↑"
                        ) : (
                          "↓"
                        )
                      ) : (
                        <span className="opacity-30">↕</span>
                      )}
                    </span>
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Pasajeros</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {r.name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{r.origin}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {r.destination}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {r.driver_detail?.user_detail?.username ||
                        (r.driver ? (
                          `#${r.driver}`
                        ) : (
                          <span className="text-gray-300">Sin asignar</span>
                        ))}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                        {r.passenger_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          to={`/tracking/${r.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                          Tracking
                        </Link>
                        <button
                          onClick={() => openEdit(r)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmId(r.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {routes.length} ruta{routes.length !== 1 ? "s" : ""} en total
        </p>
      </main>

      {modal && (
        <Modal
          title={modal === "create" ? "Nueva ruta" : `Editar: ${modal.name}`}
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-600">
              Nombre *
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="ej. Ruta Norte #1"
              />
            </label>
            <LocationAutocomplete
              label="Origen"
              required
              value={form.origin}
              onChange={(text) =>
                setForm((f) => ({ ...f, origin: text, origin_lat: null, origin_lng: null }))
              }
              onSelect={(place) =>
                setForm((f) => ({
                  ...f,
                  origin: place.address,
                  origin_lat: place.lat,
                  origin_lng: place.lng,
                }))
              }
              placeholder="ej. Colegio Central, Buenaventura"
            />
            <LocationAutocomplete
              label="Destino"
              required
              value={form.destination}
              onChange={(text) =>
                setForm((f) => ({ ...f, destination: text, destination_lat: null, destination_lng: null }))
              }
              onSelect={(place) =>
                setForm((f) => ({
                  ...f,
                  destination: place.address,
                  destination_lat: place.lat,
                  destination_lng: place.lng,
                }))
              }
              placeholder="ej. Sector Los Pinos, Buenaventura"
            />
            <label className="text-xs font-medium text-gray-600">
              Conductor (opcional)
              <select
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.driver}
                onChange={(e) =>
                  setForm((f) => ({ ...f, driver: e.target.value }))
                }
              >
                <option value="">Sin asignar</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user_detail?.username || `Conductor #${d.id}`} —{" "}
                    {d.license_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Pasajeros asignados
              <select
                multiple
                className="mt-1 block w-full h-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.passengers}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    passengers: Array.from(e.target.selectedOptions, (option) =>
                      Number(option.value),
                    ),
                  }))
                }
              >
                {passengers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user_detail?.username || `Pasajero #${p.id}`} —{" "}
                    {p.user_detail?.email || p.phone}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-full">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">
                Eliminar ruta
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              ¿Confirmas que quieres eliminar esta ruta? La acción no se puede
              deshacer.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition"
              >
                Sí, eliminar
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {passengerListRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setPassengerListRoute(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Pasajeros de {passengerListRoute.name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {passengerListRoute.passenger_details?.length || 0} asignados
                </p>
              </div>
              <button
                onClick={() => setPassengerListRoute(null)}
                className="text-sm text-gray-400 hover:text-gray-600 transition"
              >
                Cerrar
              </button>
            </div>

            {passengerListRoute.passenger_details?.length > 0 ? (
              <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                {passengerListRoute.passenger_details.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {p.user_detail?.username || `Pasajero #${p.id}`}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.user_detail?.email || p.phone || "Sin contacto"}
                      </p>
                    </div>
                    {p.phone && (
                      <span className="text-xs font-mono text-gray-500">
                        {p.phone}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No hay pasajeros en esta ruta.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

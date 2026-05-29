import React, { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import Modal from "../components/Modal";
import { icons } from "../components/dashboard/icons";
import {
  getPassengers,
  createPassenger,
  updatePassenger,
  deletePassenger,
  getUsers,
  getRoutes,
  assignPassengerToRoute,
  removePassengerFromRoute,
} from "../services/admin";
import { getDriverTrackings } from "../services/dashboard";
import { geocodeAddress, snapPointToRoad } from "../services/routing";

const EMPTY_FORM = {
  user: "",
  phone: "",
  routeId: "",
  pickupAddress: "",
  pickupLat: null,
  pickupLng: null,
};

export default function AdminPassengersPage({ role, onLogout }) {
  const [passengers, setPassengers] = useState([]);
  const [users, setUsers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trackings, setTrackings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const debounceRef = useRef(null);

  const load = useCallback((searchVal) => {
    setLoading(true);
    const params = searchVal ? { search: searchVal } : {};
    Promise.all([
      getPassengers(params),
      getUsers(),
      getRoutes(),
      getDriverTrackings(),
    ])
      .then(([p, u, r, t]) => {
        setPassengers(p);
        setUsers(u);
        setRoutes(r);
        setTrackings(t);
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

  const getPassengerRoute = (passengerId) =>
    routes.find(
      (r) => Array.isArray(r.passengers) && r.passengers.includes(passengerId),
    );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  };
  const openEdit = (p) => {
    setForm({
      user: p.user,
      phone: p.phone,
      routeId: getPassengerRoute(p.id)?.id ?? "",
      pickupAddress: p.pickup_address ?? "",
      pickupLat: p.pickup_lat ?? null,
      pickupLng: p.pickup_lng ?? null,
    });
    setFormError("");
    setModal(p);
  };

  const syncPassengerRoute = async (passengerId, nextRouteId) => {
    const currentRoute = getPassengerRoute(passengerId);
    const currentRouteId = currentRoute ? String(currentRoute.id) : "";
    const targetRouteId = String(nextRouteId || "");

    if (currentRouteId && currentRouteId !== targetRouteId) {
      await removePassengerFromRoute(currentRouteId, passengerId);
    }
    if (targetRouteId && currentRouteId !== targetRouteId) {
      await assignPassengerToRoute(targetRouteId, passengerId);
    }
  };

  const handleSave = async () => {
    if (!form.user) {
      setFormError("El usuario es obligatorio");
      return;
    }
    if (!form.phone.trim()) {
      setFormError("El teléfono es obligatorio");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      let pickupLat = form.pickupLat;
      let pickupLng = form.pickupLng;

      if (form.pickupAddress.trim()) {
        if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
          const resolved = await geocodeAddress(
            form.pickupAddress.trim(),
          ).catch(() => null);
          if (!Array.isArray(resolved)) {
            setFormError(
              "No se pudo ubicar la parada intermedia. Ajusta la direccion de recogida.",
            );
            setSaving(false);
            return;
          }

          const snapped = await snapPointToRoad(resolved).catch(() => resolved);
          pickupLat = snapped[0];
          pickupLng = snapped[1];
        }
      } else {
        pickupLat = null;
        pickupLng = null;
      }

      const payload = {
        phone: form.phone,
        pickup_address: form.pickupAddress.trim(),
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
      };

      if (modal === "create") {
        const created = await createPassenger({ user: form.user, ...payload });
        await syncPassengerRoute(created.id, form.routeId);
      } else {
        await updatePassenger(modal.id, payload);
        await syncPassengerRoute(modal.id, form.routeId);
      }
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
    await deletePassenger(confirmId);
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

  const getVal = (p, col) => {
    if (col === "username") return p.user_detail?.username ?? "";
    if (col === "email") return p.user_detail?.email ?? "";
    if (col === "phone") return p.phone ?? "";
    if (col === "route") return getPassengerRoute(p.id)?.name ?? "";
    return "";
  };

  const sorted = [...passengers].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(getVal(a, sortCol)).toLowerCase();
    const vb = String(getVal(b, sortCol)).toLowerCase();
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const existingUserIds = passengers.map((p) => p.user);
  const availableUsers = users.filter(
    (u) => u.role === "user" && !existingUserIds.includes(u.id),
  );

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Estudiantes</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Registro de estudiantes y rutas asignadas
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            {icons.addUser({ size: 15 })}
            Nuevo estudiante
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
              placeholder="Buscar por nombre, email, telefono, direccion..."
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
          ) : passengers.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No hay estudiantes registrados
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                  <th
                    onClick={() => toggleSort("username")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Usuario{" "}
                      {sortCol === "username" ? (
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
                    onClick={() => toggleSort("email")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Email{" "}
                      {sortCol === "email" ? (
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
                    onClick={() => toggleSort("phone")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Teléfono{" "}
                      {sortCol === "phone" ? (
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
                    onClick={() => toggleSort("route")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      Ruta asignada{" "}
                      {sortCol === "route" ? (
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
                  <th className="text-left px-5 py-3 font-medium">
                    Parada intermedia
                  </th>
                  <th className="text-left px-5 py-3 font-medium">
                    Estado de Recogida
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((p) => {
                  const assignedRoute = getPassengerRoute(p.id);
                  const passengerTracking = trackings.find(
                    (t) => Number(t.passenger) === Number(p.id),
                  );
                  const pickupStatus =
                    passengerTracking?.status || "not_picked";
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {p.user_detail?.username || `#${p.user}`}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {p.user_detail?.email || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 font-mono text-xs">
                        {p.phone}
                      </td>
                      <td className="px-5 py-3.5">
                        {assignedRoute ? (
                          <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                            {assignedRoute.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {p.pickup_address || "Sin definir"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                            pickupStatus === "picked"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {pickupStatus === "picked"
                            ? "✓ Recogido"
                            : "✗ No recogido"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setConfirmId(p.id)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {passengers.length} estudiante{passengers.length !== 1 ? "s" : ""} en
          total
        </p>
      </main>

      {modal && (
        <Modal
          title={
            modal === "create"
              ? "Nuevo estudiante"
              : `Editar: ${modal.user_detail?.username || ""}`
          }
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-600">
              Usuario (rol: user) *
              <select
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.user}
                onChange={(e) =>
                  setForm((f) => ({ ...f, user: e.target.value }))
                }
                disabled={modal !== "create"}
              >
                <option value="">Seleccionar...</option>
                {(modal === "create"
                  ? availableUsers
                  : users.filter(
                      (u) => u.id === form.user || u.id === Number(form.user),
                    )
                ).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Teléfono *
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="ej. 600 123 456"
              />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Ruta asignada
              <select
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.routeId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, routeId: e.target.value }))
                }
              >
                <option value="">Sin asignar</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Parada intermedia
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.pickupAddress}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pickupAddress: e.target.value,
                    pickupLat: null,
                    pickupLng: null,
                  }))
                }
                placeholder="ej. Bellavista, Buenaventura"
              />
            </label>
            <p className="text-[11px] text-gray-400">
              Si defines una parada, se geocodifica y se usa como waypoint real
              de la ruta.
            </p>
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
                Eliminar estudiante
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              ¿Confirmas que quieres eliminar este estudiante? La acción no se
              puede deshacer.
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
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import Modal from "../components/Modal";
import { icons } from "../components/dashboard/icons";
import {
  getDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
} from "../services/admin";
import { getUsers } from "../services/admin";

const EMPTY_FORM = { user: "", license_number: "" };

export default function AdminDriversPage({ role, onLogout }) {
  const [drivers, setDrivers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getDrivers(), getUsers()])
      .then(([d, u]) => {
        setDrivers(d);
        setUsers(u);
      })
      .catch(() => setError("No se pudo cargar los datos"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModal("create");
  };
  const openEdit = (d) => {
    setForm({ user: d.user, license_number: d.license_number });
    setFormError("");
    setModal(d);
  };

  const handleSave = async () => {
    if (!form.user) {
      setFormError("Selecciona un usuario");
      return;
    }
    if (!form.license_number.trim()) {
      setFormError("La licencia es obligatoria");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (modal === "create") await createDriver(form);
      else await updateDriver(modal.id, form);
      setModal(null);
      load();
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
    await deleteDriver(confirmId);
    setConfirmId(null);
    load();
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const getDriverVal = (d, col) => {
    if (col === "username") return d.user_detail?.username ?? "";
    if (col === "email") return d.user_detail?.email ?? "";
    return d[col] ?? "";
  };

  const sorted = [...drivers].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(getDriverVal(a, sortCol)).toLowerCase();
    const vb = String(getDriverVal(b, sortCol)).toLowerCase();
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  // Solo usuarios con role=driver que no sean ya conductores
  const existingUserIds = drivers.map((d) => d.user);
  const availableUsers = users.filter(
    (u) => u.role === "driver" && !existingUserIds.includes(u.id),
  );

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Conductores</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Gestiona los conductores registrados
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            {icons.addUser({ size: 15 })}
            Nuevo conductor
          </button>
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
          ) : drivers.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No hay conductores registrados
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
                    onClick={() => toggleSort("license_number")}
                    className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600"
                  >
                    <span className="flex items-center gap-1">
                      N° Licencia{" "}
                      {sortCol === "license_number" ? (
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
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {d.user_detail?.username || `#${d.user}`}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {d.user_detail?.email || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 font-mono text-xs">
                      {d.license_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmId(d.id)}
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
          {drivers.length} conductor{drivers.length !== 1 ? "es" : ""} en total
        </p>
      </main>

      {modal && (
        <Modal
          title={modal === "create" ? "Nuevo conductor" : `Editar conductor`}
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-600">
              Usuario (rol: driver) *
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
              N° de licencia *
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.license_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, license_number: e.target.value }))
                }
                placeholder="ej. LIC-0012345"
              />
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
                Eliminar conductor
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              ¿Confirmas que quieres eliminar este conductor? La acción no se
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

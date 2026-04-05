import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '../components/dashboard/Sidebar';
import Modal from '../components/Modal';
import { icons } from '../components/dashboard/icons';
import { getUsers, createUser, updateUser, deleteUser } from '../services/admin';

const ROLES = ['admin', 'driver', 'user'];
const EMPTY_FORM = { username: '', email: '', role: 'user', password: '', is_active: true };

function Badge({ role }) {
  const map = {
    admin:  'bg-violet-100 text-violet-700',
    driver: 'bg-blue-100 text-blue-700',
    user:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${map[role] || map.user}`}>
      {role}
    </span>
  );
}

export default function AdminUsersPage({ role, onLogout }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [modal, setModal]     = useState(null); // null | 'create' | {user}
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmId, setConfirmId]     = useState(null); // id a eliminar
  const [sortCol, setSortCol]         = useState(null);
  const [sortDir, setSortDir]         = useState('asc');
  const [selected, setSelected]       = useState(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(() => setError('No se pudo cargar la lista de usuarios'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowPassword(false);
    setModal('create');
  };

  const openEdit = (u) => {
    setForm({ username: u.username, email: u.email, role: u.role, password: '', is_active: u.is_active });
    setFormError('');
    setShowPassword(false);
    setModal(u);
  };

  const handleSave = async () => {
    if (!form.username.trim()) { setFormError('El nombre de usuario es obligatorio'); return; }
    if (modal === 'create' && !form.password) { setFormError('La contraseña es obligatoria'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (modal === 'create') {
        await createUser(payload);
      } else {
        await updateUser(modal.id, payload);
      }
      setModal(null);
      load();
    } catch (e) {
      const detail = e?.response?.data;
      setFormError(typeof detail === 'object' ? JSON.stringify(detail) : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteUser(confirmId);
    setConfirmId(null);
    load();
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...users].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(a[sortCol] ?? '').toLowerCase();
    const vb = String(b[sortCol] ?? '').toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const allSelected = sorted.length > 0 && sorted.every(u => selected.has(u.id));
  const toggleAll = () => {
    allSelected ? setSelected(new Set()) : setSelected(new Set(sorted.map(u => u.id)));
  };
  const toggleOne = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const handleBulkDelete = async () => {
    await Promise.all([...selected].map(id => deleteUser(id)));
    setSelected(new Set());
    setConfirmBulk(false);
    load();
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gestiona los usuarios del sistema</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            {icons.addUser({ size: 15 })}
            Nuevo usuario
          </button>
        </div>

        {/* Selección múltiple */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="text-sm text-gray-500">
              {selected.size} usuario{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-600 transition"
            >
              Eliminar seleccionados
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600 transition">
              Deseleccionar todo
            </button>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Cargando...</div>
          ) : error ? (
            <div className="py-20 text-center text-red-500 text-sm">{error}</div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">No hay usuarios registrados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                  <th className="px-5 py-3 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded cursor-pointer" />
                  </th>
                  <th onClick={() => toggleSort('username')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Usuario {sortCol === 'username' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('email')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Email {sortCol === 'email' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('role')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Rol {sortCol === 'role' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('is_active')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Estado {sortCol === 'is_active' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(u => (
                  <tr key={u.id} className={`transition-colors ${selected.has(u.id) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>
                    <td className="px-5 py-3.5 w-10">
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} className="rounded cursor-pointer" />
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-900">{u.username}</td>
                    <td className="px-5 py-3.5 text-gray-500">{u.email || '—'}</td>
                    <td className="px-5 py-3.5"><Badge role={u.role} /></td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">Editar</button>
                        <button onClick={() => setConfirmId(u.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-sm text-gray-400 mt-3">{users.length} usuario{users.length !== 1 ? 's' : ''} en total</p>
      </main>

      {/* Modal */}
      {modal && (
        <Modal
          title={modal === 'create' ? 'Nuevo usuario' : `Editar: ${modal.username}`}
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-600">Usuario *
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-gray-600">Email
              <input
                type="email"
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-gray-600">Rol
              <select
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-600">
                Contraseña {modal !== 'create' && <span className="text-gray-400">(dejar vacío para no cambiar)</span>}
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer mt-0.5">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={e => setShowPassword(e.target.checked)}
                  className="rounded"
                />
                Mostrar contraseña
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              Usuario activo
            </label>
            {formError && <p className="text-sm text-red-500">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal confirmación eliminar */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Eliminar usuario</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Esta acción no se puede deshacer. ¿Confirmas que quieres eliminar este usuario?</p>
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
      {/* Modal confirmación eliminar múltiple */}
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-100 p-2 rounded-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Eliminar {selected.size} usuario{selected.size !== 1 ? 's' : ''}</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">Esta acción no se puede deshacer. ¿Confirmas que quieres eliminar los {selected.size} usuarios seleccionados?</p>
            <div className="flex gap-2">
              <button onClick={handleBulkDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition">
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmBulk(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

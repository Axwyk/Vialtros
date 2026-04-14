import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/dashboard/Sidebar';
import Modal from '../components/Modal';
import { icons } from '../components/dashboard/icons';
import { getRoutes, createRoute, updateRoute, deleteRoute, getDrivers, getPassengers } from '../services/admin';
import { searchBuenaventuraPlaces, geocodeAddress } from '../services/routing';

const EMPTY_FORM = { name: '', origin: '', destination: '', driver: '', passengers: [], origin_lat: null, origin_lng: null, destination_lat: null, destination_lng: null };

export default function AdminRoutesPage({ role, onLogout }) {
  const [routes, setRoutes]   = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [modal, setModal]     = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [passengerListRoute, setPassengerListRoute] = useState(null);
  const [sortCol, setSortCol]     = useState(null);
  const [sortDir, setSortDir]     = useState('asc');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [originSuggestionsOpen, setOriginSuggestionsOpen] = useState(false);
  const [originSuggestionsEnabled, setOriginSuggestionsEnabled] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [destinationSuggestionsOpen, setDestinationSuggestionsOpen] = useState(false);
  const [destinationSuggestionsEnabled, setDestinationSuggestionsEnabled] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getRoutes(), getDrivers(), getPassengers()])
      .then(([r, d, p]) => { setRoutes(r); setDrivers(d); setPassengers(p); })
      .catch(() => setError('No se pudo cargar los datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setOriginSuggestions([]);
    setOriginSuggestionsOpen(false);
    setOriginSuggestionsEnabled(false);
    setDestinationSuggestions([]);
    setDestinationSuggestionsOpen(false);
    setDestinationSuggestionsEnabled(false);
    setModal('create');
  };
  const openEdit   = (r) => {
    setForm({ name: r.name, origin: r.origin, destination: r.destination, driver: r.driver ?? '', passengers: r.passengers ?? [], origin_lat: r.origin_lat ?? null, origin_lng: r.origin_lng ?? null, destination_lat: r.destination_lat ?? null, destination_lng: r.destination_lng ?? null });
    setFormError('');
    setOriginSuggestions([]);
    setOriginSuggestionsOpen(false);
    setOriginSuggestionsEnabled(false);
    setDestinationSuggestions([]);
    setDestinationSuggestionsOpen(false);
    setDestinationSuggestionsEnabled(false);
    setModal(r);
  };

  useEffect(() => {
    if (!modal || !originSuggestionsEnabled) return undefined;

    const originValue = form.origin?.trim() || '';
    if (originValue.length < 2) {
      setOriginSuggestions([]);
      setOriginSuggestionsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timerId = setTimeout(() => {
      searchBuenaventuraPlaces(originValue)
        .then((results) => {
          if (!cancelled) {
            setOriginSuggestions(results);
            setOriginSuggestionsOpen(results.length > 0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOriginSuggestions([]);
            setOriginSuggestionsOpen(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [form.origin, modal, originSuggestionsEnabled]);

  useEffect(() => {
    if (!modal || !destinationSuggestionsEnabled) return undefined;

    const destinationValue = form.destination?.trim() || '';
    if (destinationValue.length < 2) {
      setDestinationSuggestions([]);
      setDestinationSuggestionsOpen(false);
      return undefined;
    }

    let cancelled = false;
    const timerId = setTimeout(() => {
      searchBuenaventuraPlaces(destinationValue)
        .then((results) => {
          if (!cancelled) {
            setDestinationSuggestions(results);
            setDestinationSuggestionsOpen(results.length > 0);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDestinationSuggestions([]);
            setDestinationSuggestionsOpen(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [form.destination, modal, destinationSuggestionsEnabled]);

  const handleSave = async () => {
    if (!form.name.trim())        { setFormError('El nombre es obligatorio'); return; }
    if (!form.origin.trim())      { setFormError('El origen es obligatorio'); return; }
    if (!form.destination.trim()) { setFormError('El destino es obligatorio'); return; }
    setSaving(true); setFormError('');
    try {
      // Resolve coordinates if not already set (user typed manually without selecting a suggestion)
      let originLat = form.origin_lat;
      let originLng = form.origin_lng;
      let destLat = form.destination_lat;
      let destLng = form.destination_lng;

      if (originLat == null || originLng == null) {
        const resolved = await geocodeAddress(form.origin.trim()).catch(() => null);
        if (Array.isArray(resolved)) { originLat = resolved[0]; originLng = resolved[1]; }
      }
      if (destLat == null || destLng == null) {
        const resolved = await geocodeAddress(form.destination.trim()).catch(() => null);
        if (Array.isArray(resolved)) { destLat = resolved[0]; destLng = resolved[1]; }
      }

      const payload = { ...form, driver: form.driver || null, passengers: form.passengers || [], origin_lat: originLat, origin_lng: originLng, destination_lat: destLat, destination_lng: destLng };
      if (modal === 'create') await createRoute(payload);
      else await updateRoute(modal.id, payload);
      setModal(null); load();
    } catch (e) {
      const d = e?.response?.data;
      setFormError(typeof d === 'object' ? JSON.stringify(d) : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    await deleteRoute(confirmId);
    setConfirmId(null);
    load();
  };

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const getRouteVal = (r, col) => {
    if (col === 'driver') return r.driver_detail?.user_detail?.username ?? '';
    return r[col] ?? '';
  };

  const sorted = [...routes].sort((a, b) => {
    if (!sortCol) return 0;
    const va = String(getRouteVal(a, sortCol)).toLowerCase();
    const vb = String(getRouteVal(b, sortCol)).toLowerCase();
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const getPassengerPreview = (route) => {
    if (!Array.isArray(route.passenger_details) || route.passenger_details.length === 0) {
      return 'Sin pasajeros';
    }

    const names = route.passenger_details
      .map(p => p.user_detail?.username || `#${p.id}`)
      .filter(Boolean);

    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  };

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      <Sidebar role={role} onLogout={onLogout} />
      <main className="flex-1 min-w-0 py-8 px-6 md:px-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Rutas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Gestiona las rutas escolares</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
          >
            {icons.routes({ size: 15 })}
            Nueva ruta
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Cargando...</div>
          ) : error ? (
            <div className="py-20 text-center text-red-500 text-sm">{error}</div>
          ) : routes.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">No hay rutas registradas</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                  <th onClick={() => toggleSort('name')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Nombre {sortCol === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('origin')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Origen {sortCol === 'origin' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('destination')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Destino {sortCol === 'destination' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th onClick={() => toggleSort('driver')} className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-gray-600">
                    <span className="flex items-center gap-1">Conductor {sortCol === 'driver' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="opacity-30">↕</span>}</span>
                  </th>
                  <th className="text-left px-5 py-3 font-medium">Pasajeros</th>
                  <th className="text-left px-5 py-3 font-medium">Resumen</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{r.name}</td>
                    <td className="px-5 py-3.5 text-gray-500">{r.origin}</td>
                    <td className="px-5 py-3.5 text-gray-500">{r.destination}</td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {r.driver_detail?.user_detail?.username || (r.driver ? `#${r.driver}` : <span className="text-gray-300">Sin asignar</span>)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                        {r.passenger_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 truncate max-w-[190px]" title={getPassengerPreview(r)}>
                          {getPassengerPreview(r)}
                        </span>
                        {r.passenger_details?.length > 0 && (
                          <button
                            onClick={() => setPassengerListRoute(r)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                          >
                            Ver lista
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/tracking/${r.id}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">Tracking</Link>
                        <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">Editar</button>
                        <button onClick={() => setConfirmId(r.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">{routes.length} ruta{routes.length !== 1 ? 's' : ''} en total</p>
      </main>

      {modal && (
        <Modal
          title={modal === 'create' ? 'Nueva ruta' : `Editar: ${modal.name}`}
          onClose={() => setModal(null)}
        >
          <div className="flex flex-col gap-3">
            <label className="text-xs font-medium text-gray-600">Nombre *
              <input
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ej. Ruta Norte #1"
              />
            </label>
            <label className="text-xs font-medium text-gray-600">Origen *
              <div className="relative mt-1">
                <input
                  className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.origin}
                  onChange={e => {
                    setForm(f => ({ ...f, origin: e.target.value, origin_lat: null, origin_lng: null }));
                    setOriginSuggestionsEnabled(true);
                  }}
                  placeholder="ej. Colegio Central"
                  autoComplete="off"
                />
                {originSuggestionsOpen && originSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-100/70">
                    {originSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.source}-${suggestion.label}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setForm((current) => ({ ...current, origin: suggestion.label, origin_lat: suggestion.coords?.[0] ?? null, origin_lng: suggestion.coords?.[1] ?? null }));
                          setOriginSuggestionsEnabled(false);
                          setOriginSuggestionsOpen(false);
                        }}
                        className="flex w-full items-start justify-between gap-3 border-b border-blue-50 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">{suggestion.label}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{suggestion.subtitle}</span>
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                          {suggestion.source === 'local' ? 'Local' : 'Mapa'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="text-xs font-medium text-gray-600">Destino *
              <div className="relative mt-1">
                <input
                  className="block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={form.destination}
                  onChange={e => {
                    setForm(f => ({ ...f, destination: e.target.value, destination_lat: null, destination_lng: null }));
                    setDestinationSuggestionsEnabled(true);
                  }}
                  placeholder="ej. Sector Los Pinos"
                  autoComplete="off"
                />
                {destinationSuggestionsOpen && destinationSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-blue-100 bg-white shadow-xl shadow-blue-100/70">
                    {destinationSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.source}-${suggestion.label}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setForm((current) => ({ ...current, destination: suggestion.label, destination_lat: suggestion.coords?.[0] ?? null, destination_lng: suggestion.coords?.[1] ?? null }));
                          setDestinationSuggestionsEnabled(false);
                          setDestinationSuggestionsOpen(false);
                        }}
                        className="flex w-full items-start justify-between gap-3 border-b border-blue-50 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-blue-50"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">{suggestion.label}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{suggestion.subtitle}</span>
                        </span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700">
                          {suggestion.source === 'local' ? 'Local' : 'Mapa'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="text-xs font-medium text-gray-600">Conductor (opcional)
              <select
                className="mt-1 block w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.driver}
                onChange={e => setForm(f => ({ ...f, driver: e.target.value }))}
              >
                <option value="">Sin asignar</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.user_detail?.username || `Conductor #${d.id}`} — {d.license_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">Pasajeros asignados
              <select
                multiple
                className="mt-1 block w-full h-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.passengers}
                onChange={e => setForm(f => ({
                  ...f,
                  passengers: Array.from(e.target.selectedOptions, option => Number(option.value)),
                }))}
              >
                {passengers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.user_detail?.username || `Pasajero #${p.id}`} — {p.user_detail?.email || p.phone}
                  </option>
                ))}
              </select>
            </label>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
              </div>
              <h3 className="text-base font-semibold text-gray-900">Eliminar ruta</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">¿Confirmas que quieres eliminar esta ruta? La acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm font-semibold transition">Sí, eliminar</button>
              <button onClick={() => setConfirmId(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {passengerListRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPassengerListRoute(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Pasajeros de {passengerListRoute.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{passengerListRoute.passenger_details?.length || 0} asignados</p>
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
                {passengerListRoute.passenger_details.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.user_detail?.username || `Pasajero #${p.id}`}</p>
                      <p className="text-xs text-gray-400">{p.user_detail?.email || p.phone || 'Sin contacto'}</p>
                    </div>
                    {p.phone && <span className="text-xs font-mono text-gray-500">{p.phone}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No hay pasajeros en esta ruta.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

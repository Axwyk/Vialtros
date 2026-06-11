import React, { useState, useEffect, useRef, useCallback } from "react";
import SectionCard from "../components/dashboard/SectionCard";
import { getCurrentUser, updateCurrentUser, getUserCache, saveUserCache } from "../services/auth";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Usuario&background=2563eb&color=fff&size=128&rounded=true";

function normalizeName(value) {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "")
    .filter(Boolean)
    .join(" ");
}

export default function ProfileScreen() {
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const [photoSavedMsg, setPhotoSavedMsg] = useState("");
  const [user, setUser] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef();

  const getUserIdKey = (u, token) => {
    if (u && u.id) return String(u.id);
    if (u && u.username) return String(u.username).toLowerCase();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.id) return String(payload.id);
        if (payload.username) return String(payload.username).toLowerCase();
      } catch {}
    }
    return (localStorage.getItem("username") || "default").toLowerCase();
  };

  const applyUserData = useCallback((u, token) => {
    if (!u) return;
    const usernameRaw = localStorage.getItem("username") || u.username || "";
    const username = usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1);
    const userData = {
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      username,
      email: u.email || "",
      phone_number: u.phone_number || "",
    };
    setUser(userData);
    setEditData(userData);
    const userIdKey = getUserIdKey(u, token);
    const saved = localStorage.getItem(`profileImage_${userIdKey}`);
    setAvatar(saved || DEFAULT_AVATAR);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access");

    // Carga instantánea desde caché
    const cached = getUserCache();
    if (cached) applyUserData(cached, token);

    // Refresco en background desde la API
    getCurrentUser().then((u) => {
      if (!u) return;
      saveUserCache(u);
      applyUserData(u, token);
    });
  }, [applyUserData]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const token = localStorage.getItem("access");
    getCurrentUser().then((u) => {
      const userIdKey = getUserIdKey(u, token);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatar(ev.target.result);
        localStorage.setItem(`profileImage_${userIdKey}`, ev.target.result);
        setPhotoSavedMsg("Foto guardada correctamente");
        setTimeout(() => setPhotoSavedMsg(""), 2000);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInputChange = (field) => (e) =>
    setEditData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);
    try {
      const normalizedFirst = normalizeName(editData.first_name || "");
      const normalizedLast = normalizeName(editData.last_name || "");
      await updateCurrentUser({
        first_name: normalizedFirst,
        last_name: normalizedLast,
        email: editData.email || "",
        phone_number: editData.phone_number || "",
      });
      setEditData((ed) => ({ ...ed, first_name: normalizedFirst, last_name: normalizedLast }));
      setUser({ ...editData });
      saveUserCache({ ...editData });
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditData({ ...user });
    setEditMode(false);
    setSaveError("");
  };

  const displayName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username ||
    "Sin nombre";

  return (
    <div className="w-full flex justify-center px-4 py-10">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-14 flex flex-col items-center w-full min-w-[350px] max-w-[600px] relative">
        <button
          className="absolute top-6 right-6 text-3xl text-gray-400 hover:text-gray-700 focus:outline-none"
          title="Cerrar"
          onClick={() => window.history.back()}
        >
          ×
        </button>
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Mi Perfil</h2>
        <p className="text-gray-500 text-center mb-8">Actualiza tu foto e información personal.</p>

        {/* Avatar */}
        <div className="relative mb-10 flex flex-col items-center">
          <img
            src={avatar}
            alt="Avatar"
            className="w-[120px] h-[120px] md:w-[150px] md:h-[150px] rounded-full object-cover border-4 border-blue-200 shadow-lg"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-md focus:outline-none"
            title="Cambiar foto"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          {photoSavedMsg && (
            <span className="mt-3 text-green-600 text-sm font-semibold">{photoSavedMsg}</span>
          )}
        </div>

        {/* Campos */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10">
          <SectionCard
            label="Nombre"
            value={editMode ? `${editData.first_name} ${editData.last_name}`.trim() : displayName}
            editable={editMode}
            onChange={(e) => {
              const [first, ...rest] = e.target.value.split(" ");
              setEditData((ed) => ({ ...ed, first_name: first || "", last_name: rest.join(" ") }));
            }}
          />
          <SectionCard
            label="Correo"
            value={editMode ? editData.email : user.email}
            editable={editMode}
            onChange={handleInputChange("email")}
            type="email"
          />
          <SectionCard
            label="Teléfono"
            value={editMode ? editData.phone_number : (user.phone_number || "Sin especificar")}
            editable={editMode}
            onChange={handleInputChange("phone_number")}
            type="tel"
          />
        </div>

        {saveError && (
          <p className="text-red-500 text-sm mb-4 text-center">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-green-600 text-sm mb-4 text-center font-semibold">Cambios guardados correctamente.</p>
        )}

        {/* Botones */}
        <div className="w-full flex flex-col gap-4">
          {!editMode ? (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
              onClick={() => setEditMode(true)}
            >
              Editar perfil
            </button>
          ) : (
            <>
              <button
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

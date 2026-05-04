import React, { useState, useEffect, useRef } from "react";
import SectionCard from "../components/dashboard/SectionCard";
import { getCurrentUser } from "../services/auth";

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?name=Usuario&background=2563eb&color=fff&size=128&rounded=true";


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
  const [editData, setEditData] = useState({ ...user });
  const fileInputRef = useRef();

  // Función para obtener el userId único y consistente
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
    const usernameRaw = localStorage.getItem("username") || "default";
    return String(usernameRaw).toLowerCase();
  };

  useEffect(() => {
    // Obtener nombre real desde el token JWT
    const token = localStorage.getItem("token");
    let nombreToken = "";
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const fn = payload.first_name || "";
        const ln = payload.last_name || "";
        nombreToken = (fn + " " + ln).trim();
      } catch (e) {
        nombreToken = "";
      }
    }
    // Obtener nombre de usuario del dashboard (localStorage)
    const usernameRaw = localStorage.getItem("username") || "";
    const username = usernameRaw.charAt(0).toUpperCase() + usernameRaw.slice(1);
    getCurrentUser().then((u) => {
      let nombreDB = "";
      if (u) {
        nombreDB = ((u.first_name || "") + " " + (u.last_name || "")).trim();
        setUser({
          first_name: nombreToken,
          last_name: nombreDB,
          username: username,
          email: u.email || u.username || "",
          phone_number: u.phone_number || "",
        });
        setEditData((prev) => ({
          ...prev,
          first_name: nombreToken,
          last_name: nombreDB,
          username: username,
        }));
        // Imagen de perfil específica por usuario (clave consistente)
        const userIdKey = getUserIdKey(u, token);
        const key = `profileImage_${userIdKey}`;
        const saved = localStorage.getItem(key);
        if (saved) setAvatar(saved);
        else setAvatar(DEFAULT_AVATAR);
      } else {
        setUser((prev) => ({ ...prev, first_name: nombreToken, last_name: "", username: username }));
        setEditData((prev) => ({ ...prev, first_name: nombreToken, last_name: "", username: username }));
        setAvatar(DEFAULT_AVATAR);
      }
      setPhotoSavedMsg(""); // Limpiar mensaje al cargar
    });
  }, []);

  // Manejar selección de imagen y guardado persistente
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const token = localStorage.getItem("token");
    getCurrentUser().then((u) => {
      const userIdKey = getUserIdKey(u, token);
      const key = `profileImage_${userIdKey}`;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatar(ev.target.result);
        localStorage.setItem(key, ev.target.result);
        setPhotoSavedMsg("Foto guardada correctamente");
        setTimeout(() => setPhotoSavedMsg(""), 2000);
      };
      reader.readAsDataURL(file);
    });
  };

  // Manejar cambios en inputs
  const handleInputChange = (field) => (e) => {
    setEditData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Guardar cambios
  const handleSave = () => {
    setUser({ ...editData });
    setEditMode(false);
    // (Opcional) Guardar en localStorage
    localStorage.setItem("profile_user", JSON.stringify(editData));
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditData({ ...user });
    setEditMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-14 flex flex-col items-center w-full max-w-2xl min-w-[350px] md:min-w-[500px] max-w-[600px] relative">
        {/* Botón de salida */}
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
            <span className="mt-3 text-green-600 text-sm font-semibold animate-fade-in">{photoSavedMsg}</span>
          )}
        </div>
        {/* Bloques de información */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10">
          <SectionCard
            label="Nombre"
            value={
              editMode
                ? (editData.first_name || "") + (editData.last_name ? " " + editData.last_name : "")
                : ((user.first_name && user.first_name.trim() !== "") || (user.last_name && user.last_name.trim() !== "") || (user.username && user.username.trim() !== ""))
                  ? [user.first_name, user.last_name, user.username].filter(Boolean).join(" / ")
                  : "Sin nombre"
            }
            editable={editMode}
            onChange={e => {
              const [first, ...rest] = e.target.value.split(" ");
              setEditData(ed => ({ ...ed, first_name: first, last_name: rest.join(" ") }));
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
            value={editMode ? editData.phone_number : user.phone_number}
            editable={editMode}
            onChange={handleInputChange("phone_number")}
            type="tel"
          />
        </div>
        {/* Botones de acción */}
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleSave}
              >
                Guardar cambios
              </button>
              <button
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold w-full py-3 rounded-lg shadow transition-all text-lg"
                onClick={handleCancel}
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

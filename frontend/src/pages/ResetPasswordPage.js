import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LogoIcon } from "../components/Logo";
import { resetPassword } from "../services/api";

const LOGIN_FEATURES = [
  "Ubicación en tiempo real del vehículo",
  "Notificaciones de llegada y salida",
  "Historial de rutas completadas",
];

const IconLock = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function getStrength(password) {
  if (password.length === 0) return null;
  if (password.length < 8) return "débil";
  if (password.length < 12) return "media";
  return "fuerte";
}

const STRENGTH_STYLES = {
  débil: { bar: "w-1/3 bg-red-500", text: "text-red-500", label: "Débil" },
  media: { bar: "w-2/3 bg-yellow-500", text: "text-yellow-600", label: "Media" },
  fuerte: { bar: "w-full bg-green-500", text: "text-green-600", label: "Fuerte" },
};

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenError, setTokenError] = useState(false);

  const strength = getStrength(password);
  const passwordLongEnough = password.length >= 8;
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = passwordLongEnough && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      await resetPassword(token, password);
      navigate("/login?reset=success", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.error || "";
      if (err?.response?.status === 400 && msg.toLowerCase().includes("token")) {
        setTokenError(true);
      } else {
        setError("Ocurrió un error. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex font-sans bg-white overflow-hidden">
      {/* Panel izquierdo: branding */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 px-16 py-10 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #1E40AF 0%, #2563EB 55%, #3B82F6 100%)",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          aria-hidden
        >
          <circle cx="10%" cy="15%" r="180" fill="white" />
          <circle cx="85%" cy="75%" r="260" fill="white" />
          <circle cx="60%" cy="20%" r="100" fill="white" />
          <rect
            x="70%"
            y="55%"
            width="180"
            height="180"
            rx="40"
            fill="white"
            opacity="0.5"
            transform="rotate(20,900,600)"
          />
        </svg>

        <div className="relative z-10 flex items-center gap-5">
          <LogoIcon size={80} color="white" />
          <span className="text-5xl font-bold text-white tracking-tight">
            Vialtros
          </span>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-white leading-tight max-w-md">
            Sigue en tiempo real la ruta que más te importa.
          </h1>
          <p className="mt-4 text-blue-200 text-lg max-w-sm leading-relaxed">
            Sabe exactamente dónde está el vehículo y cuándo llegará, desde
            cualquier dispositivo.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {LOGIN_FEATURES.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-blue-100 text-sm font-medium">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-blue-300 text-xs">
          © 2026 Vialtros. Todos los derechos reservados.
        </p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[560px] px-12 py-8 bg-white overflow-y-auto">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <LogoIcon size={48} color="#2563EB" />
          <span className="text-xl font-bold text-gray-900">Vialtros</span>
        </div>

        <div className="w-full max-w-md">
          {tokenError ? (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Enlace inválido o expirado
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                  Este enlace ya fue usado o expiró. Solicita uno nuevo.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-md shadow-blue-200 flex items-center justify-center"
              >
                Solicitar nuevo enlace
              </Link>
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-700 transition"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Nueva contraseña
              </h2>
              <p className="text-sm text-gray-400 mb-8">
                Ingresa y confirma tu nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Campo nueva contraseña */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <IconLock />
                    </span>
                    <input
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-12 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>

                  {/* Barra de fortaleza */}
                  {password.length > 0 && strength && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${STRENGTH_STYLES[strength].bar}`}
                        />
                      </div>
                      <span className={`text-xs font-medium ${STRENGTH_STYLES[strength].text}`}>
                        Contraseña {STRENGTH_STYLES[strength].label}
                      </span>
                    </div>
                  )}

                  {/* Indicador mínimo 8 chars */}
                  {password.length > 0 && !passwordLongEnough && (
                    <span className="text-xs text-red-500">
                      Mínimo 8 caracteres
                    </span>
                  )}
                </div>

                {/* Campo confirmar contraseña */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <IconLock />
                    </span>
                    <input
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-12 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repite tu contraseña"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      tabIndex={-1}
                      aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirm ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>

                  {confirm.length > 0 && (
                    <span
                      className={`text-xs font-medium ${
                        passwordsMatch ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {passwordsMatch
                        ? "Las contraseñas coinciden"
                        : "Las contraseñas no coinciden"}
                    </span>
                  )}
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-2a8 8 0 01-8-8z"
                        />
                      </svg>
                      Guardando...
                    </>
                  ) : (
                    "Guardar contraseña"
                  )}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link
                  to="/login"
                  className="text-sm text-blue-600 hover:text-blue-700 transition"
                >
                  ← Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

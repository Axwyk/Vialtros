import React, { useState } from "react";
import { Link } from "react-router-dom";
import { LogoIcon } from "../components/Logo";
import { requestPasswordReset } from "../services/api";

const LOGIN_FEATURES = [
  "Ubicación en tiempo real del vehículo",
  "Notificaciones de llegada y salida",
  "Historial de rutas completadas",
];

const IconMail = () => (
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
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconMailLarge = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2563EB"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const validateEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setSent(true);
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
          {sent ? (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                <IconMailLarge />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Revisa tu correo
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-sm">
                  Si el correo está registrado, recibirás las instrucciones para
                  restablecer tu contraseña en unos minutos.
                </p>
              </div>
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-700 transition mt-2"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Recuperar contraseña
              </h2>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                Ingresa tu correo y te enviaremos las instrucciones para
                restablecer tu contraseña.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-gray-700">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                      <IconMail />
                    </span>
                    <input
                      className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition"
                      type="email"
                      placeholder="tucorreo@ejemplo.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      autoComplete="email"
                      required
                    />
                  </div>
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
                  disabled={loading}
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
                      Enviando...
                    </>
                  ) : (
                    "Enviar instrucciones"
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

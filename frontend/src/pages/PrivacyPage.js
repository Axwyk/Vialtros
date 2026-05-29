import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 relative">
      {/* Botón de retroceso */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-[-150px] flex items-center gap-2 px-3 py-2 rounded-full bg-transparent hover:bg-gray-200 text-blue-600 font-medium transition-all duration-200"  aria-label="Volver"
        style={{ zIndex: 10 }}
      >
        <IoArrowBack size={20} />
        <span>Volver</span>
      </button>
      <h1 className="text-3xl font-bold mb-6 text-blue-700">Política de Privacidad</h1>
      <p className="text-gray-700 mb-4">Esta es la página de privacidad. Aquí puedes describir cómo se gestionan los datos personales, el uso de cookies y la protección de la información de los usuarios.</p>
      <ul className="list-disc pl-6 text-gray-600">
        <li>Datos personales protegidos</li>
        <li>No compartimos información con terceros</li>
        <li>Uso de cookies solo para mejorar la experiencia</li>
      </ul>
    </div>
  );
}

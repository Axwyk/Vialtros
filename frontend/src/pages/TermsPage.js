import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 relative">
      {/* Botón de retroceso */}
      <button
        onClick={() => navigate(-1)}
       className="absolute top-4 left-[-150px] flex items-center gap-2 px-3 py-2 rounded-full bg-transparent hover:bg-gray-200 text-blue-600 font-medium transition-all duration-200"      aria-label="Volver"
               style={{ zIndex: 10 }}
             >
               <IoArrowBack size={20} />
               <span>Volver</span>
      </button>
      <h1 className="text-3xl font-bold mb-6 text-blue-700">Términos y Condiciones</h1>
      <p className="text-gray-700 mb-4">Esta es la página de términos y condiciones. Aquí puedes detallar las reglas de uso, responsabilidades y derechos de los usuarios en la plataforma.</p>
      <ul className="list-disc pl-6 text-gray-600">
        <li>Uso responsable de la plataforma</li>
        <li>Prohibido el uso indebido de datos</li>
        <li>Condiciones sujetas a cambios</li>
      </ul>
    </div>
  );
}

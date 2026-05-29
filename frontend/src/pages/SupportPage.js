import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function SupportPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 relative">
      {/* Botón de retroceso */}
      <button
        onClick={() => navigate(-1)}
         className="absolute top-4 left-[-150px] flex items-center gap-2 px-3 py-2 rounded-full bg-transparent hover:bg-gray-200 text-blue-600 font-medium transition-all duration-200" aria-label="Volver"
                style={{ zIndex: 10 }}
              >
                <IoArrowBack size={20} />
                <span>Volver</span>
      </button>
      <h1 className="text-3xl font-bold mb-6 text-blue-700">Soporte</h1>
      <p className="text-gray-700 mb-4">¿Tienes dudas o necesitas ayuda? Ponte en contacto con nuestro equipo de soporte.</p>
      <ul className="list-disc pl-6 text-gray-600">
        <li>Correo: soporte@vialtros.com</li>
        <li>Teléfono: +34 600 000 000</li>
        <li>Horario: Lunes a Viernes, 9:00 a 18:00</li>
      </ul>
    </div>
  );
}

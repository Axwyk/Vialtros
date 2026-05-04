import React from "react";

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
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

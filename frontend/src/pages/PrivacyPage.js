import React from "react";

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
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

import React from "react";

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
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

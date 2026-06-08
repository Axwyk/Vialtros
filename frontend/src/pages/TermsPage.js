import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 relative">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-[-150px] flex items-center gap-2 px-3 py-2 rounded-full bg-transparent hover:bg-gray-200 text-blue-600 font-medium transition-all duration-200"
        aria-label="Volver"
        style={{ zIndex: 10 }}
      >
        <IoArrowBack size={20} />
        <span>Volver</span>
      </button>

      <h1 className="text-3xl font-bold mb-2 text-blue-700">Términos y Condiciones</h1>
      <p className="text-sm text-gray-500 mb-6">Vigente desde junio de 2026</p>

      <p className="text-gray-700 mb-4">
        Al registrarse y utilizar Vialtros, el usuario acepta estos términos en su totalidad. Si no está de acuerdo, debe abstenerse de usar la plataforma.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">1. Descripción del servicio</h2>
      <p className="text-gray-700 mb-4">
        Vialtros es una plataforma SaaS de gestión de rutas y transporte que incluye seguimiento GPS en tiempo real, sistema de notificaciones automáticas, panel de administración y calificación del servicio. Está diseñada para instituciones y operadores de transporte en Colombia.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">2. Roles y responsabilidades</h2>

      <p className="text-gray-700 mb-2 font-medium">Administrador</p>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Gestionar usuarios, conductores, pasajeros y rutas dentro de la plataforma.</li>
        <li>Monitorear el estado de las rutas y el seguimiento GPS en tiempo real.</li>
        <li>Es responsable de la veracidad de la información registrada (conductores, licencias, rutas).</li>
      </ul>

      <p className="text-gray-700 mb-2 font-medium">Conductor</p>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Compartir su ubicación GPS durante rutas activas para permitir el seguimiento.</li>
        <li>Registrar correctamente el estado de cada pasajero: recogido, no recogido o dejado en destino.</li>
        <li>No falsificar su ubicación ni los estados de recogida o entrega.</li>
      </ul>

      <p className="text-gray-700 mb-2 font-medium">Pasajero / Usuario</p>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Visualizar la ruta asignada y el tracking del vehículo en tiempo real.</li>
        <li>Recibir notificaciones automáticas sobre el estado de la ruta.</li>
        <li>Calificar el servicio del conductor al finalizar la ruta.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">3. Uso aceptable</h2>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>La plataforma es de uso exclusivo para la gestión de transporte autorizado.</li>
        <li>Queda prohibido compartir credenciales de acceso con terceros.</li>
        <li>Queda prohibido el acceso no autorizado a cuentas de otros usuarios.</li>
        <li>Queda prohibido el uso de la plataforma para fines distintos a la gestión de transporte.</li>
        <li>Queda prohibida cualquier manipulación de datos de ubicación, estados de recogida o calificaciones.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">4. Precisión del GPS y limitaciones</h2>
      <p className="text-gray-700 mb-4">
        El seguimiento GPS depende de la señal y las condiciones del dispositivo del conductor. Vialtros no garantiza una precisión absoluta en todo momento y no se responsabiliza por variaciones derivadas de condiciones técnicas externas (señal, hardware, conectividad).
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">5. Suspensión del servicio</h2>
      <p className="text-gray-700 mb-4">
        Vialtros se reserva el derecho de suspender o eliminar cuentas que incumplan estos términos, sin previo aviso en casos de uso fraudulento o que comprometan la seguridad de otros usuarios.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">6. Modificaciones</h2>
      <p className="text-gray-700 mb-4">
        Vialtros puede modificar estos términos en cualquier momento. Los cambios relevantes se notificarán a través de la plataforma o por correo electrónico con un plazo razonable de anticipación.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">7. Contacto</h2>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Correo: <a href="mailto:contacto@vialtros.com" className="text-blue-600 hover:underline">contacto@vialtros.com</a></li>
        <li>Teléfono: 602 321 2100 Ext: 2649 o 2653</li>
        <li>Dirección: Buenaventura, Valle del Cauca, Colombia</li>
      </ul>
    </div>
  );
}

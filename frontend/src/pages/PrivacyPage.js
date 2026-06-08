import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function PrivacyPage() {
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

      <h1 className="text-3xl font-bold mb-2 text-blue-700">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-6">Vigente desde junio de 2026</p>

      <p className="text-gray-700 mb-4">
        Vialtros es una plataforma de gestión de rutas y transporte operada desde Buenaventura, Valle del Cauca, Colombia.
        Esta política describe cómo recopilamos, usamos y protegemos la información de quienes utilizan nuestro sistema.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">1. Datos que recopilamos</h2>
      <p className="text-gray-700 mb-2">Según el rol del usuario, la plataforma puede recopilar:</p>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li><span className="font-medium">Datos de identificación:</span> nombre, apellido, nombre de usuario, correo electrónico, número de teléfono y rol (administrador, conductor o pasajero).</li>
        <li><span className="font-medium">Datos de conductor:</span> número de licencia de conducción.</li>
        <li><span className="font-medium">Datos de pasajero:</span> dirección de recogida y coordenadas GPS asociadas (latitud y longitud).</li>
        <li><span className="font-medium">Datos de ubicación en tiempo real:</span> coordenadas GPS, velocidad del vehículo y marca de tiempo, transmitidos durante rutas activas.</li>
        <li><span className="font-medium">Datos de uso:</span> historial de rutas, estados de recogida y entrega, calificaciones del servicio (1 a 5 estrellas) y comentarios opcionales.</li>
        <li><span className="font-medium">Datos técnicos:</span> tokens de sesión JWT (acceso y refresco) y tokens de recuperación de contraseña con expiración de 1 hora.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">2. Para qué usamos los datos</h2>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Gestionar la asignación de rutas, conductores y pasajeros.</li>
        <li>Proveer el seguimiento GPS en tiempo real del vehículo durante rutas activas.</li>
        <li>Enviar notificaciones automáticas: inicio de ruta, recogida de pasajero, proximidad a parada y llegada al destino.</li>
        <li>Generar estadísticas de operación para administradores (rutas completadas, actividad semanal).</li>
        <li>Permitir la recuperación de contraseña por correo electrónico.</li>
        <li>Mejorar la seguridad y la calidad del servicio de transporte.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">3. Protección de los datos</h2>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>La autenticación se gestiona mediante tokens JWT con tiempo de expiración definido.</li>
        <li>Cada rol (administrador, conductor, pasajero) tiene acceso únicamente a los datos que le corresponden.</li>
        <li>Las coordenadas GPS del conductor se transmiten exclusivamente durante rutas activas y no se almacenan de forma permanente en el dispositivo del usuario.</li>
        <li>Las contraseñas se almacenan con hash y nunca en texto plano.</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">4. Compartir información con terceros</h2>
      <p className="text-gray-700 mb-4">
        Vialtros no vende ni cede datos personales a terceros. La información solo podrá compartirse cuando sea exigido por autoridad competente o requerimiento legal, y únicamente en la medida necesaria.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">5. Derechos del usuario</h2>
      <p className="text-gray-700 mb-2">Los usuarios pueden ejercer los siguientes derechos sobre sus datos:</p>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Acceder a la información personal registrada en la plataforma.</li>
        <li>Solicitar la corrección de datos inexactos o desactualizados.</li>
        <li>Solicitar la eliminación de su cuenta y los datos asociados.</li>
      </ul>
      <p className="text-gray-700 mb-4">
        Para ejercer estos derechos, contacta a nuestro equipo a través de <a href="mailto:contacto@vialtros.com" className="text-blue-600 hover:underline">contacto@vialtros.com</a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">6. Cambios a esta política</h2>
      <p className="text-gray-700 mb-4">
        Vialtros puede actualizar esta política cuando sea necesario. Los cambios significativos se comunicarán mediante notificación en la plataforma o por correo electrónico.
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

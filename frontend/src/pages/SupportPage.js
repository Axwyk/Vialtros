import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowBack } from "react-icons/io5";

export default function SupportPage() {
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

      <h1 className="text-3xl font-bold mb-2 text-blue-700">Soporte</h1>
      <p className="text-gray-700 mb-6">
        ¿Tienes dudas o necesitas ayuda con Vialtros? Comunicate con nuestro equipo por cualquiera de los siguientes canales.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">Canales de contacto</h2>
      <ul className="list-disc pl-6 text-gray-600 space-y-1 mb-4">
        <li>Correo: <a href="mailto:contacto@vialtros.com" className="text-blue-600 hover:underline">contacto@vialtros.com</a></li>
        <li>Teléfono: 602 321 2100 Ext: 2649 o 2653</li>
        <li>Sitio web: <a href="https://vialtros.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.vialtros.com</a></li>
        <li>Dirección: Buenaventura, Valle del Cauca, Colombia</li>
      </ul>

      <h2 className="text-xl font-semibold mt-8 mb-3 text-blue-600">Preguntas frecuentes</h2>

      <div className="space-y-5 text-gray-700">
        <div>
          <p className="font-medium mb-1">¿Cómo veo mi ruta asignada?</p>
          <p className="text-gray-600">
            Inicia sesion con tu cuenta de pasajero. En el panel principal encontraras la ruta que te ha sido asignada, incluyendo el conductor, el origen y el destino.
          </p>
        </div>

        <div>
          <p className="font-medium mb-1">¿Por que no aparece la ubicacion del conductor en el mapa?</p>
          <p className="text-gray-600">
            El tracking GPS solo esta activo cuando el conductor ha iniciado la ruta. Si la ruta aun no ha comenzado, el mapa no mostrara ubicacion en tiempo real. Tambien verifica que tengas conexion a internet estable.
          </p>
        </div>

        <div>
          <p className="font-medium mb-1">¿Como recupero mi contrasena?</p>
          <p className="text-gray-600">
            En la pantalla de inicio de sesion, haz clic en "¿Olvidaste tu contrasena?". Ingresa tu correo electronico registrado y recibiras un enlace de recuperacion valido por 1 hora.
          </p>
        </div>

        <div>
          <p className="font-medium mb-1">¿Como califico una ruta?</p>
          <p className="text-gray-600">
            Una vez finalizada la ruta, podras asignar una calificacion de 1 a 5 estrellas y dejar un comentario opcional desde el detalle de la ruta en tu panel.
          </p>
        </div>

        <div>
          <p className="font-medium mb-1">No recibo notificaciones, ¿que hago?</p>
          <p className="text-gray-600">
            Asegurate de que tu navegador tenga habilitados los permisos de notificaciones para Vialtros y de que tu sesion este activa. Si el problema persiste, contacta al administrador de tu institucion o escribe a contacto@vialtros.com.
          </p>
        </div>

        <div>
          <p className="font-medium mb-1">¿Como agrego un conductor o pasajero como administrador?</p>
          <p className="text-gray-600">
            Desde el panel de administracion, accede a la seccion "Usuarios" o "Conductores" y usa el boton de crear nuevo registro. Puedes asignar el rol correspondiente durante el registro.
          </p>
        </div>
      </div>

      <p className="mt-8 text-gray-600">
        Si tu pregunta no esta aqui, no dudes en escribirnos a <a href="mailto:contacto@vialtros.com" className="text-blue-600 hover:underline">contacto@vialtros.com</a> y te responderemos a la brevedad.
      </p>
    </div>
  );
}

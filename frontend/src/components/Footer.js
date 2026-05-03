import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 py-8 px-8 md:px-20 mt-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-white text-lg">Vialtros</span>
        </div>
        <p className="text-blue-200 text-sm">
          © {new Date().getFullYear()} Vialtros. Sistema de gestión de rutas y transporte.
        </p>
        <div className="flex gap-6">
          <Link
            to="/privacy"
            className="text-blue-300 hover:text-white text-sm transition-colors no-underline bg-transparent border-none cursor-pointer p-0"
          >
            Privacidad
          </Link>
          <Link
            to="/terms"
            className="text-blue-300 hover:text-white text-sm transition-colors no-underline bg-transparent border-none cursor-pointer p-0"
          >
            Términos y Condiciones
          </Link>
          <Link
            to="/support"
            className="text-blue-300 hover:text-white text-sm transition-colors no-underline bg-transparent border-none cursor-pointer p-0"
          >
            Soporte
          </Link>
        </div>
      </div>
    </footer>
  );
}

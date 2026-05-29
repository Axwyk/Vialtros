import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaFacebook,
  FaInstagram,
  FaTwitter,
  FaYoutube,
  FaGlobe,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
} from "react-icons/fa";

export default function Footer() {
  const location = useLocation();

  const socialLinks = [
    { name: "YouTube",   icon: FaYoutube,   url: "https://youtube.com/@vialtros",   ariaLabel: "Síguenos en YouTube" },
    { name: "Facebook",  icon: FaFacebook,  url: "https://facebook.com/vialtros",   ariaLabel: "Síguenos en Facebook" },
    { name: "Twitter",   icon: FaTwitter,   url: "https://twitter.com/vialtros",    ariaLabel: "Síguenos en Twitter" },
    { name: "Instagram", icon: FaInstagram, url: "https://instagram.com/vialtros",  ariaLabel: "Síguenos en Instagram" },
  ];

  const contactInfo = [
    { icon: FaGlobe,          text: "www.vialtros.com",               href: "https://vialtros.com" },
    { icon: FaPhone,          text: "602 321 2100 Ext: 2649 o 2653",  href: "tel:6023212100" },
    { icon: FaEnvelope,       text: "contacto@vialtros.com",          href: "mailto:contacto@vialtros.com" },
    { icon: FaMapMarkerAlt,   text: "Buenaventura, Valle del Cauca",  href: null },
  ];

  const handleLogoClick = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="w-full bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 mt-auto">

      {/* Cuerpo principal */}
      <div className="px-8 md:px-20 pt-10 pb-6">
        <div className="flex flex-col md:flex-row justify-between gap-8">

          {/* Columna izquierda — identidad + contacto */}
          <div className="flex flex-col gap-3">
            <Link
              to="/"
              onClick={handleLogoClick}
              aria-label="Ir al inicio de Vialtros"
              className="font-bold text-white text-xl focus:outline-none no-underline"
              style={{ textDecoration: "none" }}
            >
              Vialtros
            </Link>
            <p className="text-blue-200 text-sm font-medium">
              Sistema de Gestión de Rutas y Transporte
            </p>

            <ul className="mt-2 flex flex-col gap-2">
              {contactInfo.map(({ icon: Icon, text, href }) => (
                <li key={text} className="flex items-center gap-2 text-blue-200 text-sm">
                  <Icon size={13} className="flex-shrink-0 text-blue-300" />
                  {href ? (
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors no-underline"
                      style={{ textDecoration: "none" }}
                    >
                      {text}
                    </a>
                  ) : (
                    <span>{text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Columna derecha — links de navegación */}
          <div className="flex flex-col gap-3 md:items-end">
            <p className="text-white font-semibold text-sm">Información</p>
            <nav className="flex flex-col gap-2 md:items-end">
              <Link
                to="/privacy"
                className="text-blue-300 hover:text-white text-sm transition-colors no-underline"
                style={{ textDecoration: "none" }}
              >
                Política de privacidad
              </Link>
              <Link
                to="/terms"
                className="text-blue-300 hover:text-white text-sm transition-colors no-underline"
                style={{ textDecoration: "none" }}
              >
                Términos y Condiciones
              </Link>
              <Link
                to="/support"
                className="text-blue-300 hover:text-white text-sm transition-colors no-underline"
                style={{ textDecoration: "none" }}
              >
                Soporte
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Barra inferior — copyright + redes */}
      <div className="border-t border-blue-600 px-8 md:px-20 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-blue-300 text-xs">
          © {new Date().getFullYear()} Vialtros. Todos los derechos reservados.
        </p>
        <div className="flex gap-4">
          {socialLinks.map(({ name, icon: Icon, url, ariaLabel }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ariaLabel}
              className="text-blue-300 hover:text-white hover:scale-110 transition-all duration-200"
            >
              <Icon size={18} />
            </a>
          ))}
        </div>
      </div>

    </footer>
  );
}

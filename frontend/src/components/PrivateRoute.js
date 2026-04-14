// Componente para proteger rutas según autenticación JWT
import React from "react";
import { Navigate } from "react-router-dom";
import { ensureLocalAccessSession } from "../services/auth";

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem("access");
  if (token) return children;
  if (ensureLocalAccessSession()) return children;
  return <Navigate to="/login" />;
}

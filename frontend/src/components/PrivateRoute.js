// Componente para proteger rutas según autenticación JWT
import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('access');
  return token ? children : <Navigate to="/login" />;
}

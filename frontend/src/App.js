// App principal con rutas protegidas y flujo de login/logout
import React, { useState, useEffect } from 'react';
import { getCurrentUser } from './services/auth';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import TrackingPage from './pages/TrackingPage';
import DashboardPage from './pages/DashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminDriversPage from './pages/AdminDriversPage';
import AdminRoutesPage from './pages/AdminRoutesPage';
import AdminPassengersPage from './pages/AdminPassengersPage';
import UserRoutePage from './pages/UserRoutePage';
import LandingPage from './pages/LandingPage';
import PrivateRoute from './components/PrivateRoute';
import { Logo } from './components/Logo';
import { clearSession, ensureLocalAccessSession, isLocalAccessEnabled } from './services/auth';


function App() {
  const [isAuth, setIsAuth] = useState(() => {
    const token = localStorage.getItem('access');
    if (token) return true;
    return ensureLocalAccessSession();
  });
  const [role, setRole] = useState(() => localStorage.getItem('role') || (isLocalAccessEnabled() ? 'admin' : null));

  useEffect(() => {
    if (isAuth) {
      getCurrentUser().then(user => {
        if (user && user.role) {
          setRole(user.role);
          localStorage.setItem('role', user.role);
        } else {
          clearSession();
          setIsAuth(false);
          setRole(null);
        }
      });
    } else {
      setRole(null);
      localStorage.removeItem('role');
    }
  }, [isAuth]);

  const handleLogout = () => {
    clearSession();

    if (ensureLocalAccessSession()) {
      setIsAuth(true);
      setRole(localStorage.getItem('role') || 'admin');
      return;
    }

    setIsAuth(false);
    setRole(null);
  };

  return (
    <Router>
      <div className="bg-gray-100 min-h-screen">
        {isAuth && (
          <nav className="bg-blue-800 text-white px-8 py-3.5 flex justify-between items-center shadow-lg sticky top-0 z-20">
            <Logo variant="light" iconSize={36} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium text-white-500 hover:text-red-600 transition px-3 py-2 rounded-lg hover:bg-red-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar sesión
            </button>
          </nav>
        )}
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={() => setIsAuth(true)} />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardPage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="/tracking/:routeId" element={
            <PrivateRoute>
              <TrackingPage />
            </PrivateRoute>
          } />
          <Route path="/admin/users" element={
            <PrivateRoute>
              <AdminUsersPage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="/admin/drivers" element={
            <PrivateRoute>
              <AdminDriversPage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="/admin/routes" element={
            <PrivateRoute>
              <AdminRoutesPage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="/admin/passengers" element={
            <PrivateRoute>
              <AdminPassengersPage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="/user/route" element={
            <PrivateRoute>
              <UserRoutePage role={role} onLogout={handleLogout} />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to={isAuth ? "/dashboard" : "/"} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

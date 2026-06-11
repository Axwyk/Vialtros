// App principal con rutas protegidas y flujo de login/logout
import React, { useState, useEffect, useCallback } from "react";
import {
  getCurrentUser,
  clearSession,
  ensureLocalAccessSession,
  isLocalAccessEnabled,
} from "./services/auth";
import { NotificationProvider } from "./context/NotificationContext";
import { GoogleMapsProvider } from "./context/GoogleMapsContext";
import NotificationToast from "./components/notifications/NotificationToast";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import TrackingPage from "./pages/TrackingPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminDriversPage from "./pages/AdminDriversPage";
import AdminRoutesPage from "./pages/AdminRoutesPage";
import AdminPassengersPage from "./pages/AdminPassengersPage";
import UserRoutePage from "./pages/UserRoutePage";
import DriverRoutesPage from "./pages/DriverRoutesPage";
import DriverLocationPage from "./pages/DriverLocationPage";
import LandingPage from "./pages/LandingPage";
import PrivateRoute from "./components/PrivateRoute";
import { Logo } from "./components/Logo";
import ActivityPage from "./pages/ActivityPage";
import Footer from "./components/Footer";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import SupportPage from "./pages/SupportPage";
import ProfileScreen from "./pages/ProfileScreen";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

function App() {
  const [isAuth, setIsAuth] = useState(() => {
    const token = localStorage.getItem("access");
    if (token) return true;
    return ensureLocalAccessSession();
  });
  const [role, setRole] = useState(
    () =>
      localStorage.getItem("role") || (isLocalAccessEnabled() ? "admin" : null),
  );

  useEffect(() => {
    if (isAuth) {
      getCurrentUser()
        .then((user) => {
          if (user && user.role) {
            setRole(user.role);
            localStorage.setItem("role", user.role);
          } else {
            clearSession();
            setIsAuth(false);
            setRole(null);
          }
        })
        .catch(() => {
          clearSession();
          setIsAuth(false);
          setRole(null);
        });
    } else {
      setRole(null);
      localStorage.removeItem("role");
    }
  }, [isAuth]);

  const handleLogin = useCallback(() => setIsAuth(true), []);

  const handleLogout = () => {
    clearSession();

    if (ensureLocalAccessSession()) {
      setIsAuth(true);
      setRole(localStorage.getItem("role") || "admin");
      return;
    }

    setIsAuth(false);
    setRole(null);
  };

  return (
    <GoogleMapsProvider>
    <NotificationProvider isAuth={isAuth} role={role}>
    <Router>
      <div className="bg-gray-100 h-screen flex flex-col overflow-hidden">
        {isAuth && (
          <nav className="bg-blue-800 text-white px-8 py-3.5 flex justify-between items-center shadow-lg flex-shrink-0 z-20">
            <Link to="/dashboard" className="flex items-center">
              <Logo variant="light" iconSize={36} />
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-medium text-white-500 hover:text-red-600 transition px-3 py-2 rounded-lg hover:bg-red-50"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Cerrar sesion
              </button>
            </div>
          </nav>
        )}
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          <div className="flex-1">
          <Routes>
            <Route
              path="/activity"
              element={
                <PrivateRoute>
                  <ActivityPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/login"
              element={
                isAuth ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginPage onLogin={handleLogin} />
                )
              }
            />
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/tracking"
              element={
                <PrivateRoute>
                  <TrackingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/tracking/:routeId"
              element={
                <PrivateRoute>
                  <TrackingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <PrivateRoute>
                  <AdminUsersPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <PrivateRoute>
                  <AdminDriversPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/routes"
              element={
                <PrivateRoute>
                  <AdminRoutesPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/passengers"
              element={
                <PrivateRoute>
                  <AdminPassengersPage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/user/route"
              element={
                <PrivateRoute>
                  <UserRoutePage role={role} onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/driver/routes"
              element={
                <PrivateRoute>
                  <DriverRoutesPage onLogout={handleLogout} />
                </PrivateRoute>
              }
            />
            <Route
              path="/driver/location"
              element={
                <PrivateRoute>
                  <DriverLocationPage role={role} />
                </PrivateRoute>
              }
            />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route
              path="*"
              element={<Navigate to={isAuth ? "/dashboard" : "/"} />}
            />
          </Routes>
          </div>
          <Footer />
        </div>
      </div>
    </Router>
    {role !== "admin" && <NotificationToast />}
    </NotificationProvider>
    </GoogleMapsProvider>
  );
}

export default App;

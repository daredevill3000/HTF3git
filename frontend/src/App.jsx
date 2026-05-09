import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import EmergencyButton from "./components/EmergencyButton";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Ai from "./pages/Ai";

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const hideNavPaths = ["/", "/auth"];
  const showNav = !hideNavPaths.includes(location.pathname);

  useEffect(() => {
    const handleBackButton = () => {
      if (location.pathname === '/' || location.pathname === '/auth' || location.pathname === '/dashboard') {
        CapacitorApp.exitApp();
      } else {
        navigate(-1);
      }
    };

    const backListener = CapacitorApp.addListener('backButton', handleBackButton);
    
    return () => {
      backListener.then(listener => listener.remove());
    };
  }, [location.pathname, navigate]);

  return (
    <div className="app-container">
      {showNav && <Navbar />}

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/triage"
          element={
            <ProtectedRoute>
              <Ai />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>

      {/* Floating emergency button — visible on all protected pages */}
      {showNav && <EmergencyButton />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

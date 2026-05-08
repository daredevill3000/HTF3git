import { Routes, Route, useLocation, Navigate } from "react-router-dom";
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
  const hideNavPaths = ["/", "/auth"];
  const showNav = !hideNavPaths.includes(location.pathname);

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

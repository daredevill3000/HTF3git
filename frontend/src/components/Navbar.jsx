import { Shield, Activity, LayoutDashboard, Home, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <nav style={{ 
      background: "rgba(255, 255, 255, 0.8)", 
      backdropFilter: "blur(10px)", 
      position: "sticky", 
      top: 0, 
      zIndex: 1000,
      padding: "1rem 4rem"
    }}>
      <Link to="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "var(--foreground)" }}>
        <Shield size={28} color="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
        <span style={{ fontWeight: 800, fontSize: "1.4rem", letterSpacing: "-0.02em" }}>Sahayaka</span>
      </Link>
      <div style={{ display: "flex", gap: "32px", alignItems: "center" }}>
        <Link
          to="/"
          style={{
            color: "var(--accents-3)",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "0.95rem"
          }}
        >
          Home
        </Link>
        <Link
          to="/dashboard"
          style={{
            color: "var(--accents-3)",
            textDecoration: "none",
            fontWeight: "600",
            fontSize: "0.95rem"
          }}
        >
          Dashboard
        </Link>
        <Link to="/triage">
          <button style={{ padding: "0.6rem 1.2rem", borderRadius: "10px" }}>
            Triage AI
          </button>
        </Link>
        {user && (
          <button 
            onClick={handleLogout}
            className="secondary-btn"
            style={{ padding: "0.6rem 1.2rem", borderRadius: "10px" }}
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

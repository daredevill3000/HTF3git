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
    <nav className="main-navbar">
      <Link to="/" className="nav-logo">
        <Shield size={28} color="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
        <span className="logo-text">Sahayaka</span>
      </Link>
      <div className="nav-links">

        <Link to="/dashboard" className="nav-link">
          <LayoutDashboard className="mobile-icon" size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/triage" className="nav-link triage-link">
          <Activity className="mobile-icon" size={20} />
          <span className="mobile-label">Triage AI</span>
          <button className="triage-btn">Triage AI</button>
        </Link>
        {user && (
          <button
            onClick={handleLogout}
            className="logout-btn"
          >
            <LogOut className="mobile-icon" size={20} />
            <span className="mobile-label">Logout</span>
            <span className="desktop-label">Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
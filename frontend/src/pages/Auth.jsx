import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    
    // Perform login via context
    login(email, stayLoggedIn);
    
    // Redirect to dashboard
    navigate("/dashboard");
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-gradient-1"></div>
        <div className="auth-gradient-2"></div>
      </div>
      
      <div className="auth-glass-card">
        <div className="auth-header">
          <Shield size={40} className="auth-icon" />
          <h2>Welcome Back</h2>
          <p>Sign in to access your emergency dashboard</p>
        </div>
        
        <form onSubmit={handleLogin} className="auth-form">
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="responder@sahayaka.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="checkbox-group">
            <input
              id="stay-logged-in"
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
            />
            <label htmlFor="stay-logged-in">Stay logged in for 30 days</label>
          </div>
          
          <button type="submit" className="login-btn">
            Login as Responder
          </button>
        </form>
        
        <div className="auth-footer">
          <p>
            Don't have an account? <span className="signup-link">Sign Up</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

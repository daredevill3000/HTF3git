import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      const stayLoggedIn = localStorage.getItem("stayLoggedIn");
      const loginExpiry = localStorage.getItem("loginExpiry");
      const userEmail = localStorage.getItem("userEmail");

      if (stayLoggedIn === "true" && loginExpiry && userEmail) {
        const expiryTime = parseInt(loginExpiry, 10);
        const now = Date.now();

        // Check if session is still valid
        if (now < expiryTime) {
          setIsAuthenticated(true);
          setUser({ email: userEmail });
        } else {
          // Session expired, clear storage
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (email, stayLoggedIn = false) => {
    setIsAuthenticated(true);
    setUser({ email });
    localStorage.setItem("userEmail", email);

    if (stayLoggedIn) {
      localStorage.setItem("stayLoggedIn", "true");
      localStorage.setItem("loginExpiry", Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else {
      // Session-only login (cleared on browser close)
      localStorage.removeItem("stayLoggedIn");
      localStorage.removeItem("loginExpiry");
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("userEmail");
    localStorage.removeItem("stayLoggedIn");
    localStorage.removeItem("loginExpiry");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

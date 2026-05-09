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
      const userName = localStorage.getItem("userName");
      const userAadhaar = localStorage.getItem("userAadhaar");

      if (stayLoggedIn === "true" && loginExpiry && userName) {
        const expiryTime = parseInt(loginExpiry, 10);
        const now = Date.now();

        // Check if session is still valid
        if (now < expiryTime) {
          setIsAuthenticated(true);
          setUser({ name: userName, aadhaar: userAadhaar });
        } else {
          // Session expired, clear storage
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (name, mobile, password, aadhaar, stayLoggedIn = false) => {
    setIsAuthenticated(true);
    setUser({ name, aadhaar });
    localStorage.setItem("userName", name);
    localStorage.setItem("userAadhaar", aadhaar);

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
    localStorage.removeItem("userName");
    localStorage.removeItem("userAadhaar");
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

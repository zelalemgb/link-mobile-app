import React from "react";
import { getAuthToken, setAuthToken, clearAuthToken } from "../lib/auth";

const AuthContext = React.createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    getAuthToken()
      .then((stored) => {
        if (active) setToken(stored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signInWithToken = async (nextToken) => {
    try {
      await setAuthToken(nextToken);
    } catch (err) {
      console.warn("Persistent auth storage failed:", err);
    }
    setToken(nextToken);
  };

  const signOut = async () => {
    await clearAuthToken();
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        loading,
        isAuthenticated: Boolean(token),
        signInWithToken,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export default AuthContext;

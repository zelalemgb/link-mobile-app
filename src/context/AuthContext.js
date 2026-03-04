import React from 'react';
import { getAuthToken, setAuthToken, clearAuthToken } from '../lib/auth';
import { api } from '../lib/api';

const AuthContext = React.createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = React.useState(null);
  const [user, setUser]   = React.useState(null);   // { id, role, full_name, … }
  const [loading, setLoading] = React.useState(true);

  // ── Bootstrap: restore token then fetch profile ──────────────────────
  React.useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const stored = await getAuthToken();
        if (!stored || !active) return;

        setToken(stored);

        // Fetch profile to get role (best-effort; keep token even if this fails)
        try {
          const profile = await api.get('/auth/profile');
          if (active && profile) setUser(profile);
        } catch {
          // profile fetch failed — user stays null, role defaults to 'patient'
        }
      } catch {
        // no stored token
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();
    return () => { active = false; };
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────
  const signInWithToken = async (nextToken, profile = null) => {
    try {
      await setAuthToken(nextToken);
    } catch (err) {
      console.warn('Persistent auth storage failed:', err);
    }
    setToken(nextToken);

    // Accept profile passed in (from LoginScreen) or fetch fresh
    if (profile) {
      setUser(profile);
    } else {
      try {
        const fetched = await api.get('/auth/profile');
        if (fetched) setUser(fetched);
      } catch {
        // leave user null; role will default to 'patient' in consumers
      }
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────
  const signOut = async () => {
    await clearAuthToken();
    setToken(null);
    setUser(null);
  };

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role,
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
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;

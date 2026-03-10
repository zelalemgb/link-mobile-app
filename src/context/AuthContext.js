import React from 'react';
import { Platform } from 'react-native';
import { getAuthToken, setAuthToken, clearAuthToken } from '../lib/auth';
import { api } from '../lib/api';

const isWeb = Platform.OS === 'web';

// Stub patient profile — Abebe Metaferia Alemey @ Zelalem Hospital (API unreachable due to CORS)
const WEB_DEV_PROFILE = {
  id: 'demo-patient-abebe-001',
  role: 'patient',
  full_name: 'Abebe Metaferia Alemey',
  first_name: 'Abebe',
  last_name: 'Alemey',
  email: 'abebe.metaferia@linkhc.org',
  phone: '+251911000001',
  facility_id: 'demo-facility-zelalem-001',
  facility_name: 'Zelalem Hospital',
};

const AuthContext = React.createContext(null);

const normalizeWorkspace = (workspace) => {
  if (!workspace || typeof workspace !== 'object') return null;
  return {
    workspaceType: workspace.workspaceType || workspace.workspace_type || 'clinic',
    setupMode: workspace.setupMode || workspace.setup_mode || 'legacy',
    teamMode: workspace.teamMode || workspace.team_mode || 'legacy',
    enabledModules: Array.isArray(workspace.enabledModules || workspace.enabled_modules)
      ? (workspace.enabledModules || workspace.enabled_modules).filter((entry) => typeof entry === 'string')
      : [],
  };
};

const normalizeProfilePayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const source = payload.user && typeof payload.user === 'object'
    ? payload.user
    : payload;
  const role = source.role || source.user_role || payload.role || payload.user_role || null;
  const workspace = normalizeWorkspace(source.workspace || payload.workspace);

  return {
    ...source,
    role,
    workspace,
  };
};

const normalizePatientPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  const patient = payload.patient && typeof payload.patient === 'object'
    ? payload.patient
    : payload;

  if (!patient || typeof patient !== 'object' || !patient.id) return null;

  const fallbackName = [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim();
  const fullName = patient.name || patient.full_name || fallbackName || 'Patient';
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = patient.first_name || nameParts[0] || 'Patient';
  const lastName = patient.last_name || nameParts.slice(1).join(' ');

  return {
    ...patient,
    role: 'patient',
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    phone: patient.phone || patient.phone_number || null,
  };
};

const resolveRole = (profile) => profile?.role || profile?.user_role || null;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = React.useState(null);
  const [user, setUser]   = React.useState(null);   // { id, role, full_name, … }
  const [loading, setLoading] = React.useState(true);

  const fetchProfile = React.useCallback(async () => {
    try {
      const profileResponse = await api.get('/auth/profile');
      const normalizedProfile = normalizeProfilePayload(profileResponse);
      if (normalizedProfile) return normalizedProfile;
    } catch {
      // Fall through to patient profile lookup.
    }

    try {
      const patientResponse = await api.get('/patient-auth/me');
      const normalizedPatient = normalizePatientPayload(patientResponse);
      if (normalizedPatient) return normalizedPatient;
    } catch {
      // Keep existing behavior: token can still be retained without profile payload.
    }

    return null;
  }, []);

  // ── Bootstrap: restore token then fetch profile ──────────────────────
  React.useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const stored = await getAuthToken();
        if (!stored || !active) return;

        setToken(stored);

        // On web, skip API call (CORS blocks it) — use stub profile
        if (isWeb) {
          if (active) setUser(WEB_DEV_PROFILE);
          return;
        }

        const profile = await fetchProfile();
        if (active && profile) setUser(profile);
      } catch {
        // no stored token
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();
    return () => { active = false; };
  }, [fetchProfile]);

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
      setUser(
        normalizeProfilePayload(profile) ||
        normalizePatientPayload(profile) ||
        profile
      );
    } else if (isWeb) {
      // On web, skip API call — use stub profile
      setUser(WEB_DEV_PROFILE);
    } else {
      const fetched = await fetchProfile();
      if (fetched) setUser(fetched);
    }
  };

  // ── Sign out ──────────────────────────────────────────────────────────
  const signOut = async () => {
    await clearAuthToken();
    setToken(null);
    setUser(null);
  };

  const role = resolveRole(user);

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

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { registerFarmer, loginFarmer, getMe, updateMe, deleteMe } from '../services/api';
import i18n from '../i18n';

const TOKEN_KEY = 'mandimitra_token';

// Switches the whole site's language to the farmer's real saved preference.
// Translation files only exist for a few languages so far (see i18n/index.js) -
// for any other saved preference, i18next's fallbackLng quietly takes over
// rather than breaking, which is honest: we don't have that translation yet.
function applyFarmerLanguage(farmer) {
  if (farmer?.preferredLanguage) {
    i18n.changeLanguage(farmer.preferredLanguage);
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);

  // On load (or whenever the token changes), check the real backend to see
  // if this token still corresponds to a real logged-in farmer. This is
  // what keeps a farmer logged in across page refreshes.
  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!token) {
        setFarmer(null);
        setLoading(false);
        return;
      }
      try {
        const me = await getMe(token);
        if (!cancelled) {
          setFarmer(me);
          applyFarmerLanguage(me);
        }
      } catch (err) {
        // Token missing/expired/invalid on the real backend - log out cleanly.
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setToken('');
          setFarmer(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const register = useCallback(async (data) => {
    const result = await registerFarmer(data);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setFarmer(result.farmer);
    applyFarmerLanguage(result.farmer);
    return result.farmer;
  }, []);

  const login = useCallback(async (data) => {
    const result = await loginFarmer(data);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setFarmer(result.farmer);
    applyFarmerLanguage(result.farmer);
    return result.farmer;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setFarmer(null);
  }, []);

  const updateProfile = useCallback(
    async (data) => {
      const updated = await updateMe(token, data);
      setFarmer(updated);
      applyFarmerLanguage(updated);
      return updated;
    },
    [token]
  );

  // Permanently deletes the real account from the database, then logs the
  // farmer out of this browser the same way `logout` does.
  const deleteAccount = useCallback(async () => {
    await deleteMe(token);
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setFarmer(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ farmer, token, loading, register, login, logout, updateProfile, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

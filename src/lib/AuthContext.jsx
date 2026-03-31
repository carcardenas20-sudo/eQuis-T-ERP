import React, { createContext, useState, useContext, useEffect } from 'react';
import { localClient, getToken, setToken } from '@/api/localClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'local', public_settings: {} });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const token = getToken();
    if (!token) {
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const currentUser = await localClient.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (err) {
      setToken(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Sesión expirada' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    const result = await localClient.auth.login(email, password);
    setToken(result.token);
    setUser(result.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return result;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      login,
      logout,
      navigateToLogin,
      checkAppState: checkAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

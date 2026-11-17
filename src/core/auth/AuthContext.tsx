/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError } from '../api/index.ts';
import type { User } from '../../shared/types/index.ts';

interface AuthContextValue {
  currentUser: User | null;
  isInitializing: boolean;
  dbUnconfigured: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dbUnconfigured, setDbUnconfigured] = useState(false);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const token = api.getToken();
    if (!token) {
      setCurrentUser(null);
      setIsInitializing(false);
      return null;
    }

    try {
      const user = await api.getCurrentUser();
      setDbUnconfigured(false);
      setCurrentUser(user);
      return user;
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'DATABASE_UNCONFIGURED' || err.status === 503)) {
        setDbUnconfigured(true);
      } else {
        api.clearToken();
      }
      setCurrentUser(null);
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const res = await api.login(email.trim(), password);
    setDbUnconfigured(false);
    setCurrentUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isInitializing,
        dbUnconfigured,
        login,
        logout,
        refreshUser,
        setCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

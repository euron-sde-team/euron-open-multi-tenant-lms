'use client';

import { createContext, ReactNode, useEffect, useState } from 'react';

import { AUTH_TOKEN_KEY } from '@/constant/env';

interface AuthContextType {
  authenticated: string | null;
  setAuthenticated: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

interface AuthProviderProps {
  children?: ReactNode;
}

const initialValue: AuthContextType = {
  authenticated: null,
  setAuthenticated: () => null,
  logout: () => null,
  isLoading: true,
};

export const AuthContext = createContext<AuthContextType>(initialValue);

export const AuthContextProvider = ({ children }: AuthProviderProps) => {
  const [authenticated, setAuthenticatedState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      setAuthenticatedState(token);
      setIsLoading(false);
    }
  }, []);

  const setAuthenticated = (token: string) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    }
    setAuthenticatedState(token);
  };

  const logout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setAuthenticatedState(null);
  };

  // Attach to window for axios interceptor access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.authContext = { authenticated, setAuthenticated };
    }
  }, [authenticated]);

  return (
    <AuthContext.Provider
      value={{ authenticated, setAuthenticated, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

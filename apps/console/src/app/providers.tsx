'use client';

import { ReactNode } from 'react';

import { AuthContextProvider } from '@/context/AuthContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthContextProvider>
      {children}
    </AuthContextProvider>
  );
}

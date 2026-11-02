'use client';

import { QueryClientProvider } from 'react-query';

import { queryClient } from '@/lib/queryClient';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';

import { UserProvider } from '@/context/UserContext';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ProtectedRoute>
          <MainLayout>{children}</MainLayout>
        </ProtectedRoute>
      </UserProvider>
    </QueryClientProvider>
  );
}

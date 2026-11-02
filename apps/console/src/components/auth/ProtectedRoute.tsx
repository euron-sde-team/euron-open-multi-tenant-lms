'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useContext, useEffect } from 'react';

import { AuthContext } from '@/context/AuthContext';
import { UserContext } from '@/context/UserContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  requiredRole,
}: ProtectedRouteProps) {
  const router = useRouter();
  const { authenticated, isLoading: authLoading } = useContext(AuthContext);
  const {
    user,
    isLoading: userLoading,
    hasPermission,
    hasRole,
  } = useContext(UserContext);

  const isLoading = authLoading || userLoading;

  useEffect(() => {
    // Wait until loading is complete
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!authenticated) {
      router.push('/login');
      return;
    }

    // If user is loaded, check permissions/roles
    if (user) {
      // Check required permission
      if (requiredPermission && !hasPermission(requiredPermission)) {
        router.push('/unauthorized');
        return;
      }

      // Check required role
      if (requiredRole && !hasRole(requiredRole)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [
    isLoading,
    authenticated,
    user,
    requiredPermission,
    requiredRole,
    hasPermission,
    hasRole,
    router,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <div className='flex h-screen w-full items-center justify-center bg-bgGray'>
        <div className='flex flex-col items-center gap-4'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
          <p className='text-textSecondary'>Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children (will redirect)
  if (!authenticated) {
    return null;
  }

  // Check permissions after user is loaded
  if (user) {
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return null;
    }
    if (requiredRole && !hasRole(requiredRole)) {
      return null;
    }
  }

  return <>{children}</>;
}

'use client';

import Cookies from 'js-cookie';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { getMe } from '@/lib/api/auth';
import { AdminUser } from '@/lib/api/types';

import { AUTH_TOKEN_KEY } from '@/constant/env';

import { AuthContext } from './AuthContext';

interface UserContextType {
  user: AdminUser | null;
  setUser: (user: AdminUser | null) => void;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  hasRole: (roleCode: string) => boolean;
}

interface UserProviderProps {
  children?: ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
const asyncNoop = async () => {};

export const UserContext = createContext<UserContextType>({
  user: null,
  setUser: noop,
  isLoading: true,
  fetchProfile: asyncNoop,
  hasPermission: () => false,
  hasRole: () => false,
});

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { authenticated } = useContext(AuthContext);

  const fetchProfile = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await getMe();
      const userData = response.data;

      // Store user email in cookie for potential middleware access
      Cookies.set('admin_user', userData.email, { expires: 7 });

      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // The /me endpoint returns roles as string codes (e.g. ["SUPERADMIN"]), but
  // older code modelled them as objects ({ code }). Normalise to codes so both
  // shapes work and privileged users are never accidentally locked out.
  const roleCodesOf = (u: AdminUser | null): string[] => {
    if (!u?.roles) return [];
    return (u.roles as Array<string | { code?: string }>)
      .map((r) => (typeof r === 'string' ? r : r?.code))
      .filter((c): c is string => Boolean(c));
  };

  // Check if user has a specific role
  const hasRole = useCallback(
    (roleCode: string): boolean => roleCodesOf(user).includes(roleCode),
    [user],
  );

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permissionCode: string): boolean => {
      if (!user) return false;

      // SUPERADMIN / ADMIN have full access (mirrors the backend bypass).
      const roleCodes = roleCodesOf(user);
      if (roleCodes.includes('SUPERADMIN') || roleCodes.includes('ADMIN')) {
        return true;
      }

      // Direct permission code grant.
      if (user.permissions?.includes(permissionCode)) return true;

      // Fallback for object-shaped roles with nested permissions.
      if (user.roles) {
        for (const role of user.roles as Array<{
          permissions?: Array<{ code: string }>;
        }>) {
          if (role.permissions?.some((p) => p.code === permissionCode)) {
            return true;
          }
        }
      }

      return false;
    },
    [user],
  );

  // Fetch profile when authenticated changes
  useEffect(() => {
    if (authenticated) {
      fetchProfile();
    } else {
      setUser(null);
      setIsLoading(false);
    }
  }, [authenticated, fetchProfile]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        isLoading,
        fetchProfile,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

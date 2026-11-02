import { useAuthStore } from "../stores/auth-store";

/** Tenant system role code that gets full access (mirrors backend TENANT_ADMIN_ROLE_CODE). */
const ADMIN_ROLE_CODE = "admin";

/**
 * Permissions the admin role does NOT get for free, only the owner, or a role
 * the owner explicitly grants. Mirrors OWNER_ONLY_PERMISSIONS in the backend
 * (team.service.ts); keep the two in sync so the UI matches enforcement.
 */
const OWNER_ONLY_PERMISSIONS = new Set<string>([
  "gateway.configure",
  "roles.manage",
  "staff.manage",
  "settings.auth",
]);

/** Owner and Admin bypass all permission checks (access is then gated by entitlements only). */
function hasFullAccess(isOwner: boolean, roles: string[]): boolean {
  return isOwner || roles.includes(ADMIN_ROLE_CODE);
}

export function useHasPermission(permission: string): boolean {
  const { isOwner, roles, permissions } = useAuthStore();
  // Owner-only permissions are never auto-passed by the admin role, the owner
  // has them via isOwner; everyone else needs the explicit grant.
  if (isOwner) return true;
  if (!permission) return false;
  if (OWNER_ONLY_PERMISSIONS.has(permission)) return permissions.includes(permission);
  if (hasFullAccess(isOwner, roles)) return true;
  return permissions.includes(permission);
}

export function useHasAnyPermission(...perms: string[]): boolean {
  const { isOwner, roles, permissions } = useAuthStore();
  if (isOwner) return true;
  const set = new Set(permissions);
  return perms.some((p) =>
    OWNER_ONLY_PERMISSIONS.has(p)
      ? set.has(p)
      : hasFullAccess(isOwner, roles) || set.has(p)
  );
}

export function useHasAllPermissions(...perms: string[]): boolean {
  const { isOwner, roles, permissions } = useAuthStore();
  if (isOwner) return true;
  const set = new Set(permissions);
  return perms.every((p) =>
    OWNER_ONLY_PERMISSIONS.has(p)
      ? set.has(p)
      : hasFullAccess(isOwner, roles) || set.has(p)
  );
}

import { apiClient } from "./axios";

// Types
export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  /**
   * NULL = a built-in template (Admin / Educator / Operations / Finance) shared
   * by every tenant, so it can't be edited. A value = this tenant's own role.
   */
  tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Built-in templates are read-only, you duplicate them to get an editable copy. */
export function isBuiltInRole(role: Pick<Role, "is_system" | "tenant_id">) {
  return role.is_system || role.tenant_id === null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface PermissionGroup {
  category: string;
  permissions: Permission[];
}

/**
 * A capability is one plain-English sentence, "Can create and edit courses".
 * that stands in for a group of permission codes. Admins tick sentences; the
 * server translates them into the codes the engine actually enforces.
 */
export interface Capability {
  id: string;
  label: string;
  description: string;
  grants: string[];
  /** Why this one deserves a second look before you hand it over. */
  danger?: "DESTRUCTIVE" | "FINANCIAL" | "PERSONAL_DATA" | "PUBLIC";
  /** Belongs to the account owner alone, can never be given to a role. */
  ownerOnly?: boolean;
  /** Ticked by default on a new role (e.g. seeing the dashboard). */
  defaultOn?: boolean;
}

export interface CapabilityFeature {
  feature: string;
  addedIn: string;
  capabilities: Capability[];
}

export interface CapabilityArea {
  area: string;
  label: string;
  features: CapabilityFeature[];
}

export const DANGER_LABELS: Record<
  NonNullable<Capability["danger"]>,
  string
> = {
  DESTRUCTIVE: "Permanent",
  FINANCIAL: "Moves money",
  PERSONAL_DATA: "Personal data",
  PUBLIC: "Learners see this",
};

export interface StaffMember {
  membership_id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: string;
  is_owner: boolean;
  joined_at: string | null;
  roles: Role[];
}

// API functions
export const teamApi = {
  listRoles: async () =>
    (await apiClient.get("/tenant/team/roles")).data.data as Role[],

  getRole: async (roleId: string) =>
    (await apiClient.get(`/tenant/team/roles/${roleId}`)).data
      .data as RoleWithPermissions,

  // No `code`: it's an internal identifier the server derives from the name.
  createRole: async (data: { name: string; description?: string }) =>
    (await apiClient.post("/tenant/team/roles", data)).data.data as Role,

  /** Copy a role (usually a built-in template) into an editable one of our own. */
  duplicateRole: async (roleId: string, name?: string) =>
    (
      await apiClient.post(`/tenant/team/roles/${roleId}/duplicate`, { name })
    ).data.data as Role,

  updateRole: async (
    roleId: string,
    data: { name?: string; description?: string }
  ) =>
    (await apiClient.put(`/tenant/team/roles/${roleId}`, data)).data
      .data as Role,

  deleteRole: async (roleId: string) =>
    (await apiClient.delete(`/tenant/team/roles/${roleId}`)).data,

  listPermissions: async () =>
    (await apiClient.get("/tenant/team/permissions")).data
      .data as PermissionGroup[],

  updateRolePermissions: async (
    roleId: string,
    permissionIds: string[]
  ) =>
    (
      await apiClient.put(`/tenant/team/roles/${roleId}/permissions`, {
        permissionIds,
      })
    ).data,

  // --- Capabilities: the plain-English layer the role editor uses by default ---

  listCapabilities: async () =>
    (await apiClient.get("/tenant/team/capabilities")).data
      .data as CapabilityArea[],

  getRoleCapabilities: async (roleId: string) =>
    (await apiClient.get(`/tenant/team/roles/${roleId}/capabilities`)).data
      .data as {
      capabilityIds: string[];
      /** False when the role was hand-edited in Advanced and the plain-English
       *  view can no longer describe it faithfully. */
      exact: boolean;
    },

  updateRoleCapabilities: async (roleId: string, capabilityIds: string[]) =>
    (
      await apiClient.put(`/tenant/team/roles/${roleId}/capabilities`, {
        capabilityIds,
      })
    ).data,

  listStaff: async () =>
    (await apiClient.get("/tenant/team/staff")).data.data as StaffMember[],

  assignStaffRoles: async (userId: string, roleIds: string[]) =>
    (
      await apiClient.put(`/tenant/team/staff/${userId}/roles`, {
        roleIds,
      })
    ).data,

  removeStaffRole: async (userId: string, roleId: string) =>
    (
      await apiClient.delete(
        `/tenant/team/staff/${userId}/roles/${roleId}`
      )
    ).data,

  checkEmail: async (email: string) =>
    (await apiClient.get("/tenant/team/check-email", { params: { email } })).data
      .data as {
      exists: boolean;
      already_member: boolean;
      user?: { id: string; name: string; email: string; avatar_url: string | null };
    },

  inviteMember: async (data: { email: string; name: string; roleIds: string[] }) =>
    (await apiClient.post("/tenant/team/members/invite", data)).data.data as {
      userId: string;
      email: string;
      name: string;
      tempPassword?: string;
    },

  resetMemberPassword: async (userId: string) =>
    (await apiClient.post(`/tenant/team/members/${userId}/reset-password`)).data
      .data as { tempPassword: string },

  /** Switch access off, keeping their roles and their history. Reversible. */
  suspendMember: async (userId: string) =>
    (await apiClient.put(`/tenant/team/members/${userId}/suspend`)).data,

  reactivateMember: async (userId: string) =>
    (await apiClient.put(`/tenant/team/members/${userId}/reactivate`)).data,

  removeMember: async (userId: string) =>
    (await apiClient.delete(`/tenant/team/members/${userId}`)).data,
};

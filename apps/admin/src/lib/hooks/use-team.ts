import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { teamApi } from "../api/team";

// Query keys
export const teamKeys = {
  all: ["team"] as const,
  roles: () => [...teamKeys.all, "roles"] as const,
  role: (roleId: string) => [...teamKeys.all, "roles", roleId] as const,
  permissions: () => [...teamKeys.all, "permissions"] as const,
  capabilities: () => [...teamKeys.all, "capabilities"] as const,
  roleCapabilities: (roleId: string) =>
    [...teamKeys.all, "roles", roleId, "capabilities"] as const,
  staff: () => [...teamKeys.all, "staff"] as const,
};

// Queries
export function useRoles() {
  return useQuery({
    queryKey: teamKeys.roles(),
    queryFn: teamApi.listRoles,
  });
}

export function useRole(roleId: string) {
  return useQuery({
    queryKey: teamKeys.role(roleId),
    queryFn: () => teamApi.getRole(roleId),
    enabled: !!roleId,
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: teamKeys.permissions(),
    queryFn: teamApi.listPermissions,
  });
}

/** The catalogue of plain-English capabilities, grouped area → feature. */
export function useCapabilities() {
  return useQuery({
    queryKey: teamKeys.capabilities(),
    queryFn: teamApi.listCapabilities,
    // The catalogue only changes when we ship a feature. Don't refetch it.
    staleTime: Infinity,
  });
}

export function useRoleCapabilities(roleId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.roleCapabilities(roleId ?? ""),
    queryFn: () => teamApi.getRoleCapabilities(roleId as string),
    enabled: !!roleId,
  });
}

export function useStaff() {
  return useQuery({
    queryKey: teamKeys.staff(),
    queryFn: teamApi.listStaff,
  });
}

export function useCheckEmail(email: string) {
  const isValidEmail = email.includes("@") && email.length > 3;
  return useQuery({
    queryKey: [...teamKeys.all, "check-email", email],
    queryFn: () => teamApi.checkEmail(email),
    enabled: isValidEmail,
    staleTime: 30000,
    retry: false,
  });
}

// Mutations
export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      teamApi.createRole(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
    },
  });
}

export function useDuplicateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, name }: { roleId: string; name?: string }) =>
      teamApi.duplicateRole(roleId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      data,
    }: {
      roleId: string;
      data: { name?: string; description?: string };
    }) => teamApi.updateRole(roleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => teamApi.deleteRole(roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
    },
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      permissionIds,
    }: {
      roleId: string;
      permissionIds: string[];
    }) => teamApi.updateRolePermissions(roleId, permissionIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
      qc.invalidateQueries({ queryKey: teamKeys.role(vars.roleId) });
      // An Advanced edit changes which capabilities the role maps to (and may
      // make it stop mapping cleanly at all), so the Simple view must refetch.
      qc.invalidateQueries({
        queryKey: teamKeys.roleCapabilities(vars.roleId),
      });
    },
  });
}

/** Save a role by what it can DO. The server turns the sentences into codes. */
export function useUpdateRoleCapabilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      capabilityIds,
    }: {
      roleId: string;
      capabilityIds: string[];
    }) => teamApi.updateRoleCapabilities(roleId, capabilityIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: teamKeys.roles() });
      qc.invalidateQueries({ queryKey: teamKeys.role(vars.roleId) });
      qc.invalidateQueries({
        queryKey: teamKeys.roleCapabilities(vars.roleId),
      });
    },
  });
}

export function useAssignStaffRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleIds,
    }: {
      userId: string;
      roleIds: string[];
    }) => teamApi.assignStaffRoles(userId, roleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.staff() });
    },
  });
}

export function useRemoveStaffRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleId,
    }: {
      userId: string;
      roleId: string;
    }) => teamApi.removeStaffRole(userId, roleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.staff() });
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name: string; roleIds: string[] }) =>
      teamApi.inviteMember(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.staff() });
    },
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (userId: string) => teamApi.resetMemberPassword(userId),
  });
}

/** Suspend or reactivate, one hook, since the UI treats it as a single toggle. */
export function useSetMemberSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      suspended,
    }: {
      userId: string;
      suspended: boolean;
    }) =>
      suspended
        ? teamApi.suspendMember(userId)
        : teamApi.reactivateMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.staff() });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.staff() });
    },
  });
}

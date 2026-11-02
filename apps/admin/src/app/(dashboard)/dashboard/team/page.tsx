"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@open-mtlms/core";
import { Check, Copy, Plus, Shield, UserPlus, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { PermissionGate } from "@/components/permission-gate";

import { InviteMemberDialog } from "../../../../components/team/InviteMemberDialog";
import { RoleCapabilitiesDialog } from "../../../../components/team/RoleCapabilitiesDialog";
import { RoleCard } from "../../../../components/team/RoleCard";
import { RolePermissionsDialog } from "../../../../components/team/RolePermissionsDialog";
import { StaffRolesDialog } from "../../../../components/team/StaffRolesDialog";
import { StaffTable } from "../../../../components/team/StaffTable";
import { isBuiltInRole, type Role, type StaffMember } from "../../../../lib/api/team";
import {
  useAssignStaffRoles,
  useDeleteRole,
  useDuplicateRole,
  useInviteMember,
  usePermissions,
  useRemoveMember,
  useResetMemberPassword,
  useSetMemberSuspended,
  useRole,
  useRoles,
  useStaff,
  useUpdateRolePermissions,
} from "../../../../lib/hooks/use-team";

export default function TeamPage() {
  const { toast } = useToast();

  // Data queries
  const { data: staff, isLoading: staffLoading } = useStaff();
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: permissionGroups, isLoading: permissionsLoading } =
    usePermissions();

  // Staff roles dialog
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(
    null
  );

  // Role editing. Two views of the same role: the plain-English capability
  // editor (the default), and the raw permission-code grid behind "Advanced".
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const { data: roleWithPerms, isLoading: rolePermsLoading } = useRole(
    selectedRole?.id ?? ""
  );

  // Invite member dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Password reset result dialog
  const [resetResultOpen, setResetResultOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{
    email: string;
    name: string;
    tempPassword: string;
  } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);

  // Mutations
  const assignRoles = useAssignStaffRoles();
  const inviteMember = useInviteMember();
  const resetPassword = useResetMemberPassword();
  const removeMember = useRemoveMember();
  const setSuspended = useSetMemberSuspended();
  const duplicateRole = useDuplicateRole();
  const deleteRole = useDeleteRole();
  const updateRolePermissions = useUpdateRolePermissions();

  // --- Staff Handlers ---

  const handleManageRoles = useCallback((member: StaffMember) => {
    setSelectedMember(member);
    setStaffDialogOpen(true);
  }, []);

  const handleSaveStaffRoles = useCallback(
    (userId: string, roleIds: string[]) => {
      assignRoles.mutate(
        { userId, roleIds },
        {
          onSuccess: () => {
            toast({
              title: "Roles updated",
              description: "Staff member roles have been updated.",
            });
            setStaffDialogOpen(false);
          },
          onError: (err) => {
            toast({
              title: "Error",
              description:
                err instanceof Error
                  ? err.message
                  : "Failed to update roles",
              variant: "destructive",
            });
          },
        }
      );
    },
    [assignRoles, toast]
  );

  const handleInviteSubmit = useCallback(
    (
      data: { email: string; name: string; roleIds: string[] },
      callbacks: {
        onSuccess: (result: { tempPassword?: string }) => void;
        onError: (err: Error) => void;
      }
    ) => {
      inviteMember.mutate(data, {
        onSuccess: (result) => {
          callbacks.onSuccess(result);
          toast({
            title: "Invitation sent",
            description: `${data.name} has been invited to the team.`,
          });
        },
        onError: (err) => {
          callbacks.onError(
            err instanceof Error ? err : new Error("Failed to invite member")
          );
          toast({
            title: "Error",
            description:
              err instanceof Error ? err.message : "Failed to invite member",
            variant: "destructive",
          });
        },
      });
    },
    [inviteMember, toast]
  );

  const handleResetPassword = useCallback(
    (member: StaffMember) => {
      const confirmed = window.confirm(
        `Reset password for ${member.name} (${member.email})? They will receive a new temporary password via email.`
      );
      if (!confirmed) return;

      resetPassword.mutate(member.user_id, {
        onSuccess: (result) => {
          setResetResult({
            email: member.email,
            name: member.name,
            tempPassword: result.tempPassword,
          });
          setResetResultOpen(true);
          toast({
            title: "Password reset",
            description: `New temporary password has been set for ${member.name}.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description:
              err instanceof Error
                ? err.message
                : "Failed to reset password",
            variant: "destructive",
          });
        },
      });
    },
    [resetPassword, toast]
  );

  const handleRemoveMember = useCallback(
    (member: StaffMember) => {
      if (member.is_owner) return;
      const confirmed = window.confirm(
        `Remove ${member.name} (${member.email}) from the team? They will lose access to this organization. This cannot be undone.`
      );
      if (!confirmed) return;

      removeMember.mutate(member.user_id, {
        onSuccess: () => {
          toast({
            title: "Member removed",
            description: `${member.name} has been removed from the team.`,
          });
        },
        onError: (err) => {
          toast({
            title: "Error",
            description:
              err instanceof Error
                ? err.message
                : "Failed to remove member",
            variant: "destructive",
          });
        },
      });
    },
    [removeMember, toast]
  );

  /**
   * Suspend keeps their roles and their history, the person on leave or serving
   * notice loses access, not their record. Removing is the irreversible one, so
   * only that gets a confirm.
   */
  const handleSetSuspended = useCallback(
    (member: StaffMember, suspended: boolean) => {
      setSuspended.mutate(
        { userId: member.user_id, suspended },
        {
          onSuccess: () =>
            toast({
              title: suspended
                ? `${member.name} suspended`
                : `${member.name} is back`,
              description: suspended
                ? "They can't sign in until you restore their access. Their roles are kept."
                : "They can sign in again, with the roles they had before.",
            }),
          onError: (err) =>
            toast({
              title: "Couldn't change their access",
              description:
                err instanceof Error ? err.message : "Please try again.",
              variant: "destructive",
            }),
        }
      );
    },
    [setSuspended, toast]
  );

  const handleCopyResetCredentials = useCallback(() => {
    if (!resetResult) return;
    navigator.clipboard.writeText(
      `Email: ${resetResult.email}\nTemporary Password: ${resetResult.tempPassword}`
    );
    setResetCopied(true);
    setTimeout(() => setResetCopied(false), 2000);
  }, [resetResult]);

  // --- Role Handlers ---

  /** Clicking a role opens the plain-English editor, never the code grid. */
  const handleEditRole = useCallback((role: Role) => {
    setSelectedRole(role);
    setCapDialogOpen(true);
  }, []);

  /** "Advanced" swaps the capability editor for the raw permission-code grid. */
  const handleOpenAdvanced = useCallback((role: Role) => {
    setSelectedRole(role);
    setCapDialogOpen(false);
    setPermDialogOpen(true);
  }, []);

  const handleSavePermissions = useCallback(
    (roleId: string, permissionIds: string[]) => {
      updateRolePermissions.mutate(
        { roleId, permissionIds },
        {
          onSuccess: () => {
            toast({
              title: "Permissions updated",
              description: "The role's permissions have been saved.",
            });
            setPermDialogOpen(false);
          },
          onError: (err) =>
            toast({
              title: "Couldn't save permissions",
              description:
                err instanceof Error ? err.message : "Please try again.",
              variant: "destructive",
            }),
        }
      );
    },
    [updateRolePermissions, toast]
  );

  /**
   * The one way into a custom role. Built-in templates are shared across every
   * tenant, so instead of editing one you copy it, and land on the copy's
   * editor with its permissions already carried over.
   */
  const handleDuplicateRole = useCallback(
    (role: Role) => {
      duplicateRole.mutate(
        { roleId: role.id },
        {
          onSuccess: (created) => {
            toast({
              title: `Created "${created.name}"`,
              description: `An editable copy of ${role.name}. Change what it can do below.`,
            });
            setSelectedRole(created);
          },
          onError: (err) =>
            toast({
              title: "Couldn't duplicate the role",
              description:
                err instanceof Error ? err.message : "Please try again.",
              variant: "destructive",
            }),
        }
      );
    },
    [duplicateRole, toast]
  );

  /** "New role" = the capability dialog with no role behind it. */
  const handleNewRole = useCallback(() => {
    setSelectedRole(null);
    setCapDialogOpen(true);
  }, []);

  const handleDeleteRole = useCallback(
    (role: Role) => {
      const confirmed = window.confirm(
        `Delete "${role.name}"? Anyone who only has this role will lose access to the dashboard. This cannot be undone.`
      );
      if (!confirmed) return;

      deleteRole.mutate(role.id, {
        onSuccess: () =>
          toast({
            title: "Role deleted",
            description: `"${role.name}" has been removed.`,
          }),
        onError: (err) =>
          toast({
            title: "Couldn't delete the role",
            description:
              err instanceof Error ? err.message : "Please try again.",
            variant: "destructive",
          }),
      });
    },
    [deleteRole, toast]
  );

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Team Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your team members, roles, and permissions.
          </p>
        </div>
        <PermissionGate requires="staff.manage">
          <Button onClick={() => setInviteDialogOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" />
            Invite Member
          </Button>
        </PermissionGate>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="staff" className="w-full">
        <TabsList>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-4 w-4" />
            Staff Members
            {staff && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {staff.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Roles & Permissions
            {roles && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {roles.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff" className="mt-4">
          <StaffTable
            staff={staff ?? []}
            isLoading={staffLoading}
            onManageRoles={handleManageRoles}
            onResetPassword={handleResetPassword}
            onRemoveMember={handleRemoveMember}
            onSetSuspended={handleSetSuspended}
          />
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="mt-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <p className="max-w-2xl text-sm text-muted-foreground">
              A role is a list of things a person is allowed to do. The four
              built-in roles cover most teams, copy one to make your own.
            </p>
            <PermissionGate requires="roles.manage">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewRole}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                New role
              </Button>
            </PermissionGate>
          </div>

          {rolesLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : !roles || roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No roles yet</p>
              <p className="mb-4 text-sm">
                Roles decide what each teammate can do. Create your first one.
              </p>
              <PermissionGate requires="roles.manage">
                <Button size="sm" onClick={handleNewRole}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New role
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  onViewPermissions={handleEditRole}
                  // Built-in templates are shared across tenants, never deletable.
                  onDelete={isBuiltInRole(role) ? undefined : handleDeleteRole}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <StaffRolesDialog
        open={staffDialogOpen}
        onOpenChange={setStaffDialogOpen}
        member={selectedMember}
        allRoles={roles ?? []}
        onSave={handleSaveStaffRoles}
        isSaving={assignRoles.isPending}
      />

      {/* The default role editor: plain-English sentences, not permission codes. */}
      <RoleCapabilitiesDialog
        open={capDialogOpen}
        onOpenChange={setCapDialogOpen}
        role={selectedRole}
        onOpenAdvanced={handleOpenAdvanced}
        onDuplicate={handleDuplicateRole}
        isDuplicating={duplicateRole.isPending}
      />

      {/* The escape hatch: the raw permission-code grid, for people who want it.
          Built-in templates stay read-only here too. */}
      <RolePermissionsDialog
        open={permDialogOpen}
        onOpenChange={setPermDialogOpen}
        role={selectedRole}
        currentPermissionIds={
          new Set(roleWithPerms?.permissions.map((p) => p.id) ?? [])
        }
        permissionGroups={permissionGroups ?? []}
        isLoadingPermissions={permissionsLoading || rolePermsLoading}
        onSave={handleSavePermissions}
        isSaving={updateRolePermissions.isPending}
        readOnly={selectedRole ? isBuiltInRole(selectedRole) : true}
      />



      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        allRoles={roles ?? []}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteMember.isPending}
      />

      {/* Password Reset Result Dialog */}
      <Dialog open={resetResultOpen} onOpenChange={setResetResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset Complete</DialogTitle>
            <DialogDescription>
              A new temporary password has been generated and emailed to the
              member.
            </DialogDescription>
          </DialogHeader>

          {resetResult && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/40">
                <div className="mb-2 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    Password reset for {resetResult.name}
                  </span>
                </div>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  An email with the new credentials has been sent to{" "}
                  <strong>{resetResult.email}</strong>.
                </p>
              </div>

              <div className="rounded-lg border border bg-muted/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New Credentials
                </p>
                <div className="space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium text-foreground">
                      {resetResult.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password: </span>
                    <span className="font-medium text-foreground">
                      {resetResult.tempPassword}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleCopyResetCredentials}
                >
                  {resetCopied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy Credentials
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                The member should change this password after their first login.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResetResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

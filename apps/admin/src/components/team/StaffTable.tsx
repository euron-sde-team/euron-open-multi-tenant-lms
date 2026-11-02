"use client";

import { Button } from "@open-mtlms/core";
import { Crown, KeyRound, Pause, Play, Settings2, Trash2, UserCircle } from "lucide-react";

import type { Role, StaffMember } from "../../lib/api/team";
import { cn } from "../../lib/utils";

function getRoleBadgeColor(code: string): string {
  const map: Record<string, string> = {
    admin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    educator: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    finance: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    ops: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  };
  return map[code] ?? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusColor(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "SUSPENDED":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "INVITED":
      return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface StaffTableProps {
  staff: StaffMember[];
  isLoading: boolean;
  onManageRoles: (member: StaffMember) => void;
  onResetPassword: (member: StaffMember) => void;
  onRemoveMember: (member: StaffMember) => void;
  /** Switch access off (reversible) rather than deleting them outright. */
  onSetSuspended: (member: StaffMember, suspended: boolean) => void;
}

export function StaffTable({
  staff,
  isLoading,
  onManageRoles,
  onResetPassword,
  onRemoveMember,
  onSetSuspended,
}: StaffTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!staff || staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <UserCircle className="mb-3 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No staff members found</p>
        <p className="text-sm">Staff members will appear here once added.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border">
      <table className="w-full">
        <thead>
          <tr className="border-b border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Member
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Roles
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Joined
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {staff.map((member, idx) => (
            <tr
              key={member.membership_id}
              className={cn(
                "border-b border transition-colors hover:bg-muted",
                idx % 2 === 1 && "bg-muted/30"
              )}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {member.name}
                      </span>
                      {member.is_owner && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
                          <Crown className="h-3 w-3" />
                          Owner
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                    statusColor(member.status)
                  )}
                >
                  {member.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {member.roles.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No roles assigned
                    </span>
                  ) : (
                    member.roles.map((role: Role) => (
                      <span
                        key={role.id}
                        className={cn(
                          "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          getRoleBadgeColor(role.code)
                        )}
                      >
                        {role.name}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDate(member.joined_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onManageRoles(member)}
                    disabled={member.is_owner}
                    title={
                      member.is_owner
                        ? "Cannot modify owner roles"
                        : "Manage roles"
                    }
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Roles
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResetPassword(member)}
                    title="Reset password"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  {/* Suspend keeps their roles and their history; removing
                      throws both away. Offer the reversible one first. */}
                  {!member.is_owner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onSetSuspended(member, member.status !== "SUSPENDED")
                      }
                      title={
                        member.status === "SUSPENDED"
                          ? "Restore access"
                          : "Suspend access"
                      }
                    >
                      {member.status === "SUSPENDED" ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  {!member.is_owner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRemoveMember(member)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";
import { Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import type { Role, StaffMember } from "../../lib/api/team";
import { cn } from "../../lib/utils";

/**
 * The accent stripe on a selected role.
 *
 * Only the ACCENT is per-role, the row's fill and text come from theme tokens,
 * never from a fixed colour. The previous version selected a row with a raw
 * `bg-indigo-50`, which is a light fill: in dark mode the text stayed light and
 * the row became unreadable. A `bg-*-50` is always a light-mode-only decision.
 */
function getRoleAccent(code: string): string {
  const map: Record<string, string> = {
    admin: "bg-indigo-500",
    educator: "bg-emerald-500",
    finance: "bg-amber-500",
    ops: "bg-cyan-500",
  };
  return map[code] ?? "bg-purple-500";
}

interface StaffRolesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: StaffMember | null;
  allRoles: Role[];
  onSave: (userId: string, roleIds: string[]) => void;
  isSaving: boolean;
}

export function StaffRolesDialog({
  open,
  onOpenChange,
  member,
  allRoles,
  onSave,
  isSaving,
}: StaffRolesDialogProps) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (member) {
      setSelectedRoleIds(new Set(member.roles.map((r) => r.id)));
    }
  }, [member]);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!member) return;
    onSave(member.user_id, Array.from(selectedRoleIds));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Roles</DialogTitle>
          <DialogDescription>
            {member
              ? `Assign roles to ${member.name} (${member.email})`
              : "Select a staff member"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {allRoles.map((role) => {
            const checked = selectedRoleIds.has(role.id);
            return (
              <label
                key={role.id}
                className={cn(
                  // Fills and spacing, not outlines. The selected state is a
                  // theme token (`bg-muted`), so it reads correctly in both
                  // light and dark, the role's colour is carried by the accent
                  // stripe alone.
                  "relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-lg p-3 pl-4 transition-colors",
                  checked ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                {checked && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-1",
                      getRoleAccent(role.code)
                    )}
                  />
                )}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRole(role.id)}
                  className="h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500"
                />
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {role.name}
                    </span>
                    {role.is_system && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        System
                      </span>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  )}
                </div>
              </label>
            );
          })}

          {allRoles.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No roles available
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

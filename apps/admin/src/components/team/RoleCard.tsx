"use client";

import { Button } from "@open-mtlms/core";
import { Lock, Shield, Trash2 } from "lucide-react";

import { isBuiltInRole, type Role } from "../../lib/api/team";
import { cn } from "../../lib/utils";

function getRoleAccent(code: string): string {
  const map: Record<string, string> = {
    admin: "border-l-indigo-500",
    educator: "border-l-emerald-500",
    finance: "border-l-amber-500",
    ops: "border-l-cyan-500",
  };
  return map[code] ?? "border-l-purple-500";
}

interface RoleCardProps {
  role: Role;
  permissionCount?: number;
  onViewPermissions: (role: Role) => void;
  onDelete?: (role: Role) => void;
}

export function RoleCard({
  role,
  permissionCount,
  onViewPermissions,
  onDelete,
}: RoleCardProps) {
  const builtIn = isBuiltInRole(role);

  return (
    <div
      className={cn(
        "group relative rounded-lg border border border-l-4 bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
        getRoleAccent(role.code)
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {role.name}
              </h3>
              {builtIn && (
                <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Built-in
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {role.description || "No description"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {permissionCount !== undefined
            ? `${permissionCount} permission${permissionCount !== 1 ? "s" : ""}`
            : "-"}
        </span>

        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewPermissions(role)}
            className="h-7 text-xs"
          >
            <Shield className="mr-1 h-3 w-3" />
            {builtIn ? "View" : "Edit"}
          </Button>
          {/* The page only passes onDelete for roles this tenant actually owns.
              built-in templates are shared, so they're never deletable. */}
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(role)}
              className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
              title="Delete role"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

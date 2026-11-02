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
import { ChevronDown, ChevronRight, Loader2, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import type { Permission, PermissionGroup, Role } from "../../lib/api/team";
import { cn } from "../../lib/utils";

interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  currentPermissionIds: Set<string>;
  permissionGroups: PermissionGroup[];
  isLoadingPermissions: boolean;
  onSave?: (roleId: string, permissionIds: string[]) => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

export function RolePermissionsDialog({
  open,
  onOpenChange,
  role,
  currentPermissionIds,
  permissionGroups,
  isLoadingPermissions,
  onSave,
  isSaving = false,
  readOnly = false,
}: RolePermissionsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    if (open && currentPermissionIds) {
      setSelectedIds(new Set(currentPermissionIds));
      // Expand all categories by default
      setExpandedCategories(
        new Set(permissionGroups.map((g) => g.category))
      );
    }
  }, [open, currentPermissionIds, permissionGroups]);

  const togglePermission = (permId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleAllInCategory = (permissions: Permission[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = permissions.every((p) => next.has(p.id));
      if (allSelected) {
        permissions.forEach((p) => next.delete(p.id));
      } else {
        permissions.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!role || !onSave) return;
    onSave(role.id, Array.from(selectedIds));
  };

  const totalPermissions = permissionGroups.reduce(
    (sum, g) => sum + g.permissions.length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-500" />
            {role?.name}: Permissions
          </DialogTitle>
          <DialogDescription>
            {selectedIds.size} of {totalPermissions} permissions
            {readOnly ? " assigned to this role" : " selected"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 py-2 min-h-0">
          {isLoadingPermissions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : permissionGroups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No permissions available
            </p>
          ) : (
            permissionGroups.map((group) => {
              const expanded = expandedCategories.has(group.category);
              const allChecked = group.permissions.every((p) =>
                selectedIds.has(p.id)
              );
              const someChecked =
                !allChecked &&
                group.permissions.some((p) => selectedIds.has(p.id));
              const checkedCount = group.permissions.filter((p) =>
                selectedIds.has(p.id)
              ).length;

              return (
                <div
                  key={group.category}
                  className="rounded-lg border border"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-muted transition-colors"
                    onClick={() => toggleCategory(group.category)}
                  >
                    <div className="flex items-center gap-2">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold capitalize text-foreground">
                        {group.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({checkedCount}/{group.permissions.length})
                      </span>
                    </div>
                    <label
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {!readOnly && <span className="text-xs text-muted-foreground">All</span>}
                      <input
                        type="checkbox"
                        checked={allChecked}
                        disabled={readOnly}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked;
                        }}
                        onChange={() =>
                          toggleAllInCategory(group.permissions)
                        }
                        className="h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                      />
                    </label>
                  </button>

                  {expanded && (
                    <div className="border-t border px-4 py-2 space-y-1">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted",
                            selectedIds.has(perm.id) && "bg-muted"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(perm.id)}
                            disabled={readOnly}
                            onChange={() => togglePermission(perm.id)}
                            className="h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                          />
                          <div className="flex-1">
                            <span className="text-sm text-foreground">
                              {perm.name}
                            </span>
                            {perm.description && (
                              <p className="text-xs text-muted-foreground">
                                {perm.description}
                              </p>
                            )}
                          </div>
                          <code className="text-[10px] text-muted-foreground font-mono">
                            {perm.code}
                          </code>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          {readOnly ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Permissions
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

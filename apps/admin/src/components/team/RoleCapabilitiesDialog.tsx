"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
} from "@open-mtlms/core";
import { AlertTriangle, Lock, Search, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DANGER_LABELS,
  isBuiltInRole,
  type Capability,
  type CapabilityArea,
  type Role,
} from "../../lib/api/team";
import {
  useCapabilities,
  useCreateRole,
  useRoleCapabilities,
  useUpdateRoleCapabilities,
} from "../../lib/hooks/use-team";
import { cn } from "../../lib/utils";

interface RoleCapabilitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The role being edited, or NULL to create a new one. */
  role: Role | null;
  /** Opens the raw permission-code grid, the escape hatch for power users. */
  onOpenAdvanced: (role: Role) => void;
  /** Turn a read-only template into this tenant's own editable copy. */
  onDuplicate: (role: Role) => void;
  isDuplicating?: boolean;
}

/**
 * One dialog, two jobs: name a NEW role and choose what it can do, or edit an
 * existing one.
 *
 * These used to be two dialogs, a "Create Custom Role" form, then this. That's
 * a seam with no reason to exist: naming a role and deciding what it can do are
 * one decision, and splitting them meant the first screen you met was a form
 * asking for a slug. Passing `role: null` puts this dialog in create mode, so
 * the name field simply appears above the capabilities.
 *
 * Each capability is a sentence an admin can act on, "Can publish courses".
 * with the consequence spelled out underneath and a warning chip when the answer
 * is "yes, and learners see it immediately" or "yes, and it moves money". The
 * permission codes still exist; they're just not the vocabulary any more.
 */
export function RoleCapabilitiesDialog({
  open,
  onOpenChange,
  role,
  onOpenAdvanced,
  onDuplicate,
  isDuplicating,
}: RoleCapabilitiesDialogProps) {
  const { toast } = useToast();
  const { data: areas, isLoading: areasLoading } = useCapabilities();
  const { data: current, isLoading: currentLoading } = useRoleCapabilities(
    open ? role?.id : undefined
  );
  const save = useUpdateRoleCapabilities();
  const create = useCreateRole();

  const isCreating = role === null;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const readOnly = role ? isBuiltInRole(role) : false;
  const isLoading = areasLoading || (!isCreating && currentLoading);
  const isSaving = save.isPending || create.isPending;

  // Reset to what the server has whenever we open on a different role.
  useEffect(() => {
    if (open && current) setSelected(new Set(current.capabilityIds));
  }, [open, current, role?.id]);

  // A brand-new role starts with the baseline capabilities already ticked.
  // chiefly "Can see the dashboard", which is the page they land on after
  // signing in. Starting from a blank slate meant a new role's first experience
  // was "Failed to load dashboard: Insufficient permissions".
  useEffect(() => {
    if (open && isCreating && areas) {
      const defaults = areas
        .flatMap((a) => a.features)
        .flatMap((f) => f.capabilities)
        .filter((c) => c.defaultOn && !c.ownerOnly)
        .map((c) => c.id);
      setSelected(new Set(defaults));
      setName("");
      setDescription("");
    }
  }, [open, isCreating, areas]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const visibleAreas = useMemo(
    () => filterAreas(areas ?? [], query),
    [areas, query]
  );

  const grantableCount = useMemo(() => {
    let n = 0;
    for (const a of areas ?? [])
      for (const f of a.features)
        for (const c of f.capabilities) if (!c.ownerOnly) n++;
    return n;
  }, [areas]);

  function toggle(cap: Capability, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(cap.id);
      else next.delete(cap.id);
      return next;
    });
  }

  function toggleArea(area: CapabilityArea, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const f of area.features)
        for (const c of f.capabilities) {
          if (c.ownerOnly) continue;
          if (on) next.add(c.id);
          else next.delete(c.id);
        }
      return next;
    });
  }

  function fail(err: unknown) {
    toast({
      title: "Couldn't save the role",
      description: err instanceof Error ? err.message : "Please try again.",
      variant: "destructive",
    });
  }

  function done(roleName: string, verb: string) {
    toast({
      title: `${roleName} ${verb}`,
      description: `It can do ${selected.size} of ${grantableCount} things.`,
    });
    onOpenChange(false);
  }

  function handleSave() {
    const capabilityIds = [...selected];

    if (isCreating) {
      // Create the role, then apply what was ticked. Two calls, but one action
      // as far as the user is concerned, they never see a role that exists but
      // can't do anything.
      create.mutate(
        { name: name.trim(), description: description.trim() || undefined },
        {
          onSuccess: (created) => {
            if (capabilityIds.length === 0) {
              done(created.name, "created");
              return;
            }
            save.mutate(
              { roleId: created.id, capabilityIds },
              {
                onSuccess: () => done(created.name, "created"),
                onError: fail,
              }
            );
          },
          onError: fail,
        }
      );
      return;
    }

    if (!role) return;
    save.mutate(
      { roleId: role.id, capabilityIds },
      {
        onSuccess: () => done(role.name, "updated"),
        onError: fail,
      }
    );
  }

  /** Can't save a nameless role. Everything else is optional. */
  const canSave = isCreating ? name.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle>
            {isCreating ? "New role" : `What can ${role?.name} do?`}
          </DialogTitle>
          <DialogDescription>
            Tick everything a person with this role is allowed to do. Anything
            left unticked, they simply won&apos;t see.
          </DialogDescription>
        </DialogHeader>

        {/* Naming the role and deciding what it can do are one decision, so they
            live on one screen. */}
        {isCreating && (
          <div className="space-y-3 px-6 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-role-name">Name</Label>
              <Input
                id="new-role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Content Manager"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role-description">
                What is this role for?{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="new-role-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Writes and publishes courses, but can't touch payments."
              />
            </div>
          </div>
        )}

        {/* A built-in template is shared by every tenant, so it can't be edited
            in place. Offer the one action that gets them unstuck. */}
        {readOnly && role && (
          <div className="mx-6 mb-4 flex items-start gap-3 rounded-lg bg-muted p-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-foreground">
                {role.name} is a built-in role
              </p>
              <p className="text-muted-foreground">
                It stays the same for everyone. Make your own copy to change
                what it can do.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => onDuplicate(role)}
              disabled={isDuplicating}
            >
              {isDuplicating ? "Copying…" : "Duplicate & edit"}
            </Button>
          </div>
        )}

        {/* The role was hand-edited in Advanced, so these sentences no longer
            describe it exactly. Say so rather than quietly misrepresenting it. */}
        {!isLoading && current && !current.exact && (
          <div className="mx-6 mb-4 flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-amber-800 dark:text-amber-200">
              This role was customised in Advanced, so it holds a few extra
              permissions that aren&apos;t listed here. Saving from this screen
              will replace them with exactly what you tick.
            </p>
          </div>
        )}

        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, e.g. refund, publish, learner"
              className="h-9 w-full rounded-lg bg-muted px-9 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : visibleAreas.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="space-y-5">
              {visibleAreas.map((area) => (
                <AreaSection
                  key={area.area}
                  area={area}
                  selected={selected}
                  readOnly={readOnly}
                  onToggle={toggle}
                  onToggleArea={toggleArea}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 px-6 pb-6 pt-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {selected.size} of {grantableCount} selected
            </span>
            {role && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={() => onOpenAdvanced(role)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Advanced
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button onClick={handleSave} disabled={isSaving || !canSave}>
                {isSaving
                  ? "Saving…"
                  : isCreating
                    ? "Create role"
                    : "Save changes"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AreaSection({
  area,
  selected,
  readOnly,
  onToggle,
  onToggleArea,
}: {
  area: CapabilityArea;
  selected: Set<string>;
  readOnly: boolean;
  onToggle: (cap: Capability, on: boolean) => void;
  onToggleArea: (area: CapabilityArea, on: boolean) => void;
}) {
  const grantable = area.features.flatMap((f) =>
    f.capabilities.filter((c) => !c.ownerOnly)
  );
  const on = grantable.filter((c) => selected.has(c.id)).length;
  const allOn = grantable.length > 0 && on === grantable.length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{area.label}</h4>
        {!readOnly && grantable.length > 0 && (
          <button
            type="button"
            onClick={() => onToggleArea(area, !allOn)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {allOn ? "Clear all" : "Select all"}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {area.features.flatMap((f) =>
          f.capabilities.map((cap) => (
            <CapabilityRow
              key={cap.id}
              cap={cap}
              checked={selected.has(cap.id)}
              readOnly={readOnly}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CapabilityRow({
  cap,
  checked,
  readOnly,
  onToggle,
}: {
  cap: Capability;
  checked: boolean;
  readOnly: boolean;
  onToggle: (cap: Capability, on: boolean) => void;
}) {
  const disabled = readOnly || !!cap.ownerOnly;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors",
        disabled ? "cursor-default opacity-60" : "hover:bg-muted"
      )}
    >
      <input
        type="checkbox"
        checked={checked && !cap.ownerOnly}
        disabled={disabled}
        onChange={(e) => onToggle(cap, e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">
            {cap.label}
          </span>
          {cap.danger && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                dangerChip(cap.danger)
              )}
            >
              {DANGER_LABELS[cap.danger]}
            </span>
          )}
          {cap.ownerOnly && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Lock className="h-2.5 w-2.5" />
              Owner only
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {cap.ownerOnly
            ? "Only the account owner can do this. It can't be given to a role."
            : cap.description}
        </p>
      </div>
    </label>
  );
}

function dangerChip(danger: NonNullable<Capability["danger"]>): string {
  switch (danger) {
    case "DESTRUCTIVE":
      return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300";
    case "FINANCIAL":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
    case "PERSONAL_DATA":
      return "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300";
    case "PUBLIC":
      return "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300";
  }
}

/** Search across the sentence and its explanation, never the permission codes. */
function filterAreas(areas: CapabilityArea[], query: string): CapabilityArea[] {
  const q = query.trim().toLowerCase();
  if (!q) return areas;

  return areas
    .map((area) => ({
      ...area,
      features: area.features
        .map((f) => ({
          ...f,
          capabilities: f.capabilities.filter(
            (c) =>
              c.label.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q)
          ),
        }))
        .filter((f) => f.capabilities.length > 0),
    }))
    .filter((a) => a.features.length > 0);
}

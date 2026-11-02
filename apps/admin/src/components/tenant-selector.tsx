"use client";

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  useToast,
} from "@open-mtlms/core";
import { Building2, Check, ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { captureEvent } from "@/lib/analytics";
import { useCreateOrganization } from "@/lib/hooks/use-organization";
import { useTenantStore } from "@/lib/stores/tenant-store";

function CreateOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const { toast } = useToast();
  const createOrgMutation = useCreateOrganization();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createOrgMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: (data) => {
          toast({
            title: "Organization created",
            description: `${data.name} is ready to go.`,
          });
          setName("");
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to create organization",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="e.g. Acme Academy"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={createOrgMutation.isPending}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will be used to generate your unique subdomain
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createOrgMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrgMutation.isPending || !name.trim()}
            >
              {createOrgMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Lightweight tenant shape rendered in the switcher list. */
type SwitcherTenant = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  is_owner: boolean;
};

function TenantRow({
  tenant,
  isActive,
  onSelect,
}: {
  tenant: SwitcherTenant;
  isActive: boolean;
  onSelect: (tenant: SwitcherTenant) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tenant)}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
        isActive && "bg-primary/10"
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{tenant.tenant_name}</span>
          {tenant.is_owner && (
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              Owner
            </span>
          )}
        </span>
      </span>
      {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}

export function TenantSelector() {
  const { tenants, selectedTenantId, selectedTenant, selectTenant } =
    useTenantStore();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [search, setSearch] = useState("");

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const normalizedSearch = search.trim().toLowerCase();

  // The user's own orgs, pinned owned-first (an owned academy is always the
  // first item), filtered client-side by the search term.
  const membershipItems = useMemo<SwitcherTenant[]>(() => {
    const ownedFirst = [...tenants].sort(
      (a, b) => Number(b.is_owner) - Number(a.is_owner)
    );
    if (!normalizedSearch) return ownedFirst;
    return ownedFirst.filter(
      (t) =>
        t.tenant_name.toLowerCase().includes(normalizedSearch) ||
        t.tenant_slug.toLowerCase().includes(normalizedSearch)
    );
  }, [tenants, normalizedSearch]);

  if (!mounted) return null;
  // No memberships: nothing to switch.
  if (tenants.length === 0) return null;

  const hasAnyItem = membershipItems.length > 0;

  const triggerLabel =
    selectedTenant?.tenant_name ??
    tenants.find((t) => t.tenant_id === selectedTenantId)?.tenant_name ??
    tenants[0]?.tenant_name;

  // Single-tenant user: static badge + create button (no switcher).
  if (tenants.length === 1) {
    return (
      <>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{tenants[0].tenant_name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Create new organization"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <CreateOrganizationDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
        />
      </>
    );
  }

  const handleSelect = (tenant: SwitcherTenant) => {
    selectTenant(tenant.tenant_id, {
      tenant_id: tenant.tenant_id,
      tenant_name: tenant.tenant_name,
      tenant_slug: tenant.tenant_slug,
    });
    captureEvent("tenant_switched", { tenant_id: tenant.tenant_id });
    setOpen(false);
    setSearch("");
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 font-normal">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[140px] truncate sm:max-w-[180px]">
              {triggerLabel}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[320px] p-0 sm:w-[360px] lg:w-[400px] max-w-[calc(100vw-1.5rem)]"
        >
          {/* Search box (typing works here, unlike a Radix DropdownMenu) */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizations..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Scrollable list, plain overflow div, NOT Radix ScrollArea */}
          <div className="max-h-[320px] overflow-y-auto py-1">
            {!hasAnyItem ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No organizations found
              </div>
            ) : (
              <>
                {/* Your organizations (pinned, owned-first) */}
                {membershipItems.map((tenant) => (
                  <TenantRow
                    key={tenant.tenant_id}
                    tenant={tenant}
                    isActive={tenant.tenant_id === selectedTenantId}
                    onSelect={handleSelect}
                  />
                ))}

              </>
            )}
          </div>

          <Separator />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowCreateDialog(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </button>
        </PopoverContent>
      </Popover>
      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}

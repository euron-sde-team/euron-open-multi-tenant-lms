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
import { Check, Copy, Loader2, Search, Shield, UserPlus, UserCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { Role } from "../../lib/api/team";
import { useCheckEmail } from "../../lib/hooks/use-team";
import { cn } from "../../lib/utils";

function getRoleBadgeColor(code: string): string {
  const map: Record<string, string> = {
    admin: "bg-muted",
    educator: "bg-muted",
    finance: "bg-muted",
    ops: "bg-muted",
  };
  return map[code] ?? "bg-muted";
}

type Step = "search" | "form" | "result";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allRoles: Role[];
  onSubmit: (
    data: { email: string; name: string; roleIds: string[] },
    callbacks: {
      onSuccess: (result: { tempPassword?: string }) => void;
      onError: (err: Error) => void;
    }
  ) => void;
  isSubmitting: boolean;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  allRoles,
  onSubmit,
  isSubmitting,
}: InviteMemberDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [searchEmail, setSearchEmail] = useState("");
  const [debouncedEmail, setDebouncedEmail] = useState("");
  const [name, setName] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    tempPassword?: string;
    email: string;
    isNew: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Debounce email for API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmail(searchEmail.trim().toLowerCase());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchEmail]);

  const { data: emailCheck, isLoading: isChecking, isFetching } = useCheckEmail(debouncedEmail);

  const resetForm = useCallback(() => {
    setStep("search");
    setSearchEmail("");
    setDebouncedEmail("");
    setName("");
    setIsNewUser(false);
    setSelectedRoleIds(new Set());
    setResult(null);
    setCopied(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) resetForm();
      onOpenChange(open);
    },
    [onOpenChange, resetForm]
  );

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSelectExistingUser = () => {
    if (!emailCheck?.user) return;
    setName(emailCheck.user.name);
    setIsNewUser(false);
    setStep("form");
  };

  const handleCreateNewUser = () => {
    setName("");
    setIsNewUser(true);
    setStep("form");
  };

  const handleSubmit = () => {
    const email = searchEmail.trim().toLowerCase();
    if (!email || selectedRoleIds.size === 0) return;
    if (isNewUser && !name.trim()) return;

    const submitName = isNewUser ? name.trim() : (emailCheck?.user?.name ?? name.trim());

    onSubmit(
      { email, name: submitName, roleIds: Array.from(selectedRoleIds) },
      {
        onSuccess: (res) => {
          setResult({ tempPassword: res.tempPassword, email, isNew: isNewUser });
          setStep("result");
        },
        onError: () => {},
      }
    );
  };

  const handleCopyCredentials = () => {
    if (!result) return;
    const text = result.tempPassword
      ? `Email: ${result.email}\nTemporary Password: ${result.tempPassword}`
      : `Email: ${result.email}\n(Existing user, no new password generated)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Result screen ──
  if (step === "result" && result) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Member Invited</DialogTitle>
            <DialogDescription>
              {result.isNew
                ? "A new account has been created and invitation sent."
                : "The user has been added to your team."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <div className="mb-2 flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {result.isNew ? "Account created & invitation sent" : "Added to team successfully"}
                </span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {result.isNew ? "An email with login credentials has been sent to " : ""}
                <strong>{result.email}</strong>
                {!result.isNew && " can now access this organization."}
              </p>
            </div>

            {result.tempPassword && (
              <div className="rounded-lg border border bg-muted/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Login Credentials
                </p>
                <div className="space-y-2 font-mono text-sm">
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium text-foreground">{result.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Password: </span>
                    <span className="font-medium text-foreground">{result.tempPassword}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleCopyCredentials}>
                  {copied ? (
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
            )}

            {!result.tempPassword && (
              <div className="rounded-lg bg-sky-50 p-4 dark:bg-sky-950/40">
                <p className="text-sm text-sky-700 dark:text-sky-300">
                  This user already has an account. They can log in with their existing password.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Form screen (roles + optional name) ──
  if (step === "form") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isNewUser ? "Create & Invite Member" : "Add to Team"}
            </DialogTitle>
            <DialogDescription>
              {isNewUser
                ? "Create a new account and send login credentials."
                : `Add ${emailCheck?.user?.name ?? searchEmail} to your team.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Show selected user info */}
            {!isNewUser && emailCheck?.user && (
              <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
                <UserCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {emailCheck.user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {emailCheck.user.email}
                  </p>
                </div>
              </div>
            )}

            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <input
                type="email"
                value={searchEmail}
                disabled
                className="w-full rounded-lg border border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              />
            </div>

            {/* Name (only for new users) */}
            {isNewUser && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-lg border border px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Roles */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Assign Roles</label>
              <div className="space-y-2">
                {allRoles.map((role) => {
                  const checked = selectedRoleIds.has(role.id);
                  return (
                    <label
                      key={role.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                        checked && getRoleBadgeColor(role.code)
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(role.id)}
                        className="h-4 w-4 rounded border text-indigo-600 focus:ring-indigo-500"
                      />
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-foreground">{role.name}</span>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              {selectedRoleIds.size === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pick at least one role, it decides what they can do.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("search")} disabled={isSubmitting}>
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                selectedRoleIds.size === 0 ||
                (isNewUser && !name.trim())
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isNewUser ? "Create & Invite" : "Add to Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Search screen (default) ──
  const showResult = debouncedEmail.includes("@") && !isChecking && !isFetching && emailCheck;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Search by email to add an existing user or create a new account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Email Search */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Email Address
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Search by email..."
                autoFocus
                className="w-full rounded-lg border border py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Loading State */}
          {(isChecking || isFetching) && debouncedEmail.includes("@") && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Checking...</span>
            </div>
          )}

          {/* Results */}
          {showResult && emailCheck.exists && emailCheck.user && (
            <div className="rounded-lg border border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {emailCheck.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{emailCheck.user.name}</p>
                  <p className="text-xs text-muted-foreground">{emailCheck.user.email}</p>
                </div>
              </div>

              {emailCheck.already_member ? (
                <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/40">
                  <p className="text-xs font-medium text-amber-700">
                    Already a member of this organization
                  </p>
                </div>
              ) : (
                <Button className="mt-3 w-full" size="sm" onClick={handleSelectExistingUser}>
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Add to Team
                </Button>
              )}
            </div>
          )}

          {showResult && !emailCheck.exists && (
            <div className="rounded-lg border border-dashed border p-4 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                No account found for <strong>{debouncedEmail}</strong>
              </p>
              <Button variant="outline" size="sm" onClick={handleCreateNewUser}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Create New User
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!debouncedEmail.includes("@") && searchEmail.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">Enter a valid email address</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

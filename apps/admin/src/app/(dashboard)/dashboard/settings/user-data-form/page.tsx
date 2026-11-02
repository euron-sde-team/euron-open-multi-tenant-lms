"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Switch,
  useToast,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MemberFormSummary } from "@/lib/api/member-form";
import {
  useCreateMemberForm,
  useDeleteMemberForm,
  useMemberForms,
  useReorderMemberForms,
  useSetMemberFormActive,
} from "@/lib/hooks/use-member-form";
import { useTenantStore } from "@/lib/stores/tenant-store";

const BASE = "/dashboard/settings/user-data-form";

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "Something went wrong. Please try again.";
}

export default function UserDataFormsPage() {
  const { selectedTenantId } = useTenantStore();
  const tenantId = selectedTenantId ?? undefined;
  const router = useRouter();
  const { toast } = useToast();

  const { data: forms, isLoading } = useMemberForms(tenantId);
  const createForm = useCreateMemberForm(tenantId);
  const deleteForm = useDeleteMemberForm(tenantId);
  const reorderForms = useReorderMemberForms(tenantId);
  const setActive = useSetMemberFormActive(tenantId);

  const [pendingDelete, setPendingDelete] = useState<MemberFormSummary | null>(
    null
  );

  const handleCreate = () => {
    createForm.mutate(
      { name: "Untitled form" },
      {
        onSuccess: (form) => router.push(`${BASE}/${form.id}`),
        onError: (err) =>
          toast({
            title: "Could not create form",
            description: getErrorMessage(err),
            variant: "destructive",
          }),
      }
    );
  };

  const handleToggleActive = (form: MemberFormSummary, next: boolean) => {
    setActive.mutate(
      { formId: form.id, active: next },
      {
        onError: (err) =>
          toast({
            title: next ? "Could not activate form" : "Could not deactivate",
            description: getErrorMessage(err),
            variant: "destructive",
          }),
      }
    );
  };

  const handleMove = (index: number, dir: -1 | 1) => {
    if (!forms) return;
    const target = index + dir;
    if (target < 0 || target >= forms.length) return;
    const next = [...forms];
    [next[index], next[target]] = [next[target], next[index]];
    reorderForms.mutate(next.map((f) => f.id));
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    deleteForm.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast({ title: "Form deleted" });
        setPendingDelete(null);
      },
      onError: (err) =>
        toast({
          title: "Could not delete form",
          description: getErrorMessage(err),
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/users">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              User Data Forms
            </h1>
            <p className="text-sm text-muted-foreground">
              Build forms to collect custom details from your users after they
              log in. Active forms appear in the order below.
            </p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={createForm.isPending}>
          {createForm.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New form
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[88px] animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      ) : !forms || forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No forms yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Create a form to ask users for details like college, year, or
                department once they sign in.
              </p>
            </div>
            <Button onClick={handleCreate} disabled={createForm.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((form, index) => (
            <Card key={form.id} className="overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                {/* Reorder */}
                <div className="flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={index === 0 || reorderForms.isPending}
                    onClick={() => handleMove(index, -1)}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={index === forms.length - 1 || reorderForms.isPending}
                    onClick={() => handleMove(index, 1)}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`${BASE}/${form.id}`}
                      className="truncate font-semibold hover:underline"
                    >
                      {form.name}
                    </Link>
                    {form.active ? (
                      <Badge variant={form.mode === "MANDATORY" ? "default" : "secondary"}>
                        {form.mode === "MANDATORY" ? "Mandatory" : "Optional"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {form.fieldCount} {form.fieldCount === 1 ? "field" : "fields"}
                    {" · "}
                    {form.responseCount}{" "}
                    {form.responseCount === 1 ? "response" : "responses"}
                  </p>
                </div>

                {/* Active toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => handleToggleActive(form, v)}
                    aria-label="Active"
                  />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {form.active ? "Active" : "Off"}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Link href={`${BASE}/${form.id}/responses`}>
                    <Button variant="ghost" size="sm" title="View responses">
                      <Inbox className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`${BASE}/${form.id}`}>
                    <Button variant="ghost" size="sm" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    title="Delete"
                    onClick={() => setPendingDelete(form)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this form?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.responseCount ? (
                <>
                  &quot;{pendingDelete?.name}&quot; has{" "}
                  {pendingDelete?.responseCount} response
                  {pendingDelete?.responseCount === 1 ? "" : "s"}. Deleting the
                  form permanently removes the form and all of its responses.
                  This cannot be undone.
                </>
              ) : (
                <>
                  &quot;{pendingDelete?.name}&quot; will be permanently deleted.
                  This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteForm.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteForm.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteForm.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

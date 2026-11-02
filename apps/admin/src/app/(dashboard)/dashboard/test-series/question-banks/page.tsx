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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SkeletonRows,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { ArrowLeft, BookOpen, Edit, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useTestQuestionBanks,
  useCreateTestQuestionBank,
  useUpdateTestQuestionBank,
  useDeleteTestQuestionBank,
  testSeriesKeys,
} from "@/lib/hooks/use-test-series";
import type { TestQuestionBank } from "@/lib/api/test-series";
import { AIGenerateModal } from "@/components/test-series/AIGenerateModal";
import { decodeEntities } from "@/lib/quiz-formats/text";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

export default function QuestionBanksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TestQuestionBank | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [aiBankId, setAiBankId] = useState<string | null>(null);
  const aiAuthoringEnabled = useAiAuthoringEnabled();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading, error } = useTestQuestionBanks({ limit: 100 });
  const createMut = useCreateTestQuestionBank();
  const updateMut = useUpdateTestQuestionBank();
  const deleteMut = useDeleteTestQuestionBank();

  const filtered = useMemo(() => {
    const banks = data?.banks ?? [];
    if (!search.trim()) return banks;
    const q = search.toLowerCase();
    return banks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description ?? "").toLowerCase().includes(q)
    );
  }, [data?.banks, search]);

  const resetForm = () => {
    setName("");
    setDescription("");
  };

  const openEdit = (bank: TestQuestionBank) => {
    setEditing(bank);
    // Decode on load: stored text is HTML-entity-encoded by the global XSS
    // sanitizer; a re-save round-trips back to clean single-encoding.
    setName(decodeEntities(bank.name));
    setDescription(bank.description ? decodeEntities(bank.description) : "");
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    createMut.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => {
          toast({ title: "Question bank created" });
          setCreateOpen(false);
          resetForm();
        },
        onError: (err) => {
          toast({
            title: "Failed to create question bank",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleUpdate = () => {
    if (!editing || !name.trim()) return;
    updateMut.mutate(
      {
        bankId: editing.id,
        data: { name: name.trim(), description: description.trim() || null },
      },
      {
        onSuccess: () => {
          toast({ title: "Question bank updated" });
          setEditing(null);
          resetForm();
        },
        onError: (err) => {
          toast({
            title: "Failed to update",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Question bank deleted" });
        setDeleteId(null);
      },
      onError: (err) => {
        toast({
          title: "Failed to delete",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to test series
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Banks</h1>
          <p className="text-muted-foreground mt-1">
            Group your questions into banks. Tests pull from these banks.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Bank
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search question banks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} rowClassName="h-20" />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load banks"}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground">
              {search ? "No matching banks" : "No question banks yet"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first bank
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((bank) => (
            <Card key={bank.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">
                  {decodeEntities(bank.name)}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {bank.description ? decodeEntities(bank.description) : "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Link href={`/dashboard/test-series/question-banks/${bank.id}`}>
                  <Button variant="outline" size="sm">
                    Open
                  </Button>
                </Link>
                <div className="flex gap-1">
                  {aiAuthoringEnabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAiBankId(bank.id)}
                      aria-label="Generate with AI"
                      title="Generate with AI"
                    >
                      <Sparkles className="text-primary h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(bank)}
                    aria-label="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(bank.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Question Bank</DialogTitle>
            <DialogDescription>
              A container for related questions (e.g. JEE Physics, UPSC History).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Name *</Label>
              <Input
                id="bank-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. JEE Physics Mechanics"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-description">Description</Label>
              <Textarea
                id="bank-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createMut.isPending}
            >
              {createMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Question Bank</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-bank-name">Name *</Label>
              <Input
                id="edit-bank-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank-description">Description</Label>
              <Textarea
                id="edit-bank-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!name.trim() || updateMut.isPending}
            >
              {updateMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question bank?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bank and all its questions. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI generation modal */}
      {aiBankId && (
        <AIGenerateModal
          bankId={aiBankId}
          open={!!aiBankId}
          onOpenChange={(open) => {
            if (!open) setAiBankId(null);
          }}
          onCompleted={() => {
            queryClient.invalidateQueries({
              queryKey: testSeriesKeys.questions.all,
            });
          }}
        />
      )}
    </div>
  );
}

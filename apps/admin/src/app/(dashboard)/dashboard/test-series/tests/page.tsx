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
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  SkeletonRows,
  useToast,
} from "@open-mtlms/core";
import {
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { Test } from "@/lib/api/test-series";
import {
  useTests,
  useDeleteTest,
  usePublishTest,
  useUnpublishTest,
} from "@/lib/hooks/use-test-series";

function StatusBadge({ status }: { status: string }) {
  const variant: "default" | "secondary" | "outline" =
    status === "PUBLISHED" ? "default" : status === "DRAFT" ? "secondary" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function TestsListPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, error } = useTests({ limit: 100 });
  const deleteMut = useDeleteTest();
  const publishMut = usePublishTest();
  const unpublishMut = useUnpublishTest();

  const filtered = useMemo(() => {
    const tests = data?.tests ?? [];
    if (!search.trim()) return tests;
    const q = search.toLowerCase();
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [data?.tests, search]);

  const handlePublishToggle = (t: Test) => {
    const action = t.status === "PUBLISHED" ? unpublishMut : publishMut;
    action.mutate(t.id, {
      onSuccess: () => {
        toast({
          title: t.status === "PUBLISHED" ? "Test unpublished" : "Test published",
        });
      },
      onError: (err) => {
        toast({
          title: "Failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      },
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Test deleted" });
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
          <h1 className="text-3xl font-bold tracking-tight">Tests</h1>
          <p className="text-muted-foreground mt-1">
            Build attempt-able tests from your question banks. Add to a series to sell.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/test-series/tests/create")}>
          <Plus className="mr-2 h-4 w-4" />
          New Test
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search tests…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} rowClassName="h-16" />
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load tests"}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground">
              {search ? "No matching tests" : "No tests yet"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => router.push("/dashboard/test-series/tests/create")}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first test
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-base">{t.name}</CardTitle>
                  <StatusBadge status={t.status} />
                </div>
                <CardDescription className="line-clamp-2">
                  {t.description ?? "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span>{t.durationMin} min</span>
                  <span>•</span>
                  <span>{t.totalMarks} marks</span>
                </div>
                <div className="flex items-center justify-between">
                  <Link href={`/dashboard/test-series/tests/${t.id}`}>
                    <Button variant="outline" size="sm">
                      <Settings className="mr-1 h-3 w-3" />
                      Manage
                    </Button>
                  </Link>
                  <div className="flex gap-1">
                    <Link href={`/dashboard/test-series/tests/${t.id}/analytics`}>
                      <Button variant="ghost" size="sm" title="Analytics">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePublishToggle(t)}
                      disabled={publishMut.isPending || unpublishMut.isPending}
                    >
                      {t.status === "PUBLISHED" ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this test?</AlertDialogTitle>
            <AlertDialogDescription>
              All sections, question links, and attempt history will be lost.
              This action cannot be undone.
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
    </div>
  );
}

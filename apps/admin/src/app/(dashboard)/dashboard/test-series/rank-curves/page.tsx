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
import { ArrowLeft, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  useRankCurves,
  useCreateRankCurve,
  useDeleteRankCurve,
} from "@/lib/hooks/use-test-series";
import type { TestRankCurve } from "@/lib/api/test-series";

export default function RankCurvesPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [examName, setExamName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [totalCandidates, setTotalCandidates] = useState("");
  const [csv, setCsv] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useRankCurves();
  const createMut = useCreateRankCurve();
  const deleteMut = useDeleteRankCurve();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv") && f.type !== "text/csv") {
      toast({
        title: "CSV only",
        description: "Please upload a .csv file.",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }
    const text = await f.text();
    setCsv(text);
  };

  const reset = () => {
    setExamName("");
    setYear(String(new Date().getFullYear() - 1));
    setTotalCandidates("");
    setCsv("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = () => {
    if (!examName.trim() || !csv.trim()) {
      toast({ title: "Missing fields", variant: "destructive" });
      return;
    }
    createMut.mutate(
      {
        exam_name: examName.trim(),
        year: parseInt(year, 10),
        total_candidates: parseInt(totalCandidates, 10) || 0,
        csv,
      },
      {
        onSuccess: () => {
          toast({ title: "Curve created" });
          setCreateOpen(false);
          reset();
        },
        onError: (err) =>
          toast({
            title: "Create failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(deleteId, {
      onSuccess: () => {
        toast({ title: "Curve deleted" });
        setDeleteId(null);
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rank curves</h1>
          <p className="text-muted-foreground mt-1">
            Upload historical rank-percentile data so the rank predictor can map a
            learner&apos;s percentile to a likely rank.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New curve
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} rowClassName="h-16" />
      ) : (data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileSpreadsheet className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground">
              No rank curves yet. Upload a CSV to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((c: TestRankCurve) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.examName}</CardTitle>
                <CardDescription>
                  Year {c.year} · {c.totalCandidates.toLocaleString()} candidates
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  {c.curve.length} data points
                </p>
                <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)}>
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
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
          if (!open) reset();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New rank curve</DialogTitle>
            <DialogDescription>
              Upload a 2-column CSV: <code>percentile,rank</code> (one row per data point).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Exam name *</Label>
                <Input
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="JEE Main"
                />
              </div>
              <div className="space-y-1">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Total candidates</Label>
              <Input
                type="number"
                value={totalCandidates}
                onChange={(e) => setTotalCandidates(e.target.value)}
                placeholder="e.g. 1100000"
              />
            </div>
            <div className="space-y-1">
              <Label>CSV data *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-input hover:bg-muted/40 flex w-full items-center gap-3 rounded-md border border-dashed px-4 py-3 text-left text-sm transition-colors"
              >
                <Upload className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground">
                  {csv ? "Replace CSV" : "Choose CSV file"}
                </span>
              </button>
              <Textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={6}
                placeholder={`percentile,rank\n100,1\n99.9,200\n99.5,1500\n99,3500\n95,25000`}
                className="font-mono text-xs"
              />
              <p className="text-muted-foreground text-xs">
                You can also paste the CSV directly. Header row is optional.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!examName.trim() || !csv.trim() || createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this curve?</AlertDialogTitle>
            <AlertDialogDescription>
              Tests pointing at this curve will fall back to no prediction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

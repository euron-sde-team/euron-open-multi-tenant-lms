"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Award, Check, Loader2, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  scholarshipsApi,
  testsApi,
  testSeriesApi,
  type ScholarshipTier,
} from "@/lib/api/test-series";

export default function ScholarshipsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: scholarships, isLoading } = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => scholarshipsApi.list(),
  });
  const { data: awards } = useQuery({
    queryKey: ["scholarship-awards"],
    queryFn: () => scholarshipsApi.listAwards(),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "CONFIRMED" | "REJECTED" }) =>
      scholarshipsApi.decideAward(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scholarship-awards"] });
      toast({ title: "Award updated" });
    },
    onError: (e) =>
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scholarshipsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scholarships"] });
      toast({ title: "Scholarship deleted" });
    },
  });

  const pending = (awards ?? []).filter((a) => a.status === "PENDING");
  const decided = (awards ?? []).filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Test Series
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Award className="h-7 w-7 text-amber-500" />
            Scholarships
          </h1>
          <p className="text-muted-foreground mt-1">
            Offer score-based scholarships. Qualifying learners are auto-flagged
            for your review.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New scholarship
        </Button>
      </div>

      {/* Pending awards queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Pending approvals{" "}
            {pending.length > 0 && (
              <Badge className="ml-1 bg-amber-500">{pending.length}</Badge>
            )}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Learners who crossed a scholarship threshold. Confirm to award, or
            reject.
          </p>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending awards.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-amber-50/50 p-3 dark:bg-amber-950/20"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{a.memberName}</p>
                    <p className="text-muted-foreground text-xs">
                      {a.scholarshipName} · {a.tierLabel}
                      {a.amount != null
                        ? ` · ${a.currency ?? ""}${a.amount}`
                        : ""}{" "}
                      · scored {a.score}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => decideMut.mutate({ id: a.id, status: "CONFIRMED" })}
                      disabled={decideMut.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideMut.mutate({ id: a.id, status: "REJECTED" })}
                      disabled={decideMut.isPending}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Scholarships list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your scholarships</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : !scholarships || scholarships.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No scholarships yet. Create one to start.
            </p>
          ) : (
            <ul className="space-y-3">
              {scholarships.map((s) => (
                <li key={s.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      {s.description && (
                        <p className="text-muted-foreground text-sm">
                          {s.description}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        Basis: {s.basis === "SCALED" ? "Scaled score" : "Percent"} ·{" "}
                        {s.testId ? "Test-scoped" : "Series-scoped"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMut.mutate(s.id)}
                    >
                      <Trash2 className="text-destructive h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.tiers.map((t, i) => (
                      <span
                        key={i}
                        className="text-xs font-medium"
                      >
                        {t.label}: ≥{t.min}
                        {t.amount != null ? ` → ${t.currency ?? ""}${t.amount}` : ""}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Decided history */}
      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Decided</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {decided.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>
                    {a.memberName} · {a.scholarshipName} · {a.tierLabel}
                  </span>
                  <Badge
                    variant={a.status === "CONFIRMED" ? "default" : "secondary"}
                    className={a.status === "CONFIRMED" ? "bg-emerald-600" : ""}
                  >
                    {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CreateScholarshipDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["scholarships"] })}
      />
    </div>
  );
}

function CreateScholarshipDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basis, setBasis] = useState<"PERCENT" | "SCALED">("PERCENT");
  const [scopeType, setScopeType] = useState<"TEST" | "SERIES">("TEST");
  const [scopeId, setScopeId] = useState("");
  const [tiers, setTiers] = useState<ScholarshipTier[]>([
    { min: 90, label: "Gold", amount: undefined, currency: "INR" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const { data: tests } = useQuery({
    queryKey: ["tests", "for-scholarship"],
    queryFn: () => testsApi.list({ limit: 200 }),
    enabled: open,
  });
  const { data: seriesList } = useQuery({
    queryKey: ["series", "for-scholarship"],
    queryFn: () => testSeriesApi.list({ limit: 200 }),
    enabled: open,
  });

  const setTier = (i: number, patch: Partial<ScholarshipTier>) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const submit = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!scopeId) {
      toast({ title: "Choose a test or series", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await scholarshipsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        basis,
        test_id: scopeType === "TEST" ? scopeId : null,
        test_series_id: scopeType === "SERIES" ? scopeId : null,
        tiers: tiers.map((t) => ({
          min: Number(t.min),
          label: t.label,
          amount: t.amount != null && !Number.isNaN(t.amount) ? Number(t.amount) : undefined,
          currency: t.currency,
        })),
      });
      toast({ title: "Scholarship created" });
      onCreated();
      onOpenChange(false);
      setName("");
      setDescription("");
      setScopeId("");
      setTiers([{ min: 90, label: "Gold", amount: undefined, currency: "INR" }]);
    } catch (e) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New scholarship</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Merit Scholarship 2026" />
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Maps to</Label>
              <Select value={scopeType} onValueChange={(v) => { setScopeType(v as "TEST" | "SERIES"); setScopeId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEST">A test</SelectItem>
                  <SelectItem value="SERIES">A series</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Score basis</Label>
              <Select value={basis} onValueChange={(v) => setBasis(v as "PERCENT" | "SCALED")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percentage</SelectItem>
                  <SelectItem value="SCALED">Scaled score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{scopeType === "TEST" ? "Test" : "Series"}</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger>
                <SelectValue placeholder={`Choose a ${scopeType === "TEST" ? "test" : "series"}`} />
              </SelectTrigger>
              <SelectContent>
                {scopeType === "TEST"
                  ? (tests?.tests ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  : (seriesList?.series ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tiers (high to low)</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setTiers((prev) => [...prev, { min: 0, label: "", amount: undefined, currency: "INR" }])
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                Add tier
              </Button>
            </div>
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_90px_36px] items-center gap-2">
                <Input
                  placeholder="Label (Gold)"
                  value={t.label}
                  onChange={(e) => setTier(i, { label: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="min"
                  value={String(t.min)}
                  onChange={(e) => setTier(i, { min: Number(e.target.value) })}
                />
                <Input
                  type="number"
                  placeholder="amount"
                  value={t.amount != null ? String(t.amount) : ""}
                  onChange={(e) =>
                    setTier(i, { amount: e.target.value === "" ? undefined : Number(e.target.value) })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={tiers.length === 1}
                >
                  <Trash2 className="text-destructive h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              A learner earns the highest tier whose minimum they reach (
              {basis === "SCALED" ? "scaled score" : "percentage"}).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

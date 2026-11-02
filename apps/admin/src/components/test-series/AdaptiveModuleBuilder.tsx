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
  DialogDescription,
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
  useToast,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  FlaskConical,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import { QuestionEditorModal } from "@/components/test-series/QuestionEditorModal";
import { RandomPickPanel } from "@/components/test-series/RandomPickPanel";
import { ScoreScaleEditor } from "@/components/test-series/ScoreScaleEditor";
import {
  testQuestionsApi,
  type RoutingRule,
  type TestModuleWithQuestions,
  type TestQuestion,
  type TestScoreScale,
  type TestSection,
} from "@/lib/api/test-series";
import {
  useAddModuleQuestions,
  useCreateTestModule,
  useDeleteTestModule,
  useRemoveModuleQuestion,
  useTestQuestionBanks,
  useUpdateModuleQuestion,
  useUpdateTestModule,
} from "@/lib/hooks/use-test-series";

interface AdaptiveModuleBuilderProps {
  testId: string;
  section: TestSection;
  modules: TestModuleWithQuestions[];
  scoreScales: TestScoreScale[];
  questionsById: Map<string, TestQuestion>;
  /** Question ids already pooled anywhere in this test (random pick skips them). */
  allPooledQuestionIds: string[];
}

const PRESETS = {
  SAT: {
    label: "SAT style",
    description: "Routing module, then an Easier or Harder module 2.",
    variants: [
      { variant: "EASIER", rank: 0 },
      { variant: "HARDER", rank: 1 },
    ],
  },
  THREE: {
    label: "Three route",
    description: "Routing module, then Easy, Medium or Hard module 2.",
    variants: [
      { variant: "EASY", rank: 0 },
      { variant: "MEDIUM", rank: 1 },
      { variant: "HARD", rank: 2 },
    ],
  },
} as const;

function variantLabel(variant: string): string {
  if (variant === "ROUTING") return "Routing";
  return variant.charAt(0) + variant.slice(1).toLowerCase();
}

/** Friendly, plain-language name for a module by its stage and variant. */
function pathDisplayName(variant: string, stageNo: number): string {
  if (stageNo === 1 || variant === "ROUTING") return "Everyone starts here";
  return `${variantLabel(variant)} path`;
}

function stemPreview(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object" && "text" in stem) {
    return String((stem as { text?: unknown }).text ?? "");
  }
  try {
    return JSON.stringify(stem).slice(0, 160);
  } catch {
    return "";
  }
}

export function AdaptiveModuleBuilder({
  testId,
  section,
  modules,
  scoreScales,
  questionsById,
  allPooledQuestionIds,
}: AdaptiveModuleBuilderProps) {
  const sorted = useMemo(
    () =>
      [...modules].sort(
        (a, b) => a.stageNo - b.stageNo || a.difficultyRank - b.difficultyRank
      ),
    [modules]
  );
  const [pickerModule, setPickerModule] = useState<TestModuleWithQuestions | null>(
    null
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="text-muted-foreground h-4 w-4" />
            {section.name}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            Module 1 is the same for everyone. Based on their Module 1 score, each
            student gets an easier or harder Module 2; the harder one unlocks a
            higher score.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {sorted.length === 0 ? (
          <SectionSetup testId={testId} sectionId={section.id} />
        ) : (
          <>
            {sorted.map((m) => (
              <ModuleCard
                key={m.id}
                testId={testId}
                module={m}
                sameStageSiblingIds={sorted
                  .filter((s) => s.id !== m.id && s.stageNo === m.stageNo)
                  .map((s) => s.id)}
                questionsById={questionsById}
                onAddQuestions={() => setPickerModule(m)}
              />
            ))}
            <ScoreScaleEditor
              testId={testId}
              sectionId={section.id}
              sectionName={section.name}
              modules={sorted}
              scales={scoreScales}
            />
          </>
        )}
        {pickerModule && (
          <ModuleQuestionPicker
            testId={testId}
            module={pickerModule}
            excludeIds={allPooledQuestionIds}
            onClose={() => setPickerModule(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ----- Empty-section setup (tests created outside the wizard) -----

function SectionSetup({ testId, sectionId }: { testId: string; sectionId: string }) {
  const { toast } = useToast();
  const createModule = useCreateTestModule();
  const [busyPreset, setBusyPreset] = useState<keyof typeof PRESETS | null>(null);

  const applyPreset = async (preset: keyof typeof PRESETS) => {
    setBusyPreset(preset);
    const def = PRESETS[preset];
    const count = 20;
    const time = 30;
    try {
      const rules: RoutingRule[] =
        preset === "SAT"
          ? [{ min_correct: Math.ceil(count * 0.65), next_variant: "HARDER" }]
          : [
              { min_correct: Math.ceil(count * 0.7), next_variant: "HARD" },
              { min_correct: Math.ceil(count * 0.45), next_variant: "MEDIUM" },
            ];
      await createModule.mutateAsync({
        testId,
        sectionId,
        data: {
          stage_no: 1,
          variant: "ROUTING",
          difficulty_rank: 0,
          question_count: count,
          time_limit_min: time,
          routing_rules: rules,
        },
      });
      for (const v of def.variants) {
        await createModule.mutateAsync({
          testId,
          sectionId,
          data: {
            stage_no: 2,
            variant: v.variant,
            difficulty_rank: v.rank,
            question_count: count,
            time_limit_min: time,
          },
        });
      }
      toast({ title: `${def.label} modules created` });
    } catch (err) {
      toast({
        title: "Module setup failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyPreset(null);
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => applyPreset(key)}
          disabled={busyPreset !== null}
          className="hover:border-primary/40 hover:bg-muted/40 rounded-md border p-4 text-left transition-colors disabled:opacity-60"
        >
          <div className="flex items-center gap-2 font-medium">
            {busyPreset === key && <Loader2 className="h-4 w-4 animate-spin" />}
            {PRESETS[key].label}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {PRESETS[key].description}
          </p>
        </button>
      ))}
    </div>
  );
}

// ----- Single module card -----

function ModuleCard({
  testId,
  module,
  sameStageSiblingIds,
  questionsById,
  onAddQuestions,
}: {
  testId: string;
  module: TestModuleWithQuestions;
  /** Other variants at the same stage; shape edits propagate to them. */
  sameStageSiblingIds: string[];
  questionsById: Map<string, TestQuestion>;
  onAddQuestions: () => void;
}) {
  const { toast } = useToast();
  const updateModule = useUpdateTestModule();
  const deleteModule = useDeleteTestModule();
  const updateQuestion = useUpdateModuleQuestion();
  const removeQuestion = useRemoveModuleQuestion();

  const [count, setCount] = useState(String(module.questionCount));
  const [pretestCount, setPretestCount] = useState(String(module.pretestCount));
  const [time, setTime] = useState(String(module.timeLimitMin));
  const [editing, setEditing] = useState<TestQuestion | null>(null);
  const [thresholds, setThresholds] = useState<string[]>(
    (module.routingRules ?? []).map((r) => String(r.min_correct))
  );

  useEffect(() => {
    setCount(String(module.questionCount));
    setPretestCount(String(module.pretestCount));
    setTime(String(module.timeLimitMin));
    setThresholds((module.routingRules ?? []).map((r) => String(r.min_correct)));
  }, [module]);

  const scoredPool = module.questions.filter((q) => !q.isPretest);
  const pretestPool = module.questions.filter((q) => q.isPretest);
  const poolShort = scoredPool.length < module.questionCount;
  const pretestShort = pretestPool.length < module.pretestCount;

  const difficultyCounts = useMemo(() => {
    const counts = { EASY: 0, MEDIUM: 0, HARD: 0 };
    for (const entry of scoredPool) {
      const q = questionsById.get(entry.questionId);
      if (q && q.difficulty in counts) counts[q.difficulty] += 1;
    }
    return counts;
  }, [scoredPool, questionsById]);

  const marksMixed = useMemo(() => {
    const seen = new Set<string>();
    for (const entry of scoredPool) {
      const q = questionsById.get(entry.questionId);
      if (q) seen.add(`${q.marks}|${q.negativeMarks}`);
    }
    return seen.size > 1;
  }, [scoredPool, questionsById]);

  const saveField = (
    field: "question_count" | "pretest_count" | "time_limit_min",
    raw: string,
    current: number
  ) => {
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < (field === "pretest_count" ? 0 : 1)) {
      return;
    }
    if (parsed === current) return;
    const onError = (err: unknown) =>
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    updateModule.mutate(
      { testId, moduleId: module.id, data: { [field]: parsed } },
      { onError }
    );
    // Publish requires identical question_count, pretest_count, and time across
    // every variant at a stage (so the routing path stays hidden). Keep the
    // sibling variants in lockstep instead of letting the author hit that error.
    for (const siblingId of sameStageSiblingIds) {
      updateModule.mutate(
        { testId, moduleId: siblingId, data: { [field]: parsed } },
        { onError }
      );
    }
  };

  const saveThreshold = (ruleIdx: number, raw: string) => {
    const rules = module.routingRules ?? [];
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (rules[ruleIdx] && rules[ruleIdx].min_correct === parsed) return;
    const next = rules.map((r, i) =>
      i === ruleIdx ? { ...r, min_correct: parsed } : r
    );
    updateModule.mutate(
      { testId, moduleId: module.id, data: { routing_rules: next } },
      {
        onError: (err) =>
          toast({
            title: "Threshold update failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const isRouting = module.stageNo === 1;

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isRouting ? "default" : "secondary"}>
            Module {module.stageNo}
          </Badge>
          <span className="text-sm font-medium">
            {pathDisplayName(module.variant, module.stageNo)}
          </span>
          <span
            className={`text-xs ${poolShort ? "text-destructive font-medium" : "text-muted-foreground"}`}
          >
            Pool {scoredPool.length} / serving {module.questionCount}
          </span>
          {(module.pretestCount > 0 || pretestPool.length > 0) && (
            <span
              className={`text-xs ${pretestShort ? "text-destructive font-medium" : "text-muted-foreground"}`}
            >
              · pretest {pretestPool.length} / {module.pretestCount}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            E {difficultyCounts.EASY} · M {difficultyCounts.MEDIUM} · H{" "}
            {difficultyCounts.HARD}
          </span>
          {marksMixed && (
            <span className="text-destructive inline-flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" />
              mixed marks in pool
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={onAddQuestions}>
            <Plus className="mr-1 h-3 w-3" />
            Add questions
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              deleteModule.mutate(
                { testId, moduleId: module.id },
                {
                  onError: (err) =>
                    toast({
                      title: "Delete failed",
                      description:
                        err instanceof Error ? err.message : "Unknown error",
                      variant: "destructive",
                    }),
                }
              )
            }
            disabled={deleteModule.isPending}
            aria-label="Delete module"
          >
            <Trash2 className="text-destructive h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 px-3 py-2">
        <div className="space-y-1">
          <Label className="text-xs">Serve (scored)</Label>
          <Input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onBlur={() => saveField("question_count", count, module.questionCount)}
            className="h-8 w-24"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pretest (unscored)</Label>
          <Input
            type="number"
            min={0}
            value={pretestCount}
            onChange={(e) => setPretestCount(e.target.value)}
            onBlur={() => saveField("pretest_count", pretestCount, module.pretestCount)}
            className="h-8 w-24"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Time (min)</Label>
          <Input
            type="number"
            min={1}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={() => saveField("time_limit_min", time, module.timeLimitMin)}
            className="h-8 w-24"
          />
        </div>
        {(module.routingRules ?? []).map((rule, idx) => (
          <div key={rule.next_variant} className="space-y-1">
            <Label className="text-xs">
              Send to {variantLabel(rule.next_variant)} when correct is at least
            </Label>
            <Input
              type="number"
              min={0}
              max={module.questionCount}
              value={thresholds[idx] ?? ""}
              onChange={(e) =>
                setThresholds((prev) =>
                  prev.map((t, i) => (i === idx ? e.target.value : t))
                )
              }
              onBlur={() => saveThreshold(idx, thresholds[idx] ?? "")}
              className="h-8 w-24"
            />
          </div>
        ))}
      </div>

      <div className="px-3 pb-3">
        {module.questions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No questions in this module&apos;s pool yet.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {module.questions.map((entry, idx) => {
              const q = questionsById.get(entry.questionId);
              return (
                <li
                  key={entry.questionId}
                  className="bg-muted/30 flex items-start gap-2 rounded-md p-2"
                >
                  <span className="text-muted-foreground w-6 shrink-0 text-center text-xs">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      {q && (
                        <>
                          <Badge variant="outline" className="text-[10px]">
                            {q.type.replace(/_/g, " ")}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {q.difficulty}
                          </Badge>
                        </>
                      )}
                      {entry.isPretest && (
                        <Badge className="bg-amber-500/15 text-amber-700 text-[10px] hover:bg-amber-500/15">
                          Pretest
                        </Badge>
                      )}
                    </div>
                    <div className="text-foreground line-clamp-1 text-sm">
                      {q ? (
                        <MathText block={false}>{stemPreview(q.stem)}</MathText>
                      ) : (
                        <span className="bg-muted inline-block h-4 w-2/3 animate-pulse rounded" />
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {q && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Edit question"
                        onClick={() => setEditing(q)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      title={
                        entry.isPretest
                          ? "Make scored question"
                          : "Make pretest (unscored pilot) question"
                      }
                      onClick={() =>
                        updateQuestion.mutate({
                          testId,
                          moduleId: module.id,
                          questionId: entry.questionId,
                          data: { is_pretest: !entry.isPretest },
                        })
                      }
                    >
                      <FlaskConical
                        className={`h-3 w-3 ${entry.isPretest ? "text-amber-600" : "text-muted-foreground"}`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove from module"
                      onClick={() =>
                        removeQuestion.mutate({
                          testId,
                          moduleId: module.id,
                          questionId: entry.questionId,
                        })
                      }
                    >
                      <Trash2 className="text-destructive h-3 w-3" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {editing && (
        <QuestionEditorModal
          bankId={editing.questionBankId}
          question={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onCreated={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ----- Module pool picker (browse + random) -----

function ModuleQuestionPicker({
  testId,
  module,
  excludeIds,
  onClose,
}: {
  testId: string;
  module: TestModuleWithQuestions;
  excludeIds: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const addQuestions = useAddModuleQuestions();
  const { data: banks } = useTestQuestionBanks({ limit: 100 });

  const [mode, setMode] = useState<"browse" | "random">("browse");
  const [bankId, setBankId] = useState("");
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [asPretest, setAsPretest] = useState(false);
  const [aiUploading, setAiUploading] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const inModule = useMemo(
    () => new Set(module.questions.map((q) => q.questionId)),
    [module.questions]
  );

  // Auto-select the first bank so upload/browse work immediately.
  useEffect(() => {
    if (!bankId && (banks?.banks?.length ?? 0) > 0) {
      setBankId(banks!.banks[0].id);
    }
  }, [banks, bankId]);

  useEffect(() => {
    if (!bankId) return;
    setLoading(true);
    testQuestionsApi
      .list({
        question_bank_id: bankId,
        status: "PUBLISHED",
        search: search || undefined,
        limit: 100,
      })
      .then((res) => setQuestions(res.questions))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [bankId, search]);

  // Upload a Word/PDF/Excel/CSV file → AI extracts questions into the chosen
  // bank, publishes them, then pre-selects them so they can be added to this
  // module's pool (the path to "build a whole test/module from a document").
  const handleUploadFile = async (file: File) => {
    if (!bankId) {
      toast({ title: "Choose a bank first", variant: "destructive" });
      return;
    }
    setAiUploading(true);
    try {
      const res = await testQuestionsApi.importFileAI(bankId, file);
      const all = await testQuestionsApi.list({ question_bank_id: bankId, limit: 200 });
      const newIds = (all.questions ?? []).slice(0, res.created).map((q) => q.id);
      if (newIds.length) await testQuestionsApi.bulkUpdateStatus(newIds, "PUBLISHED");
      const pub = await testQuestionsApi.list({
        question_bank_id: bankId,
        status: "PUBLISHED",
        limit: 200,
      });
      setQuestions(pub.questions ?? []);
      setSelected((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      toast({
        title: "AI import complete",
        description: `${res.created} question${res.created === 1 ? "" : "s"} extracted and selected. Review, then click Add to put them in this module.`,
      });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAiUploading(false);
      if (aiFileRef.current) aiFileRef.current.value = "";
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRandomPicked = (picked: TestQuestion[]) => {
    if (picked.length === 0) return;
    setQuestions((prev) => {
      const pickedIds = new Set(picked.map((q) => q.id));
      return [...picked, ...prev.filter((p) => !pickedIds.has(p.id))];
    });
    setSelected((prev) => {
      const next = new Set(prev);
      picked.forEach((q) => next.add(q.id));
      return next;
    });
    setMode("browse");
  };

  const handleAdd = () => {
    if (selected.size === 0) return;
    addQuestions.mutate(
      {
        testId,
        moduleId: module.id,
        items: Array.from(selected).map((id) => ({
          question_id: id,
          is_pretest: asPretest,
        })),
      },
      {
        onSuccess: () => {
          toast({
            title: `Added ${selected.size} question${selected.size === 1 ? "" : "s"} to ${variantLabel(module.variant)}${asPretest ? " as pretest" : ""}`,
          });
          onClose();
        },
        onError: (err) =>
          toast({
            title: "Failed to add",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            Add to Stage {module.stageNo} · {variantLabel(module.variant)} pool
          </DialogTitle>
          <DialogDescription>
            Browse a bank or random-pick by difficulty mix. The engine samples{" "}
            {module.questionCount} scored questions per attempt from this pool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 pt-3">
          <div className="bg-muted/40 flex items-center gap-1 rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setMode("browse")}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                mode === "browse"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setMode("random")}
              className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                mode === "random"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Random pick
            </button>
          </div>
          {mode === "browse" && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bankId} onValueChange={setBankId}>
                <SelectTrigger className="min-w-[180px] flex-1">
                  <SelectValue placeholder="Choose question bank" />
                </SelectTrigger>
                <SelectContent>
                  {(banks?.banks ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search published…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-w-[180px] flex-1"
              />
              <input
                ref={aiFileRef}
                type="file"
                accept=".docx,.pdf,.xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadFile(f);
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!bankId) {
                    toast({ title: "Choose a bank first", variant: "destructive" });
                    return;
                  }
                  aiFileRef.current?.click();
                }}
                disabled={aiUploading}
                title="Upload a Word, PDF, Excel or CSV file (e.g. a DSAT doc): AI extracts the questions so you can add them to this module"
              >
                {aiUploading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-1 h-4 w-4" />
                )}
                Upload file (AI)
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-6 pt-3">
          {mode === "random" ? (
            <RandomPickPanel
              excludeIds={[...excludeIds, ...Array.from(selected)]}
              onPicked={handleRandomPicked}
            />
          ) : !bankId ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Choose a bank to see questions.
            </p>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No published questions match.
            </p>
          ) : (
            <ul className="space-y-2">
              {questions.map((q) => {
                const already = inModule.has(q.id);
                const checked = selected.has(q.id);
                return (
                  <li
                    key={q.id}
                    className={`bg-muted/20 flex items-start gap-2 rounded-md p-2 ${
                      already ? "opacity-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={already}
                      onChange={() => toggle(q.id)}
                      className="mt-1 h-4 w-4"
                      aria-label="Select question"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {q.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {q.difficulty}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">
                          {q.marks} / -{q.negativeMarks}
                        </span>
                        {already && (
                          <span className="text-muted-foreground text-xs">
                            already in module
                          </span>
                        )}
                      </div>
                      <div className="text-foreground line-clamp-2 text-sm">
                        <MathText block={false}>{stemPreview(q.stem)}</MathText>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asPretest}
              onChange={(e) => setAsPretest(e.target.checked)}
              className="h-4 w-4"
            />
            Add as pretest (unscored pilot)
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || addQuestions.isPending}
            >
              {addQuestions.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
  } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdaptiveHealthCard } from "@/components/test-series/AdaptiveHealthCard";
import { AdaptiveModuleBuilder } from "@/components/test-series/AdaptiveModuleBuilder";
import { AdaptiveReadiness } from "@/components/test-series/AdaptiveReadiness";
import { AttemptsReport } from "@/components/test-series/AttemptsReport";
import { AttemptsSection } from "@/components/test-series/AttemptsSection";
import { MathText } from "@/components/test-series/MathText";
import { NormTableEditor } from "@/components/test-series/NormTableEditor";
import { QuestionEditorModal } from "@/components/test-series/QuestionEditorModal";
import { RandomPickPanel } from "@/components/test-series/RandomPickPanel";
import { SectionBlueprintEditor } from "@/components/test-series/SectionBlueprintEditor";
import { ThumbnailComposer } from "@/components/test-series/ThumbnailComposer";
import { useTestSeriesAICoverField } from "@/components/test-series/use-test-series-ai-fields";
import {
  testsApi,
  testQuestionsApi,
  type SectionBlueprint,
  type TestSection,
  type TestSectionQuestion,
  type TestShowSolutions,
  type TestQuestion,
} from "@/lib/api/test-series";
import { uploadApi } from "@/lib/api/upload";
import { THUMBNAILS_BASE_URL } from "@/lib/constants";
import { useCertificateDesigns } from "@/lib/hooks/use-certificate-designer";
import {
  useTestFull,
  useTestModules,
  useUpdateTest,
  usePublishTest,
  useUnpublishTest,
  useDeleteTest,
  useTestQuestionBanks,
  testSeriesKeys,
} from "@/lib/hooks/use-test-series";
import { useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";

/** ISO (UTC) → `datetime-local` input value in the browser's local time. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value (local time) → ISO UTC string, or null if empty. */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const SectionRowSkeleton = ({ index }: { index: number }) => (
  <li className="bg-muted/30 flex items-start gap-2 rounded-md p-2">
    <span className="text-muted-foreground w-6 shrink-0 text-center text-xs">
      {index + 1}
    </span>
    <div className="flex-1 min-w-0 space-y-1">
      <div className="flex items-center gap-2">
        <div className="bg-muted h-4 w-12 animate-pulse rounded" />
        <div className="bg-muted h-4 w-14 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
    </div>
  </li>
);

interface FullSection extends TestSection {
  questions: TestSectionQuestion[];
}

export default function TestBuilderPage() {
  const params = useParams<{ testId: string }>();
  const testId = params?.testId ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useTestFull(testId);
  const updateTest = useUpdateTest();
  const publishMut = usePublishTest();
  const unpublishMut = useUnpublishTest();
  const deleteMut = useDeleteTest();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");
  const [showSolutions, setShowSolutions] = useState<TestShowSolutions>("IMMEDIATE");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowReattempt, setAllowReattempt] = useState(false);
  // "" = unlimited (only meaningful when allowReattempt is on).
  const [maxAttempts, setMaxAttempts] = useState("");
  const [randomQuestionCount, setRandomQuestionCount] = useState("");
  const [passPct, setPassPct] = useState("");
  const [targetExam, setTargetExam] = useState("");
  const [calculatorMode, setCalculatorMode] = useState("NONE");
  // Scheduling window, datetime-local strings ("" = no constraint).
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  // Proctoring config.
  const [proctoringEnabled, setProctoringEnabled] = useState(false);
  const [proctorCamera, setProctorCamera] = useState(false);
  const [proctorMic, setProctorMic] = useState(false);
  const [proctorFullscreen, setProctorFullscreen] = useState(false);
  const [proctorBlockCopyPaste, setProctorBlockCopyPaste] = useState(false);
  const [proctorMaxTabSwitches, setProctorMaxTabSwitches] = useState("");
  const [proctorAction, setProctorAction] = useState<"WARN" | "AUTO_SUBMIT">("WARN");
  // Certificate config.
  const [certificateEnabled, setCertificateEnabled] = useState(false);
  const [certMinScore, setCertMinScore] = useState("");
  const [certTemplateId, setCertTemplateId] = useState("");
  const { data: certDesigns } = useCertificateDesigns();
  // Thumbnail.
  const [coverImageKey, setCoverImageKey] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const coverAI = useTestSeriesAICoverField((key) => {
    setCoverImageKey(key);
    toast({ title: "AI thumbnail generated. Click Save thumbnail to apply." });
  });
  const generatingThumbnail = coverAI.isActive || uploadingCover;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [tab, setTab] = useState("basics");
  const [newSectionOpen, setNewSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionTimeLimit, setSectionTimeLimit] = useState("");

  const [pickerSection, setPickerSection] = useState<FullSection | null>(null);
  const [pickerAutoUpload, setPickerAutoUpload] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.test.name);
    setDescription(data.test.description ?? "");
    setDuration(String(data.test.durationMin));
    setShowSolutions(data.test.showSolutions as TestShowSolutions);
    setShuffleQuestions(data.test.shuffleQuestions);
    setShuffleOptions(data.test.shuffleOptions);
    setAllowReattempt(data.test.allowReattempt);
    setMaxAttempts(
      data.test.maxAttempts != null ? String(data.test.maxAttempts) : ""
    );
    setRandomQuestionCount(
      data.test.randomQuestionCount != null
        ? String(data.test.randomQuestionCount)
        : ""
    );
    setPassPct(data.test.passCriteriaPct ?? "");
    setTargetExam(data.test.targetExam ?? "");
    setCalculatorMode(data.test.calculatorMode ?? "NONE");
    setAvailableFrom(isoToLocalInput(data.test.availableFrom));
    setAvailableUntil(isoToLocalInput(data.test.availableUntil));
    setProctoringEnabled(data.test.proctoringEnabled);
    setProctorCamera(data.test.proctorCamera);
    setProctorMic(data.test.proctorMic);
    setProctorFullscreen(data.test.proctorFullscreen);
    setProctorBlockCopyPaste(data.test.proctorBlockCopyPaste);
    setProctorMaxTabSwitches(
      data.test.proctorMaxTabSwitches != null
        ? String(data.test.proctorMaxTabSwitches)
        : ""
    );
    setProctorAction(data.test.proctorAction ?? "WARN");
    setCertificateEnabled(data.test.certificateEnabled);
    setCertMinScore(data.test.certificateMinScorePct ?? "");
    setCertTemplateId(data.test.certificateTemplateId ?? "");
    setCoverImageKey(data.test.coverImageKey ?? null);
  }, [data]);

  const sections = data?.sections ?? [];
  const questionsMap = useMemo(() => {
    const m = new Map<string, TestQuestion>();
    for (const q of data?.questions ?? []) m.set(q.id, q);
    return m;
  }, [data?.questions]);

  // Bank id -> name, so each pooled question row can show which bank it came
  // from (client asked for bank/subject/chapter/topic visibility per question).
  const { data: pageBanks } = useTestQuestionBanks({ limit: 100 });
  const bankNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of pageBanks?.banks ?? []) m.set(b.id, b.name);
    return m;
  }, [pageBanks]);

  // Adaptive tests keep their content in modules, not section questions.
  const isAdaptive = data?.test.mode === "ADAPTIVE";
  const { data: modulesData } = useTestModules(isAdaptive ? testId : undefined);
  const modulePoolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of modulesData?.modules ?? []) {
      for (const q of m.questions) ids.add(q.questionId);
    }
    return Array.from(ids);
  }, [modulesData]);
  const { data: moduleQuestionRows } = useQuery({
    queryKey: testSeriesKeys.questions.byIds(modulePoolIds),
    queryFn: () => testQuestionsApi.getByIds(modulePoolIds),
    enabled: isAdaptive && modulePoolIds.length > 0,
  });
  const moduleQuestionsMap = useMemo(() => {
    const m = new Map<string, TestQuestion>();
    for (const q of moduleQuestionRows ?? []) m.set(q.id, q);
    return m;
  }, [moduleQuestionRows]);

  // Parse the random-question input into a payload value. Empty = all questions
  // (null). Returns `undefined` when the value is invalid so callers can bail.
  const parseRandomCount = (): number | null | undefined => {
    const trimmed = randomQuestionCount.trim();
    if (trimmed === "") return null;
    const parsed = parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return undefined;
    return parsed;
  };

  const handleSaveSettings = () => {
    if (!testId) return;
    const dur = parseInt(duration, 10);
    if (!isAdaptive && (!Number.isFinite(dur) || dur <= 0)) {
      toast({ title: "Duration must be > 0", variant: "destructive" });
      return;
    }
    const randomCount = isAdaptive ? null : parseRandomCount();
    if (!isAdaptive && randomCount === undefined) {
      toast({
        title: "Random questions per attempt must be at least 1",
        variant: "destructive",
      });
      return;
    }
    updateTest.mutate(
      {
        testId,
        data: {
          name: name.trim(),
          description: description.trim() || null,
          show_solutions: showSolutions,
          shuffle_options: shuffleOptions,
          allow_reattempt: allowReattempt,
          max_attempts: allowReattempt
            ? maxAttempts.trim() === ""
              ? null
              : Math.max(1, parseInt(maxAttempts, 10) || 1)
            : null,
          pass_criteria_pct: passPct.trim() ? parseFloat(passPct) : null,
          target_exam: targetExam.trim() || null,
          calculator_mode: calculatorMode,
          available_from: localInputToIso(availableFrom),
          available_until: localInputToIso(availableUntil),
          // Adaptive tests: duration is computed from module timers at
          // publish, and per-attempt randomization is module sampling.
          ...(isAdaptive
            ? {}
            : {
                duration_min: dur,
                shuffle_questions: shuffleQuestions,
                random_question_count: randomCount,
              }),
        },
      },
      {
        onSuccess: () => toast({ title: "Settings saved" }),
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleSaveProctoring = () => {
    if (!testId) return;
    const maxTabs = proctorMaxTabSwitches.trim();
    updateTest.mutate(
      {
        testId,
        data: {
          proctoring_enabled: proctoringEnabled,
          proctor_camera: proctorCamera,
          proctor_mic: proctorMic,
          proctor_fullscreen: proctorFullscreen,
          proctor_block_copy_paste: proctorBlockCopyPaste,
          proctor_max_tab_switches:
            maxTabs === "" ? null : Math.max(0, parseInt(maxTabs, 10) || 0),
          proctor_action: proctorAction,
        },
      },
      {
        onSuccess: () => toast({ title: "Proctoring settings saved" }),
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleSaveCertificate = () => {
    if (!testId) return;
    const min = certMinScore.trim();
    updateTest.mutate(
      {
        testId,
        data: {
          certificate_enabled: certificateEnabled,
          certificate_min_score_pct: min === "" ? null : parseFloat(min),
          certificate_template_id: certTemplateId || null,
        },
      },
      {
        onSuccess: () => toast({ title: "Certificate settings saved" }),
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const handleCoverFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const result = await uploadApi.uploadFile(file, "test-thumbnails");
      setCoverImageKey(result.key);
      toast({ title: "Uploaded. Click Save thumbnail to apply." });
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleGenerateThumbnail = async () => {
    if (coverAI.isActive) return;
    if (!name.trim()) {
      toast({ title: "Set the test name first", variant: "destructive" });
      return;
    }
    try {
      await coverAI.generate({
        kind: "cover",
        title: name.trim(),
        category: targetExam.trim() || null,
        description: description.trim() || null,
      });
    } catch (err) {
      toast({
        title: "AI generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSaveThumbnail = () => {
    if (!testId) return;
    updateTest.mutate(
      { testId, data: { cover_image_key: coverImageKey } },
      {
        onSuccess: () => toast({ title: "Thumbnail saved" }),
        onError: (err) =>
          toast({
            title: "Save failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: testSeriesKeys.tests.full(testId),
    });

  const handleAddSection = async () => {
    if (!sectionName.trim()) return;
    try {
      await testsApi.createSection(testId, {
        name: sectionName.trim(),
        time_limit_min: sectionTimeLimit.trim()
          ? parseInt(sectionTimeLimit, 10)
          : null,
        order_index: sections.length,
      });
      toast({ title: "Section created" });
      setSectionName("");
      setSectionTimeLimit("");
      setNewSectionOpen(false);
      refresh();
    } catch (err) {
      toast({
        title: "Failed to add section",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      await testsApi.deleteSection(testId, sectionId);
      toast({ title: "Section deleted" });
      refresh();
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRemoveQuestion = async (sectionId: string, questionId: string) => {
    try {
      await testsApi.removeSectionQuestion(testId, sectionId, questionId);
      refresh();
    } catch (err) {
      toast({
        title: "Failed to remove",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleReorderQuestion = async (
    section: FullSection,
    fromIdx: number,
    direction: -1 | 1
  ) => {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= section.questions.length) return;
    const next = [...section.questions];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    try {
      await testsApi.reorderSectionQuestions(
        testId,
        section.id,
        next.map((q) => q.questionId)
      );
      refresh();
    } catch (err) {
      toast({
        title: "Reorder failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handlePublish = () => {
    publishMut.mutate(testId, {
      onSuccess: (published) => {
        toast({ title: "Test published" });
        if (published.publishWarnings && published.publishWarnings.length > 0) {
          toast({
            title: "Publish warnings",
            description: published.publishWarnings.join(" · "),
          });
        }
        refresh();
      },
      onError: (err) =>
        toast({
          title: "Publish failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        }),
    });
  };

  const handleUnpublish = () => {
    unpublishMut.mutate(testId, {
      onSuccess: () => {
        toast({ title: "Test unpublished" });
        refresh();
      },
    });
  };

  const handleDelete = () => {
    deleteMut.mutate(testId, {
      onSuccess: () => {
        toast({ title: "Test deleted" });
        window.location.href = "/dashboard/test-series/tests";
      },
    });
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  const isPublished = data.test.status === "PUBLISHED";

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/test-series/tests"
        className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to tests
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.test.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Badge variant={isPublished ? "default" : "secondary"}>
              {data.test.status}
            </Badge>
            {isAdaptive && <Badge variant="outline">Adaptive (MST)</Badge>}
            <span className="text-muted-foreground">
              {data.test.durationMin} min · {data.test.totalMarks} marks · {sections.length} section{sections.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublished ? (
            <Button variant="outline" onClick={handleUnpublish} disabled={unpublishMut.isPending}>
              <EyeOff className="mr-1 h-4 w-4" />
              Unpublish
            </Button>
          ) : (
            <Button onClick={handlePublish} disabled={publishMut.isPending}>
              {publishMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Eye className="mr-1 h-4 w-4" />
              Publish
            </Button>
          )}
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings, grouped into tabs so they're findable, not a long scroll */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
          <TabsTrigger value="certificate">Certificate</TabsTrigger>
          <TabsTrigger value="thumbnail">Thumbnail</TabsTrigger>
          <TabsTrigger value="attempts">Attempts &amp; answers</TabsTrigger>
        </TabsList>
        <TabsContent value="basics" className="mt-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Duration (min)</Label>
              {isAdaptive ? (
                <p className="text-muted-foreground flex h-10 items-center text-sm">
                  {data.test.durationMin} min (worst-case path, computed at publish)
                </p>
              ) : (
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Show solutions</Label>
              <Select
                value={showSolutions}
                onValueChange={(v) => setShowSolutions(v as TestShowSolutions)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IMMEDIATE">Immediately after submit</SelectItem>
                  <SelectItem value="AFTER_SERIES_END">After series ends</SelectItem>
                  <SelectItem value="NEVER">Never</SelectItem>
                </SelectContent>
              </Select>
                <p className="text-muted-foreground text-xs">
                  Controls when learners see the correct answers and your
                  explanations. &quot;After the whole series is finished&quot;
                  means a learner who completes only this test sees neither,
                  until the series end date passes or they have submitted every
                  test in the series.
                </p>
              <p className="text-muted-foreground text-xs">
                When students can see the correct answers.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Pass criteria %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passPct}
                onChange={(e) => setPassPct(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-muted-foreground text-xs">
                Lowest score that counts as a pass. Blank = no pass or fail.
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Target exam (optional)</Label>
            <Input
              value={targetExam}
              onChange={(e) => setTargetExam(e.target.value)}
              placeholder="e.g. JEE Main 2026"
            />
          </div>
          <div className="space-y-1">
            <Label>Calculator</Label>
            <Select value={calculatorMode} onValueChange={setCalculatorMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No calculator</SelectItem>
                <SelectItem value="SCIENTIFIC">Scientific</SelectItem>
                <SelectItem value="GRAPHING">Graphing</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              A calculator students can open during the test without leaving the window. Especially useful in proctored exams.
            </p>
          </div>
          {/* Scheduling window, when set, students can only start within it. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Opens at (optional)</Label>
              <Input
                type="datetime-local"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Blank = available immediately once published.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Closes at / deadline (optional)</Label>
              <Input
                type="datetime-local"
                value={availableUntil}
                onChange={(e) => setAvailableUntil(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Blank = no deadline. After this, new attempts are blocked.
              </p>
            </div>
          </div>
          {!isAdaptive && (
            <div className="space-y-1">
              <Label htmlFor="randomQuestionCount">
                Random questions per attempt
              </Label>
              <Input
                id="randomQuestionCount"
                type="number"
                min={1}
                value={randomQuestionCount}
                onChange={(e) => setRandomQuestionCount(e.target.value)}
                onBlur={() => {
                  if (!testId) return;
                  const parsed = parseRandomCount();
                  if (parsed === undefined) return;
                  if ((data?.test.randomQuestionCount ?? null) !== parsed) {
                    updateTest.mutate({
                      testId,
                      data: { random_question_count: parsed },
                    });
                  }
                }}
                placeholder="All questions"
              />
              <p className="text-muted-foreground text-xs">
                Each attempt serves this many randomly picked questions. Leave
                empty to serve all questions.
              </p>
              {/* Randomness only produces unequal totals when the pool mixes
                  marks. Surfacing the range here is what stops a cohort being
                  scored out of different totals without anyone noticing. */}
              {data?.test.servedMarksMin != null &&
                data.test.servedMarksMax != null &&
                data.test.servedMarksMin !== data.test.servedMarksMax && (
                  <div className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 mt-2 rounded-md border px-3 py-2 text-xs">
                    <p className="font-medium">
                      Learners will be scored out of {data.test.servedMarksMin} to{" "}
                      {data.test.servedMarksMax} marks.
                    </p>
                    <p className="mt-1 opacity-90">
                      This section&apos;s questions carry different marks, so a
                      random draw gives each learner a different total. Give the
                      questions in a section the same marks to keep the total
                      identical for everyone while the paper stays random. Use
                      separate sections if you want parts of the paper weighted
                      differently.
                    </p>
                  </div>
                )}
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            {!isAdaptive && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="h-4 w-4"
                />
                Shuffle questions
              </label>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="h-4 w-4"
              />
              Shuffle options
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allowReattempt}
                onChange={(e) => setAllowReattempt(e.target.checked)}
                className="h-4 w-4"
              />
              Allow re-attempt
            </label>
            {allowReattempt && (
              <label className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
                Max attempts
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="border-input bg-background h-8 w-28 rounded-md border px-2 text-sm"
                />
                <span className="text-xs">blank = unlimited</span>
              </label>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={updateTest.isPending}>
              {updateTest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-4 w-4" />
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="proctoring" className="mt-0">
      {/* Proctoring */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proctoring</CardTitle>
          <p className="text-muted-foreground text-sm">
            Lightweight, in-browser monitoring. Detection runs entirely on the
            student&apos;s device, no video is uploaded or recorded, so it adds
            almost no load.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={proctoringEnabled}
              onChange={(e) => setProctoringEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Enable proctoring for this test
          </label>
          {proctoringEnabled && (
            <div className="space-y-4 border-l-2 pl-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={proctorFullscreen}
                    onChange={(e) => setProctorFullscreen(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Require fullscreen
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      The test opens in fullscreen and leaving it is recorded.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={proctorBlockCopyPaste}
                    onChange={(e) => setProctorBlockCopyPaste(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Block copy / paste / right-click
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Stops students copying questions or pasting answers.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={proctorCamera}
                    onChange={(e) => setProctorCamera(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Require camera
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Students must allow their webcam before they can start.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={proctorMic}
                    onChange={(e) => setProctorMic(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Require microphone
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Students must allow their microphone before they can start.
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Max tab switches</Label>
                  <Input
                    type="number"
                    min={0}
                    value={proctorMaxTabSwitches}
                    onChange={(e) => setProctorMaxTabSwitches(e.target.value)}
                    placeholder="Unlimited"
                  />
                  <p className="text-muted-foreground text-xs">
                    Leaving the test tab counts as a switch. Blank = no limit.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>When the limit is exceeded</Label>
                  <Select
                    value={proctorAction}
                    onValueChange={(v) => setProctorAction(v as "WARN" | "AUTO_SUBMIT")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WARN">Warn the student</SelectItem>
                      <SelectItem value="AUTO_SUBMIT">
                        Auto-submit the test
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveProctoring} disabled={updateTest.isPending}>
              {updateTest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-4 w-4" />
              Save proctoring
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="certificate" className="mt-0">
      {/* Certificate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Certificate</CardTitle>
          <p className="text-muted-foreground text-sm">
            Auto-issue a branded certificate when a learner passes. Uses your
            tenant&apos;s certificate template &amp; branding.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={certificateEnabled}
              onChange={(e) => setCertificateEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Issue a certificate on pass
          </label>
          {certificateEnabled && (
            <div className="max-w-xs space-y-1 border-l-2 pl-4">
              <Label>Minimum score to earn (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={certMinScore}
                onChange={(e) => setCertMinScore(e.target.value)}
                placeholder="e.g. 40"
              />
              <p className="text-muted-foreground text-xs">
                Blank = any completion earns it. Otherwise the attempt must reach
                this percentage.
              </p>
            </div>
          )}
          {certificateEnabled && (
            <div className="max-w-xs space-y-1 border-l-2 pl-4">
              <Label>Certificate design</Label>
              <select
                value={certTemplateId}
                onChange={(e) => setCertTemplateId(e.target.value)}
                className="bg-background h-9 w-full rounded-md border px-2 pr-8 text-sm"
              >
                <option value="">Use tenant default</option>
                {(certDesigns ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Pick a specific design for this test series, or leave on default
                to use your tenant-wide certificate (Settings → Certificates).
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSaveCertificate} disabled={updateTest.isPending}>
              {updateTest.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-4 w-4" />
              Save certificate
            </Button>
          </div>
        </CardContent>
      </Card>

        </TabsContent>
        <TabsContent value="thumbnail" className="mt-0">
      {/* Thumbnail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thumbnail</CardTitle>
          <p className="text-muted-foreground text-sm">
            Upload a cover image, or generate one with AI from the test name.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverFileChange}
          />
          {coverImageKey && (
            <div className="relative w-full max-w-md overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${THUMBNAILS_BASE_URL}/${coverImageKey}`}
                alt="Test cover"
                className="aspect-[16/9] w-full object-cover"
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute right-2 top-2"
                onClick={() => setCoverImageKey(null)}
                disabled={generatingThumbnail}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => coverInputRef.current?.click()}
              disabled={generatingThumbnail}
            >
              {uploadingCover ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="mr-2 h-4 w-4" />
              )}
              {coverImageKey ? "Upload different" : "Upload cover"}
            </Button>
            {aiAuthoringEnabled && (
              <Button
                variant="outline"
                onClick={handleGenerateThumbnail}
                disabled={generatingThumbnail || !name.trim()}
              >
                {coverAI.isActive ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate with AI
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setComposerOpen(true)}
              disabled={generatingThumbnail}
            >
              <Palette className="mr-2 h-4 w-4" />
              Design thumbnail
            </Button>
            <Button onClick={handleSaveThumbnail} disabled={updateTest.isPending}>
              <Save className="mr-1 h-4 w-4" />
              Save thumbnail
            </Button>
          </div>
          <ThumbnailComposer
            open={composerOpen}
            onOpenChange={setComposerOpen}
            onSave={(key) => {
              setCoverImageKey(key);
              toast({ title: "Thumbnail designed. Click Save thumbnail to apply." });
            }}
          />
        </CardContent>
      </Card>
        </TabsContent>
        <TabsContent value="attempts" className="mt-0">
          <AttemptsReportCard testId={testId} testName={data?.test.name} />
        </TabsContent>
      </Tabs>

      {/* Everything below is the question builder. It is always-on content
          rather than a tab, so it has to stand down while the attempts report
          is showing, otherwise the sections bleed through underneath it. */}
      {tab !== "attempts" && (
      <>
      {/* Adaptive routing health (published adaptive tests) */}
      {isAdaptive && isPublished && <AdaptiveHealthCard testId={testId} />}

      {isAdaptive && modulesData && modulesData.modules.length > 0 && (
        <AdaptiveReadiness
          sections={sections}
          data={modulesData}
          published={isPublished}
        />
      )}

      {/* Sections */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sections</h2>
        <Button size="sm" onClick={() => setNewSectionOpen(true)} disabled={sections.length >= 10}>
          <Plus className="mr-1 h-4 w-4" />
          Add section
        </Button>
      </div>
      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No sections yet. Add one to start.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((s) =>
            isAdaptive ? (
              <AdaptiveModuleBuilder
                key={s.id}
                testId={testId}
                section={s}
                modules={(modulesData?.modules ?? []).filter(
                  (m) => m.sectionId === s.id
                )}
                scoreScales={(modulesData?.scoreScales ?? []).filter(
                  (sc) => sc.sectionId === s.id
                )}
                questionsById={moduleQuestionsMap}
                allPooledQuestionIds={modulePoolIds}
              />
            ) : (
              <SectionCard
                key={s.id}
                testId={testId}
                section={s as FullSection}
                questionsMap={questionsMap}
                bankNameById={bankNameById}
                onAddQuestions={() => {
                  setPickerAutoUpload(false);
                  setPickerSection(s as FullSection);
                }}
                onUploadQuestions={() => {
                  setPickerAutoUpload(true);
                  setPickerSection(s as FullSection);
                }}
                onDelete={() => handleDeleteSection(s.id)}
                onRemoveQuestion={(qid) => handleRemoveQuestion(s.id, qid)}
                onReorder={(fromIdx, dir) => handleReorderQuestion(s as FullSection, fromIdx, dir)}
                onRefresh={refresh}
              />
            )
          )}
        </div>
      )}

      {isAdaptive && sections.length > 0 && (
        <NormTableEditor testId={testId} normTable={modulesData?.normTable ?? null} />
      )}

      </>
      )}

      {/* New section dialog */}
      <Dialog open={newSectionOpen} onOpenChange={setNewSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New section</DialogTitle>
            <DialogDescription>
              Sections group related questions and can have their own time limit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="Physics"
              />
            </div>
            <div className="space-y-1">
              <Label>Time limit (min)</Label>
              <Input
                type="number"
                min={1}
                value={sectionTimeLimit}
                onChange={(e) => setSectionTimeLimit(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSection} disabled={!sectionName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question picker */}
      {pickerSection && (
        <QuestionPickerModal
          testId={testId}
          section={pickerSection}
          excludeIds={sections.flatMap((s) =>
            s.questions.map((q) => q.questionId)
          )}
          autoUpload={pickerAutoUpload}
          onClose={() => {
            setPickerSection(null);
            setPickerAutoUpload(false);
          }}
          onAdded={() => {
            refresh();
          }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this test?</AlertDialogTitle>
            <AlertDialogDescription>
              All sections, question links, and attempt history will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMut.isPending}
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

// ----- Section Card -----

/** Stem can be a plain string or `{ text, imageUrl }`. Pull out both. */
function stemParts(stem: unknown): { text: string; imageUrl: string | null } {
  if (typeof stem === "string") return { text: stem, imageUrl: null };
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    return {
      text: typeof o.text === "string" ? o.text : "",
      imageUrl:
        typeof o.imageUrl === "string" && o.imageUrl.length > 0
          ? o.imageUrl
          : null,
    };
  }
  return { text: "", imageUrl: null };
}

/** Normalise the unknown-typed `options` into `{ id, label, imageUrl }[]`. */
function optionParts(
  options: unknown
): { id: string; label: string; imageUrl: string | null }[] {
  if (!Array.isArray(options)) return [];
  return options.map((o, idx) => {
    const fallbackId = String.fromCharCode(65 + idx);
    if (typeof o === "string")
      return { id: fallbackId, label: o, imageUrl: null };
    if (typeof o === "object" && o !== null) {
      const obj = o as Record<string, unknown>;
      return {
        id: String(obj.id ?? fallbackId),
        label: String(obj.label ?? obj.text ?? ""),
        imageUrl:
          typeof obj.imageUrl === "string" && obj.imageUrl.length > 0
            ? obj.imageUrl
            : null,
      };
    }
    return { id: fallbackId, label: String(o), imageUrl: null };
  });
}

/** Set of correct option ids (uppercased) for MCQ-style questions. */
function correctIdSet(correctAnswer: unknown): Set<string> {
  const out = new Set<string>();
  const add = (v: unknown) => {
    const s = String(v ?? "").trim().toUpperCase();
    if (s) out.add(s);
  };
  if (Array.isArray(correctAnswer)) correctAnswer.forEach(add);
  else if (correctAnswer != null && typeof correctAnswer !== "object")
    add(correctAnswer);
  else if (typeof correctAnswer === "object" && correctAnswer !== null) {
    const o = correctAnswer as Record<string, unknown>;
    if (Array.isArray(o.ids)) o.ids.forEach(add);
    else if (o.id != null) add(o.id);
    else if (o.value != null) add(o.value);
  }
  return out;
}

/** Human-readable answer for NAT / non-MCQ questions. */
function plainAnswer(correctAnswer: unknown): string {
  if (correctAnswer == null) return "-";
  if (typeof correctAnswer === "object") {
    const o = correctAnswer as Record<string, unknown>;
    if (o.value != null) return String(o.value);
    return JSON.stringify(correctAnswer);
  }
  return String(correctAnswer);
}

/**
 * Define or edit a section's bank pooling blueprint AFTER the test is created.
 * Mirrors the create wizard's per-section blueprint, but saves via updateSection
 * which re-materialises the section pool from the bank by the rules. This is how
 * an admin adds rule based questions to an existing test.
 */
function SectionPoolingEditor({
  testId,
  section,
  onRefresh,
}: {
  testId: string;
  section: FullSection;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const initialBp = (section.questionSelection as SectionBlueprint | null) ?? null;
  const [open, setOpen] = useState<boolean>(
    Boolean((initialBp?.rules?.length ?? 0) > 0 || section.questionBankId)
  );
  const [bp, setBp] = useState<SectionBlueprint | null>(initialBp);
  const [bankId, setBankId] = useState<string>(section.questionBankId ?? "");
  const [randomCount, setRandomCount] = useState<string>(
    section.randomQuestionCount != null ? String(section.randomQuestionCount) : ""
  );
  const [saving, setSaving] = useState(false);

  const hasRules = (bp?.rules?.length ?? 0) > 0;

  const save = async () => {
    if (hasRules && !bankId) {
      toast({
        title: "Choose a question bank",
        description: "A blueprint needs a bank to pool questions from.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await testsApi.updateSection(testId, section.id, {
        question_selection: hasRules ? bp : null,
        question_bank_id: hasRules ? bankId || null : null,
        random_question_count: randomCount.trim()
          ? Math.max(1, parseInt(randomCount, 10) || 1)
          : null,
      });
      toast({
        title: "Section pooling saved",
        description: hasRules
          ? "Questions were pooled again from the bank by your rules."
          : "Blueprint cleared for this section.",
      });
      onRefresh();
    } catch (err) {
      toast({
        title: "Failed to save pooling",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Pool from a bank (blueprint)
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border/60 mt-3 space-y-3 rounded-md border border-dashed p-3">
      <div className="flex items-center justify-between">
        <p className="text-foreground text-xs font-semibold">
          Pool from a bank (rule based)
        </p>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground text-xs"
          onClick={() => setOpen(false)}
        >
          Hide
        </button>
      </div>

      <SectionBlueprintEditor
        value={bp}
        onChange={setBp}
        bankId={bankId || undefined}
        onBankChange={setBankId}
      />

      {!hasRules && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-muted-foreground text-xs font-medium">
            Random questions per attempt
          </label>
          <Input
            type="number"
            min={1}
            className="w-28"
            placeholder="All"
            value={randomCount}
            onChange={(e) => setRandomCount(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">
            blank = serve all in this section
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save pooling"}
        </Button>
        <span className="text-muted-foreground text-xs">
          Saving pools this section from the bank again and replaces its questions.
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  testId,
  section,
  questionsMap,
  bankNameById,
  onAddQuestions,
  onUploadQuestions,
  onDelete,
  onRemoveQuestion,
  onReorder,
  onRefresh,
}: {
  testId: string;
  section: FullSection;
  questionsMap: Map<string, TestQuestion>;
  bankNameById: Map<string, string>;
  onAddQuestions: () => void;
  onUploadQuestions: () => void;
  onDelete: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onReorder: (fromIdx: number, dir: -1 | 1) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<TestQuestion | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{section.name}</CardTitle>
          <p className="text-muted-foreground text-xs">
            {section.questions.length} question{section.questions.length === 1 ? "" : "s"}
            {section.timeLimitMin ? ` · ${section.timeLimitMin} min` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onUploadQuestions}
            title="Upload a Word, PDF, Excel or CSV file: AI extracts the questions and adds them to this section"
          >
            <Upload className="mr-1 h-3 w-3" />
            Upload file (AI)
          </Button>
          <Button size="sm" variant="outline" onClick={onAddQuestions}>
            <Plus className="mr-1 h-3 w-3" />
            Add questions
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="text-destructive h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {section.questions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No questions yet.</p>
        ) : (
          <ol className="space-y-2">
            {section.questions.map((sq, idx) => {
              const q = questionsMap.get(sq.questionId);
              if (!q) {
                return <SectionRowSkeleton key={sq.id} index={idx} />;
              }
              return (
                <SectionQuestionRow
                  key={sq.id}
                  index={idx}
                  question={q}
                  bankName={bankNameById.get(q.questionBankId)}
                  isFirst={idx === 0}
                  isLast={idx === section.questions.length - 1}
                  onEdit={() => setEditing(q)}
                  onReorder={(dir) => onReorder(idx, dir)}
                  onRemove={() => onRemoveQuestion(sq.questionId)}
                />
              );
            })}
          </ol>
        )}

        <SectionPoolingEditor
          testId={testId}
          section={section}
          onRefresh={onRefresh}
        />
      </CardContent>

      {/* Edit an existing question inline. */}
      {editing && (
        <QuestionEditorModal
          bankId={editing.questionBankId}
          question={editing}
          open={!!editing}
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              onRefresh();
            }
          }}
        />
      )}
    </Card>
  );
}

function SectionQuestionRow({
  index,
  question: q,
  bankName,
  isFirst,
  isLast,
  onEdit,
  onReorder,
  onRemove,
}: {
  index: number;
  question: TestQuestion;
  bankName?: string;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onReorder: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { text: stemText, imageUrl: stemImage } = stemParts(q.stem);
  const options = optionParts(q.options);
  const correct = correctIdSet(q.correctAnswer);
  const isMcq = options.length > 0;

  return (
    <li className="bg-muted/30 rounded-md p-2">
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-6 shrink-0 text-center text-xs leading-6">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {q.type.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {q.difficulty}
            </Badge>
            {stemImage && (
              <Badge variant="secondary" className="text-[10px]">
                figure
              </Badge>
            )}
            {bankName && (
              <Badge variant="secondary" className="text-[10px]">
                {bankName}
              </Badge>
            )}
            {q.subject && (
              <Badge variant="outline" className="text-[10px]">
                {q.subject}
              </Badge>
            )}
            {q.chapter && (
              <Badge variant="outline" className="text-[10px]">
                {q.chapter}
              </Badge>
            )}
            {q.topic && (
              <Badge variant="outline" className="text-[10px]">
                {q.topic}
              </Badge>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px]"
            >
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
              />
              {open ? "Hide answer" : "Show answer"}
            </button>
          </div>
          <div
            className={`text-foreground cursor-pointer text-sm ${open ? "" : "line-clamp-2"}`}
            onClick={() => setOpen((v) => !v)}
          >
            <MathText block={false}>{stemText || "(empty stem)"}</MathText>
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReorder(-1)}
            disabled={isFirst}
            aria-label="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onReorder(1)}
            disabled={isLast}
            aria-label="Move down"
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label="Remove">
            <Trash2 className="text-destructive h-3 w-3" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-2 space-y-2 border-t pt-2 pl-8">
          {stemImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stemImage}
              alt="Question figure"
              className="max-h-48 rounded-md border"
            />
          )}
          {isMcq ? (
            <ul className="space-y-1">
              {options.map((opt) => {
                const right = correct.has(opt.id.toUpperCase());
                return (
                  <li
                    key={opt.id}
                    className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                      right
                        ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100"
                        : ""
                    }`}
                  >
                    <span className="font-semibold">{opt.id}.</span>
                    <span className="min-w-0 flex-1">
                      {opt.label ? (
                        <MathText block={false}>{opt.label}</MathText>
                      ) : (
                        !opt.imageUrl && <span>(empty)</span>
                      )}
                      {opt.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={opt.imageUrl}
                          alt={`Option ${opt.id}`}
                          className="mt-1 max-h-28 rounded border"
                        />
                      )}
                    </span>
                    {right && (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm">
              <span className="text-muted-foreground">Correct answer: </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                {plainAnswer(q.correctAnswer)}
              </span>
            </p>
          )}
          {q.explanation && (
            <div className="text-muted-foreground rounded-md bg-background/60 p-2 text-xs leading-relaxed">
              <span className="font-medium">Solution:</span>
              <MathText multiline>{q.explanation}</MathText>
            </div>
          )}
          <div>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3 w-3" />
              Edit this question
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

// ----- Question Picker -----

function QuestionPickerModal({
  testId,
  section,
  excludeIds = [],
  autoUpload = false,
  onClose,
  onAdded,
}: {
  testId: string;
  section: FullSection;
  /** Question ids attached to ANY section of this test (random pick skips them). */
  excludeIds?: string[];
  /** When opened via the section "Upload file (AI)" shortcut, jump to the file picker. */
  autoUpload?: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const { data: banks } = useTestQuestionBanks({ limit: 100 });
  const [mode, setMode] = useState<"browse" | "random">("browse");
  const [bankId, setBankId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [bankPickOpen, setBankPickOpen] = useState(false);
  const [bankPickValue, setBankPickValue] = useState<string>("");
  const [aiUploading, setAiUploading] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const autoUploadFiredRef = useRef(false);

  // Auto-select the first question bank so upload/browse work immediately
  // (the buried "choose a bank first" step was why upload felt missing).
  useEffect(() => {
    if (!bankId && (banks?.banks?.length ?? 0) > 0) {
      setBankId(banks!.banks[0].id);
    }
  }, [banks, bankId]);

  // Opened via the section "Upload file (AI)" shortcut → open the file picker
  // straight away once a bank is selected.
  useEffect(() => {
    if (autoUpload && bankId && mode === "browse" && !autoUploadFiredRef.current) {
      autoUploadFiredRef.current = true;
      aiFileRef.current?.click();
    }
  }, [autoUpload, bankId, mode]);

  // Upload a Word/PDF/Excel/CSV file → AI extracts questions into the chosen
  // bank, publishes them, then pre-selects them so the admin can add + edit.
  const handleUploadFile = async (file: File) => {
    if (!bankId) {
      toast({ title: "Choose a bank first", variant: "destructive" });
      return;
    }
    setAiUploading(true);
    try {
      const res = await testQuestionsApi.importFileAI(bankId, file);
      const all = await testQuestionsApi.list({ question_bank_id: bankId, limit: 100 });
      const newOnes = (all.questions ?? []).slice(0, res.created);
      const newIds = newOnes.map((q) => q.id);
      if (newIds.length) {
        await testQuestionsApi.bulkUpdateStatus(newIds, "PUBLISHED");
      }
      const pub = await testQuestionsApi.list({
        question_bank_id: bankId,
        status: "PUBLISHED",
        limit: 100,
      });
      setQuestions(pub.questions ?? []);
      setSelected((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      toast({
        title: "AI import complete",
        description: `${res.created} question${res.created === 1 ? "" : "s"} added and selected. Review/edit, then click Add to attach them.`,
      });
    } catch (err) {
      toast({
        title: "AI import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAiUploading(false);
      if (aiFileRef.current) aiFileRef.current.value = "";
    }
  };

  const existing = useMemo(
    () => new Set(section.questions.map((q) => q.questionId)),
    [section.questions]
  );

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

  const handleCreateNew = () => {
    const bankList = banks?.banks ?? [];
    if (bankList.length === 0) {
      toast({
        title: "No question banks yet",
        description:
          "Create a question bank first, questions must belong to one.",
        variant: "destructive",
      });
      return;
    }
    if (bankId) {
      // Bank already chosen via the filter, just open the editor
      setCreatorOpen(true);
      return;
    }
    if (bankList.length === 1) {
      // Single bank, auto-pick it
      setBankId(bankList[0].id);
      setCreatorOpen(true);
      return;
    }
    // Multiple banks but none chosen, prompt for one
    setBankPickValue("");
    setBankPickOpen(true);
  };

  const handleConfirmBankPick = () => {
    if (!bankPickValue) return;
    setBankId(bankPickValue);
    setBankPickOpen(false);
    setCreatorOpen(true);
  };

  // Random picks land pre-selected at the top of the Browse list so the admin
  // reviews them before clicking Add (same merge pattern as handleQuestionCreated).
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

  const handleQuestionCreated = (q: TestQuestion) => {
    // Show the new question at the top so the admin sees it immediately,
    // and pre-select it so it gets attached when they click Add.
    // Note: section attach requires PUBLISHED on the backend (publish-validation),
    // but we filter the list to PUBLISHED here so DRAFT questions won't show up
    // until the admin publishes them. Show a hint if they created a DRAFT.
    setQuestions((prev) => {
      const without = prev.filter((p) => p.id !== q.id);
      return [q, ...without];
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(q.id);
      return next;
    });
    if (q.status !== "PUBLISHED") {
      toast({
        title: "Saved as draft",
        description:
          "Set status to PUBLISHED on the question to attach it to a published test.",
      });
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

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      await testsApi.addSectionQuestions(
        testId,
        section.id,
        Array.from(selected).map((id) => ({ question_id: id }))
      );
      toast({ title: `Added ${selected.size} questions` });
      onAdded();
      onClose();
    } catch (err) {
      toast({
        title: "Failed to add",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Dialog
      open={!creatorOpen && !bankPickOpen}
      onOpenChange={(o) => !o && !creatorOpen && !bankPickOpen && onClose()}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 p-6 pb-0">
          <DialogTitle>Add questions to {section.name}</DialogTitle>
          <DialogDescription>
            Browse a bank and select questions, or let Random pick choose them
            by difficulty mix.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 px-6 pt-3">
          <div className="flex items-center gap-1 rounded-md bg-muted/40 p-0.5">
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
                <SelectTrigger className="flex-1 min-w-[180px]">
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
                className="flex-1 min-w-[180px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateNew}
                title="Create a new question"
              >
                <Plus className="mr-1 h-4 w-4" />
                New question
              </Button>
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
                title="Upload a Word, PDF, Excel or CSV file: AI extracts questions into this bank and adds them to the section"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-3">
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
                const already = existing.has(q.id);
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
                        <Badge variant="outline" className="text-[10px]">{q.type.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                        {already && (
                          <span className="text-muted-foreground text-xs">already in section</span>
                        )}
                      </div>
                      <div className="text-foreground line-clamp-2 text-sm">
                        <MathText block={false}>
                          {typeof q.stem === "string" ? q.stem : JSON.stringify(q.stem).slice(0, 200)}
                        </MathText>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selected.size === 0 || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {bankId && (
      <QuestionEditorModal
        bankId={bankId}
        question={null}
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        onCreated={handleQuestionCreated}
      />
    )}

    <Dialog open={bankPickOpen} onOpenChange={setBankPickOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save new question to which bank?</DialogTitle>
          <DialogDescription>
            Pick the bank this question should belong to. You can move it later
            by editing the question.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="picker-bank-pick">Bank</Label>
          <Select value={bankPickValue} onValueChange={setBankPickValue}>
            <SelectTrigger id="picker-bank-pick">
              <SelectValue placeholder="Select a bank…" />
            </SelectTrigger>
            <SelectContent>
              {(banks?.banks ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setBankPickOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBankPick} disabled={!bankPickValue}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ----- Learner attempts and answers -----

function AttemptsReportCard({ testId, testName }: { testId: string; testName?: string }) {
  const { data: attempts, isLoading } = useQuery({
    queryKey: ["test-attempts-report", testId],
    queryFn: () => testsApi.listAttempts(testId),
    enabled: !!testId,
  });

  return (
    <AttemptsSection
      count={attempts?.length ?? 0}
      loading={isLoading}
      collapsible={false}
      description={
        <>
          Who attempted this test, what they scored, and their percentile, rank,
          time taken and proctoring flags. Use Review on any row to read that
          learner&apos;s answers question by question.
        </>
      }
    >
      <AttemptsReport
        attempts={attempts ?? []}
        loading={isLoading}
        testId={testId}
        filename={`attempts-${(testName || testId).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
      />
    </AttemptsSection>
  );
}

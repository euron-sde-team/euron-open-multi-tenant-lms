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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, GitBranch, ListOrdered, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MathText } from "@/components/test-series/MathText";
import { RandomPickPanel } from "@/components/test-series/RandomPickPanel";
import {
  testModulesApi,
  testQuestionBanksApi,
  testQuestionsApi,
  testsApi,
  type RoutingRule,
  type TestMode,
  type TestQuestion,
  type TestShowSolutions,
  type SectionBlueprint,
} from "@/lib/api/test-series";
import { testSeriesKeys, useCreateTestFull } from "@/lib/hooks/use-test-series";
import { SectionBlueprintEditor } from "./SectionBlueprintEditor";

type Step = 1 | 2 | 3 | 4;
type AdaptiveTemplate = "SAT_OFFICIAL" | "CUSTOM";
const MAX_SECTIONS = 10;

// Official Digital SAT shape: two sections with their real per-section module
// sizes and timings. Module 1 and both Module 2 variants share each section's
// shape (required so the routing path stays hidden).
const SAT_SECTIONS = [
  { name: "Reading and Writing", count: 27, time: 32 },
  { name: "Math", count: 22, time: 35 },
] as const;
const SAT_SCALE_MAX = 800; // per section; 800 + 800 = 1600 total
const SAT_NORM_MAX = 1600;
const SAT_THRESHOLD_PCT = 65;

interface SectionDraft {
  key: string;
  name: string;
  timeLimitMin: string;
  questionIds: string[];
  // Optional per-section question distribution blueprint (null = serve all
  // the picked questions as-is).
  questionSelection: SectionBlueprint | null;
  // Question bank this section pools from (blueprint + random count draw from it).
  questionBankId: string | null;
  // Random questions served per attempt from this section's pool ("" = all).
  randomQuestionCount: string;
  // Adaptive (custom) per-section module shape.
  moduleCount: string;
  moduleTime: string;
}

function makeSection(idx: number): SectionDraft {
  return {
    key: `s-${Date.now()}-${idx}`,
    name: idx === 0 ? "Section 1" : `Section ${idx + 1}`,
    timeLimitMin: "",
    questionIds: [],
    questionSelection: null,
    questionBankId: null,
    randomQuestionCount: "",
    moduleCount: "20",
    moduleTime: "30",
  };
}

function stemPreview(stem: unknown): string {
  if (typeof stem === "string") return stem;
  if (stem && typeof stem === "object" && "text" in stem) {
    return String((stem as { text?: unknown }).text ?? "");
  }
  try {
    return JSON.stringify(stem);
  } catch {
    return "";
  }
}

export interface CreateTestWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (testId: string) => void;
  /**
   * "modal" (default) renders inside a Dialog. "page" renders the same 4-step
   * flow full-width with a progress bar, for the dedicated create-test page.
   */
  variant?: "modal" | "page";
}

/**
 * Single dialog, 4 steps:
 *  1. Basics: name, description, duration
 *  2. Sections: name + optional per-section time limit, reorderable
 *  3. Questions: pick a bank, search, multi-select per section
 *  4. Settings: shuffle, show solutions, allow reattempt, pass criteria, target exam
 *
 * Submits to POST /tenant/tests/full and redirects to the detail page.
 * No rank curve, no coupons, no separate "save" hops.
 */
export function CreateTestWizard({ open, onOpenChange, onCreated, variant = "modal" }: CreateTestWizardProps) {
  const { toast } = useToast();
  const createMut = useCreateTestFull();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [mode, setMode] = useState<TestMode>("STANDARD");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("60");

  // Adaptive setup. The Digital SAT template owns its sections + shapes + scoring;
  // Custom adaptive sets per-section shapes (in step 2) and routing thresholds.
  const [adaptiveTemplate, setAdaptiveTemplate] =
    useState<AdaptiveTemplate>("SAT_OFFICIAL");
  const [preset, setPreset] = useState<"SAT" | "THREE">("SAT");
  const [thresholdUpPct, setThresholdUpPct] = useState(String(SAT_THRESHOLD_PCT));
  const [thresholdMidPct, setThresholdMidPct] = useState("45");
  const [adaptiveSubmitting, setAdaptiveSubmitting] = useState(false);

  // Step 2
  const [sections, setSections] = useState<SectionDraft[]>([makeSection(0)]);
  const [activeSectionKey, setActiveSectionKey] = useState<string>("");

  // Step 3: manual browsing vs random pick with a difficulty mix
  const [pickerMode, setPickerMode] = useState<"manual" | "random">("manual");

  // Step 4
  // IMMEDIATE, matching the column default and the test edit page.
  //
  // This wizard defaulted to AFTER_SERIES_END while `tests.show_solutions`
  // defaults to IMMEDIATE and the edit page initialises to IMMEDIATE. So every
  // test created here silently withheld the correct answers AND the
  // explanations, and the admin never made that choice. Reported from the
  // field: "students are concerned that after attending the test they didn't
  // get the actual answer of individual questions and also they didn't get the
  // explanation of answers. I have even uploaded the question with an
  // explanation."
  //
  // AFTER_SERIES_END is stricter than it sounds, which is what made it hard to
  // spot: when the series has no end date, solutions appear only once the
  // learner has submitted EVERY test in the series, so a learner who finishes
  // one test sees nothing at all, indefinitely.
  const [showSolutions, setShowSolutions] = useState<TestShowSolutions>("IMMEDIATE");
  // Default both shuffles ON for new tests so option/question order varies per
  // attempt without the admin having to remember the toggles.
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [allowReattempt, setAllowReattempt] = useState(false);
  const [passPct, setPassPct] = useState("");
  const [targetExam, setTargetExam] = useState("");
  // Calculator available to students during the test (useful in proctored
  // exams so they need not leave the window). NONE = no calculator.
  const [calculatorMode, setCalculatorMode] = useState("NONE");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMode("STANDARD");
    setName("");
    setDescription("");
    setDuration("60");
    setAdaptiveTemplate("SAT_OFFICIAL");
    setPreset("SAT");
    setThresholdUpPct(String(SAT_THRESHOLD_PCT));
    setThresholdMidPct("45");
    setAdaptiveSubmitting(false);
    setSections([makeSection(0)]);
    setActiveSectionKey("");
    setPickerMode("manual");
    // IMMEDIATE here too, not just in the useState above.
    //
    // This effect re-runs every time the dialog OPENS, so it overwrites the
    // initial state. Changing only the useState default left the wizard still
    // creating tests that withheld answers and explanations, because by the
    // time an admin saw step 4 this line had already put it back.
    setShowSolutions("IMMEDIATE");
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setAllowReattempt(false);
    setPassPct("");
    setTargetExam("");
    setCalculatorMode("NONE");
  }, [open]);

  useEffect(() => {
    if (step === 3 && sections.length > 0 && !activeSectionKey) {
      setActiveSectionKey(sections[0].key);
    }
  }, [step, sections, activeSectionKey]);

  const totalQuestions = useMemo(
    () => sections.reduce((acc, s) => acc + s.questionIds.length, 0),
    [sections]
  );

  // A section is populated when it has manually picked questions OR a blueprint
  // that pools from a bank by rules. Blueprint sections have no questionIds at
  // this point (they are materialised from the bank on save), so counting only
  // questionIds would wrongly block creating a bank-pooled test.
  const sectionsPopulated = useMemo(
    () =>
      sections.length > 0 &&
      sections.every(
        (s) =>
          s.questionIds.length > 0 ||
          (s.questionSelection?.rules?.length ?? 0) > 0
      ),
    [sections]
  );

  // Sections that still have no questions and no blueprint, so we can tell the
  // creator exactly why the Create button is disabled instead of greying out
  // silently.
  const emptySections = useMemo(
    () =>
      sections.filter(
        (s) =>
          s.questionIds.length === 0 &&
          (s.questionSelection?.rules?.length ?? 0) === 0
      ),
    [sections]
  );

  const isAdaptive = mode === "ADAPTIVE";
  const isSatTemplate = isAdaptive && adaptiveTemplate === "SAT_OFFICIAL";

  const canAdvanceFromStep1 =
    name.trim().length > 0 &&
    (isAdaptive ||
      (Number.isFinite(parseInt(duration, 10)) && parseInt(duration, 10) > 0));

  // The SAT template owns its sections, so step 2 is informational for it.
  const canAdvanceFromStep2 = isSatTemplate
    ? true
    : sections.length > 0 && sections.every((s) => s.name.trim().length > 0);

  // Routing thresholds are percentages applied per section, so sections of
  // different sizes work without separate threshold inputs.
  const upPct = parseInt(thresholdUpPct, 10);
  const midPct = parseInt(thresholdMidPct, 10);
  const customShapesValid = sections.every((s) => {
    const c = parseInt(s.moduleCount, 10);
    const t = parseInt(s.moduleTime, 10);
    return Number.isFinite(c) && c >= 1 && Number.isFinite(t) && t >= 1;
  });
  const thresholdsValid =
    Number.isFinite(upPct) &&
    upPct >= 1 &&
    upPct <= 100 &&
    (preset === "SAT" ||
      (Number.isFinite(midPct) && midPct >= 1 && midPct < upPct));
  const adaptiveConfigValid = isSatTemplate
    ? true
    : customShapesValid && thresholdsValid;

  const canSubmit = isAdaptive
    ? canAdvanceFromStep1 && canAdvanceFromStep2 && adaptiveConfigValid
    : canAdvanceFromStep1 && canAdvanceFromStep2 && sectionsPopulated;

  const updateSection = (key: string, patch: Partial<SectionDraft>) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const addSection = () => {
    if (sections.length >= MAX_SECTIONS) return;
    const next = makeSection(sections.length);
    setSections((prev) => [...prev, next]);
    setActiveSectionKey(next.key);
  };

  const removeSection = (key: string) => {
    setSections((prev) => {
      const next = prev.filter((s) => s.key !== key);
      return next.length > 0 ? next : [makeSection(0)];
    });
    if (activeSectionKey === key) setActiveSectionKey("");
  };

  const moveSection = (key: string, dir: -1 | 1) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = prev.slice();
      const [moved] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, moved);
      return copy;
    });
  };

  const setQuestionsForSection = (key: string, ids: string[]) => {
    updateSection(key, { questionIds: ids });
  };

  /**
   * Adaptive creation: test (mode ADAPTIVE) + sections + a module set per section
   * via the generic module API. The Digital SAT template fixes the sections,
   * shapes, threshold, and also auto-seeds score scales + the percentile table so
   * the test is immediately scorable. Pools are attached in the builder after.
   */
  const handleSubmitAdaptive = async () => {
    if (!canSubmit) return;
    setAdaptiveSubmitting(true);
    try {
      const planSections = isSatTemplate
        ? SAT_SECTIONS.map((s) => ({ name: s.name, count: s.count, time: s.time }))
        : sections.map((s) => ({
            name: s.name.trim(),
            count: parseInt(s.moduleCount, 10),
            time: parseInt(s.moduleTime, 10),
          }));
      const usePreset = isSatTemplate ? "SAT" : preset;
      const variants =
        usePreset === "SAT"
          ? [
              { variant: "EASIER", rank: 0 },
              { variant: "HARDER", rank: 1 },
            ]
          : [
              { variant: "EASY", rank: 0 },
              { variant: "MEDIUM", rank: 1 },
              { variant: "HARD", rank: 2 },
            ];
      const upFraction =
        (Number.isFinite(upPct) && upPct >= 1 && upPct <= 100
          ? upPct
          : SAT_THRESHOLD_PCT) / 100;
      const midFraction = midPct / 100;

      // Two modules per section (Module 1 + the served Module 2), same shape.
      const computedDuration = planSections.reduce((sum, s) => sum + s.time * 2, 0);
      const test = await testsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        duration_min: computedDuration,
        mode: "ADAPTIVE",
        show_solutions: showSolutions,
        allow_reattempt: allowReattempt,
        shuffle_options: shuffleOptions,
        pass_criteria_pct: passPct.trim() ? parseFloat(passPct) : null,
        target_exam: targetExam.trim() || null,
      });

      const createdSectionIds: string[] = [];
      for (let i = 0; i < planSections.length; i++) {
        const ps = planSections[i];
        const sec = await testsApi.createSection(test.id, {
          name: ps.name,
          order_index: i,
        });
        createdSectionIds.push(sec.id);
        const rules: RoutingRule[] =
          usePreset === "SAT"
            ? [{ min_correct: Math.ceil(ps.count * upFraction), next_variant: "HARDER" }]
            : [
                { min_correct: Math.ceil(ps.count * upFraction), next_variant: "HARD" },
                { min_correct: Math.ceil(ps.count * midFraction), next_variant: "MEDIUM" },
              ];
        await testModulesApi.create(test.id, sec.id, {
          stage_no: 1,
          variant: "ROUTING",
          difficulty_rank: 0,
          question_count: ps.count,
          time_limit_min: ps.time,
          routing_rules: rules,
        });
        for (const v of variants) {
          await testModulesApi.create(test.id, sec.id, {
            stage_no: 2,
            variant: v.variant,
            difficulty_rank: v.rank,
            question_count: ps.count,
            time_limit_min: ps.time,
          });
        }
      }

      // SAT template: seed scoring. Score scales convert raw correct to a scaled
      // score per section; the norm table converts the 1600 total to a percentile.
      if (isSatTemplate) {
        for (const sectionId of createdSectionIds) {
          await testModulesApi.autoGenerateScoreScales(
            test.id,
            sectionId,
            SAT_SCALE_MAX
          );
        }
        await testModulesApi.autoGenerateNormTable(test.id, SAT_NORM_MAX);
      }

      queryClient.invalidateQueries({ queryKey: testSeriesKeys.tests.all });
      toast({
        title: isSatTemplate ? "Digital SAT test created" : "Adaptive test created",
        description: "Now add questions to each module in the builder.",
      });
      onOpenChange(false);
      onCreated(test.id);
    } catch (err) {
      toast({
        title: "Failed to create adaptive test",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAdaptiveSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    createMut.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        duration_min: parseInt(duration, 10),
        pass_criteria_pct: passPct.trim() ? parseFloat(passPct) : null,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_solutions: showSolutions,
        allow_reattempt: allowReattempt,
        calculator_mode: calculatorMode,
        target_exam: targetExam.trim() || null,
        sections: sections.map((s, idx) => ({
          name: s.name.trim(),
          time_limit_min: s.timeLimitMin.trim() ? parseInt(s.timeLimitMin, 10) : null,
          order_index: idx,
          question_ids: s.questionIds,
          question_selection:
            s.questionSelection && s.questionSelection.rules.length > 0
              ? s.questionSelection
              : null,
          // Only pool from a bank when a blueprint with rules is defined.
          // Manual sections keep their picked questions (no bank).
          question_bank_id:
            s.questionSelection && s.questionSelection.rules.length > 0
              ? s.questionBankId || null
              : null,
          random_question_count: s.randomQuestionCount.trim()
            ? Math.max(1, parseInt(s.randomQuestionCount, 10) || 1)
            : null,
        })),
      },
      {
        onSuccess: (result) => {
          toast({ title: "Test created" });
          onOpenChange(false);
          onCreated(result.test.id);
        },
        onError: (err) =>
          toast({
            title: "Failed to create test",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          }),
      }
    );
  };

  const stepLabel =
    step === 1
      ? "Basics"
      : step === 2
        ? "Sections"
        : step === 3
          ? isAdaptive
            ? "Modules"
            : "Questions"
          : "Settings";

  const content = (
    <>
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("STANDARD")}
                className={`rounded-md border p-3 text-left transition-colors ${
                  !isAdaptive
                    ? "border-primary/50 bg-primary/5"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ListOrdered className="h-4 w-4" />
                  Standard
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Fixed question paper. Everyone gets the same test.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode("ADAPTIVE")}
                className={`rounded-md border p-3 text-left transition-colors ${
                  isAdaptive
                    ? "border-primary/50 bg-primary/5"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="h-4 w-4" />
                  Adaptive (SAT-style)
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Module 1 routes each learner to an easier or harder module 2.
                </p>
              </button>
            </div>
            {isAdaptive && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAdaptiveTemplate("SAT_OFFICIAL")}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    isSatTemplate
                      ? "border-primary/50 bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="text-sm font-medium">Digital SAT (official)</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Reading and Writing + Math at official sizes and timing. Scoring
                    is set up for you; just add questions.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAdaptiveTemplate("CUSTOM")}
                  className={`rounded-md border p-3 text-left transition-colors ${
                    !isSatTemplate
                      ? "border-primary/50 bg-primary/5"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="text-sm font-medium">Custom adaptive</div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Your own sections, module sizes, and routing. Set scoring later.
                  </p>
                </button>
              </div>
            )}
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isAdaptive ? "Digital SAT Mock 1" : "JEE Main Mock 1"}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            {!isAdaptive && (
              <div className="space-y-1">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            )}
            {isAdaptive && (
              <p className="text-muted-foreground rounded-md bg-muted/30 p-3 text-xs">
                Total duration comes from per-module timers, configured in the
                Modules step.
              </p>
            )}
          </div>
        )}

        {step === 2 && isSatTemplate && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              The Digital SAT template uses two fixed sections. You add questions to
              each module in the builder after creating the test.
            </p>
            {SAT_SECTIONS.map((s) => (
              <div key={s.name} className="rounded-md border p-3">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-muted-foreground text-xs">
                  {s.count} questions and {s.time} min per module
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 2 && !isSatTemplate && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              {isAdaptive
                ? `Add up to ${MAX_SECTIONS} sections and set each section's module size and time. You add questions in the builder after creating.`
                : `Add up to ${MAX_SECTIONS} sections. You will pick questions per section in the next step.`}
            </p>
            {sections.map((s, idx) => (
              <div key={s.key} className="rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSection(s.key, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveSection(s.key, 1)}
                      disabled={idx === sections.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid flex-1 grid-cols-3 gap-3">
                    <div
                      className={`space-y-1 ${isAdaptive ? "col-span-1" : "col-span-2"}`}
                    >
                      <Label>Section name</Label>
                      <Input
                        value={s.name}
                        onChange={(e) => updateSection(s.key, { name: e.target.value })}
                        placeholder={`Section ${idx + 1}`}
                      />
                    </div>
                    {!isAdaptive && (
                      <div className="space-y-1">
                        <Label>Time limit (min)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={s.timeLimitMin}
                          onChange={(e) =>
                            updateSection(s.key, { timeLimitMin: e.target.value })
                          }
                          placeholder="No limit"
                        />
                      </div>
                    )}
                    {isAdaptive && (
                      <>
                        <div className="space-y-1">
                          <Label>Questions / module</Label>
                          <Input
                            type="number"
                            min={1}
                            value={s.moduleCount}
                            onChange={(e) =>
                              updateSection(s.key, { moduleCount: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Time / module (min)</Label>
                          <Input
                            type="number"
                            min={1}
                            value={s.moduleTime}
                            onChange={(e) =>
                              updateSection(s.key, { moduleTime: e.target.value })
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSection(s.key)}
                    aria-label="Remove section"
                  >
                    <Trash2 className="text-destructive h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={addSection}
              disabled={sections.length >= MAX_SECTIONS}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add section
            </Button>
          </div>
        )}

        {step === 3 && isAdaptive && isSatTemplate && (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">Digital SAT (official)</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Reading and Writing (27 q, 32 min) and Math (22 q, 35 min). Module 1
                routes each student to an Easier or Harder Module 2. Score conversion
                (800 per section) and the percentile chart (1600) are created for you,
                so the test is scorable as soon as you add questions.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Route to the Harder module at (% of Module 1 correct)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={thresholdUpPct}
                onChange={(e) => setThresholdUpPct(e.target.value)}
                className="w-28"
              />
              <p className="text-muted-foreground text-xs">
                Default 65%, like the digital SAT. That is{" "}
                {Number.isFinite(upPct) ? Math.ceil(27 * (upPct / 100)) : "-"} of 27 in
                Reading and Writing and{" "}
                {Number.isFinite(upPct) ? Math.ceil(22 * (upPct / 100)) : "-"} of 22 in
                Math.
              </p>
            </div>
          </div>
        )}

        {step === 3 && isAdaptive && !isSatTemplate && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Module 1 routes each student to a Module 2 variant. Module sizes and
              times are set per section in the previous step.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPreset("SAT")}
                className={`rounded-md border p-3 text-left transition-colors ${
                  preset === "SAT" ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <div className="text-sm font-medium">SAT style</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Routing then Easier or Harder. One threshold.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setPreset("THREE")}
                className={`rounded-md border p-3 text-left transition-colors ${
                  preset === "THREE" ? "border-primary/50 bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <div className="text-sm font-medium">Three route</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Routing then Easy, Medium or Hard. Two thresholds.
                </p>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>
                  Route to {preset === "SAT" ? "Harder" : "Hard"} at (% correct)
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={thresholdUpPct}
                  onChange={(e) => setThresholdUpPct(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  About {preset === "SAT" ? "65" : "70"}% of Module 1, like the
                  digital SAT.
                </p>
              </div>
              {preset === "THREE" && (
                <div className="space-y-1">
                  <Label>Route to Medium at (% correct)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={thresholdMidPct}
                    onChange={(e) => setThresholdMidPct(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Below this routes to Easy.
                  </p>
                </div>
              )}
            </div>
            <div className="text-muted-foreground rounded-md bg-muted/30 p-3 text-xs">
              {sections.length} section{sections.length === 1 ? "" : "s"} x{" "}
              {preset === "SAT" ? 3 : 4} modules. Each student sits{" "}
              {sections.length * 2} modules.
            </div>
          </div>
        )}

        {step === 3 && !isAdaptive && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Pick questions for each section. You can change a section&apos;s selection
              by clicking it on the left.
            </p>
            <div className="grid grid-cols-[200px_1fr] gap-3">
              <ul className="space-y-1">
                {sections.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setActiveSectionKey(s.key)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                        activeSectionKey === s.key
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium">{s.name || "(unnamed)"}</div>
                      <div className="text-muted-foreground text-xs">
                        {(s.questionSelection?.rules?.length ?? 0) > 0
                          ? `Blueprint: ${s.questionSelection!.rules.length} rule${
                              s.questionSelection!.rules.length === 1 ? "" : "s"
                            }`
                          : `${s.questionIds.length} question${
                              s.questionIds.length === 1 ? "" : "s"
                            }`}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border p-3">
                {(() => {
                  const active = sections.find((s) => s.key === activeSectionKey);
                  if (!active) {
                    return (
                      <p className="text-muted-foreground text-sm">
                        Select a section on the left.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 rounded-md bg-muted/40 p-0.5">
                        <button
                          type="button"
                          onClick={() => setPickerMode("manual")}
                          className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                            pickerMode === "manual"
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Pick manually
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickerMode("random")}
                          className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                            pickerMode === "random"
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Random pick
                        </button>
                      </div>
                      {pickerMode === "manual" ? (
                        <QuestionPickerInline
                          sectionLabel={active.name}
                          selected={active.questionIds}
                          // A question already used by another section can't be
                          // picked here, no duplicate questions across sections.
                          excludeIds={sections
                            .filter((s) => s.key !== active.key)
                            .flatMap((s) => s.questionIds)}
                          onChange={(ids) =>
                            setQuestionsForSection(active.key, ids)
                          }
                        />
                      ) : (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">{active.name}</div>
                          <RandomPickPanel
                            // Never re-pick a question already used by ANY
                            // section of this draft test.
                            excludeIds={sections.flatMap((s) => s.questionIds)}
                            onPicked={(picked) => {
                              const merged = new Set([
                                ...active.questionIds,
                                ...picked.map((q) => q.id),
                              ]);
                              setQuestionsForSection(
                                active.key,
                                Array.from(merged)
                              );
                              toast({
                                title: `Added ${picked.length} questions to ${active.name}`,
                                description: `Section now has ${merged.size} question${
                                  merged.size === 1 ? "" : "s"
                                }.`,
                              });
                            }}
                          />
                        </div>
                      )}
                      <SectionBlueprintEditor
                        key={active.key}
                        value={active.questionSelection}
                        onChange={(v) =>
                          updateSection(active.key, { questionSelection: v })
                        }
                        bankId={active.questionBankId ?? undefined}
                        onBankChange={(bid) =>
                          updateSection(active.key, { questionBankId: bid })
                        }
                      />
                      {!active.questionSelection && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-muted-foreground text-xs font-medium">
                            Random questions per attempt
                          </label>
                          <Input
                            type="number"
                            min={1}
                            className="w-28"
                            placeholder="All"
                            value={active.randomQuestionCount}
                            onChange={(e) =>
                              updateSection(active.key, {
                                randomQuestionCount: e.target.value,
                              })
                            }
                          />
                          <span className="text-muted-foreground text-xs">
                            blank = serve all in this section
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Show solutions</Label>
                <Select
                  value={showSolutions}
                  onValueChange={(v) => setShowSolutions(v as TestShowSolutions)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMMEDIATE">After each attempt</SelectItem>
                    <SelectItem value="AFTER_SERIES_END">
                      After the whole series is finished
                    </SelectItem>
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
              </div>
              <div className="space-y-1">
                <Label>Pass criteria (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passPct}
                  onChange={(e) => setPassPct(e.target.value)}
                  placeholder="Optional"
                />
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
            </div>
            <div className="text-muted-foreground rounded-md bg-muted/30 p-3 text-xs">
              {isAdaptive ? (
                <>
                  Summary:{" "}
                  {isSatTemplate
                    ? "Digital SAT (official), 2 sections, scoring set up automatically. Add questions next."
                    : `custom adaptive (${
                        preset === "SAT" ? "SAT style" : "three route"
                      }), ${sections.length} section${
                        sections.length === 1 ? "" : "s"
                      }.`}
                </>
              ) : (
                <>
                  Summary: {sections.length} section{sections.length === 1 ? "" : "s"},{" "}
                  {totalQuestions > 0
                    ? `${totalQuestions} question${totalQuestions === 1 ? "" : "s"} picked`
                    : "questions pooled from a bank"}
                  , {duration} min.
                </>
              )}
            </div>
            {!isAdaptive && emptySections.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                Create is disabled because every section needs questions. Still
                empty:{" "}
                {emptySections.map((s) => s.name || "(unnamed)").join(", ")}. Go
                back to the Questions step, select the section on the left, and
                either pick questions or click Add question blueprint.
              </div>
            )}
          </div>
        )}

      </>
  );

  const footerButtons = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      {step > 1 && (
        <Button variant="outline" onClick={() => setStep((step - 1) as Step)}>
          Back
        </Button>
      )}
      {step < 4 ? (
        <Button
          onClick={() => setStep((step + 1) as Step)}
          disabled={
            (step === 1 && !canAdvanceFromStep1) ||
            (step === 2 && !canAdvanceFromStep2)
          }
        >
          Next
        </Button>
      ) : (
        <Button
          onClick={isAdaptive ? handleSubmitAdaptive : handleSubmit}
          disabled={!canSubmit || createMut.isPending || adaptiveSubmitting}
        >
          {(createMut.isPending || adaptiveSubmitting) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isAdaptive ? "Create adaptive test" : "Create test"}
        </Button>
      )}
    </>
  );

  if (variant === "page") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to tests
          </button>
          <h1 className="text-2xl font-bold">New test</h1>
          <div className="mt-3 flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={
                  s <= step
                    ? "h-1.5 flex-1 rounded-full bg-primary"
                    : "h-1.5 flex-1 rounded-full bg-muted"
                }
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Step {step} of 4 · {stepLabel}
          </p>
        </div>
        <div className="space-y-4">{content}</div>
        <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
          {footerButtons}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New test</DialogTitle>
          <DialogDescription>
            Step {step} of 4 · {stepLabel}
          </DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter className="gap-2">{footerButtons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface QuestionPickerInlineProps {
  sectionLabel: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Questions already used by OTHER sections of this test, shown disabled so
   *  the same question can't be picked into two sections. */
  excludeIds?: string[];
}

function QuestionPickerInline({
  sectionLabel,
  selected,
  onChange,
  excludeIds = [],
}: QuestionPickerInlineProps) {
  const [bankId, setBankId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [banks, setBanks] = useState<Array<{ id: string; name: string }>>([]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("__ALL__");
  const [chapterFilter, setChapterFilter] = useState("__ALL__");
  const [topicFilter, setTopicFilter] = useState("__ALL__");
  const [difficultyFilter, setDifficultyFilter] = useState("__ALL__");

  useEffect(() => {
    let cancelled = false;
    setLoadingBanks(true);
    testQuestionBanksApi
      .list()
      .then((res) => {
        if (cancelled) return;
        const items = res.banks.map((b) => ({ id: b.id, name: b.name }));
        setBanks(items);
        if (items.length > 0 && !bankId) setBankId(items[0].id);
      })
      .finally(() => {
        if (!cancelled) setLoadingBanks(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bankId) {
      setQuestions([]);
      return;
    }
    let cancelled = false;
    setLoadingQuestions(true);
    testQuestionsApi
      .list({
        question_bank_id: bankId,
        status: "PUBLISHED",
        search: search.trim() || undefined,
        limit: 100,
      })
      .then((res) => {
        if (!cancelled) setQuestions(res.questions);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bankId, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const distinct = useMemo(() => {
    const s = new Set<string>();
    const c = new Set<string>();
    const t = new Set<string>();
    for (const q of questions) {
      if (q.subject) s.add(q.subject);
      if (q.chapter) c.add(q.chapter);
      if (q.topic) t.add(q.topic);
    }
    return {
      subjects: Array.from(s).sort(),
      chapters: Array.from(c).sort(),
      topics: Array.from(t).sort(),
    };
  }, [questions]);

  const filtered = useMemo(
    () =>
      questions.filter((q) => {
        if (subjectFilter !== "__ALL__" && q.subject !== subjectFilter) return false;
        if (chapterFilter !== "__ALL__" && q.chapter !== chapterFilter) return false;
        if (topicFilter !== "__ALL__" && q.topic !== topicFilter) return false;
        if (difficultyFilter !== "__ALL__" && q.difficulty !== difficultyFilter)
          return false;
        return true;
      }),
    [questions, subjectFilter, chapterFilter, topicFilter, difficultyFilter]
  );

  const toggle = (id: string) => {
    // Questions used by another section can't be picked here.
    if (excludeSet.has(id)) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedSet);
    for (const q of filtered) if (!excludeSet.has(q.id)) next.add(q.id);
    onChange(Array.from(next));
  };

  const clearFiltered = () => {
    const remove = new Set(filtered.map((q) => q.id));
    onChange(selected.filter((id) => !remove.has(id)));
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{sectionLabel}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Bank</Label>
          <Select value={bankId} onValueChange={setBankId} disabled={loadingBanks}>
            <SelectTrigger>
              <SelectValue placeholder={loadingBanks ? "Loading..." : "Pick a bank"} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Search</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-9"
              placeholder="Stem text"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All subjects</SelectItem>
            {distinct.subjects.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={chapterFilter} onValueChange={setChapterFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Chapter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All chapters</SelectItem>
            {distinct.chapters.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All topics</SelectItem>
            {distinct.topics.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">Any difficulty</SelectItem>
            <SelectItem value="EASY">Easy</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HARD">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {selected.length} selected · {filtered.length} shown
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={selectAllFiltered}
          disabled={filtered.length === 0}
          className="ml-auto"
        >
          Select all shown
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={clearFiltered}
          disabled={filtered.length === 0}
        >
          Clear shown
        </Button>
      </div>
      <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
        {loadingQuestions ? (
          <div className="flex justify-center py-6">
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">
            No published questions in this bank match.
          </p>
        ) : (
          filtered.map((q) => {
            const excluded = excludeSet.has(q.id);
            const checked = selectedSet.has(q.id);
            const tags = [q.subject, q.chapter, q.topic]
              .filter(Boolean)
              .join(" › ");
            return (
              <label
                key={q.id}
                className={`flex items-start gap-2 rounded-md border p-2 text-sm ${
                  excluded
                    ? "cursor-not-allowed opacity-50"
                    : checked
                      ? "bg-primary/5 border-primary/30"
                      : "hover:bg-muted/30"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={excluded}
                  onChange={() => toggle(q.id)}
                  className="mt-0.5 h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2">
                    <MathText block={false}>{stemPreview(q.stem)}</MathText>
                  </div>
                  {tags && (
                    <div className="text-muted-foreground text-xs">{tags}</div>
                  )}
                  <div className="text-muted-foreground text-xs">
                    {q.type} · {q.difficulty} · {q.marks} marks
                    {excluded && " · in another section"}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

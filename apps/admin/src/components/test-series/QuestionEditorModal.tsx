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
  useToast,
} from "@open-mtlms/core";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DiagramUploader,
  type DiagramSize,
} from "@/components/test-series/DiagramUploader";
import { RichEditor } from "@/components/test-series/rich-editor/RichEditor";
import type {
  TestQuestion,
  TestQuestionDifficulty,
  TestQuestionStatus,
  TestQuestionType,
} from "@/lib/api/test-series";
import {
  useCreateTestQuestion,
  useUpdateTestQuestion,
  useTaxonomy,
} from "@/lib/hooks/use-test-series";
import { decodeEntities } from "@/lib/quiz-formats/text";

// Valid size presets, see DiagramUploader.tsx. Anything else (legacy data,
// hand-edited DB rows) coerces back to "md" so the renderer never receives
// an unrecognized enum.
const VALID_SIZES: ReadonlyArray<DiagramSize> = ["sm", "md", "lg", "xl"];
function coerceSize(value: unknown): DiagramSize {
  return typeof value === "string" && (VALID_SIZES as readonly string[]).includes(value)
    ? (value as DiagramSize)
    : "md";
}

interface Option {
  id: string;
  label: string;
  imageUrl: string | null;
  imageSize: DiagramSize;
}

interface Props {
  bankId: string;
  question: TestQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a NEW question is successfully created (not on update). */
  onCreated?: (question: TestQuestion) => void;
  /**
   * "modal" (default) renders inside a Dialog. "page" renders the same authoring
   * body full-width without the Dialog chrome, for the dedicated editor page.
   */
  variant?: "modal" | "page";
}

function getStemString(stem: unknown): string {
  // Stored text is HTML-entity-encoded by the global XSS sanitizer. Decode on
  // load so the editor shows readable text (e.g. "&amp;" -> "&"); a save then
  // round-trips it back to clean single-encoding.
  if (typeof stem === "string") return decodeEntities(stem);
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.text === "string") return decodeEntities(o.text);
  }
  return "";
}

// New: extract the optional stem diagram URL. Stem JSON migrated from `string`
// to `{ text, imageUrl, imageSize? }` when diagrams were added, old
// questions still come back as a string, in which case the diagram URL is
// just null.
function getStemImageUrl(stem: unknown): string | null {
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    if (typeof o.imageUrl === "string" && o.imageUrl.length > 0) return o.imageUrl;
  }
  return null;
}

function getStemImageSize(stem: unknown): DiagramSize {
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    return coerceSize(o.imageSize);
  }
  return "md";
}

/** Optional long context/passage shown in the student's Description panel. */
function getStemDescriptionStr(stem: unknown): string {
  if (typeof stem === "object" && stem !== null) {
    const o = stem as Record<string, unknown>;
    for (const key of ["description", "context", "passage"]) {
      const v = o[key];
      if (typeof v === "string" && v.trim().length > 0) return decodeEntities(v);
    }
  }
  return "";
}

function getOptionsArray(options: unknown): Option[] {
  if (!Array.isArray(options)) return [];
  return options.map((o, idx) => {
    if (typeof o === "string") {
      return {
        id: String.fromCharCode(65 + idx),
        label: decodeEntities(o),
        imageUrl: null,
        imageSize: "md" as DiagramSize,
      };
    }
    if (typeof o === "object" && o !== null) {
      const obj = o as Record<string, unknown>;
      const imageUrl =
        typeof obj.imageUrl === "string" && obj.imageUrl.length > 0
          ? obj.imageUrl
          : null;
      return {
        id: String(obj.id ?? String.fromCharCode(65 + idx)),
        label: decodeEntities(String(obj.label ?? obj.text ?? "")),
        imageUrl,
        imageSize: coerceSize(obj.imageSize),
      };
    }
    return {
      id: String.fromCharCode(65 + idx),
      label: decodeEntities(String(o)),
      imageUrl: null,
      imageSize: "md" as DiagramSize,
    };
  });
}

// A blank is a run of 2+ underscores ("___"). Matches the renderer's
// DragDropQuestion blank regex so the editor and player agree on blank count.
const BLANK_REGEX = /_{2,}/g;
function countBlanks(stemText: string): number {
  const matches = stemText.match(BLANK_REGEX);
  return matches ? matches.length : 0;
}

function defaultOptionsForType(type: TestQuestionType): Option[] {
  if (type === "MCQ_SINGLE" || type === "MCQ_MULTI" || type === "DRAG_DROP") {
    return [
      { id: "A", label: "", imageUrl: null, imageSize: "md" },
      { id: "B", label: "", imageUrl: null, imageSize: "md" },
      { id: "C", label: "", imageUrl: null, imageSize: "md" },
      { id: "D", label: "", imageUrl: null, imageSize: "md" },
    ];
  }
  if (type === "TRUE_FALSE") {
    return [
      { id: "TRUE", label: "True", imageUrl: null, imageSize: "md" },
      { id: "FALSE", label: "False", imageUrl: null, imageSize: "md" },
    ];
  }
  return [];
}

export function QuestionEditorModal({ bankId, question, open, onOpenChange, onCreated, variant = "modal" }: Props) {
  const { toast } = useToast();
  const createMut = useCreateTestQuestion();
  const updateMut = useUpdateTestQuestion();

  const [type, setType] = useState<TestQuestionType>("MCQ_SINGLE");
  const [stem, setStem] = useState("");
  const [stemImageUrl, setStemImageUrl] = useState<string | null>(null);
  const [stemImageSize, setStemImageSize] = useState<DiagramSize>("md");
  const [options, setOptions] = useState<Option[]>(defaultOptionsForType("MCQ_SINGLE"));
  const [singleAnswer, setSingleAnswer] = useState<string>("");
  const [multiAnswer, setMultiAnswer] = useState<string[]>([]);
  // DRAG_DROP: one selected option id per blank ("___"), in stem order.
  const [blankAnswers, setBlankAnswers] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState<string>("");
  const [numAnswer, setNumAnswer] = useState<string>("");
  const [numTolerance, setNumTolerance] = useState<string>("");
  const [explanation, setExplanation] = useState("");
  const [description, setDescription] = useState("");
  const [marks, setMarks] = useState("4");
  const [negativeMarks, setNegativeMarks] = useState("1");
  const [difficulty, setDifficulty] = useState<TestQuestionDifficulty>("MEDIUM");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [subjectNodeId, setSubjectNodeId] = useState("");
  const [chapterNodeId, setChapterNodeId] = useState("");
  const [topicNodeId, setTopicNodeId] = useState("");
  const [status, setStatus] = useState<TestQuestionStatus>("DRAFT");

  // Fixed taxonomy dropdowns (subject -> chapter -> topic).
  const { data: subjectNodes = [] } = useTaxonomy("SUBJECT");
  const { data: chapterNodes = [] } = useTaxonomy(
    "CHAPTER",
    subjectNodeId || undefined
  );
  const { data: topicNodes = [] } = useTaxonomy(
    "TOPIC",
    chapterNodeId || undefined
  );

  const isEdit = !!question;
  // Number of "___" blanks in the DRAG_DROP stem, drives the per-blank mapper.
  const blankCount = countBlanks(stem);

  useEffect(() => {
    if (!open) return;
    if (question) {
      setType(question.type);
      setStem(getStemString(question.stem));
      setStemImageUrl(getStemImageUrl(question.stem));
      setStemImageSize(getStemImageSize(question.stem));
      setDescription(getStemDescriptionStr(question.stem));
      const opts = getOptionsArray(question.options);
      setOptions(opts.length > 0 ? opts : defaultOptionsForType(question.type));
      const ca = question.correctAnswer;
      setSingleAnswer(typeof ca === "string" ? ca : "");
      setMultiAnswer(Array.isArray(ca) ? (ca as string[]) : []);
      // DRAG_DROP: correct_answer is an array (one option id per blank, in
      // order) for multi-blank, or a legacy single string.
      if (question.type === "DRAG_DROP") {
        setBlankAnswers(
          Array.isArray(ca)
            ? (ca as unknown[]).map(String)
            : typeof ca === "string" && ca
              ? [ca]
              : []
        );
      } else {
        setBlankAnswers([]);
      }
      setTextAnswer(
        typeof ca === "string" && question.type === "FIB" ? decodeEntities(ca) : ""
      );
      if (question.type === "NAT") {
        if (typeof ca === "object" && ca !== null) {
          setNumAnswer(String((ca as { value?: number }).value ?? ""));
          setNumTolerance(String((ca as { tolerance?: number }).tolerance ?? ""));
        } else {
          setNumAnswer(typeof ca === "number" ? String(ca) : String(ca ?? ""));
          setNumTolerance("0");
        }
      }
      setExplanation(decodeEntities(question.explanation ?? ""));
      setMarks(String(question.marks));
      setNegativeMarks(String(question.negativeMarks));
      setDifficulty(question.difficulty);
      setSubject(decodeEntities(question.subject ?? ""));
      setChapter(decodeEntities(question.chapter ?? ""));
      setTopic(decodeEntities(question.topic ?? ""));
      setSubjectNodeId(question.subjectNodeId ?? "");
      setChapterNodeId(question.chapterNodeId ?? "");
      setTopicNodeId(question.topicNodeId ?? "");
      setStatus(question.status);
    } else {
      setType("MCQ_SINGLE");
      setStem("");
      setStemImageUrl(null);
      setStemImageSize("md");
      setDescription("");
      setOptions(defaultOptionsForType("MCQ_SINGLE"));
      setSingleAnswer("");
      setMultiAnswer([]);
      setBlankAnswers([]);
      setTextAnswer("");
      setNumAnswer("");
      setNumTolerance("0");
      setExplanation("");
      setMarks("4");
      setNegativeMarks("1");
      setDifficulty("MEDIUM");
      setSubject("");
      setChapter("");
      setTopic("");
      setSubjectNodeId("");
      setChapterNodeId("");
      setTopicNodeId("");
      setStatus("DRAFT");
    }
  }, [open, question]);

  const handleTypeChange = (next: TestQuestionType) => {
    setType(next);
    setOptions(defaultOptionsForType(next));
    setSingleAnswer("");
    setMultiAnswer([]);
    setBlankAnswers([]);
    setTextAnswer("");
    setNumAnswer("");
  };

  const updateOption = (idx: number, label: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, label } : o)));
  };

  const updateOptionImage = (idx: number, imageUrl: string | null) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, imageUrl } : o)));
  };

  const updateOptionImageSize = (idx: number, imageSize: DiagramSize) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, imageSize } : o)));
  };

  const addOption = () => {
    setOptions((prev) => [
      ...prev,
      {
        id: String.fromCharCode(65 + prev.length),
        label: "",
        imageUrl: null,
        imageSize: "md",
      },
    ]);
  };

  const removeOption = (idx: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (!stem.trim() && !stemImageUrl) return "Stem text or a diagram is required";
    if (
      type === "MCQ_SINGLE" ||
      type === "MCQ_MULTI" ||
      type === "TRUE_FALSE" ||
      type === "DRAG_DROP"
    ) {
      if (options.length < 2) return "At least 2 options are required";
      // An option is "filled" when it has text OR a diagram (or both).
      if (options.some((o) => !o.label.trim() && !o.imageUrl))
        return "Every option must have text or a diagram";
    }
    if (type === "MCQ_SINGLE" || type === "TRUE_FALSE") {
      if (!singleAnswer) return "Select the correct option";
    }
    if (type === "DRAG_DROP") {
      // Each "___" in the stem is a drop slot; the learner drags one option
      // into each. The creator maps the correct option to every blank.
      const blanks = countBlanks(stem);
      if (blanks < 1)
        return 'Drag & drop stem must contain at least one "___" (blank marker)';
      for (let i = 0; i < blanks; i++) {
        if (!blankAnswers[i])
          return `Select the correct option for blank ${i + 1}`;
        if (!options.some((o) => o.id === blankAnswers[i]))
          return `Blank ${i + 1} maps to an option that no longer exists`;
      }
    }
    if (type === "MCQ_MULTI") {
      if (multiAnswer.length === 0) return "Select at least one correct option";
    }
    if (type === "FIB") {
      if (!textAnswer.trim()) return "Provide the correct answer";
    }
    if (type === "NAT") {
      const n = parseFloat(numAnswer);
      if (!Number.isFinite(n)) return "Provide a numeric answer";
    }
    return null;
  };

  const buildPayload = () => {
    let correctAnswer: unknown;
    if (type === "MCQ_SINGLE" || type === "TRUE_FALSE")
      correctAnswer = singleAnswer;
    else if (type === "DRAG_DROP") {
      // Single blank → store a plain string (legacy shape, the player submits
      // a string too, so grading stays unchanged). Multiple blanks → an ordered
      // array, one option id per blank. Grading is all-or-nothing.
      const blanks = countBlanks(stem);
      correctAnswer =
        blanks <= 1 ? blankAnswers[0] ?? "" : blankAnswers.slice(0, blanks);
    }
    else if (type === "MCQ_MULTI") correctAnswer = multiAnswer;
    else if (type === "FIB") correctAnswer = textAnswer;
    else if (type === "NAT") {
      const value = parseFloat(numAnswer);
      const tol = parseFloat(numTolerance);
      correctAnswer = Number.isFinite(tol) && tol > 0
        ? { value, tolerance: tol }
        : value;
    }

    // Stem JSON shape: keep `text` for the rich text (string), add optional
    // `imageUrl` + `imageSize` for the diagram. Readers tolerate both
    // `stem = "string"` (legacy) and `stem = { text, imageUrl, imageSize }`
    // (current), see getStemString / getStemImageSize.
    const desc = description.trim();
    const stemPayload =
      stemImageUrl !== null || desc
        ? {
            text: stem,
            ...(stemImageUrl !== null
              ? { imageUrl: stemImageUrl, imageSize: stemImageSize }
              : {}),
            ...(desc ? { description: desc } : {}),
          }
        : stem;

    const base = {
      type,
      stem: stemPayload,
      explanation: explanation.trim() || null,
      marks: parseFloat(marks) || 4,
      difficulty,
      subject: subject.trim() || null,
      chapter: chapter.trim() || null,
      topic: topic.trim() || null,
      subject_node_id: subjectNodeId || null,
      chapter_node_id: chapterNodeId || null,
      topic_node_id: topicNodeId || null,
      status,
    };

    // Descriptive questions are human-graded, they carry no options,
    // correct_answer, or negative marks. Omit those fields entirely so the
    // backend nulls them (per the API contract).
    if (type === "DESCRIPTIVE") {
      return base;
    }

    return {
      ...base,
      options:
        type === "FIB" || type === "NAT"
          ? null
          : options.map((o) => ({
              id: o.id,
              label: o.label,
              ...(o.imageUrl
                ? { imageUrl: o.imageUrl, imageSize: o.imageSize }
                : {}),
            })),
      correct_answer: correctAnswer,
      negative_marks: parseFloat(negativeMarks) || 0,
    };
  };

  const handleSave = () => {
    const error = validate();
    if (error) {
      toast({ title: "Invalid question", description: error, variant: "destructive" });
      return;
    }
    const payload = buildPayload();
    if (isEdit && question) {
      updateMut.mutate(
        { questionId: question.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Question updated" });
            onOpenChange(false);
          },
          onError: (err) =>
            toast({
              title: "Update failed",
              description: err instanceof Error ? err.message : "Unknown error",
              variant: "destructive",
            }),
        }
      );
    } else {
      createMut.mutate(
        { ...payload, question_bank_id: bankId },
        {
          onSuccess: (created) => {
            toast({ title: "Question created" });
            onCreated?.(created);
            onOpenChange(false);
          },
          onError: (err) =>
            toast({
              title: "Create failed",
              description: err instanceof Error ? err.message : "Unknown error",
              variant: "destructive",
            }),
        }
      );
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  const showOptions =
    type === "MCQ_SINGLE" ||
    type === "MCQ_MULTI" ||
    type === "TRUE_FALSE" ||
    type === "DRAG_DROP";

  const body = (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as TestQuestionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ_SINGLE">MCQ (single)</SelectItem>
                  <SelectItem value="MCQ_MULTI">MCQ (multi)</SelectItem>
                  <SelectItem value="TRUE_FALSE">True / False</SelectItem>
                  <SelectItem value="FIB">Fill in the blank</SelectItem>
                  <SelectItem value="NAT">Numerical</SelectItem>
                  <SelectItem value="DRAG_DROP">Drag &amp; Drop</SelectItem>
                  <SelectItem value="DESCRIPTIVE">Descriptive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as TestQuestionDifficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">Easy</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HARD">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Stem *</Label>
            <RichEditor
              value={stem}
              onChange={setStem}
              placeholder="Type the question… use the toolbar to insert equations"
              minHeight={120}
            />
            <div className="pt-1">
              <DiagramUploader
                value={stemImageUrl}
                onChange={setStemImageUrl}
                size={stemImageSize}
                onSizeChange={setStemImageSize}
                label="question diagram"
              />
            </div>
            {type === "DRAG_DROP" && (
              <p className="text-muted-foreground text-xs">
                Use &quot;___&quot; (three underscores) to mark the blank.
              </p>
            )}
          </div>

          {showOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options *</Label>
                {type !== "TRUE_FALSE" && options.length < 6 && (
                  <Button size="sm" variant="ghost" onClick={addOption}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                )}
              </div>
              {options.map((opt, idx) => {
                const isCorrect =
                  type === "MCQ_MULTI"
                    ? multiAnswer.includes(opt.id)
                    : singleAnswer === opt.id;
                return (
                  <div
                    key={`${opt.id}-${idx}`}
                    className="flex items-start gap-2"
                  >
                    {type !== "DRAG_DROP" && (
                      <input
                        type={type === "MCQ_MULTI" ? "checkbox" : "radio"}
                        name="correct"
                        checked={isCorrect}
                        onChange={() => {
                          if (type === "MCQ_MULTI") {
                            setMultiAnswer((prev) =>
                              prev.includes(opt.id)
                                ? prev.filter((x) => x !== opt.id)
                                : [...prev, opt.id]
                            );
                          } else {
                            setSingleAnswer(opt.id);
                          }
                        }}
                        className="mt-3 h-4 w-4"
                        aria-label="Correct answer"
                      />
                    )}
                    <span className="text-muted-foreground mt-3 w-6 text-xs">
                      {opt.id}
                    </span>
                    <div className="flex-1 space-y-2">
                      {type === "TRUE_FALSE" ? (
                        <Input value={opt.label} disabled />
                      ) : (
                        <RichEditor
                          value={opt.label}
                          onChange={(next) => updateOption(idx, next)}
                          placeholder={`Option ${opt.id}`}
                          minHeight={48}
                          slim
                        />
                      )}
                      {type !== "TRUE_FALSE" && (
                        <DiagramUploader
                          value={opt.imageUrl}
                          onChange={(url) => updateOptionImage(idx, url)}
                          size={opt.imageSize}
                          onSizeChange={(s) => updateOptionImageSize(idx, s)}
                          variant="compact"
                          label={`Option ${opt.id} diagram`}
                        />
                      )}
                    </div>
                    {type !== "TRUE_FALSE" && options.length > 2 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeOption(idx)}
                        aria-label="Remove option"
                        className="mt-1"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
              {type !== "DRAG_DROP" && (
                <p className="text-muted-foreground text-xs">
                  {type === "MCQ_MULTI"
                    ? "Tick every correct option."
                    : "Select the radio button next to the correct option."}
                </p>
              )}
              {type === "DRAG_DROP" && (
                <div className="space-y-2 rounded-md border p-3">
                  <Label>Correct answer per blank *</Label>
                  {blankCount === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Add &quot;___&quot; (three underscores) in the stem to
                      create a blank. Use multiple to create multiple blanks.
                    </p>
                  ) : (
                    Array.from({ length: blankCount }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">
                          Blank {i + 1}
                        </span>
                        <Select
                          value={blankAnswers[i] ?? ""}
                          onValueChange={(v) =>
                            setBlankAnswers((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            })
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.id}.{" "}
                                {decodeEntities(o.label)
                                  .replace(/<[^>]+>/g, "")
                                  .trim()
                                  .slice(0, 40) || "(diagram)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))
                  )}
                  <p className="text-muted-foreground text-xs">
                    Each blank becomes a drop slot, filled by the option you map
                    here (in stem order).
                  </p>
                </div>
              )}
            </div>
          )}

          {type === "FIB" && (
            <div className="space-y-1">
              <Label>Correct answer *</Label>
              <Input
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Canonical answer (case-insensitive)"
              />
            </div>
          )}

          {type === "NAT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Numerical answer *</Label>
                <Input
                  type="number"
                  value={numAnswer}
                  onChange={(e) => setNumAnswer(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Tolerance (±)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={numTolerance}
                  onChange={(e) => setNumTolerance(e.target.value)}
                  placeholder="0.0"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Description / context (optional)</Label>
            <RichEditor
              value={description}
              onChange={setDescription}
              placeholder="Long passage, case study, table, or extra context shown in the student's Description panel…"
              minHeight={90}
            />
            <p className="text-muted-foreground text-xs">
              Appears behind the student&apos;s &quot;Description&quot; button during the test.
              Leave blank if the question has no extra context.
            </p>
          </div>

          <div className="space-y-1">
            <Label>
              {type === "DESCRIPTIVE"
                ? "Model answer / grading notes"
                : "Explanation"}
            </Label>
            <RichEditor
              value={explanation}
              onChange={setExplanation}
              placeholder={
                type === "DESCRIPTIVE"
                  ? "Reference answer or rubric for the evaluator (optional)…"
                  : "Why this answer is correct…"
              }
              minHeight={100}
            />
            {type === "DESCRIPTIVE" && (
              <p className="text-muted-foreground text-xs">
                Only the evaluator sees this while grading. Students never see it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Marks</Label>
              <Input
                type="number"
                step="0.5"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
              />
              {type === "DESCRIPTIVE" && (
                <p className="text-muted-foreground text-xs">
                  Maximum the evaluator can award for this answer.
                </p>
              )}
            </div>
            {type !== "DESCRIPTIVE" && (
              <div className="space-y-1">
                <Label>Negative marks</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={negativeMarks}
                  onChange={(e) => setNegativeMarks(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Select
                value={subjectNodeId}
                onValueChange={(v) => {
                  setSubjectNodeId(v);
                  setSubject(subjectNodes.find((n) => n.id === v)?.name ?? "");
                  setChapterNodeId("");
                  setChapter("");
                  setTopicNodeId("");
                  setTopic("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Chapter</Label>
              <Select
                value={chapterNodeId}
                onValueChange={(v) => {
                  setChapterNodeId(v);
                  setChapter(chapterNodes.find((n) => n.id === v)?.name ?? "");
                  setTopicNodeId("");
                  setTopic("");
                }}
                disabled={!subjectNodeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapterNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Select
                value={topicNodeId}
                onValueChange={(v) => {
                  setTopicNodeId(v);
                  setTopic(topicNodes.find((n) => n.id === v)?.name ?? "");
                }}
                disabled={!chapterNodeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {topicNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TestQuestionStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
  );

  const actions = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEdit ? "Save" : "Create"}
      </Button>
    </>
  );

  if (variant === "page") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5">
          <h1 className="text-2xl font-bold">
            {isEdit ? "Edit question" : "New question"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Use plain text or LaTeX wrapped in <code>$…$</code> for math.
          </p>
        </div>
        {body}
        <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit question" : "New question"}</DialogTitle>
          <DialogDescription>
            Use plain text or LaTeX wrapped in <code>$…$</code> for math.
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
  AlertDialogTrigger,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, ChevronDown, ChevronUp, Download, Eye, EyeOff, FileSpreadsheet, Library, Loader2, Pencil, Plus, Save, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { QuestionExportButton } from "@/components/quiz-formats/QuestionExportButton";
import {
  QuestionImportDialog,
  type ImportDefaults,
} from "@/components/quiz-formats/QuestionImportDialog";
import { coursesLmsApi } from "@/lib/api/courses-lms";
import { downloadCsv } from "@/lib/api/csv-export";
import {
  quizzesApi,
  type UpdateQuizRequest,
} from "@/lib/api/quizzes";
import { useAllowedFeatures , useAiAuthoringEnabled } from "@/lib/hooks/use-entitlements";
import { useImportQuestions } from "@/lib/hooks/use-question-library";
import {
  quizQuestionToIR,
  toCourseQuizPayload,
  type ParsedQuestion,
} from "@/lib/quiz-formats";
import { useTenantStore } from "@/lib/stores/tenant-store";
import type { QuizOption, QuizQuestion } from "@/lib/types/course-lms";

import { BankImportDialog } from "./BankImportDialog";
import { QuestionLibraryPicker } from "./QuestionLibraryPicker";

type QuestionType = "MCQ" | "DRAG_DROP";

const DRAG_DROP_HELPER =
  "Use ___ where an answer should be dropped. Use it multiple times for multiple blanks (example: The capital of ___ is ___).";

// A blank is a run of 2+ underscores ("___"). Matches the DragDropQuestion
// renderer so authoring and playback agree on how many blanks exist.
const countBlanks = (text: string): number =>
  (text.match(/_{2,}/g) || []).length;

function QuestionCard({
  question,
  index,
  addingOptionFor,
  newOptionText,
  newOptionCorrect,
  newOptionBlankIndex,
  editingQuestionId,
  editingOptionId,
  editQuestionText,
  editQuestionMarks,
  editQuestionType,
  setAddingOptionFor,
  setNewOptionText,
  setNewOptionCorrect,
  setNewOptionBlankIndex,
  setEditingQuestionId,
  setEditingOptionId,
  setEditQuestionText,
  setEditQuestionMarks,
  setEditQuestionType,
  onAddOption,
  onUpdateQuestion,
  onDeleteQuestion,
  onUpdateOption,
  onDeleteOption,
  createOptionMutation,
  updateQuestionMutation,
  deleteQuestionMutation,
  updateOptionMutation,
  deleteOptionMutation,
}: {
  question: QuizQuestion;
  index: number;
  addingOptionFor: string | null;
  newOptionText: string;
  newOptionCorrect: boolean;
  newOptionBlankIndex: number | null;
  editingQuestionId: string | null;
  editingOptionId: string | null;
  editQuestionText: string;
  editQuestionMarks: string;
  editQuestionType: QuestionType;
  setAddingOptionFor: (id: string | null) => void;
  setNewOptionText: (v: string) => void;
  setNewOptionCorrect: (v: boolean) => void;
  setNewOptionBlankIndex: (v: number | null) => void;
  setEditingQuestionId: (id: string | null) => void;
  setEditingOptionId: (id: string | null) => void;
  setEditQuestionText: (v: string) => void;
  setEditQuestionMarks: (v: string) => void;
  setEditQuestionType: (v: QuestionType) => void;
  onAddOption: (questionId: string) => void;
  onUpdateQuestion: (
    questionId: string,
    data: { question: string; marks: number; question_type: QuestionType }
  ) => void;
  onDeleteQuestion: (questionId: string) => void;
  onUpdateOption: (
    questionId: string,
    optionId: string,
    data: { option_text: string; is_correct: boolean; blank_index?: number | null }
  ) => void;
  onDeleteOption: (questionId: string, optionId: string) => void;
  createOptionMutation: { isPending: boolean };
  updateQuestionMutation: { isPending: boolean };
  deleteQuestionMutation: { isPending: boolean };
  updateOptionMutation: { isPending: boolean };
  deleteOptionMutation: { isPending: boolean };
}) {
  const options = question.options ?? [];
  const isAdding = addingOptionFor === question.id;
  const isEditingQuestion = editingQuestionId === question.id;
  // Multi-blank DRAG_DROP: 2+ "___" → author maps a correct option per blank.
  const blankCount =
    question.question_type === "DRAG_DROP" ? countBlanks(question.question) : 0;
  const multiBlank = blankCount > 1;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditingQuestion ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={editQuestionType}
                  onValueChange={(v) => setEditQuestionType(v as QuestionType)}
                >
                  <SelectTrigger className="h-8 w-44 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MCQ">Multiple choice</SelectItem>
                    <SelectItem value="DRAG_DROP">Drag and drop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editQuestionType === "DRAG_DROP" && (
                <p className="text-xs text-muted-foreground">{DRAG_DROP_HELPER}</p>
              )}
              <Textarea
                value={editQuestionText}
                onChange={(e) => setEditQuestionText(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Marks</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editQuestionMarks}
                  onChange={(e) => setEditQuestionMarks(e.target.value)}
                  className="w-16 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() =>
                    onUpdateQuestion(question.id, {
                      question: editQuestionText.trim(),
                      marks: parseInt(editQuestionMarks, 10) || 1,
                      question_type: editQuestionType,
                    })
                  }
                  disabled={updateQuestionMutation.isPending}
                >
                  {updateQuestionMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingQuestionId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">
                {index + 1}. {question.question}
                {question.question_type === "DRAG_DROP" && (
                  <span className="ml-2 inline-block rounded bg-muted px-1.5 py-0.5 align-middle text-[10px] font-medium text-muted-foreground">
                    Drag and drop
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Marks: {question.marks}</p>
            </>
          )}
        </div>
        {!isEditingQuestion && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditingQuestionId(question.id);
                setEditQuestionText(question.question);
                setEditQuestionMarks(String(question.marks));
                setEditQuestionType(question.question_type ?? "MCQ");
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete question?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this question and all its options.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteQuestion(question.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteQuestionMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Delete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      <div className="space-y-1">
        {options.map((opt: QuizOption) => {
          const isEditingOpt = editingOptionId === opt.id;
          return (
            <div
              key={opt.id}
              className="flex items-center gap-2 text-sm group"
            >
              {isEditingOpt ? (
                <OptionEditForm
                  opt={opt}
                  multiBlank={multiBlank}
                  blankCount={blankCount}
                  onSave={(data) => onUpdateOption(question.id, opt.id, data)}
                  onCancel={() => setEditingOptionId(null)}
                  updateOptionMutation={updateOptionMutation}
                />
              ) : (
                <>
                  {opt.is_correct ? (
                    <Check className="h-3 w-3 shrink-0 text-green-600" />
                  ) : (
                    <span className="w-3" />
                  )}
                  <span className="flex-1 min-w-0">{opt.option_text}</span>
                  {multiBlank && opt.is_correct && opt.blank_index != null && (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Blank {opt.blank_index + 1}
                    </span>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingOptionId(opt.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete option?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this option.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteOption(question.id, opt.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleteOptionMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {isAdding ? (
        <div className="flex flex-col gap-2 pt-2">
          <Input
            placeholder="Option text"
            value={newOptionText}
            onChange={(e) => setNewOptionText(e.target.value)}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            {multiBlank ? (
              <Select
                value={
                  newOptionBlankIndex === null
                    ? "none"
                    : String(newOptionBlankIndex)
                }
                onValueChange={(v) =>
                  setNewOptionBlankIndex(v === "none" ? null : Number(v))
                }
              >
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Distractor</SelectItem>
                  {Array.from({ length: blankCount }).map((_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      Correct for blank {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={newOptionCorrect}
                  onChange={(e) => setNewOptionCorrect(e.target.checked)}
                />
                Correct answer
              </label>
            )}
            <Button
              size="sm"
              onClick={() => onAddOption(question.id)}
              disabled={createOptionMutation.isPending}
            >
              {createOptionMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Add Option"
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingOptionFor(null);
                setNewOptionText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={() => setAddingOptionFor(question.id)}
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Option
        </Button>
      )}
    </div>
  );
}

function OptionEditForm({
  opt,
  multiBlank,
  blankCount,
  onSave,
  onCancel,
  updateOptionMutation,
}: {
  opt: QuizOption;
  multiBlank: boolean;
  blankCount: number;
  onSave: (data: {
    option_text: string;
    is_correct: boolean;
    blank_index?: number | null;
  }) => void;
  onCancel: () => void;
  updateOptionMutation: { isPending: boolean };
}) {
  const [text, setText] = useState(opt.option_text);
  const [isCorrect, setIsCorrect] = useState(opt.is_correct);
  const [blankIndex, setBlankIndex] = useState<number | null>(
    opt.blank_index ?? null
  );

  const handleSave = () =>
    multiBlank
      ? onSave({
          option_text: text.trim(),
          is_correct: blankIndex !== null,
          blank_index: blankIndex,
        })
      : onSave({
          option_text: text.trim(),
          is_correct: isCorrect,
          blank_index: null,
        });

  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="text-sm flex-1"
      />
      {multiBlank ? (
        <Select
          value={blankIndex === null ? "none" : String(blankIndex)}
          onValueChange={(v) =>
            setBlankIndex(v === "none" ? null : Number(v))
          }
        >
          <SelectTrigger className="h-8 w-44 shrink-0 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Distractor</SelectItem>
            {Array.from({ length: blankCount }).map((_, i) => (
              <SelectItem key={i} value={String(i)}>
                Correct for blank {i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <label className="flex items-center gap-1.5 text-sm shrink-0">
          <input
            type="checkbox"
            checked={isCorrect}
            onChange={(e) => setIsCorrect(e.target.checked)}
          />
          Correct
        </label>
      )}
      <Button
        size="sm"
        onClick={handleSave}
        disabled={updateOptionMutation.isPending || !text.trim()}
      >
        {updateOptionMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          "Save"
        )}
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export interface QuizConfigPanelProps {
  quizId: string;
  courseId: string;
  lessonTitle?: string;
  onTitleChange?: (title: string) => void;
  /** Called when quiz data is loaded (for syncing modal subtitle with quiz title) */
  onQuizLoaded?: (quiz: { title: string }) => void;
  className?: string;
  /** When true, renders without outer border/padding (for use inside dialogs) */
  compact?: boolean;
  /** When provided, a "Done" button is shown in the sticky action footer. */
  onDone?: () => void;
}

export function QuizConfigPanel({
  quizId,
  courseId,
  lessonTitle: _lessonTitle,
  onTitleChange,
  onQuizLoaded,
  className,
  compact = false,
  onDone,
}: QuizConfigPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedTenantId } = useTenantStore();
  const { maxQuizQuestionsPerQuiz } = useAllowedFeatures(
    selectedTenantId ?? undefined
  );

  const [formTitle, setFormTitle] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formMaxScore, setFormMaxScore] = useState("100");
  const [formPassPercentage, setFormPassPercentage] = useState("60");
  const [formDueDate, setFormDueDate] = useState("");
  // "" = serve all questions; N = serve N random per attempt (overlap-controlled).
  const [formRandomCount, setFormRandomCount] = useState("");
  const [formTimed, setFormTimed] = useState(false);
  const [formDurationMin, setFormDurationMin] = useState("");
  const [formAllowReattempt, setFormAllowReattempt] = useState(true);
  // "" = unlimited (only meaningful when re-attempts are allowed).
  const [formMaxAttempts, setFormMaxAttempts] = useState("");
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showQuestionLibrary, setShowQuestionLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBankImport, setShowBankImport] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionMarks, setNewQuestionMarks] = useState("1");
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>("MCQ");
  const [addingOptionFor, setAddingOptionFor] = useState<string | null>(null);
  const [newOptionText, setNewOptionText] = useState("");
  const [newOptionCorrect, setNewOptionCorrect] = useState(false);
  // Multi-blank DRAG_DROP: which blank the option being added answers (null = distractor).
  const [newOptionBlankIndex, setNewOptionBlankIndex] = useState<number | null>(
    null
  );
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const aiAuthoringEnabled = useAiAuthoringEnabled();
  const [aiInputText, setAiInputText] = useState("");
  const [aiQuestionLimit, setAiQuestionLimit] = useState("5");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editQuestionMarks, setEditQuestionMarks] = useState("1");
  const [editQuestionType, setEditQuestionType] = useState<QuestionType>("MCQ");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const { data: quiz, isLoading } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => quizzesApi.get(quizId),
    enabled: !!quizId,
  });

  const questionsQueryKey = ["quiz-questions", courseId, quizId];
  const { data: questions = [] } = useQuery({
    queryKey: questionsQueryKey,
    queryFn: () => coursesLmsApi.getQuizQuestions(courseId, quizId),
    enabled: !!courseId && !!quizId,
  });

  // AIKEN / GIFT import (reuses the Question Library copy path, which bypasses
  // the per-quiz question cap, same as picking from the library).
  const importQuestionsMut = useImportQuestions(courseId, quizId);

  const handleImportConfirm = async (
    parsed: ParsedQuestion[],
    defaults: ImportDefaults
  ) => {
    const payload = parsed.map((q) => toCourseQuizPayload(q, defaults.marks));
    const res = await importQuestionsMut.mutateAsync({ quizId, questions: payload });
    return { created: res.added };
  };

  const getExportQuestions = (): ParsedQuestion[] =>
    (questions as QuizQuestion[]).map(quizQuestionToIR);

  // CSV import (backend parses the file and reports per row errors on 400)
  const importCsvMutation = useMutation({
    mutationFn: (file: File) =>
      coursesLmsApi.importQuizQuestionsCsv(courseId, quizId, file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      const dup = result.skipped ?? 0;
      toast({
        title: "Success",
        description: `${result.created} question(s) imported${
          dup ? ` · ${dup} duplicate(s) skipped` : ""
        }.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Import failed",
        description: (
          <span className="whitespace-pre-line">
            {err.message || "Failed to import questions."}
          </span>
        ),
        variant: "destructive",
      });
    },
  });

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    importCsvMutation.mutate(file);
  };

  const handleDownloadSample = async () => {
    try {
      await downloadCsv(
        "/tenant/quizzes/import-sample",
        "quiz-questions-sample.csv"
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to download the sample file.",
        variant: "destructive",
      });
    }
  };

  const createQuestionMutation = useMutation({
    mutationFn: async (data: {
      question: string;
      question_type?: QuestionType;
      marks?: number;
      sort_order?: number;
    }) => coursesLmsApi.createQuizQuestion(courseId, quizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setShowAddQuestion(false);
      setNewQuestionText("");
      setNewQuestionMarks("1");
      setNewQuestionType("MCQ");
      toast({ title: "Success", description: "Question added." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to add question.",
        variant: "destructive",
      });
    },
  });

  const createOptionMutation = useMutation({
    mutationFn: async ({
      questionId,
      option_text,
      is_correct,
      blank_index,
    }: {
      questionId: string;
      option_text: string;
      is_correct: boolean;
      blank_index?: number | null;
    }) =>
      coursesLmsApi.createQuizOption(courseId, questionId, {
        option_text,
        is_correct,
        blank_index,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setAddingOptionFor(null);
      setNewOptionText("");
      setNewOptionCorrect(false);
      setNewOptionBlankIndex(null);
      toast({ title: "Success", description: "Option added." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to add option.",
        variant: "destructive",
      });
    },
  });

  const generateQuestionsMutation = useMutation({
    mutationFn: async (data: {
      input_text: string;
      question_limit: number;
    }) => quizzesApi.generateQuestions(quizId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      toast({
        title: "Success",
        description: `${result.added} question(s) generated. Review and edit as needed.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "AI generation failed.",
        variant: "destructive",
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({
      questionId,
      question,
      marks,
      question_type,
    }: {
      questionId: string;
      question: string;
      marks: number;
      question_type?: QuestionType;
    }) =>
      coursesLmsApi.updateQuizQuestion(courseId, quizId, questionId, {
        question,
        marks,
        question_type,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setEditingQuestionId(null);
      toast({ title: "Success", description: "Question updated." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update question.",
        variant: "destructive",
      });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: string) =>
      coursesLmsApi.deleteQuizQuestion(courseId, quizId, questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setEditingQuestionId(null);
      toast({ title: "Success", description: "Question deleted." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to delete question.",
        variant: "destructive",
      });
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({
      questionId,
      optionId,
      option_text,
      is_correct,
      blank_index,
    }: {
      questionId: string;
      optionId: string;
      option_text: string;
      is_correct: boolean;
      blank_index?: number | null;
    }) =>
      coursesLmsApi.updateQuizOption(courseId, questionId, optionId, {
        option_text,
        is_correct,
        blank_index,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setEditingOptionId(null);
      toast({ title: "Success", description: "Option updated." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update option.",
        variant: "destructive",
      });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: ({
      questionId,
      optionId,
    }: {
      questionId: string;
      optionId: string;
    }) =>
      coursesLmsApi.deleteQuizOption(courseId, questionId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsQueryKey });
      setEditingOptionId(null);
      toast({ title: "Success", description: "Option deleted." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to delete option.",
        variant: "destructive",
      });
    },
  });

  // Initialise the form ONCE per loaded quiz (keyed on its id). Depending on
  // the quiz object or the inline `onQuizLoaded` prop would re-run this on every
  // parent re-render of the LMS editor and wipe in-progress edits, e.g. a
  // freshly typed "Max attempts" value would vanish on the next render.
  useEffect(() => {
    if (!quiz) return;
    setFormTitle(quiz.title);
    setFormInstructions(quiz.instructions || "");
    setFormMaxScore(String(quiz.max_score));
    setFormPassPercentage(String(quiz.pass_percentage));
    setFormDueDate(quiz.due_date ? quiz.due_date.slice(0, 10) : "");
    setFormRandomCount(
      quiz.random_question_count != null
        ? String(quiz.random_question_count)
        : ""
    );
    setFormTimed(quiz.duration_min != null);
    setFormDurationMin(
      quiz.duration_min != null ? String(quiz.duration_min) : ""
    );
    setFormAllowReattempt(quiz.allow_reattempt ?? true);
    setFormMaxAttempts(
      quiz.max_attempts != null ? String(quiz.max_attempts) : ""
    );
    onQuizLoaded?.({ title: quiz.title });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id]);

  // Whether the quiz settings differ from what's saved (drives the Saved /
  // Unsaved indicator). Questions save on their own; this covers the settings.
  const metaDirty =
    !!quiz &&
    (formTitle !== quiz.title ||
      formInstructions !== (quiz.instructions || "") ||
      formMaxScore !== String(quiz.max_score) ||
      formPassPercentage !== String(quiz.pass_percentage) ||
      formDueDate !== (quiz.due_date ? quiz.due_date.slice(0, 10) : "") ||
      formRandomCount !==
        (quiz.random_question_count != null
          ? String(quiz.random_question_count)
          : "") ||
      formTimed !== (quiz.duration_min != null) ||
      formDurationMin !==
        (quiz.duration_min != null ? String(quiz.duration_min) : "") ||
      formAllowReattempt !== (quiz.allow_reattempt ?? true) ||
      formMaxAttempts !==
        (quiz.max_attempts != null ? String(quiz.max_attempts) : ""));

  const saveMutation = useMutation({
    mutationFn: async (data: UpdateQuizRequest) =>
      quizzesApi.update(quizId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["quiz", quizId], updated);
      onTitleChange?.(updated.title);
      toast({ title: "Success", description: "Quiz updated." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update quiz.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => quizzesApi.publish(quizId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["quiz", quizId], updated);
      toast({ title: "Success", description: "Quiz published." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to publish.",
        variant: "destructive",
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => quizzesApi.unpublish(quizId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["quiz", quizId], updated);
      toast({ title: "Success", description: "Quiz unpublished." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to unpublish.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (formTitle.trim().length < 3) {
      toast({
        title: "Error",
        description: "Title must be at least 3 characters.",
        variant: "destructive",
      });
      return;
    }
    const passPct = parseInt(formPassPercentage, 10);
    if (isNaN(passPct) || passPct < 0 || passPct > 100) {
      toast({
        title: "Error",
        description: "Pass percentage must be between 0 and 100.",
        variant: "destructive",
      });
      return;
    }
    if (formTimed) {
      const mins = parseInt(formDurationMin, 10);
      if (isNaN(mins) || mins < 1) {
        toast({
          title: "Error",
          description: "Time limit must be at least 1 minute.",
          variant: "destructive",
        });
        return;
      }
    }
    saveMutation.mutate({
      title: formTitle.trim(),
      instructions: formInstructions.trim() || null,
      max_score: parseInt(formMaxScore, 10) || 100,
      pass_percentage: passPct,
      duration_min: formTimed
        ? Math.max(1, parseInt(formDurationMin, 10) || 1)
        : null,
      due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
      random_question_count:
        formRandomCount.trim() === ""
          ? null
          : Math.max(1, parseInt(formRandomCount, 10) || 1),
      allow_reattempt: formAllowReattempt,
      max_attempts: formAllowReattempt
        ? formMaxAttempts.trim() === ""
          ? null
          : Math.max(1, parseInt(formMaxAttempts, 10) || 1)
        : null,
    });
  };

  const handleTogglePublish = () => {
    if (quiz?.status === "PUBLISHED") {
      unpublishMutation.mutate();
    } else {
      publishMutation.mutate();
    }
  };

  const canAddQuestion =
    maxQuizQuestionsPerQuiz == null ||
    questions.length < maxQuizQuestionsPerQuiz;

  const handleAddQuestion = () => {
    const text = newQuestionText.trim();
    if (text.length < 3) {
      toast({
        title: "Error",
        description: "Question text must be at least 3 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newQuestionType === "DRAG_DROP" && !text.includes("___")) {
      toast({
        title: "Error",
        description: `Drag and drop questions must contain ___. ${DRAG_DROP_HELPER}`,
        variant: "destructive",
      });
      return;
    }
    createQuestionMutation.mutate({
      question: text,
      question_type: newQuestionType,
      marks: parseInt(newQuestionMarks, 10) || 1,
      sort_order: questions.length,
    });
  };

  const handleAddOption = (questionId: string) => {
    const text = newOptionText.trim();
    if (text.length < 1) {
      toast({
        title: "Error",
        description: "Option text is required.",
        variant: "destructive",
      });
      return;
    }
    // Multi-blank DRAG_DROP: the chosen blank determines correctness; the
    // option is correct iff it answers a blank.
    const q = questions.find((x: QuizQuestion) => x.id === questionId);
    const multiBlank =
      q?.question_type === "DRAG_DROP" && countBlanks(q.question) > 1;
    createOptionMutation.mutate({
      questionId,
      option_text: text,
      is_correct: multiBlank ? newOptionBlankIndex !== null : newOptionCorrect,
      blank_index: multiBlank ? newOptionBlankIndex : null,
    });
  };

  const handleGenerateQuestions = () => {
    const text = aiInputText.trim();
    if (!text) {
      toast({
        title: "Error",
        description: "Content is required to generate questions.",
        variant: "destructive",
      });
      return;
    }
    const limit = parseInt(aiQuestionLimit, 10) || 5;
    if (limit < 1 || limit > 20) {
      toast({
        title: "Error",
        description: "Question limit must be between 1 and 20.",
        variant: "destructive",
      });
      return;
    }
    generateQuestionsMutation.mutate({
      input_text: text,
      question_limit: limit,
    });
  };

  const handleUpdateQuestion = (
    questionId: string,
    data: { question: string; marks: number; question_type: QuestionType }
  ) => {
    if (data.question_type === "DRAG_DROP" && !data.question.includes("___")) {
      toast({
        title: "Error",
        description: `Drag and drop questions must contain ___. ${DRAG_DROP_HELPER}`,
        variant: "destructive",
      });
      return;
    }
    updateQuestionMutation.mutate({ questionId, ...data });
  };

  const handleDeleteQuestion = (questionId: string) => {
    deleteQuestionMutation.mutate(questionId);
  };

  const handleUpdateOption = (
    questionId: string,
    optionId: string,
    data: { option_text: string; is_correct: boolean; blank_index?: number | null }
  ) => {
    updateOptionMutation.mutate({ questionId, optionId, ...data });
  };

  const handleDeleteOption = (questionId: string, optionId: string) => {
    deleteOptionMutation.mutate({ questionId, optionId });
  };

  if (isLoading || !quiz) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isTogglingPublish =
    publishMutation.isPending || unpublishMutation.isPending;

  return (
    <div
      className={
        compact
          ? "flex min-h-0 flex-1 flex-col"
          : `space-y-4 ${className ?? ""}`
      }
    >
      <div
        className={
          compact
            ? "min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-1"
            : ""
        }
      >
      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="settings" className="mt-0 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="Quiz title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          value={formInstructions}
          onChange={(e) => setFormInstructions(e.target.value)}
          placeholder="Describe what students need to do..."
          rows={6}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="maxScore">Max Score</Label>
          <Input
            id="maxScore"
            type="number"
            min={1}
            max={1000}
            value={formMaxScore}
            onChange={(e) => setFormMaxScore(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="passPercentage">Pass Percentage (%)</Label>
          <Input
            id="passPercentage"
            type="number"
            min={0}
            max={100}
            value={formPassPercentage}
            onChange={(e) => setFormPassPercentage(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          type="date"
          value={formDueDate}
          onChange={(e) => setFormDueDate(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="randomCount">Random questions per attempt</Label>
        <Input
          id="randomCount"
          type="number"
          min={1}
          placeholder="All questions"
          value={formRandomCount}
          onChange={(e) => setFormRandomCount(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Blank = serve all. A number serves that many random questions per
          learner, spread to keep overlap low across learners.
        </p>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formTimed}
            onChange={(e) => setFormTimed(e.target.checked)}
            className="h-4 w-4"
          />
          Timed quiz
        </label>
        {formTimed && (
          <div className="flex items-center gap-2 pl-6">
            <Label
              htmlFor="durationMin"
              className="text-sm text-muted-foreground"
            >
              Time limit (minutes)
            </Label>
            <Input
              id="durationMin"
              type="number"
              min={1}
              max={999}
              placeholder="e.g. 30"
              value={formDurationMin}
              onChange={(e) => setFormDurationMin(e.target.value)}
              className="w-28"
            />
          </div>
        )}
        <p className="pl-6 text-xs text-muted-foreground">
          A countdown shows while attempting and the quiz auto-submits when time
          runs out. Off = learners get unlimited time.
        </p>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={formAllowReattempt}
            onChange={(e) => setFormAllowReattempt(e.target.checked)}
            className="h-4 w-4"
          />
          Allow re-attempts
        </label>
        {formAllowReattempt && (
          <div className="flex items-center gap-2 pl-6">
            <Label
              htmlFor="maxAttempts"
              className="text-sm text-muted-foreground"
            >
              Max attempts
            </Label>
            <Input
              id="maxAttempts"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={formMaxAttempts}
              onChange={(e) => setFormMaxAttempts(e.target.value)}
              className="w-28"
            />
            <span className="text-xs text-muted-foreground">
              blank = unlimited
            </span>
          </div>
        )}
      </div>
        </TabsContent>
        <TabsContent value="questions" className="mt-0 space-y-4">
      <div className="space-y-3">
        {aiAuthoringEnabled && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowAiGenerate(!showAiGenerate)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </span>
              {showAiGenerate ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showAiGenerate && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paste content below and AI will generate questions and options for you.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="aiInputText" className="text-xs">
                    Content
                  </Label>
                  <Textarea
                    id="aiInputText"
                    placeholder="Paste lecture transcript, article, or any content to generate questions from..."
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    rows={4}
                    className="resize-none text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="aiQuestionLimit" className="text-xs">
                      Question limit
                    </Label>
                    <Input
                      id="aiQuestionLimit"
                      type="number"
                      min={1}
                      max={20}
                      value={aiQuestionLimit}
                      onChange={(e) => setAiQuestionLimit(e.target.value)}
                      className="w-20"
                    />
                  </div>
                  <Button
                    className="mt-5"
                    size="sm"
                    onClick={handleGenerateQuestions}
                    disabled={generateQuestionsMutation.isPending}
                  >
                    {generateQuestionsMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Generate Questions
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Questions</Label>
          <div className="flex flex-wrap items-center gap-2">
            <QuestionExportButton
              getQuestions={getExportQuestions}
              fileBaseName={formTitle || quiz?.title || "quiz"}
              disabled={questions.length === 0}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Upload className="mr-1 h-3 w-3" />
                  Import
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowImport(true)}>
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  From file (AIKEN / GIFT)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => csvInputRef.current?.click()}
                  disabled={importCsvMutation.isPending}
                >
                  {importCsvMutation.isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
                  )}
                  Import questions (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadSample}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download sample CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowQuestionLibrary(true)}>
                  <Library className="mr-2 h-3.5 w-3.5" />
                  From Question Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowBankImport(true)}>
                  <Library className="mr-2 h-3.5 w-3.5" />
                  From question bank
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleCsvFileChange}
              aria-hidden
            />
            {canAddQuestion && (
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddQuestion(!showAddQuestion)}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            )}
          </div>
        </div>
        {maxQuizQuestionsPerQuiz != null && (
          <p className="text-xs text-muted-foreground">
            {questions.length} / {maxQuizQuestionsPerQuiz} questions
          </p>
        )}
        {showAddQuestion && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={newQuestionType}
                onValueChange={(v) => setNewQuestionType(v as QuestionType)}
              >
                <SelectTrigger className="h-8 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MCQ">Multiple choice</SelectItem>
                  <SelectItem value="DRAG_DROP">Drag and drop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newQuestionType === "DRAG_DROP" && (
              <p className="text-xs text-muted-foreground">{DRAG_DROP_HELPER}</p>
            )}
            <Textarea
              placeholder="Enter question text..."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex items-center gap-2">
              <Label htmlFor="newQuestionMarks" className="text-xs">
                Marks
              </Label>
              <Input
                id="newQuestionMarks"
                type="number"
                min={1}
                max={100}
                value={newQuestionMarks}
                onChange={(e) => setNewQuestionMarks(e.target.value)}
                className="w-16"
              />
              <Button
                size="sm"
                onClick={handleAddQuestion}
                disabled={createQuestionMutation.isPending}
              >
                {createQuestionMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddQuestion(false);
                  setNewQuestionText("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-3">
          {questions.map((q: QuizQuestion, idx: number) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              addingOptionFor={addingOptionFor}
              newOptionText={newOptionText}
              newOptionCorrect={newOptionCorrect}
              newOptionBlankIndex={newOptionBlankIndex}
              editingQuestionId={editingQuestionId}
              editingOptionId={editingOptionId}
              editQuestionText={editQuestionText}
              editQuestionMarks={editQuestionMarks}
              editQuestionType={editQuestionType}
              setAddingOptionFor={setAddingOptionFor}
              setNewOptionText={setNewOptionText}
              setNewOptionCorrect={setNewOptionCorrect}
              setNewOptionBlankIndex={setNewOptionBlankIndex}
              setEditingQuestionId={setEditingQuestionId}
              setEditingOptionId={setEditingOptionId}
              setEditQuestionText={setEditQuestionText}
              setEditQuestionMarks={setEditQuestionMarks}
              setEditQuestionType={setEditQuestionType}
              onAddOption={handleAddOption}
              onUpdateQuestion={handleUpdateQuestion}
              onDeleteQuestion={handleDeleteQuestion}
              onUpdateOption={handleUpdateOption}
              onDeleteOption={handleDeleteOption}
              createOptionMutation={createOptionMutation}
              updateQuestionMutation={updateQuestionMutation}
              deleteQuestionMutation={deleteQuestionMutation}
              updateOptionMutation={updateOptionMutation}
              deleteOptionMutation={deleteOptionMutation}
            />
          ))}
        </div>
      </div>
        </TabsContent>
      </Tabs>
      </div>

      <div
        className={
          compact
            ? "flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-background px-6 py-3"
            : "mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-3"
        }
      >
        <span
          className={
            metaDirty
              ? "flex items-center gap-1.5 text-xs font-medium text-amber-600"
              : "flex items-center gap-1.5 text-xs text-muted-foreground"
          }
        >
          <span
            className={
              metaDirty
                ? "h-1.5 w-1.5 rounded-full bg-amber-500"
                : "h-1.5 w-1.5 rounded-full bg-emerald-500"
            }
          />
          {metaDirty ? "Unsaved changes" : "All changes saved"}
        </span>
        {quiz.status === "PUBLISHED" && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/analytics/quizzes-analytics">
              <BarChart3 className="mr-1 h-3 w-3" />
              View Analytics
            </Link>
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
        <Button
          variant={quiz.status === "PUBLISHED" ? "outline" : "default"}
          size="sm"
          onClick={handleTogglePublish}
          disabled={isTogglingPublish}
        >
          {isTogglingPublish ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : quiz.status === "PUBLISHED" ? (
            <>
              <EyeOff className="mr-1 h-3 w-3" />
              Unpublish
            </>
          ) : (
            <>
              <Eye className="mr-1 h-3 w-3" />
              Publish
            </>
          )}
        </Button>
        {onDone && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onDone}
          >
            Done
          </Button>
        )}
      </div>

      <QuestionLibraryPicker
        open={showQuestionLibrary}
        onOpenChange={setShowQuestionLibrary}
        courseId={courseId}
        quizId={quizId}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: questionsQueryKey });
        }}
      />

      <BankImportDialog
        open={showBankImport}
        onOpenChange={setShowBankImport}
        courseId={courseId}
        quizId={quizId}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: questionsQueryKey });
        }}
      />

      <QuestionImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        target="COURSE_QUIZ"
        onConfirm={handleImportConfirm}
      />
    </div>
  );
}

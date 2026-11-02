"use client";

import { Button, Input, Label, Textarea, useToast } from "@open-mtlms/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, Loader2, Save, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  assignmentsApi,
  type UpdateAssignmentRequest,
} from "@/lib/api/assignments";

export interface AssignmentConfigPanelProps {
  assignmentId: string;
  courseId: string;
  lessonTitle?: string;
  onTitleChange?: (title: string) => void;
  /** Called when assignment data is loaded (for syncing modal subtitle with assignment title) */
  onAssignmentLoaded?: (assignment: { title: string }) => void;
  className?: string;
  /** When true, renders without outer border/padding (for use inside dialogs) */
  compact?: boolean;
}

export function AssignmentConfigPanel({
  assignmentId,
  courseId: _courseId,
  lessonTitle: _lessonTitle,
  onTitleChange,
  onAssignmentLoaded,
  className,
  compact = false,
}: AssignmentConfigPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formTitle, setFormTitle] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formMaxScore, setFormMaxScore] = useState("100");
  const [formPassingScore, setFormPassingScore] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => assignmentsApi.get(assignmentId),
    enabled: !!assignmentId,
  });

  useEffect(() => {
    if (assignment) {
      setFormTitle(assignment.title);
      setFormInstructions(assignment.instructions || "");
      setFormMaxScore(String(assignment.max_score));
      setFormPassingScore(
        assignment.passing_score != null ? String(assignment.passing_score) : ""
      );
      setFormDueDate(assignment.due_date ? assignment.due_date.slice(0, 10) : "");
      onAssignmentLoaded?.({ title: assignment.title });
    }
  }, [assignment, onAssignmentLoaded]);

  const saveMutation = useMutation({
    mutationFn: async (data: UpdateAssignmentRequest) =>
      assignmentsApi.update(assignmentId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["assignment", assignmentId], updated);
      onTitleChange?.(updated.title);
      toast({ title: "Success", description: "Assignment updated." });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update assignment.",
        variant: "destructive",
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => assignmentsApi.publish(assignmentId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["assignment", assignmentId], updated);
      toast({ title: "Success", description: "Assignment published." });
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
    mutationFn: () => assignmentsApi.unpublish(assignmentId),
    onSuccess: (updated) => {
      queryClient.setQueryData(["assignment", assignmentId], updated);
      toast({ title: "Success", description: "Assignment unpublished." });
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
    const maxScore = parseInt(formMaxScore, 10) || 100;
    const passingScore =
      formPassingScore.trim() === "" ? null : parseInt(formPassingScore, 10);
    if (
      passingScore !== null &&
      (isNaN(passingScore) || passingScore < 0 || passingScore > maxScore)
    ) {
      toast({
        title: "Error",
        description: `Passing score must be between 0 and the max score (${maxScore}).`,
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate({
      title: formTitle.trim(),
      instructions: formInstructions.trim() || null,
      max_score: maxScore,
      passing_score: passingScore,
      due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assignmentId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File must be under 20MB.",
        variant: "destructive",
      });
      return;
    }
    setIsUploadingPdf(true);
    try {
      const updated = await assignmentsApi.uploadPdf(assignmentId, file);
      queryClient.setQueryData(["assignment", assignmentId], updated);
      toast({ title: "Success", description: "File uploaded." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPdf(false);
      e.target.value = "";
    }
  };

  const handleRemovePdf = async () => {
    if (!assignmentId || !assignment?.pdf_key) return;
    if (assignment.status === "PUBLISHED") {
      toast({
        title: "Error",
        description: "Unpublish first to remove the file.",
        variant: "destructive",
      });
      return;
    }
    try {
      const updated = await assignmentsApi.removePdf(assignmentId);
      queryClient.setQueryData(["assignment", assignmentId], updated);
      toast({ title: "Success", description: "File removed." });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove file.",
        variant: "destructive",
      });
    }
  };

  const handleGetPdfUrl = async () => {
    if (!assignmentId || !assignment?.pdf_key) return;
    try {
      const { url } = await assignmentsApi.getPdfUrl(assignmentId);
      window.open(url, "_blank");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to get file URL.",
        variant: "destructive",
      });
    }
  };

  const handleTogglePublish = () => {
    if (assignment?.status === "PUBLISHED") {
      unpublishMutation.mutate();
    } else {
      publishMutation.mutate();
    }
  };

  if (isLoading || !assignment) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isTogglingPublish =
    publishMutation.isPending || unpublishMutation.isPending;

  return (
    <div className={compact ? "space-y-4" : `space-y-4 ${className ?? ""}`}>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
          placeholder="Assignment title"
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
          <Label htmlFor="passingScore">Passing Score</Label>
          <Input
            id="passingScore"
            type="number"
            min={0}
            placeholder="No passing mark"
            value={formPassingScore}
            onChange={(e) => setFormPassingScore(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Blank = no pass/fail. If set, a score below it is marked failed and
            the learner is asked to resubmit.
          </p>
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
        <Label>Attachment</Label>
        {assignment.pdf_key ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              File attached
            </div>
            <Button variant="outline" size="sm" onClick={handleGetPdfUrl}>
              View file
            </Button>
            {assignment.status === "DRAFT" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemovePdf}
                className="text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <Input
              type="file"
              onChange={handlePdfUpload}
              disabled={isUploadingPdf}
            />
            {isUploadingPdf && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        {assignment.status === "PUBLISHED" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/assignments/${assignmentId}/submissions`}>
              <Users className="mr-1 h-3 w-3" />
              View Submissions
            </Link>
          </Button>
        )}
        <Button
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
          variant={assignment.status === "PUBLISHED" ? "outline" : "default"}
          size="sm"
          onClick={handleTogglePublish}
          disabled={isTogglingPublish}
        >
          {isTogglingPublish ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : assignment.status === "PUBLISHED" ? (
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
      </div>
    </div>
  );
}

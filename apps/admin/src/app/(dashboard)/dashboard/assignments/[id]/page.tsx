"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  useToast,
} from "@open-mtlms/core";
import { ArrowLeft, Calendar, FileText, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { assignmentsApi, type Assignment, type UpdateAssignmentRequest } from "@/lib/api/assignments";
import { useTenantStore } from "@/lib/stores/tenant-store";

export default function AssignmentDetailPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { selectedTenantId } = useTenantStore();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formMaxScore, setFormMaxScore] = useState("100");
  const [formDueDate, setFormDueDate] = useState("");

  const loadAssignment = useCallback(async () => {
    if (!id || !selectedTenantId) return;
    setIsLoading(true);
    try {
      const a = await assignmentsApi.get(id);
      setAssignment(a);
      setFormTitle(a.title);
      setFormInstructions(a.instructions || "");
      setFormMaxScore(String(a.max_score));
      setFormDueDate(a.due_date ? a.due_date.slice(0, 10) : "");
    } catch (err) {
      console.error("Failed to load assignment:", err);
      toast({ title: "Error", description: "Assignment not found.", variant: "destructive" });
      router.push("/dashboard/assignments");
    } finally {
      setIsLoading(false);
    }
  }, [id, selectedTenantId, router, toast]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  const handleSave = async () => {
    if (!id || !assignment) return;
    if (formTitle.trim().length < 3) {
      toast({ title: "Error", description: "Title must be at least 3 characters.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const data: UpdateAssignmentRequest = {
        title: formTitle.trim(),
        instructions: formInstructions.trim() || null,
        max_score: parseInt(formMaxScore, 10) || 100,
        due_date: formDueDate ? new Date(formDueDate).toISOString() : null,
      };
      const updated = await assignmentsApi.update(id, data);
      setAssignment(updated);
      toast({ title: "Success", description: "Assignment updated." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update assignment.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be under 20MB.", variant: "destructive" });
      return;
    }
    setIsUploadingPdf(true);
    try {
      const updated = await assignmentsApi.uploadPdf(id, file);
      setAssignment(updated);
      toast({ title: "Success", description: "File uploaded." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload file.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsUploadingPdf(false);
      e.target.value = "";
    }
  };

  const handleRemovePdf = async () => {
    if (!id || !assignment?.pdf_key) return;
    if (assignment.status === "PUBLISHED") {
      toast({ title: "Error", description: "Unpublish first to remove the file.", variant: "destructive" });
      return;
    }
    try {
      const updated = await assignmentsApi.removePdf(id);
      setAssignment(updated);
      toast({ title: "Success", description: "File removed." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove file.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleGetPdfUrl = async () => {
    if (!id || !assignment?.pdf_key) return;
    try {
      const { url } = await assignmentsApi.getPdfUrl(id);
      window.open(url, "_blank");
    } catch (err) {
      toast({ title: "Error", description: "Failed to get file URL.", variant: "destructive" });
    }
  };

  if (isLoading || !assignment) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/assignments">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={assignment.status === "PUBLISHED" ? "default" : "secondary"}>
              {assignment.status}
            </Badge>
            <span>{assignment.scope}</span>
            <span>·</span>
            <span>Max {assignment.max_score} pts</span>
            {assignment.due_date && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due {new Date(assignment.due_date).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Edit assignment title, instructions, and settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                rows={8}
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachment</CardTitle>
            <CardDescription>
              Attach any file for this assignment (PDF, source code, spreadsheet, doc,
              slides, image, zip, etc.). Students can download it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignment.pdf_key ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" />
                  File attached
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleGetPdfUrl}>
                    View file
                  </Button>
                  {assignment.status === "DRAFT" && (
                    <Button variant="outline" size="sm" onClick={handleRemovePdf} className="text-destructive">
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pdf-upload">Upload file (max 20MB)</Label>
                <Input
                  id="pdf-upload"
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
          </CardContent>
        </Card>
      </div>

      {assignment.status === "PUBLISHED" && (
        <Card>
          <CardContent className="pt-6">
            <Button asChild>
              <Link href={`/dashboard/assignments/${id}/submissions`}>
                View Submissions
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

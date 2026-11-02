"use client";

import {
  cn,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  useToast,
} from "@open-mtlms/core";
import type { LMSResource } from "@open-mtlms/shared";
import {
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Github,
  ChevronDown,
  ChevronUp,
  Upload,
  Loader2,
  Check,
  X,
  Pencil,
  Image as ImageIcon,
  AlignLeft,
} from "lucide-react";
import { useRef, useState } from "react";

import type { LessonResource, LessonResourceType } from "@/lib/api/courses-lms";
import {
  useCreateLessonResource,
  useDeleteLessonResource,
  useLessonResources,
  useUpdateLessonResource,
} from "@/lib/hooks/use-courses-lms";

import { LessonRichEditor } from "./LessonRichEditor";

interface ResourceManagerProps {
  /** Resolved LMS course ID (never the page ID from URL params) */
  courseId: string | null;
  /** Persisted lesson ID the resources belong to */
  lessonId: string | null;
  /** Legacy resource_links entries, shown read only with a legacy tag */
  legacyResources?: LMSResource[];
  title?: string;
  className?: string;
  /** Upload file to S3 via the presigned lecture resource flow; returns public URL */
  onUploadFile?: (file: File) => Promise<string | null>;
  /** Render without editing controls (preview mode) */
  readOnly?: boolean;
}

const TYPE_META: Record<LessonResourceType, { label: string; icon: React.ElementType }> = {
  PDF: { label: "PDF Document", icon: FileText },
  LINK: { label: "External Link", icon: ExternalLink },
  GITHUB: { label: "GitHub Repository", icon: Github },
  IMAGE: { label: "Image", icon: ImageIcon },
  TEXT: { label: "Text", icon: AlignLeft },
};

/** Types that support the Downloadable toggle (uploaded files only) */
const DOWNLOADABLE_TYPES: LessonResourceType[] = ["PDF", "IMAGE"];

const LEGACY_ICONS: Record<string, React.ElementType> = {
  pdf: FileText,
  link: ExternalLink,
  github: Github,
  text: AlignLeft,
  article: FileText,
};

/** Pending URL based resource being created (not yet persisted) */
interface PendingLink {
  type: "LINK" | "GITHUB";
  title: string;
  url: string;
}

interface TextDialogState {
  /** null = creating a new Text resource */
  resourceId: string | null;
  title: string;
  content: string;
}

export function ResourceManager({
  courseId,
  lessonId,
  legacyResources = [],
  title = "Resources",
  className,
  onUploadFile,
  readOnly = false,
}: ResourceManagerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; url: string } | null>(null);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const [uploadingType, setUploadingType] = useState<"PDF" | "IMAGE" | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const hasServerContext = !!courseId && !!lessonId;
  const { data: resourcesData, isLoading } = useLessonResources(courseId, lessonId);
  const resources = [...(resourcesData ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const createMut = useCreateLessonResource(courseId ?? "", lessonId ?? "");
  const updateMut = useUpdateLessonResource(courseId ?? "", lessonId ?? "");
  const deleteMut = useDeleteLessonResource(courseId ?? "", lessonId ?? "");

  const showError = (message: string) =>
    toast({ title: "Error", description: message, variant: "destructive" });

  // ── Create: uploaded file (PDF / Image) ──
  const handleFileChange = async (
    type: "PDF" | "IMAGE",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadFile || !hasServerContext) return;
    setUploadingType(type);
    try {
      const publicUrl = await onUploadFile(file);
      if (!publicUrl) return;
      await createMut.mutateAsync({
        type,
        title: file.name,
        url: publicUrl,
        downloadable: true,
        sort_order: resources.length,
      });
      toast({ title: "Success", description: "Resource added." });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add resource.");
    } finally {
      setUploadingType(null);
    }
  };

  // ── Create: link / GitHub ──
  const handleConfirmAddLink = async () => {
    if (!pendingLink || !pendingLink.url.trim()) return;
    try {
      await createMut.mutateAsync({
        type: pendingLink.type,
        title: pendingLink.title.trim() || pendingLink.url.trim(),
        url: pendingLink.url.trim(),
        downloadable: false,
        sort_order: resources.length,
      });
      setPendingLink(null);
      toast({ title: "Success", description: "Resource added." });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to add resource.");
    }
  };

  // ── Create / edit: text (rich editor dialog) ──
  const handleSaveText = async () => {
    if (!textDialog || !textDialog.title.trim()) return;
    try {
      if (textDialog.resourceId) {
        await updateMut.mutateAsync({
          resourceId: textDialog.resourceId,
          data: { title: textDialog.title.trim(), content: textDialog.content },
        });
        toast({ title: "Success", description: "Resource updated." });
      } else {
        await createMut.mutateAsync({
          type: "TEXT",
          title: textDialog.title.trim(),
          content: textDialog.content,
          downloadable: false,
          sort_order: resources.length,
        });
        toast({ title: "Success", description: "Resource added." });
      }
      setTextDialog(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save resource.");
    }
  };

  // ── Edit (title / url) ──
  const handleStartEdit = (resource: LessonResource) => {
    if (resource.type === "TEXT") {
      setTextDialog({
        resourceId: resource.id,
        title: resource.title,
        content: resource.content || "",
      });
      return;
    }
    if (editingId === resource.id) {
      setEditingId(null);
      setEditDraft(null);
      return;
    }
    setEditingId(resource.id);
    setEditDraft({ title: resource.title, url: resource.url || "" });
    setPendingLink(null);
  };

  const handleConfirmEdit = async (resource: LessonResource) => {
    if (!editDraft) return;
    const isUrlEditable = resource.type === "LINK" || resource.type === "GITHUB";
    try {
      await updateMut.mutateAsync({
        resourceId: resource.id,
        data: {
          title: editDraft.title.trim() || editDraft.url.trim() || resource.title,
          ...(isUrlEditable ? { url: editDraft.url.trim() } : {}),
        },
      });
      setEditingId(null);
      setEditDraft(null);
      toast({ title: "Success", description: "Resource updated." });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update resource.");
    }
  };

  // ── Downloadable toggle (PDF / IMAGE only) ──
  const handleToggleDownloadable = (resource: LessonResource, downloadable: boolean) => {
    updateMut.mutate(
      { resourceId: resource.id, data: { downloadable } },
      {
        onError: (err) =>
          showError(err instanceof Error ? err.message : "Failed to update resource."),
      }
    );
  };

  // ── Delete ──
  const handleDelete = (resourceId: string) => {
    deleteMut.mutate(resourceId, {
      onError: (err) =>
        showError(err instanceof Error ? err.message : "Failed to delete resource."),
    });
    if (editingId === resourceId) {
      setEditingId(null);
      setEditDraft(null);
    }
  };

  // ── Reorder (swap sort_order with neighbour) ──
  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= resources.length) return;
    const current = resources[index];
    const neighbour = resources[newIndex];
    updateMut.mutate({ resourceId: current.id, data: { sort_order: newIndex } });
    updateMut.mutate({ resourceId: neighbour.id, data: { sort_order: index } });
  };

  const totalCount = resources.length + legacyResources.length;
  const isMutating = createMut.isPending || updateMut.isPending || deleteMut.isPending;

  return (
    <div className={cn("border rounded-lg bg-card", className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{title}</h4>
          <span className="text-sm text-muted-foreground">({totalCount})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t p-4 space-y-3">
          {isLoading && hasServerContext && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* ── Structured resources ── */}
          {resources.length > 0 && (
            <div className="space-y-2">
              {resources.map((resource, index) => {
                const meta = TYPE_META[resource.type] ?? TYPE_META.LINK;
                const Icon = meta.icon;
                const isEditing = editingId === resource.id;
                const showDownloadable = DOWNLOADABLE_TYPES.includes(resource.type);
                const isUrlEditable =
                  resource.type === "LINK" || resource.type === "GITHUB";

                return (
                  <div
                    key={resource.id}
                    className={cn(
                      "border rounded-lg transition-all",
                      isEditing ? "bg-muted/50 ring-1 ring-primary/30" : "bg-background"
                    )}
                  >
                    <div className="flex items-center gap-2 p-3">
                      {!readOnly && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMove(index, "up")}
                            disabled={index === 0 || isMutating}
                            className="p-1 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(index, "down")}
                            disabled={index === resources.length - 1 || isMutating}
                            className="p-1 hover:bg-muted rounded disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <div className="p-1.5 rounded bg-muted flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block">
                          {resource.title || `Untitled ${meta.label}`}
                        </span>
                        <span className="text-xs text-muted-foreground">({meta.label})</span>
                      </div>

                      {showDownloadable && !readOnly && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Label
                            htmlFor={`downloadable-${resource.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Downloadable
                          </Label>
                          <Switch
                            id={`downloadable-${resource.id}`}
                            checked={resource.downloadable}
                            onCheckedChange={(checked) =>
                              handleToggleDownloadable(resource, checked)
                            }
                          />
                        </div>
                      )}
                      {showDownloadable && readOnly && resource.downloadable && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          Downloadable
                        </span>
                      )}

                      {resource.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 flex-shrink-0"
                          asChild
                        >
                          <a href={resource.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}

                      {!readOnly && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(resource)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(resource.id)}
                            disabled={deleteMut.isPending}
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Inline edit form (link / github / file title) */}
                    {isEditing && editDraft && !readOnly && (
                      <div className="border-t p-4 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={editDraft.title}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, title: e.target.value })
                            }
                            placeholder="Resource title"
                            className="h-9"
                          />
                        </div>
                        {isUrlEditable && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">URL</Label>
                            <Input
                              value={editDraft.url}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, url: e.target.value })
                              }
                              placeholder="https://..."
                              type="url"
                              className="h-9"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmEdit(resource)}
                            disabled={
                              updateMut.isPending ||
                              (isUrlEditable
                                ? !editDraft.url.trim()
                                : !editDraft.title.trim())
                            }
                            className="gap-1.5"
                          >
                            {updateMut.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Save Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null);
                              setEditDraft(null);
                            }}
                            className="gap-1.5"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Legacy resource_links entries (read only) ── */}
          {legacyResources.length > 0 && (
            <div className="space-y-2">
              {legacyResources.map((resource) => {
                const Icon = LEGACY_ICONS[resource.type] || ExternalLink;
                return (
                  <div
                    key={resource.id}
                    className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-3"
                  >
                    <div className="p-1.5 rounded bg-muted flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block text-muted-foreground">
                        {resource.title || resource.url || "Untitled resource"}
                      </span>
                    </div>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex-shrink-0">
                      legacy
                    </span>
                    {resource.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 flex-shrink-0"
                        asChild
                      >
                        <a href={resource.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && totalCount === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              No resources added yet.
            </p>
          )}

          {/* ── Pending link / GitHub form ── */}
          {pendingLink && !readOnly && (
            <div className="border rounded-lg bg-muted/30 ring-1 ring-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                {pendingLink.type === "GITHUB" ? (
                  <Github className="h-4 w-4 text-primary" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm font-medium">
                  New {TYPE_META[pendingLink.type].label}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={pendingLink.title}
                  onChange={(e) => setPendingLink({ ...pendingLink, title: e.target.value })}
                  placeholder="Resource title (optional)"
                  className="h-9"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  value={pendingLink.url}
                  onChange={(e) => setPendingLink({ ...pendingLink, url: e.target.value })}
                  placeholder={
                    pendingLink.type === "GITHUB"
                      ? "https://github.com/user/repo"
                      : "https://example.com"
                  }
                  type="url"
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleConfirmAddLink}
                  disabled={!pendingLink.url.trim() || createMut.isPending}
                  className="gap-1.5"
                >
                  {createMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add Resource
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingLink(null)}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── Add resource buttons ── */}
          {!readOnly && hasServerContext && (
            <div className="flex flex-wrap gap-2">
              {onUploadFile && (
                <>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange("PDF", e)}
                    aria-hidden
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange("IMAGE", e)}
                    aria-hidden
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={!!uploadingType || !!pendingLink}
                    className="gap-1"
                  >
                    {uploadingType === "PDF" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <FileText className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {uploadingType === "PDF" ? "Uploading..." : "PDF"}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={!!uploadingType || !!pendingLink}
                    className="gap-1"
                  >
                    {uploadingType === "IMAGE" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <ImageIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">
                      {uploadingType === "IMAGE" ? "Uploading..." : "Image"}
                    </span>
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingLink({ type: "LINK", title: "", url: "" })}
                disabled={!!pendingLink || !!uploadingType}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                <ExternalLink className="h-3 w-3" />
                <span className="hidden sm:inline">Link</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingLink({ type: "GITHUB", title: "", url: "" })}
                disabled={!!pendingLink || !!uploadingType}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                <Github className="h-3 w-3" />
                <span className="hidden sm:inline">GitHub</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTextDialog({ resourceId: null, title: "", content: "" })}
                disabled={!!pendingLink || !!uploadingType}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                <AlignLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Text</span>
              </Button>
            </div>
          )}

          {!readOnly && !hasServerContext && (
            <p className="text-xs text-muted-foreground">
              Save the lesson first to add resources.
            </p>
          )}
        </div>
      )}

      {/* ── Text resource dialog (rich text editor) ── */}
      <Dialog
        open={!!textDialog}
        onOpenChange={(open) => {
          if (!open) setTextDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {textDialog?.resourceId ? "Edit Text Resource" : "New Text Resource"}
            </DialogTitle>
          </DialogHeader>
          {textDialog && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input
                  value={textDialog.title}
                  onChange={(e) => setTextDialog({ ...textDialog, title: e.target.value })}
                  placeholder="Resource title"
                  className="h-9"
                  autoFocus
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                <LessonRichEditor
                  key={textDialog.resourceId ?? "new"}
                  content={textDialog.content}
                  onChange={(html) =>
                    setTextDialog((prev) => (prev ? { ...prev, content: html } : prev))
                  }
                  onUploadImage={onUploadFile}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button size="sm" variant="outline" onClick={() => setTextDialog(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveText}
              disabled={
                !textDialog?.title.trim() || createMut.isPending || updateMut.isPending
              }
            >
              {createMut.isPending || updateMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ResourceManager;

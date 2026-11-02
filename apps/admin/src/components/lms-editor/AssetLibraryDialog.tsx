"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useToast,
} from "@open-mtlms/core";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { questionAssetsApi } from "@/lib/api/courses-lms";

interface Props {
  courseId: string;
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

/**
 * Asset Library, reuse previously uploaded question files. Upload a CSV once
 * (saved as an asset), then import it into any quiz without re-uploading.
 */
export function AssetLibraryDialog({
  courseId,
  quizId,
  open,
  onOpenChange,
  onImported,
}: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    data: assets = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["question-assets"],
    queryFn: () => questionAssetsApi.list(),
    enabled: open,
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await questionAssetsApi.create(file);
      toast({
        title: "Saved to library",
        description: `${res.question_count} question(s) stored as "${file.name}"`,
      });
      await refetch();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async (assetId: string) => {
    setBusyId(assetId);
    try {
      const res = await questionAssetsApi.importToQuiz(assetId, courseId, quizId);
      toast({
        title: "Imported",
        description: `${res.created} question(s) added to the quiz`,
      });
      onImported?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (assetId: string) => {
    setBusyId(assetId);
    try {
      await questionAssetsApi.remove(assetId);
      await refetch();
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asset library</DialogTitle>
          <DialogDescription>
            Reusable uploaded question files. Upload a CSV once, then import it
            into any quiz without re-uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">
            {assets.length} saved file{assets.length === 1 ? "" : "s"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved files yet. Upload a CSV to add one.
            </p>
          ) : (
            assets.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.questionCount} question{a.questionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => handleImport(a.id)}
                    disabled={busyId === a.id}
                  >
                    {busyId === a.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Import"
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(a.id)}
                    disabled={busyId === a.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AssetLibraryDialog;

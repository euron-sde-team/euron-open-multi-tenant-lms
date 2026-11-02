"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@open-mtlms/core";
import { BookOpen, GraduationCap, Loader2, ShieldCheck, Users } from "lucide-react";

interface RedesignWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageCount: number;
  onConfirm: () => void;
  isDeleting: boolean;
  deletedCount?: number;
}

export function RedesignWebsiteDialog({
  open,
  onOpenChange,
  pageCount,
  onConfirm,
  isDeleting,
  deletedCount = 0,
}: RedesignWebsiteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Redesign Website</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                This will delete all {pageCount} website page{pageCount !== 1 ? "s" : ""}{" "}
                (Home, About, Contact, FAQ, Privacy, Terms, Blog, etc.) and restart the
                setup wizard with a fresh design.
              </p>

              {/* What's safe */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Your content is completely safe
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-sm text-emerald-700/80 dark:text-emerald-400/80 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    All courses & curriculum
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    All books & content
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    Members & enrollments
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Videos, quizzes & assignments
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Only the website layout pages will be replaced. The new wizard will let
                you pick a fresh template, theme, and regenerate content with AI.
              </p>

              {/* Deletion progress */}
              {isDeleting && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Removing old pages...
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: pageCount > 0 ? `${Math.round((deletedCount / pageCount) * 100)}%` : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {deletedCount} of {pageCount} pages removed
                  </p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {!isDeleting && (
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground ring-offset-background transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Delete All & Restart
            </button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { Button, Label, Switch, Separator } from "@open-mtlms/core";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Eye,
  Save,
  Send,
  Menu,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useCourseStore } from "@/lib/stores/course-store";

interface CourseEditorToolbarProps {
  onSaveDraft?: () => void;
  onPublish?: () => void;
}

export function CourseEditorToolbar({ onSaveDraft, onPublish }: CourseEditorToolbarProps) {
  const {
    isEditMode,
    toggleEditMode,
    history,
    undo,
    redo,
    isDirty,
    courseData,
  } = useCourseStore();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const toggleAppTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Back button */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/courses">
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={!canUndo}
              title="Undo"
              className="h-8 w-8"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={!canRedo}
              title="Redo"
              className="h-8 w-8"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          {/* Edit Mode Toggle */}
          <div className="hidden items-center gap-2 md:flex">
            <Switch
              id="edit-mode"
              checked={isEditMode}
              onCheckedChange={toggleEditMode}
            />
            <Label htmlFor="edit-mode" className="font-medium text-sm">
              Edit
            </Label>
          </div>
        </div>

        {/* Center - Course title */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm font-medium truncate max-w-xs">
            {courseData.title || "Untitled Course"}
          </span>
          {courseData.status === "PUBLISHED" && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
              Published
            </span>
          )}
        </div>
        {/* Template is configured in Pages > Course Pages section */}

        {/* Right side */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Dark/Light Mode Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleAppTheme}
            title={mounted ? (theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode") : "Toggle Theme"}
            className="h-8 w-8"
          >
            {mounted ? (
              theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>

          {/* Course Theme button - Hidden as theme is configured in Pages section */}
          {/* Theme customization is done via the course page template in Pages > Course Pages */}
          {/* <Button
            variant={isThemePanelOpen ? "secondary" : "outline"}
            size="sm"
            onClick={toggleThemePanel}
            className="hidden md:flex"
          >
            <Palette className="mr-2 h-4 w-4" />
            Theme
          </Button> */}

          {/* Preview button - Desktop */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEditMode}
            className="hidden md:flex"
          >
            <Eye className="mr-2 h-4 w-4" />
            {isEditMode ? "Preview" : "Edit"}
          </Button>

          {/* Unsaved indicator */}
          {isDirty && (
            <span className="hidden text-xs text-yellow-700 dark:text-yellow-300 sm:inline">
              Unsaved
            </span>
          )}

          <Separator orientation="vertical" className="hidden h-6 md:block" />

          {/* Save/Publish buttons */}
          <Button variant="outline" size="sm" onClick={onSaveDraft}>
            <Save className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button size="sm" onClick={onPublish}>
            <Send className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">
              {courseData.status === "PUBLISHED" ? "Update" : "Publish"}
            </span>
          </Button>

          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

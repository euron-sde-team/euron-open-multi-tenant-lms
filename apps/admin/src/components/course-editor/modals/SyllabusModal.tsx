"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  cn,
} from "@open-mtlms/core";
import type {
  CourseSectionData,
  CourseModuleData,
  CourseLecture,
  LMSVideoConfig,
} from "@open-mtlms/shared";
import { normalizeSectionModules } from "@open-mtlms/shared";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Film,
  GripVertical,
  Layers,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { VideoConfigPanel } from "@/components/lms-editor";
import { useCourseStore } from "@/lib/stores/course-store";
import { videoConfigToSyncKeys, videoKeyToConfig } from "@/lib/utils/lms-mapper";

// Helper: parse a stored video URL / id string to LMSVideoConfig
function parseVideoUrl(url: string | undefined): LMSVideoConfig | undefined {
  return videoKeyToConfig(url);
}

// Helper: convert LMSVideoConfig back to a URL string
function videoConfigToUrl(video: LMSVideoConfig | undefined): string | undefined {
  return videoConfigToSyncKeys(video).video_key ?? undefined;
}

interface SyllabusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SyllabusModal({ open, onOpenChange }: SyllabusModalProps) {
  const {
    courseData,
    addSection,
    updateSection,
    removeSection,
    reorderSections,
    duplicateSection,
    addModule,
    updateModule,
    removeModule,
    reorderModules,
    duplicateModule,
    addLecture,
    updateLecture,
    removeLecture,
    reorderLectures,
    duplicateLecture,
  } = useCourseStore();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState("");
  const [editingModule, setEditingModule] = useState<{ sectionId: string; moduleId: string } | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [editingLecture, setEditingLecture] = useState<{
    sectionId: string;
    moduleId: string;
    lectureId: string;
  } | null>(null);
  const [editingLectureTitle, setEditingLectureTitle] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addingModuleToSection, setAddingModuleToSection] = useState<string | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingLectureToModule, setAddingLectureToModule] = useState<{
    sectionId: string;
    moduleId: string;
  } | null>(null);
  const [newLectureTitle, setNewLectureTitle] = useState("");
  const [videoConfigTarget, setVideoConfigTarget] = useState<{
    sectionId: string;
    moduleId: string;
    lecture: CourseLecture;
  } | null>(null);
  /** Row whose free preview video is being edited. */
  const [previewTarget, setPreviewTarget] = useState<{
    sectionId: string;
    moduleId: string;
    lecture: CourseLecture;
  } | null>(null);

  const sectionsWithModules = useMemo(
    () => courseData.sections.map((s) => normalizeSectionModules(s)),
    [courseData.sections]
  );

  const totalLectures = useMemo(
    () =>
      sectionsWithModules.reduce(
        (acc, s) => acc + s.modules.reduce((mAcc, m) => mAcc + m.lectures.length, 0),
        0
      ),
    [sectionsWithModules]
  );

  const totalModules = useMemo(
    () => sectionsWithModules.reduce((acc, s) => acc + s.modules.length, 0),
    [sectionsWithModules]
  );

  const allExpanded =
    expandedSections.size === sectionsWithModules.length && sectionsWithModules.length > 0;

  // --- Section handlers ---

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleAllSections = () => {
    if (allExpanded) {
      setExpandedSections(new Set());
      setExpandedModules(new Set());
    } else {
      setExpandedSections(new Set(sectionsWithModules.map((s) => s.id)));
      setExpandedModules(
        new Set(sectionsWithModules.flatMap((s) => s.modules.map((m) => m.id)))
      );
    }
  };

  const handleAddSection = () => {
    if (newSectionTitle.trim()) {
      addSection(newSectionTitle.trim());
      setNewSectionTitle("");
    }
  };

  const handleStartEditSection = (section: CourseSectionData) => {
    setEditingSection(section.id);
    setEditingSectionTitle(section.title);
  };

  const handleSaveSection = (sectionId: string) => {
    if (editingSectionTitle.trim()) {
      updateSection(sectionId, { title: editingSectionTitle.trim() });
    }
    setEditingSection(null);
  };

  const handleMoveSection = (sectionId: string, direction: "up" | "down") => {
    const idx = sectionsWithModules.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sectionsWithModules.length) return;
    reorderSections(idx, newIdx);
  };

  // --- Module handlers ---

  const handleAddModule = (sectionId: string) => {
    if (newModuleTitle.trim()) {
      addModule(sectionId, newModuleTitle.trim());
      setNewModuleTitle("");
      setAddingModuleToSection(null);
    }
  };

  const handleStartEditModule = (sectionId: string, module: CourseModuleData) => {
    setEditingModule({ sectionId, moduleId: module.id });
    setEditingModuleTitle(module.title);
  };

  const handleSaveModule = () => {
    if (editingModule && editingModuleTitle.trim()) {
      updateModule(editingModule.sectionId, editingModule.moduleId, {
        title: editingModuleTitle.trim(),
      });
    }
    setEditingModule(null);
  };

  const handleMoveModule = (
    sectionId: string,
    moduleId: string,
    direction: "up" | "down"
  ) => {
    const section = sectionsWithModules.find((s) => s.id === sectionId);
    if (!section) return;
    const idx = section.modules.findIndex((m) => m.id === moduleId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= section.modules.length) return;
    reorderModules(sectionId, idx, newIdx);
  };

  const getSectionLectureCount = (section: CourseSectionData) =>
    section.modules.reduce((acc, m) => acc + m.lectures.length, 0);

  // --- Lecture handlers ---

  const handleAddLecture = (sectionId: string, moduleId: string) => {
    if (newLectureTitle.trim()) {
      addLecture(sectionId, moduleId, newLectureTitle.trim());
      setNewLectureTitle("");
      setAddingLectureToModule(null);
    }
  };

  const handleStartEditLecture = (
    sectionId: string,
    moduleId: string,
    lecture: CourseLecture
  ) => {
    setEditingLecture({ sectionId, moduleId, lectureId: lecture.id });
    setEditingLectureTitle(lecture.title);
  };

  const handleSaveLecture = () => {
    if (editingLecture && editingLectureTitle.trim()) {
      updateLecture(
        editingLecture.sectionId,
        editingLecture.moduleId,
        editingLecture.lectureId,
        { title: editingLectureTitle.trim() }
      );
    }
    setEditingLecture(null);
  };

  const handleMoveLecture = (
    sectionId: string,
    moduleId: string,
    lectureId: string,
    direction: "up" | "down"
  ) => {
    const section = sectionsWithModules.find((s) => s.id === sectionId);
    if (!section) return;
    const mod = section.modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const idx = mod.lectures.findIndex((l) => l.id === lectureId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= mod.lectures.length) return;
    reorderLectures(sectionId, moduleId, idx, newIdx);
  };

  // --- Video handlers ---

  const handleVideoChange = useCallback(
    (video: LMSVideoConfig | undefined) => {
      if (!videoConfigTarget) return;
      const url = videoConfigToUrl(video);
      updateLecture(
        videoConfigTarget.sectionId,
        videoConfigTarget.moduleId,
        videoConfigTarget.lecture.id,
        { videoUrl: url }
      );
      setVideoConfigTarget((prev) =>
        prev ? { ...prev, lecture: { ...prev.lecture, videoUrl: url } } : null
      );
    },
    [videoConfigTarget, updateLecture]
  );

  const handlePreviewVideoChange = (video: LMSVideoConfig | undefined) => {
    if (!previewTarget) return;
    const { video_key, video_provider } = videoConfigToSyncKeys(video);
    updateLecture(
      previewTarget.sectionId,
      previewTarget.moduleId,
      previewTarget.lecture.id,
      video_key && video_provider
        ? {
            previewVideo: {
              videoKey: video_key,
              provider: video_provider,
              title: previewTarget.lecture.title,
            },
            // Flag the row so the syllabus shows it as a free sample even before
            // the page is republished.
            previewUrl: "preview",
          }
        : { previewVideo: undefined, previewUrl: undefined }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Course Syllabus
                </DialogTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  {sectionsWithModules.length} sections &bull; {totalModules} modules &bull;{" "}
                  {totalLectures} lectures
                </p>
              </div>
              {sectionsWithModules.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAllSections}
                  className="gap-1.5 text-xs"
                >
                  {allExpanded ? (
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                  )}
                  {allExpanded ? "Collapse All" : "Expand All"}
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-auto pr-2">
            {sectionsWithModules.map((section, sectionIndex) => (
              <div key={section.id} className="bg-card overflow-hidden rounded-lg border">
                {/* Section Header */}
                <div
                  className={cn(
                    "group flex items-center gap-2 border-b p-3",
                    expandedSections.has(section.id) ? "bg-muted" : "bg-muted/50"
                  )}
                >
                  <GripVertical className="text-muted-foreground h-4 w-4 cursor-grab" />
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  {editingSection === section.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editingSectionTitle}
                        onChange={(e) => setEditingSectionTitle(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveSection(section.id);
                          if (e.key === "Escape") setEditingSection(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleSaveSection(section.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setEditingSection(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleStartEditSection(section)}
                      >
                        <p className="truncate font-medium">
                          Section {sectionIndex + 1}: {section.title}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {section.modules.length} modules &bull;{" "}
                          {getSectionLectureCount(section)} lectures
                        </p>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Move up"
                          onClick={() => handleMoveSection(section.id, "up")}
                          disabled={sectionIndex === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Move down"
                          onClick={() => handleMoveSection(section.id, "down")}
                          disabled={sectionIndex === sectionsWithModules.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Edit title"
                          onClick={() => handleStartEditSection(section)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Duplicate section"
                          onClick={() => duplicateSection(section.id)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          title="Delete section"
                          onClick={() => {
                            const count = getSectionLectureCount(section);
                            if (count > 0) {
                              if (
                                !confirm(
                                  `Delete "${section.title}" and its ${section.modules.length} module(s) and ${count} lecture(s)?`
                                )
                              )
                                return;
                            }
                            removeSection(section.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Modules & Lectures */}
                {expandedSections.has(section.id) && (
                  <div className="space-y-1 p-2">
                    {section.modules.map((module, moduleIndex) => (
                      <div
                        key={module.id}
                        className="overflow-hidden rounded-md border bg-background"
                      >
                        {/* Module Header */}
                        <div className="group/module flex items-center gap-2 border-b bg-muted/30 p-2">
                          <button
                            onClick={() => toggleModule(module.id)}
                            className="hover:bg-muted rounded p-0.5"
                          >
                            {expandedModules.has(module.id) ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <Layers className="text-muted-foreground h-3.5 w-3.5 shrink-0" />

                          {editingModule?.moduleId === module.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <Input
                                value={editingModuleTitle}
                                onChange={(e) => setEditingModuleTitle(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveModule();
                                  if (e.key === "Escape") setEditingModule(null);
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={handleSaveModule}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => setEditingModule(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div
                                className="min-w-0 flex-1 cursor-pointer"
                                onClick={() => handleStartEditModule(section.id, module)}
                              >
                                <p className="truncate text-sm font-medium">
                                  {module.title}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {module.lectures.length} lectures
                                </p>
                              </div>

                              <div className="flex items-center gap-0 opacity-0 transition-opacity group-hover/module:opacity-100">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Move up"
                                  onClick={() =>
                                    handleMoveModule(section.id, module.id, "up")
                                  }
                                  disabled={moduleIndex === 0}
                                >
                                  <ArrowUp className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Move down"
                                  onClick={() =>
                                    handleMoveModule(section.id, module.id, "down")
                                  }
                                  disabled={
                                    moduleIndex === section.modules.length - 1
                                  }
                                >
                                  <ArrowDown className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Edit module"
                                  onClick={() =>
                                    handleStartEditModule(section.id, module)
                                  }
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  title="Duplicate module"
                                  onClick={() =>
                                    duplicateModule(section.id, module.id)
                                  }
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive h-6 w-6"
                                  title="Delete module"
                                  onClick={() => {
                                    if (module.lectures.length > 0) {
                                      if (
                                        !confirm(
                                          `Delete "${module.title}" and its ${module.lectures.length} lecture(s)?`
                                        )
                                      )
                                        return;
                                    }
                                    removeModule(section.id, module.id);
                                  }}
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Lectures */}
                        {expandedModules.has(module.id) && (
                          <div className="space-y-0.5 p-2">
                            {module.lectures.map((lecture, lectureIndex) => (
                              <div
                                key={lecture.id}
                                className="group/lecture hover:bg-muted/50 flex items-center gap-2 rounded p-2"
                              >
                                <GripVertical className="text-muted-foreground h-3 w-3 cursor-grab opacity-0 group-hover/lecture:opacity-100" />
                                <button
                                  className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs transition-colors",
                                    lecture.videoUrl
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                  )}
                                  title={
                                    lecture.videoUrl ? "Change video" : "Add video"
                                  }
                                  onClick={() =>
                                    setVideoConfigTarget({
                                      sectionId: section.id,
                                      moduleId: module.id,
                                      lecture,
                                    })
                                  }
                                >
                                  {lecture.videoUrl ? (
                                    <Play className="h-3 w-3" />
                                  ) : (
                                    <Video className="h-3 w-3" />
                                  )}
                                </button>

                                {editingLecture?.lectureId === lecture.id ? (
                                  <div className="flex flex-1 items-center gap-2">
                                    <Input
                                      value={editingLectureTitle}
                                      onChange={(e) =>
                                        setEditingLectureTitle(e.target.value)
                                      }
                                      className="h-7 text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveLecture();
                                        if (e.key === "Escape")
                                          setEditingLecture(null);
                                      }}
                                    />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={handleSaveLecture}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => setEditingLecture(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    <span
                                      className="flex-1 cursor-pointer truncate text-sm"
                                      onClick={() =>
                                        handleStartEditLecture(
                                          section.id,
                                          module.id,
                                          lecture
                                        )
                                      }
                                    >
                                      {lectureIndex + 1}. {lecture.title}
                                    </span>

                                    {/* Flagging a row as a preview publishes
                                        nothing on its own: a visitor can only
                                        watch it once a video is attached. Say
                                        so, rather than showing a green badge
                                        for a row that does nothing. */}
                                    {lecture.previewUrl &&
                                      (lecture.previewVideo ? (
                                        <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          Preview
                                        </span>
                                      ) : (
                                        <span
                                          className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                          title="Marked as a preview, but no video is attached yet, so nothing plays on the course page."
                                        >
                                          Preview &middot; no video
                                        </span>
                                      ))}

                                    {/* Free sample video. Deliberately NOT hover gated
                                        like the actions beside it: this is the
                                        only way into the feature, and a control
                                        you have to discover by hovering is a
                                        control nobody uses. */}
                                    <Button
                                      size="sm"
                                      variant={
                                        lecture.previewVideo ? "secondary" : "ghost"
                                      }
                                      className="h-6 shrink-0 gap-1 px-2 text-[10px] font-medium"
                                      title={
                                        lecture.previewVideo
                                          ? "Change the free preview video"
                                          : "Add a free preview video"
                                      }
                                      onClick={() =>
                                        setPreviewTarget({
                                          sectionId: section.id,
                                          moduleId: module.id,
                                          lecture,
                                        })
                                      }
                                    >
                                      <Film className="h-3 w-3" />
                                      {lecture.previewVideo
                                        ? "Preview video"
                                        : "Add preview"}
                                    </Button>

                                    {/* Removing a preview used to mean finding
                                        the hover-only eye toggle and knowing it
                                        also deletes the video. One obvious
                                        control instead. */}
                                    {lecture.previewVideo && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-muted-foreground hover:text-destructive h-6 w-6 shrink-0"
                                        title="Remove the preview video from this lecture"
                                        onClick={() =>
                                          updateLecture(
                                            section.id,
                                            module.id,
                                            lecture.id,
                                            {
                                              previewVideo: undefined,
                                              previewUrl: undefined,
                                            }
                                          )
                                        }
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    )}

                                    <div className="flex items-center gap-0 opacity-0 transition-opacity group-hover/lecture:opacity-100">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        title="Move up"
                                        onClick={() =>
                                          handleMoveLecture(
                                            section.id,
                                            module.id,
                                            lecture.id,
                                            "up"
                                          )
                                        }
                                        disabled={lectureIndex === 0}
                                      >
                                        <ArrowUp className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        title="Move down"
                                        onClick={() =>
                                          handleMoveLecture(
                                            section.id,
                                            module.id,
                                            lecture.id,
                                            "down"
                                          )
                                        }
                                        disabled={
                                          lectureIndex === module.lectures.length - 1
                                        }
                                      >
                                        <ArrowDown className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        title={
                                          lecture.videoUrl
                                            ? "Change video"
                                            : "Add video"
                                        }
                                        onClick={() =>
                                          setVideoConfigTarget({
                                            sectionId: section.id,
                                            moduleId: module.id,
                                            lecture,
                                          })
                                        }
                                      >
                                        <Video className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        title="Duplicate lecture"
                                        onClick={() =>
                                          duplicateLecture(
                                            section.id,
                                            module.id,
                                            lecture.id
                                          )
                                        }
                                      >
                                        <Copy className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6"
                                        title="Edit title"
                                        onClick={() =>
                                          handleStartEditLecture(
                                            section.id,
                                            module.id,
                                            lecture
                                          )
                                        }
                                      >
                                        <Pencil className="h-2.5 w-2.5" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive h-6 w-6"
                                        title="Delete lecture"
                                        onClick={() =>
                                          removeLecture(
                                            section.id,
                                            module.id,
                                            lecture.id
                                          )
                                        }
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}

                            {/* Add Lecture */}
                            {addingLectureToModule?.sectionId === section.id &&
                            addingLectureToModule?.moduleId === module.id ? (
                              <div className="flex items-center gap-2 p-2">
                                <Input
                                  value={newLectureTitle}
                                  onChange={(e) =>
                                    setNewLectureTitle(e.target.value)
                                  }
                                  placeholder="Lecture title..."
                                  className="h-8 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleAddLecture(section.id, module.id);
                                    if (e.key === "Escape") {
                                      setAddingLectureToModule(null);
                                      setNewLectureTitle("");
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleAddLecture(section.id, module.id)
                                  }
                                  disabled={!newLectureTitle.trim()}
                                >
                                  Add
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setAddingLectureToModule(null);
                                    setNewLectureTitle("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground w-full justify-start"
                                onClick={() => {
                                  setAddingLectureToModule({
                                    sectionId: section.id,
                                    moduleId: module.id,
                                  });
                                  setExpandedModules((prev) =>
                                    new Set([...prev, module.id])
                                  );
                                }}
                              >
                                <Plus className="mr-2 h-3 w-3" />
                                Add Lecture
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Module */}
                    {addingModuleToSection === section.id ? (
                      <div className="flex items-center gap-2 rounded border border-dashed p-2">
                        <Input
                          value={newModuleTitle}
                          onChange={(e) => setNewModuleTitle(e.target.value)}
                          placeholder="Module title..."
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleAddModule(section.id);
                            if (e.key === "Escape") {
                              setAddingModuleToSection(null);
                              setNewModuleTitle("");
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddModule(section.id)}
                          disabled={!newModuleTitle.trim()}
                        >
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingModuleToSection(null);
                            setNewModuleTitle("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground w-full justify-start"
                        onClick={() => {
                          setAddingModuleToSection(section.id);
                          setExpandedSections((prev) =>
                            new Set([...prev, section.id])
                          );
                        }}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add Module
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add New Section */}
            <div className="rounded-lg border border-dashed p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="New section title..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSection();
                  }}
                />
                <Button onClick={handleAddSection} disabled={!newSectionTitle.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free preview video: an EVS video id or an external link. */}
      <Dialog
        open={!!previewTarget}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Free preview video
            </DialogTitle>
            <DialogDescription>
              Visitors can watch this video on the course page for &quot;
              {previewTarget?.lecture.title || "this lecture"}&quot;
            </DialogDescription>
          </DialogHeader>
          {previewTarget && (
            <VideoConfigPanel
              key={previewTarget.lecture.id}
              video={parseVideoUrl(previewTarget.lecture.previewVideo?.videoKey)}
              onChange={handlePreviewVideoChange}
              compact
            />
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Configuration Dialog */}
      <Dialog
        open={!!videoConfigTarget}
        onOpenChange={(open) => {
          if (!open) setVideoConfigTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Lecture Video
            </DialogTitle>
            <DialogDescription>
              Configure the video for &quot;
              {videoConfigTarget?.lecture.title || "this lecture"}&quot;
            </DialogDescription>
          </DialogHeader>
          <VideoConfigPanel
            video={parseVideoUrl(videoConfigTarget?.lecture.videoUrl)}
            onChange={handleVideoChange}
            compact
          />
          <DialogFooter>
            {videoConfigTarget?.lecture.videoUrl && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive mr-auto"
                onClick={() => {
                  if (videoConfigTarget) {
                    updateLecture(
                      videoConfigTarget.sectionId,
                      videoConfigTarget.moduleId,
                      videoConfigTarget.lecture.id,
                      { videoUrl: undefined }
                    );
                    setVideoConfigTarget(null);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Video
              </Button>
            )}
            <Button onClick={() => setVideoConfigTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

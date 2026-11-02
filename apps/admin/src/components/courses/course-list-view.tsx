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
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  useToast,
  PartOfBundleBadge,
} from "@open-mtlms/core";
import { decodeHtmlEntities, getErrorMessage } from "@open-mtlms/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  // Palette, // Commented out - used in theme selector which is disabled
  Plus,
  Search,
  Trash2,
  UserPlus,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";


import { courseTemplates as availableTemplates } from "@/components/course-editor";
import { CoursePageLinkButton } from "@/components/courses/course-page-link-button";
import { SortableCardGrid } from "@/components/ordered-products/sortable-card-grid";
import { useCatalogOrdering } from "@/components/ordered-products/use-catalog-ordering";
import { CopyLinkButton } from "@/components/shared/copy-link-button";
import type { CourseMode } from "@/lib/api/courses";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import {
  courseKeys,
  useCourses,
  useCreateCourse,
  useDeleteCourse,
  useToggleCoursePublish,
} from "@/lib/hooks/use-courses";
import {
  useEntitlements,
  getProductUsage,
} from "@/lib/hooks/use-entitlements";
import { useTenantWebBaseUrl } from "@/lib/hooks/use-tenant-domain-url";
import { useTenantSettingsStore } from "@/lib/stores/tenant-settings-store";
import { useTenantStore } from "@/lib/stores/tenant-store";
import { generateSlug } from "@/lib/utils/slug";

/* ------------------------------------------------------------------ */
/*  Mode metadata                                                      */
/* ------------------------------------------------------------------ */

interface ModeConfig {
  label: string;
  heading: string;
  description: string;
  productCode: string;
  emptyTitle: string;
  emptySubtitle: string;
}

const MODE_CONFIG: Record<CourseMode, ModeConfig> = {
  SELF_PACED: {
    label: "Self-Paced",
    heading: "Self-Paced Courses",
    description: "Manage self-paced courses that students can complete at their own pace",
    productCode: "self_paced_courses_count",
    emptyTitle: "No self-paced courses yet",
    emptySubtitle: "Get started by creating your first self-paced course",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface CourseListViewProps {
  /** The course mode this view is scoped to (self-paced only) */
  mode?: CourseMode;
}

export function CourseListView({ mode = "SELF_PACED" }: CourseListViewProps) {
  const config = MODE_CONFIG[mode];
  const { toast } = useToast();
  const { selectedTenantId, selectedTenant: _selectedTenant } = useTenantStore();
  const queryClient = useQueryClient();
  const { getCoursePageTemplateId } = useTenantSettingsStore();
  const tenantWebBaseUrl = useTenantWebBaseUrl();

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  // Data: pass mode/courseType filters to the API so the backend filters for us
  const apiFilters = { mode: mode, courseType: "NORMAL" as const };
  const { data: coursesData, isLoading, error } = useCourses(
    selectedTenantId || undefined,
    1,
    100,
    apiFilters
  );
  const { data: entitlements } = useEntitlements(selectedTenantId || undefined);
  const usage = getProductUsage(entitlements, config.productCode);

  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const togglePublish = useToggleCoursePublish();

  // Template selection - currently unused since theme selector is commented out
  // Uncomment when multiple themes are supported in the future
  const _selectedTemplateId = selectedTenantId ? getCoursePageTemplateId(selectedTenantId) : null;
  const _selectedTemplate = availableTemplates.find((t) => t.id === _selectedTemplateId);

  // Filter courses by mode or courseType, then by search query
  const filteredCourses = useMemo(() => {
    const filtered = (coursesData?.courses || []).filter(
      (c) => c.mode === mode && c.courseType === "NORMAL"
    );

    if (!searchQuery.trim()) return filtered;

    const query = searchQuery.toLowerCase();
    return filtered.filter(
      (course) =>
        course.title.toLowerCase().includes(query) ||
        course.slug.toLowerCase().includes(query)
    );
  }, [coursesData?.courses, mode, searchQuery]);

  // The self-paced list is arranged by the admin; the server scopes the
  // reorder by mode.
  const ordering = useCatalogOrdering({
    entity: "courses",
    mode,
    isFiltered: searchQuery.trim().length > 0,
    onSaved: () =>
      void queryClient.invalidateQueries({ queryKey: courseKeys.lists() }),
  });

  // Stats (scoped to this mode or courseType)
  const stats = useMemo(() => {
    const courses = (coursesData?.courses || []).filter(
      (c) => c.mode === mode && c.courseType === "NORMAL"
    );

    return {
      total: courses.length,
      published: courses.filter((c) => c.isPublished).length,
      draft: courses.filter((c) => !c.isPublished).length,
    };
  }, [coursesData?.courses, mode]);

  // Slug preview
  const slugPreview = useMemo(() => {
    if (!newCourseTitle.trim()) return "";
    return `courses/${generateSlug(newCourseTitle)}`;
  }, [newCourseTitle]);

  /* ---- Handlers ---- */

  const handleCreateCourse = () => {
    if (!selectedTenantId) {
      toast({ title: "Error", description: "Please select a tenant first.", variant: "destructive" });
      return;
    }
    if (!newCourseTitle.trim()) {
      toast({ title: "Error", description: "Please enter a course title.", variant: "destructive" });
      return;
    }

    createCourse.mutate(
      {
        tenantId: selectedTenantId,
        title: newCourseTitle.trim(),
        mode,
      },
      {
        onSuccess: () => {
          setIsCreateDialogOpen(false);
          setNewCourseTitle("");
          toast({ title: "Success", description: "Course created successfully. Redirecting to editor..." });
        },
        onError: (error: Error & { code?: string }) => {
          const isEntitlement =
            error.code === "ENTITLEMENT_LIMIT_REACHED" ||
            error.code === "ENTITLEMENT_FEATURE_DISABLED";
          toast({
            title: isEntitlement ? "Plan limit" : "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteCourse = () => {
    if (!deleteCourseId) return;
    deleteCourse.mutate(deleteCourseId, {
      onSuccess: () => {
        setDeleteCourseId(null);
        toast({ title: "Success", description: "Course deleted successfully." });
      },
      onError: (err) => {
        toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
      },
    });
  };

  const handleTogglePublish = (courseId: string, currentStatus: boolean, pageId?: string | null) => {
    setTogglingPublishId(courseId);
    togglePublish.mutate(
      { courseId, isPublished: !currentStatus, pageId },
      {
        onSuccess: () => {
          setTogglingPublishId(null);
          toast({
            title: "Success",
            description: currentStatus ? "Course unpublished." : "Course published successfully.",
          });
        },
        onError: (err) => {
          setTogglingPublishId(null);
          toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
        },
      }
    );
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  /* ---- Render ---- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{config.heading}</h1>
          <p className="text-muted-foreground text-sm">{config.description}</p>
          {selectedTenantId && (
            <p className="text-muted-foreground mt-1 text-sm">
              {usage.used} / {usage.isUnlimited ? "Unlimited" : usage.limit} courses used
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Theme selector commented out - only one theme available, applied by default.
              Uncomment when multiple themes are supported in the future.
          <Button variant="outline" asChild>
            <Link href="/dashboard/courses/templates">
              <Palette className="mr-2 h-4 w-4" />
              Select Theme
              {selectedTemplate && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTemplate.name}
                </Badge>
              )}
            </Link>
          </Button>
          */}
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={!selectedTenantId || !usage.allowedToAddOne}
            title={
              !usage.allowedToAddOne
                ? `${config.label} course limit reached. Upgrade your plan.`
                : undefined
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Create {config.label} Course
          </Button>
        </div>
      </div>

      {/* No Tenant Selected */}
      {!selectedTenantId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <p className="text-muted-foreground text-center">
              Please select a tenant to view and manage courses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {selectedTenantId && (
        <div className="space-y-6">
          {usage.warning && usage.allowedToAddOne && (
            <p className="text-amber-600 text-sm">
              You have {usage.remainingSlots ?? 0} {config.label.toLowerCase()} course slot{(usage.remainingSlots ?? 0) !== 1 ? "s" : ""} left.
            </p>
          )}

          {/* Search and Stats */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              <span><strong>{stats.total}</strong> Total</span>
              <span><strong>{stats.published}</strong> Published</span>
              <span><strong>{stats.draft}</strong> Draft</span>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-destructive">Failed to load courses</p>
                <p className="text-muted-foreground text-sm">Please try refreshing the page.</p>
              </CardContent>
            </Card>
          )}

          {/* Courses Grid */}
          {!isLoading && !error && filteredCourses.length > 0 && (
            <SortableCardGrid
              items={filteredCourses}
              getId={(course) => course.id}
              getLabel={(course) => course.title}
              enabled={ordering.canDrag}
              onReorder={ordering.save}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              renderCard={(course) => (
                <Card key={course.id} className="group relative border-t-0">
                  {/* Thumbnail */}
                  <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
                    {(() => {
                      const url = resolveThumbnailForDisplay(
                        course.thumbnailKey ?? course.thumbnailUrl
                      );
                      return url ? (
                        <img
                          src={url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Part-of-bundle, bottom left, clear of the grip handle
                        above it and the status badge opposite. Non-linking:
                        this is an admin list, and a nested link inside the
                        hover-action overlay would fight the card's own actions. */}
                    {course.bundles && course.bundles.length > 0 && (
                      <div className="absolute bottom-2 left-2 right-2 z-10">
                        <PartOfBundleBadge bundles={course.bundles} asLink={false} onImage />
                      </div>
                    )}
                    {/* Hover Actions */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <CoursePageLinkButton pageId={course.pageId} path="editor" size="sm" variant="secondary">
                        <Edit className="mr-1 h-3 w-3" />
                        Edit Page
                      </CoursePageLinkButton>
                      <CoursePageLinkButton pageId={course.pageId} path="lms" size="sm" variant="default">
                        <BookOpen className="mr-1 h-3 w-3" />
                        LMS Content
                      </CoursePageLinkButton>
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="line-clamp-1 text-base">{decodeHtmlEntities(course.title)}</CardTitle>
                        <CardDescription className="font-mono text-xs">/{course.slug}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                      <Badge variant={course.isPublished ? "default" : "secondary"}>
                        {course.isPublished ? "Published" : "Draft"}
                      </Badge>
                  </div>

                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-muted-foreground text-xs">Updated {formatDate(course.updatedAt)}</div>
                      <div className="flex items-center gap-2">
                        {/* Publish / Unpublish */}
                        {!course.isPublished ? (
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1 gap-1"
                            disabled={togglingPublishId === course.id}
                            onClick={() => handleTogglePublish(course.id, course.isPublished, course.pageId)}
                          >
                            {togglingPublishId === course.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                            disabled={togglingPublishId === course.id}
                            onClick={() => handleTogglePublish(course.id, course.isPublished, course.pageId)}
                          >
                            {togglingPublishId === course.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
                            Unpublish
                          </Button>
                        )}

                        <CoursePageLinkButton pageId={course.pageId} path="editor" variant="ghost" size="icon" className="h-8 w-8" title="Edit Course Page">
                          <Edit className="h-4 w-4" />
                        </CoursePageLinkButton>
                        <CoursePageLinkButton pageId={course.pageId} path="lms" variant="ghost" size="icon" className="h-8 w-8" title="Manage LMS Content">
                          <BookOpen className="h-4 w-4" />
                        </CoursePageLinkButton>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Bulk add students">
                          <Link href={`/dashboard/courses/${course.id}/bulk-enroll`}>
                            <UserPlus className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive h-8 w-8"
                          aria-label="Delete course"
                          title="Delete course"
                          onClick={() => setDeleteCourseId(course.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Full-width public share link, published courses only */}
                      {course.isPublished && (
                        <CopyLinkButton
                          display="full"
                          label="Course"
                          url={tenantWebBaseUrl ? `${tenantWebBaseUrl}/courses/${course.slug}` : ""}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            />
          )}

          {/* Empty State */}
          {!isLoading && !error && filteredCourses.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="text-muted-foreground/50 mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-medium">
                  {searchQuery ? "No courses found" : config.emptyTitle}
                </h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  {searchQuery ? "Try adjusting your search" : config.emptySubtitle}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!usage.allowedToAddOne}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {config.label} Course
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Course Dialog, mode is auto-set, no mode selector */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create {config.label} Course</DialogTitle>
            <DialogDescription>
              Set up the essentials. You can add curriculum, pricing, and other details in the editor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="course-title">Course Title</Label>
              <Input
                id="course-title"
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="e.g., Complete Python Masterclass"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCourseTitle.trim() && usage.allowedToAddOne) {
                    handleCreateCourse();
                  }
                }}
              />
              {slugPreview && (
                <p className="text-muted-foreground font-mono text-xs">/{slugPreview}</p>
              )}
            </div>

            <p className="text-muted-foreground text-xs">
              {usage.used} / {usage.isUnlimited ? "Unlimited" : usage.limit} {config.label.toLowerCase()} courses used
            </p>
          </div>

          <DialogFooter>
            {!usage.allowedToAddOne && (
              <p className="text-destructive w-full text-sm">
                {config.label} course limit reached. Upgrade your plan.
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewCourseTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCourse}
              disabled={createCourse.isPending || !newCourseTitle.trim() || !usage.allowedToAddOne}
            >
              {createCourse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCourseId} onOpenChange={(open) => !open && !deleteCourse.isPending && setDeleteCourseId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course Permanently</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deleteCourseId && (
                  <p>
                    You are about to delete{" "}
                    <span className="font-semibold text-foreground">
                      {coursesData?.courses?.find((c) => c.id === deleteCourseId)?.title || "this course"}
                    </span>.
                  </p>
                )}
                <p>This will permanently remove:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>All course curriculum (sections, lessons, and lectures)</li>
                  <li>All uploaded videos and associated storage</li>
                  <li>Student progress and enrollment data</li>
                  <li>The linked course page and its content</li>
                </ul>
                <p className="text-amber-600 font-medium text-sm">
                  This action is irreversible. All data will be permanently lost and cannot be recovered.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCourse.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={deleteCourse.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCourse.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

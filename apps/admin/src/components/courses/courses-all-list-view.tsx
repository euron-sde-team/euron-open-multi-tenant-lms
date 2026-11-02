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
  Input,
  useToast,
  PartOfBundleBadge,
} from "@open-mtlms/core";
import { decodeHtmlEntities } from "@open-mtlms/shared";
import {
  BookOpen,
  Edit,
  Eye,
  EyeOff,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { CoursePageLinkButton } from "@/components/courses/course-page-link-button";
import { SortableCardGrid } from "@/components/ordered-products/sortable-card-grid";
import { useCatalogOrdering } from "@/components/ordered-products/use-catalog-ordering";
import { resolveThumbnailForDisplay } from "@/lib/api/thumbnails";
import {
  useDeleteCourse,
  useToggleCoursePublish,
} from "@/lib/hooks/use-courses";
import {
  useInfiniteCoursesLms,
  type CourseModeFilter,
} from "@/lib/hooks/use-infinite-courses-lms";
import { useTenantStore } from "@/lib/stores/tenant-store";

const MODE_TABS: { value: CourseModeFilter; label: string; icon: typeof BookOpen }[] = [
  { value: "ALL", label: "All", icon: LayoutGrid },
  { value: "SELF_PACED", label: "Self-Paced", icon: BookOpen },
];

export function CoursesAllListView() {
  const { toast } = useToast();
  const { selectedTenantId } = useTenantStore();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [modeFilter, setModeFilter] = useState<CourseModeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteCoursesLms(selectedTenantId ?? undefined, modeFilter);

  const deleteCourse = useDeleteCourse();
  const togglePublish = useToggleCoursePublish();

  const courses = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.courses);
  }, [data?.pages]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  // Each tab is its own list, so each is arranged separately. Only "All" is
  // undraggable: it mixes tabs that the server orders independently, so there
  // is no single sequence to write.
  const orderableMode = modeFilter === "SELF_PACED" ? modeFilter : undefined;

  // Also blocked while more pages are unloaded. A reorder must name every
  // course in the mode; sending only the loaded ones would leave the rest
  // stranded, and the server rejects the partial set with 409 anyway.
  const ordering = useCatalogOrdering({
    entity: "courses",
    mode: orderableMode,
    isFiltered:
      !orderableMode || searchQuery.trim().length > 0 || hasNextPage === true,
    onSaved: () => void refetch(),
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          hasNextPage &&
          !isFetchingNextPage
        ) {
          fetchNextPage();
        }
      },
      { rootMargin: "120px", threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleDeleteCourse = () => {
    if (!deleteCourseId) return;
    deleteCourse.mutate(deleteCourseId, {
      onSuccess: () => {
        setDeleteCourseId(null);
        toast({ title: "Success", description: "Course deleted successfully." });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete course. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleTogglePublish = (
    courseId: string,
    currentStatus: boolean,
    pageId?: string | null
  ) => {
    setTogglingPublishId(courseId);
    togglePublish.mutate(
      { courseId, isPublished: !currentStatus, pageId },
      {
        onSuccess: () => {
          setTogglingPublishId(null);
          toast({
            title: "Success",
            description: currentStatus
              ? "Course unpublished."
              : "Course published successfully.",
          });
        },
        onError: () => {
          setTogglingPublishId(null);
          toast({
            title: "Error",
            description: "Failed to update course status.",
            variant: "destructive",
          });
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

  if (!selectedTenantId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Video className="text-muted-foreground/50 mb-4 h-12 w-12" />
          <p className="text-muted-foreground text-center">
            Please select a tenant to view and manage courses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">All Courses</h1>
          <p className="text-muted-foreground text-sm">
            View and manage all courses. Filter by mode.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/courses/self-paced">
            <Plus className="mr-2 h-4 w-4" />
            Create Course
          </Link>
        </Button>
      </div>

      {/* Mode filter tabs */}
      <div className="flex flex-wrap gap-2">
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.value}
              variant={modeFilter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setModeFilter(tab.value)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Failed to load courses</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Courses Grid */}
      {!isLoading && !isError && filteredCourses.length > 0 && (
        <SortableCardGrid
          items={filteredCourses}
          getId={(course) => course.id}
          getLabel={(course) => course.title}
          enabled={ordering.canDrag}
          onReorder={ordering.save}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          renderCard={(course) => (
            <Card key={course.id} className="group relative border-t-0">
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
                    above and the status/mode badges opposite. */}
                {course.bundles && course.bundles.length > 0 && (
                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <PartOfBundleBadge bundles={course.bundles} asLink={false} onImage />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <CoursePageLinkButton
                    pageId={course.pageId}
                    path="editor"
                    size="sm"
                    variant="secondary"
                  >
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </CoursePageLinkButton>
                  <CoursePageLinkButton
                    pageId={course.pageId}
                    path="lms"
                    size="sm"
                    variant="default"
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    LMS
                  </CoursePageLinkButton>
                </div>
              </div>

              <CardHeader className="pb-2">
                <CardTitle className="line-clamp-1 text-base">
                  {decodeHtmlEntities(course.title)}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  /{course.slug}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
                  <Badge variant={course.isPublished ? "default" : "secondary"}>
                    {course.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline" dot={false} className="text-muted-foreground">
                    {course.mode.charAt(0) + course.mode.slice(1).toLowerCase().replace("_", " ")}
                  </Badge>
              </div>

              <CardContent>
                <div className="space-y-3">
                  <div className="text-muted-foreground text-xs">
                    Updated {formatDate(course.updatedAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    {!course.isPublished ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-1"
                        disabled={togglingPublishId === course.id}
                        onClick={() =>
                          handleTogglePublish(
                            course.id,
                            course.isPublished,
                            course.pageId
                          )
                        }
                      >
                        {togglingPublishId === course.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        Publish
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1"
                        disabled={togglingPublishId === course.id}
                        onClick={() =>
                          handleTogglePublish(
                            course.id,
                            course.isPublished,
                            course.pageId
                          )
                        }
                      >
                        {togglingPublishId === course.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        Unpublish
                      </Button>
                    )}
                    <CoursePageLinkButton
                      pageId={course.pageId}
                      path="editor"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </CoursePageLinkButton>
                    <CoursePageLinkButton
                      pageId={course.pageId}
                      path="lms"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="LMS"
                    >
                      <BookOpen className="h-4 w-4" />
                    </CoursePageLinkButton>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                      title="Bulk add students"
                    >
                      <Link
                        href={`/dashboard/courses/${course.id}/bulk-enroll`}
                      >
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
                </div>
              </CardContent>
            </Card>
          )}
        />
      )}

      {/* Empty */}
      {!isLoading && !isError && filteredCourses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="text-muted-foreground/50 mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery ? "No courses found" : "No courses yet"}
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {searchQuery
                ? "Try adjusting your search"
                : "Create your first course to get started"}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/dashboard/courses/self-paced">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Course
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Infinite scroll trigger */}
      <div
        ref={loadMoreRef}
        className="flex min-h-[80px] items-center justify-center py-8"
      >
        {isFetchingNextPage && (
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteCourseId}
        onOpenChange={(open) => !open && setDeleteCourseId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this course? This will remove the
              course and its landing page. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCourse.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={deleteCourse.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCourse.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

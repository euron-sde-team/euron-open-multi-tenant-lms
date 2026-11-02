"use client";

import { Card, CardContent, Switch, useToast } from "@open-mtlms/core";
import { GraduationCap, Loader2 } from "lucide-react";

import {
  useEnrolledCoursesSettings,
  useUpdateEnrolledCoursesSettings,
} from "@/lib/hooks/use-enrolled-courses-settings";

export default function CourseAccessSettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useEnrolledCoursesSettings();
  const updateSettings = useUpdateEnrolledCoursesSettings();

  // Default OFF: when unset/loading, treat enrolled-only mode as disabled.
  const enrolledOnly = settings?.enrolled_courses_only_enabled ?? false;

  const handleToggle = (enabled: boolean) => {
    updateSettings.mutate(
      { enrolled_courses_only_enabled: enabled },
      {
        onSuccess: () => {
          toast({
            title: enabled
              ? "Showing enrolled courses only"
              : "Full course catalog enabled",
            description: enabled
              ? "Learners now only see the courses they are enrolled in."
              : "Learners can now browse your full course catalog again.",
          });
        },
        onError: (error) => {
          toast({
            title: "Could not update course access settings",
            description:
              error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Course access</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control which courses learners can browse across the web and mobile
          apps.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      Show only enrolled courses
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      When enabled, learners only see the courses they are
                      enrolled in, the public course catalog and explore
                      surfaces are hidden across the website and mobile app. This
                      applies to everyone, including subscribers. When disabled,
                      learners can browse your full catalog and discover new
                      courses.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enrolledOnly}
                  onCheckedChange={handleToggle}
                  disabled={updateSettings.isPending}
                  aria-label="Show only enrolled courses"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

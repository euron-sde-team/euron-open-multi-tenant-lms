"use client";

import { Card, CardContent, Switch, useToast } from "@open-mtlms/core";
import { Loader2, ListOrdered } from "lucide-react";

import { SequenceBuilder } from "@/components/settings/SequenceBuilder";
import {
  useSequenceSettings,
  useUpdateSequenceSettings,
} from "@/lib/hooks/use-course-sequence";

export default function CourseSettingsPage() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useSequenceSettings();
  const update = useUpdateSequenceSettings();

  const enabled = settings?.enabled ?? false;
  const chained = settings?.chained_courses ?? 0;

  const handleToggle = (next: boolean) => {
    update.mutate(next, {
      onSuccess: () =>
        toast({
          title: next ? "Sequential courses on" : "Sequential courses off",
          description: next
            ? "Learners must now finish each course before the next one opens."
            : "Every course is open again. Your course order is saved and comes back when you turn this on.",
        }),
      onError: (err) =>
        toast({
          title: "Couldn't update",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Control how learners move through your courses.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <ListOrdered className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Sequential courses</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                    Lock each course until the one before it is finished, so
                    learners move through them in order. Set the order below.
                    Turning this off unlocks everything immediately, your
                    order is kept, and comes back when you turn it on again.
                  </p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggle}
                disabled={update.isPending}
                aria-label="Sequential courses"
              />
            </div>

            {/* When off but chains exist: reassure nothing's lost. The builder
                below still shows and edits the order so it's ready for when
                they turn it back on. */}
            {!enabled && chained > 0 && (
              <p className="text-muted-foreground mt-4 pl-14 text-sm">
                Not enforced right now, everyone can start any course. The
                order below is saved and takes effect when you turn this on.
              </p>
            )}
          </CardContent>
        </Card>

        {/* The sequence builder, always available (build first, enable after). */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <SequenceBuilder />
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

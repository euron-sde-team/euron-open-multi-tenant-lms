"use client";

import { Button, Card, CardContent } from "@open-mtlms/core";
import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";

import { courseTemplates } from "@/components/course-editor";

export default function CourseTemplatesPage() {
  // Only Modern template is supported; no selection needed.
  const template = courseTemplates[0];
  if (!template) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-muted-foreground">No template configured.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/courses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Course Page Template</h1>
          <p className="text-muted-foreground">
            All course landing pages use the same template.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
            <div>
              <h3 className="font-semibold">{template.name}</h3>
              <p className="text-muted-foreground text-sm mt-1">{template.description}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/courses/templates/${template.id}/preview`}>
                <Eye className="mr-2 h-3 w-3" />
                Preview
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-muted-foreground text-sm">
            Course detail pages use a single, consistent layout. Edit any course to customize its content and pricing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

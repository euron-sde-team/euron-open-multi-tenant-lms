"use client";

import { Button } from "@open-mtlms/core";
import Link from "next/link";
import type { ComponentProps } from "react";

type CoursePageLinkButtonProps = Omit<
  ComponentProps<typeof Button>,
  "asChild"
> & {
  /** Landing page id (tenant_pages); null when the course has no page row. */
  pageId: string | null;
  /** Editor surface appended to /dashboard/courses/<pageId>. */
  path: "editor" | "lms";
};

/**
 * Edit/LMS buttons on course cards must link by PAGE id (tenant_pages), never
 * by course id: the editor routes read params.id as a page id and 404 on a
 * course id. When the page id is unknown, render a disabled button instead of
 * guessing.
 */
export function CoursePageLinkButton({
  pageId,
  path,
  children,
  title,
  ...buttonProps
}: CoursePageLinkButtonProps) {
  if (!pageId) {
    return (
      <Button
        {...buttonProps}
        disabled
        title="Landing page not found for this course"
      >
        {children}
      </Button>
    );
  }
  return (
    <Button {...buttonProps} asChild title={title}>
      <Link href={`/dashboard/courses/${pageId}/${path}`}>{children}</Link>
    </Button>
  );
}

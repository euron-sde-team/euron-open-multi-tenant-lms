"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@open-mtlms/core";

import { ProductLinker } from "./ProductLinker";

type ContentType = "courses" | "books" | "bundles";

interface ProductLinkerDialogProps {
  readonly contentType: ContentType;
  readonly contentId: string | undefined;
  readonly contentTitle: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function ProductLinkerDialog({
  contentType,
  contentId,
  contentTitle,
  open,
  onOpenChange,
}: ProductLinkerDialogProps) {
  const label =
    contentType === "courses"
      ? "Course"
      : contentType === "books"
        ? "Book"
        : "Bundle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Linked Products</DialogTitle>
          <DialogDescription>
            Manage products linked to{" "}
            <span className="font-medium text-foreground">{contentTitle}</span>.
            Users enrolled in this {label.toLowerCase()} will gain access to
            toggled-on products.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ProductLinker contentType={contentType} contentId={contentId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

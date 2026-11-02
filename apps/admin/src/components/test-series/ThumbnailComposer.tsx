"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@open-mtlms/core";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

// react-konva can't be server-rendered, load the editor client-side only.
const ThumbnailCanvas = dynamic(() => import("./ThumbnailCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  ),
});

export function ThumbnailComposer({
  open,
  onOpenChange,
  initialSrc,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialSrc?: string | null;
  onSave: (key: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px]">
        <DialogHeader>
          <DialogTitle>Design thumbnail</DialogTitle>
        </DialogHeader>
        {open && (
          <ThumbnailCanvas
            initialSrc={initialSrc}
            onSave={(key) => {
              onSave(key);
              onOpenChange(false);
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { SectionConfig, BookmarkPageContent } from "@open-mtlms/shared";
import { hasCustomSectionBackground } from "@open-mtlms/shared";

import { EditableText } from "@/components/editor/editable-text";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface BookmarkPageSectionProps {
  section: SectionConfig;
}

export function BookmarkPageSection({ section }: BookmarkPageSectionProps) {
  const content = section.content as BookmarkPageContent;
  const { updateSectionContent } = useEditorStore();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof BookmarkPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <EditableText
            value={content?.headline ?? "Your Bookmarks"}
            onChange={(v) => handleContentUpdate("headline", v)}
            as="h1"
            className="text-4xl font-bold tracking-tight sm:text-5xl"
          />
          <EditableText
            value={content?.subheadline ?? ""}
            onChange={(v) => handleContentUpdate("subheadline", v)}
            as="p"
            className="text-muted-foreground mt-4 text-lg"
            placeholder="Subheadline (optional)"
          />
        </div>

        <div className="mx-auto max-w-2xl rounded-xl border border-dashed bg-muted/30 p-12 text-center">
          <EditableText
            value={
              content?.emptyBookmarkMessage ??
              "No bookmarks yet. Save courses to find them here!"
            }
            onChange={(v) => handleContentUpdate("emptyBookmarkMessage", v)}
            as="p"
            className="text-muted-foreground"
            placeholder="Empty bookmark message"
          />
          <p className="text-muted-foreground mt-4 text-sm">
            Bookmarks are managed by the web app. This preview shows the empty state.
          </p>
        </div>
      </div>
    </section>
  );
}

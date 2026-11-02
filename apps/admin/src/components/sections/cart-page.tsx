"use client";

import type { SectionConfig, CartPageContent } from "@open-mtlms/shared";
import { hasCustomSectionBackground } from "@open-mtlms/shared";

import { EditableText } from "@/components/editor/editable-text";
import { useEditorStore } from "@/lib/stores/editor-store";
import { cn } from "@/lib/utils";

interface CartPageSectionProps {
  section: SectionConfig;
}

export function CartPageSection({ section }: CartPageSectionProps) {
  const content = section.content as CartPageContent;
  const { updateSectionContent } = useEditorStore();
  const hasCustomBg = hasCustomSectionBackground(section);

  const handleContentUpdate = (key: keyof CartPageContent, value: unknown) => {
    updateSectionContent(section.id, { [key]: value });
  };

  return (
    <section className={cn("py-16 md:py-24", hasCustomBg ? "bg-transparent" : "bg-background")}>
      <div className="container-custom">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <EditableText
            value={content?.headline ?? "Your Cart"}
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
            value={content?.emptyCartMessage ?? "Your cart is empty. Add courses to get started!"}
            onChange={(v) => handleContentUpdate("emptyCartMessage", v)}
            as="p"
            className="text-muted-foreground"
            placeholder="Empty cart message"
          />
          <p className="text-muted-foreground mt-4 text-sm">
            Cart items are managed by the web app. This preview shows the empty state.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-md text-center">
          <EditableText
            value={content?.checkoutButtonText ?? "Proceed to Checkout"}
            onChange={(v) => handleContentUpdate("checkoutButtonText", v)}
            as="span"
            className="inline-block rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground"
            placeholder="Checkout button text"
          />
        </div>
      </div>
    </section>
  );
}

"use client";

import type { PageLayoutOverrides } from "@open-mtlms/shared";
import { useEffect, useState } from "react";

import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { SectionRenderer } from "@/components/sections/section-renderer";
import {
  LIVE_PREVIEW_MESSAGE,
  LIVE_PREVIEW_READY,
  type LivePreviewPayload,
} from "@/lib/preview-messages";

/**
 * Live device preview target. Loaded in the editor's device-frame iframe and fed
 * the current page via postMessage, then rendered with the SAME LayoutWrapper +
 * SectionRenderer the Desktop inline preview uses. Because it's its own document,
 * the device-width viewport makes the storefront's responsive breakpoints resolve
 * correctly, while staying on the latest local code with real data and live edits.
 *
 * No dashboard chrome; not linkable/standalone (renders nothing until it receives
 * a message from its parent editor).
 */

/** Mirror the editor's special-slug layout overrides so chrome matches Desktop. */
function resolveOverrides(
  payload: LivePreviewPayload,
): PageLayoutOverrides | undefined {
  const { slug, layoutOverrides } = payload;
  if (slug === "login") {
    return { hideHeader: true, hideFooter: true, hideTopBar: true, hideSidebar: true };
  }
  if (slug === "blog" || slug.startsWith("blog/")) {
    return { ...layoutOverrides, hideHeader: true, hideTopBar: true, hideSidebar: true };
  }
  return layoutOverrides;
}

export default function LivePreviewPage() {
  const [payload, setPayload] = useState<LivePreviewPayload | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Same-origin only; ignore anything from other windows/extensions.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; payload?: LivePreviewPayload };
      if (data?.type === LIVE_PREVIEW_MESSAGE && data.payload) {
        setPayload(data.payload);
      }
    };
    window.addEventListener("message", onMessage);
    // Tell the parent editor we're mounted so it (re)sends the current state.
    window.parent?.postMessage({ type: LIVE_PREVIEW_READY }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!payload) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading preview…</p>
      </div>
    );
  }

  return (
    <LayoutWrapper
      layout={payload.layout}
      theme={payload.theme}
      layoutOverrides={resolveOverrides(payload)}
      isHomePage={payload.isHomePage}
      isEditing={false}
      sidebarTopOffset={0}
    >
      <SectionRenderer
        sections={payload.sections}
        theme={payload.theme}
        editMode={false}
      />
    </LayoutWrapper>
  );
}

import type {
  PageLayoutOverrides,
  SectionConfig,
  TenantLayout,
  ThemeConfig,
} from "@open-mtlms/shared";

/**
 * Same-origin postMessage contract between the page editor and the live device
 * preview iframe (`/preview/live`). This lets the device frames (SE/14/iPad/Pro)
 * render the editor's *current* state, same code, same data, live edits, in a
 * real device viewport, instead of loading the separately-deployed storefront.
 */

/** editor -> iframe: here is the current page to render. */
export const LIVE_PREVIEW_MESSAGE = "LMS_LIVE_PREVIEW";
/** iframe -> editor: I'm mounted, send me the current state. */
export const LIVE_PREVIEW_READY = "LMS_LIVE_PREVIEW_READY";

export interface LivePreviewPayload {
  sections: SectionConfig[];
  theme: ThemeConfig;
  layout: TenantLayout | null;
  slug: string;
  isHomePage: boolean;
  layoutOverrides?: PageLayoutOverrides;
}

export interface LivePreviewMessage {
  type: typeof LIVE_PREVIEW_MESSAGE;
  payload: LivePreviewPayload;
}

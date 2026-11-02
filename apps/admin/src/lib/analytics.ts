import { posthog } from "posthog-js";

export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | undefined>
) {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

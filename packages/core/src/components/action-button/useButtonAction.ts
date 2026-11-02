"use client";

/**
 * useButtonAction Hook
 *
 * The primary hook for executing button actions. Used by the ActionButton
 * component and can also be used directly in any template/component.
 *
 * Usage:
 *   const { execute, isLoading } = useButtonAction();
 *   await execute({ type: "enroll_course", params: { useCurrentCourse: true } });
 *
 * Or with a pre-configured action:
 *   const { execute, isLoading } = useButtonAction(myActionConfig);
 *   await execute(); // uses the pre-configured action
 */

import * as React from "react";
import type {
  ButtonActionConfig,
  ButtonActionResult,
  ButtonActionType,
} from "@open-mtlms/shared";
import { ButtonActionContext } from "./ButtonActionContext";

// ============================================================================
// Hook Return Type
// ============================================================================

interface UseButtonActionReturn {
  /** Execute an action (pass config or use pre-bound config) */
  execute: (config?: ButtonActionConfig) => Promise<ButtonActionResult>;
  /** Whether any action is currently being executed */
  isLoading: boolean;
  /** The specific action type currently executing */
  executingAction: ButtonActionType | null;
  /** Last execution result */
  result: ButtonActionResult | null;
  /** Reset the result state */
  resetResult: () => void;
  /** Whether the context is available (i.e., inside a provider) */
  isAvailable: boolean;
}

// ============================================================================
// Hook
// ============================================================================

function useButtonAction(
  /** Optional pre-bound action config */
  boundConfig?: ButtonActionConfig
): UseButtonActionReturn {
  const context = React.useContext(ButtonActionContext);
  const [result, setResult] = React.useState<ButtonActionResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [executingAction, setExecutingAction] = React.useState<ButtonActionType | null>(null);

  const execute = React.useCallback(
    async (config?: ButtonActionConfig): Promise<ButtonActionResult> => {
      const actionConfig = config ?? boundConfig;

      if (!actionConfig) {
        const errorResult: ButtonActionResult = {
          success: false,
          error: "No action configuration provided",
        };
        setResult(errorResult);
        return errorResult;
      }

      // If no provider context, handle navigate and external_link locally
      if (!context) {
        return handleFallbackAction(actionConfig);
      }

      setIsLoading(true);
      setExecutingAction(actionConfig.type);

      try {
        const actionResult = await context.executeAction(actionConfig);
        setResult(actionResult);
        return actionResult;
      } finally {
        setIsLoading(false);
        setExecutingAction(null);
      }
    },
    [context, boundConfig]
  );

  const resetResult = React.useCallback(() => {
    setResult(null);
  }, []);

  return {
    execute,
    isLoading: isLoading || (context?.isExecuting ?? false),
    executingAction: executingAction ?? context?.executingAction ?? null,
    result,
    resetResult,
    isAvailable: context !== null,
  };
}

// ============================================================================
// Fallback Handler (when no provider is present)
// ============================================================================

/**
 * Handles basic actions even without a provider context.
 * Supports navigate, external_link, and scroll_to_section out of the box.
 */
function handleFallbackAction(config: ButtonActionConfig): ButtonActionResult {
  switch (config.type) {
    case "navigate": {
      if (typeof window !== "undefined") {
        window.location.href = config.params.path;
      }
      return { success: true };
    }
    case "external_link": {
      if (typeof window !== "undefined") {
        const target = config.params.newTab !== false ? "_blank" : "_self";
        window.open(config.params.url, target, "noopener,noreferrer");
      }
      return { success: true };
    }
    case "scroll_to_section": {
      if (typeof window !== "undefined") {
        const element = document.getElementById(config.params.sectionId);
        if (element) {
          const offset = config.params.offset ?? 0;
          const top = element.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({
            top,
            behavior: config.params.behavior ?? "smooth",
          });
          return { success: true };
        }
        return { success: false, error: `Section "${config.params.sectionId}" not found` };
      }
      return { success: false, error: "Window not available" };
    }
    case "login": {
      if (typeof window !== "undefined") {
        const redirect = config.params.redirectPath
          ? `?redirect=${encodeURIComponent(config.params.redirectPath)}`
          : "";
        window.location.href = `/login${redirect}`;
      }
      return { success: true };
    }
    case "signup": {
      // Signup is handled on login page, redirect to /login
      if (typeof window !== "undefined") {
        const searchParams = new URLSearchParams();
        if (config.params.redirectPath) {
          searchParams.set("redirect", config.params.redirectPath);
        }
        if (config.params.defaultPlan) {
          searchParams.set("plan", config.params.defaultPlan);
        }
        const qs = searchParams.toString();
        window.location.href = `/login${qs ? `?${qs}` : ""}`;
      }
      return { success: true };
    }
    default:
      return {
        success: false,
        error: `No handler available for action type: "${config.type}". Wrap your app with <ButtonActionProvider>.`,
      };
  }
}

// ============================================================================
// Export
// ============================================================================

export { useButtonAction };
export type { UseButtonActionReturn };

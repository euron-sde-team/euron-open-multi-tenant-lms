"use client";

/**
 * ActionButton Component
 *
 * A universal button component that integrates with the Button Action System.
 * Use this anywhere in any template, it reads its action config and executes
 * the correct handler via the ButtonActionContext.
 *
 * Features:
 * - Automatic loading state management
 * - Fallback behavior for simple navigation (works without provider)
 * - Consistent styling via the existing shadcn Button component
 * - Icon support via lucide-react
 * - Full accessibility (disabled, aria-busy, etc.)
 *
 * Usage:
 *   <ActionButton
 *     action={{ type: "enroll_course", params: { useCurrentCourse: true } }}
 *     variant="primary"
 *   >
 *     Enroll Now
 *   </ActionButton>
 *
 * Or with an ActionButton config object:
 *   <ActionButton config={myActionButtonConfig} />
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
import type {
  ActionButton as ActionButtonType,
  ButtonActionConfig,
} from "@open-mtlms/shared";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "../ui/button";
import { useButtonAction } from "./useButtonAction";

// ============================================================================
// Variant Mapping
// ============================================================================

/** Maps ActionButton variants to shadcn Button variants */
const VARIANT_MAP: Record<
  ActionButtonType["variant"],
  ButtonProps["variant"]
> = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
};

/** Maps ActionButton sizes to shadcn Button sizes */
const SIZE_MAP: Record<
  NonNullable<ActionButtonType["size"]>,
  ButtonProps["size"]
> = {
  sm: "sm",
  md: "default",
  lg: "lg",
};

// ============================================================================
// Component Props
// ============================================================================

interface ActionButtonProps extends Omit<ButtonProps, "variant" | "size"> {
  /** Full ActionButton config object (alternative to individual props) */
  config?: ActionButtonType;

  /** Action config (if not using config prop) */
  action?: ButtonActionConfig;

  /** Visual variant */
  variant?: ActionButtonType["variant"];

  /** Button size */
  size?: ActionButtonType["size"];

  /** Loading text override */
  loadingText?: string;

  /** Callback after action execution */
  onActionComplete?: (result: { success: boolean; error?: string }) => void;

  /** Whether the button is in an editing context (prevents action execution) */
  isEditing?: boolean;

  /** Icon (lucide icon name or React node) */
  icon?: React.ReactNode;

  /** Icon position */
  iconPosition?: "left" | "right";
}

// ============================================================================
// Component
// ============================================================================

const ActionButtonComponent = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      config,
      action,
      variant = "primary",
      size = "md",
      loadingText,
      onActionComplete,
      isEditing = false,
      icon,
      iconPosition = "left",
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Resolve action from config or direct prop
    const resolvedAction = config?.action ?? action;
    const resolvedVariant = config?.variant ?? variant;
    const resolvedSize = config?.size ?? size;
    const resolvedLoadingText = config?.loadingText ?? loadingText;
    const resolvedDisabled = config?.disabled ?? disabled;
    const resolvedText = children ?? config?.text;

    // Hook into the action system
    const { execute, isLoading } = useButtonAction(resolvedAction);

    const handleClick = React.useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        // In edit mode, don't execute, just let the click bubble for inline editing
        if (isEditing) {
          e.preventDefault();
          return;
        }

        if (!resolvedAction) return;

        // For navigate and external_link with href, we might want to prevent default
        e.preventDefault();

        const result = await execute();
        onActionComplete?.(result);
      },
      [isEditing, resolvedAction, execute, onActionComplete]
    );

    // Don't render if explicitly hidden
    if (config?.visible === false) {
      return null;
    }

    const showLoadingState = isLoading && !isEditing;
    const buttonContent = showLoadingState ? (resolvedLoadingText ?? resolvedText) : resolvedText;

    return (
      <Button
        ref={ref}
        variant={VARIANT_MAP[resolvedVariant]}
        size={SIZE_MAP[resolvedSize]}
        disabled={resolvedDisabled || showLoadingState}
        aria-busy={showLoadingState}
        className={cn(className)}
        onClick={handleClick}
        {...props}
      >
        {showLoadingState && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {!showLoadingState && icon && iconPosition === "left" && (
          <span className="mr-2 inline-flex">{icon}</span>
        )}
        {buttonContent}
        {!showLoadingState && icon && iconPosition === "right" && (
          <span className="ml-2 inline-flex">{icon}</span>
        )}
      </Button>
    );
  }
);

ActionButtonComponent.displayName = "ActionButton";

// ============================================================================
// Export
// ============================================================================

export { ActionButtonComponent as ActionButton };
export type { ActionButtonProps };

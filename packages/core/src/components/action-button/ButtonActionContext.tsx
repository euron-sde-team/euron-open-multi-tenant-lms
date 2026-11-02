"use client";

/**
 * ButtonActionContext
 *
 * Provides action handlers to the entire component tree. Each app (web, admin, mobile)
 * wraps its root with <ButtonActionProvider> and supplies its own handler implementations.
 *
 * This ensures that every button in every template calls the same handler for
 * the same action type, regardless of which template renders it.
 *
 * Example usage in apps/web:
 *   <ButtonActionProvider handlers={webHandlers}>
 *     <AppContent />
 *   </ButtonActionProvider>
 *
 * Example usage in apps/admin:
 *   <ButtonActionProvider handlers={adminHandlers}>
 *     <EditorContent />
 *   </ButtonActionProvider>
 */

import * as React from "react";
import type {
  ButtonActionType,
  ButtonActionConfig,
  ButtonActionResult,
  ButtonActionHandlerMap,
} from "@open-mtlms/shared";

// ============================================================================
// Context Types
// ============================================================================

interface ButtonActionContextValue {
  /** Registered action handlers */
  handlers: ButtonActionHandlerMap;

  /** Execute an action, the main entry point for all buttons */
  executeAction: (config: ButtonActionConfig) => Promise<ButtonActionResult>;

  /** Whether an action is currently executing */
  isExecuting: boolean;

  /** The action type currently being executed (null if idle) */
  executingAction: ButtonActionType | null;

  /** Register additional handlers at runtime (e.g., for custom actions) */
  registerHandler: <T extends ButtonActionType>(
    type: T,
    handler: ButtonActionHandlerMap[T]
  ) => void;

  /** Unregister a handler */
  unregisterHandler: (type: ButtonActionType) => void;
}

// ============================================================================
// Context
// ============================================================================

const ButtonActionContext = React.createContext<ButtonActionContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

interface ButtonActionProviderProps {
  children: React.ReactNode;
  /** Initial map of action handlers for this app */
  handlers: ButtonActionHandlerMap;
  /** Global callback invoked after every action execution (for analytics, logging) */
  onActionExecuted?: (
    config: ButtonActionConfig,
    result: ButtonActionResult
  ) => void;
  /** Global error callback */
  onActionError?: (config: ButtonActionConfig, error: unknown) => void;
}

// ============================================================================
// Provider Component
// ============================================================================

function ButtonActionProvider({
  children,
  handlers: initialHandlers,
  onActionExecuted,
  onActionError,
}: ButtonActionProviderProps) {
  const [handlers, setHandlers] = React.useState<ButtonActionHandlerMap>(initialHandlers);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executingAction, setExecutingAction] = React.useState<ButtonActionType | null>(null);

  // Keep handlers in sync with parent prop changes
  React.useEffect(() => {
    setHandlers((prev) => ({ ...prev, ...initialHandlers }));
  }, [initialHandlers]);

  const registerHandler = React.useCallback(
    <T extends ButtonActionType>(type: T, handler: ButtonActionHandlerMap[T]) => {
      setHandlers((prev) => ({ ...prev, [type]: handler }));
    },
    []
  );

  const unregisterHandler = React.useCallback((type: ButtonActionType) => {
    setHandlers((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }, []);

  const executeAction = React.useCallback(
    async (config: ButtonActionConfig): Promise<ButtonActionResult> => {
      const handler = handlers[config.type] as
        | ((params: unknown) => Promise<ButtonActionResult>)
        | undefined;

      if (!handler) {
        const result: ButtonActionResult = {
          success: false,
          error: `No handler registered for action type: "${config.type}"`,
        };
        onActionError?.(config, new Error(result.error));
        return result;
      }

      setIsExecuting(true);
      setExecutingAction(config.type);

      try {
        const result = await handler(config.params);
        onActionExecuted?.(config, result);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error executing action";
        const result: ButtonActionResult = {
          success: false,
          error: errorMessage,
        };
        onActionError?.(config, err);
        return result;
      } finally {
        setIsExecuting(false);
        setExecutingAction(null);
      }
    },
    [handlers, onActionExecuted, onActionError]
  );

  const value = React.useMemo<ButtonActionContextValue>(
    () => ({
      handlers,
      executeAction,
      isExecuting,
      executingAction,
      registerHandler,
      unregisterHandler,
    }),
    [handlers, executeAction, isExecuting, executingAction, registerHandler, unregisterHandler]
  );

  return (
    <ButtonActionContext.Provider value={value}>
      {children}
    </ButtonActionContext.Provider>
  );
}

// ============================================================================
// Export
// ============================================================================

export { ButtonActionContext, ButtonActionProvider };
export type { ButtonActionContextValue, ButtonActionProviderProps };

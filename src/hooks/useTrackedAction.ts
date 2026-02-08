import { useCallback, useRef, useState } from "react";

interface TrackedActionOptions {
  /** When true, re-throw after calling showError so callers can react to the failure. */
  rethrow?: boolean;
}

/**
 * Wraps an async action with automatic pending-state tracking and error display.
 *
 * On error the action calls `showError`. If `rethrow` is set, it also re-throws
 * so callers that need to know about the failure (e.g. form panels that stay
 * open on error) can catch it.
 *
 * Returns `[execute, pending]` — a wrapped version of `action` and a boolean
 * that is `true` while the action is in flight.
 *
 * The returned `execute` function is referentially stable (safe for deps arrays).
 */
export function useTrackedAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
  showError: (err: unknown) => void,
  options?: TrackedActionOptions,
): [(...args: Args) => Promise<void>, boolean] {
  const [pending, setPending] = useState(false);

  // Keep refs so the returned callback is stable across renders.
  const actionRef = useRef(action);
  actionRef.current = action;
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const rethrowRef = useRef(options?.rethrow);
  rethrowRef.current = options?.rethrow;

  const execute = useCallback(async (...args: Args) => {
    setPending(true);
    try {
      await actionRef.current(...args);
    } catch (err) {
      showErrorRef.current(err);
      if (rethrowRef.current) throw err;
    } finally {
      setPending(false);
    }
  }, []);

  return [execute, pending];
}

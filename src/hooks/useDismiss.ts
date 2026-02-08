import { type RefObject, useEffect } from "react";

/**
 * Dismiss a popover/dropdown on outside click or Escape key.
 *
 * Registers document-level `mousedown` and `keydown` listeners that call
 * `onDismiss` when the user clicks outside `containerRef` or presses Escape.
 * Both listeners are cleaned up on unmount.
 *
 * Pass `enabled: false` to skip listener registration (e.g. when a dropdown
 * is closed). The hook must still be called unconditionally per Rules of Hooks.
 */
export function useDismiss(
  containerRef: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    function handleMouseDown(e: MouseEvent) {
      const container = containerRef.current;
      if (container && !container.contains(e.target as Node)) {
        onDismiss();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, onDismiss, enabled]);
}

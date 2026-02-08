import { useEffect } from "react";

/**
 * Registers global keyboard shortcuts that work across the app.
 *
 * - Cmd/Ctrl+K always fires (standard command palette behavior, even from inputs).
 * - Cmd/Ctrl+Shift+N is suppressed when typing in form fields to avoid hijacking text entry.
 */
export function useGlobalShortcuts(shortcuts: {
  onSearch: () => void;
  onCreateIssue: () => void;
}) {
  useEffect(() => {
    function isFormField(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }

    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K → Search (always fires, even from inputs)
      if (mod && e.key === "k") {
        e.preventDefault();
        shortcuts.onSearch();
        return;
      }

      // Cmd/Ctrl + Shift + N → Quick create (suppressed in form fields)
      if (mod && e.shiftKey && e.key === "N") {
        if (isFormField(e.target)) return;
        e.preventDefault();
        shortcuts.onCreateIssue();
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

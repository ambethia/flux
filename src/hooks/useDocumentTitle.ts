import { useEffect } from "react";

/**
 * Sets `document.title` to `"<title> - Flux"`.
 *
 * Pass `undefined` to skip setting the title — this lets a child component's
 * title take precedence (React fires child effects before parent effects, so a
 * parent that passes `undefined` won't overwrite the child's title).
 *
 * Resets to `"Flux"` on unmount so stale titles don't linger after navigation.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (title === undefined) return;
    document.title = `${title} - Flux`;
    return () => {
      document.title = "Flux";
    };
  }, [title]);
}

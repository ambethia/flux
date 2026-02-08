import { useEffect } from "react";

/**
 * Sets `document.title` to `"<title> - Flux"`, or just `"Flux"` when no title is provided.
 * Resets to `"Flux"` on unmount so stale titles don't linger.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} - Flux` : "Flux";
    return () => {
      document.title = "Flux";
    };
  }, [title]);
}

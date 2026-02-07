/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function start() {
  const res = await fetch("/api/config");
  if (!res.ok) {
    throw new Error(`Failed to fetch /api/config: ${res.status}`);
  }
  const { convexUrl } = (await res.json()) as { convexUrl: string };

  const convex = new ConvexReactClient(convexUrl);
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}

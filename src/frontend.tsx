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
  // NOTE: Avoid destructuring projectId — Bun's HMR bundler tree-shakes
  // destructured vars it fails to trace through JSX props across modules.
  const config = (await res.json()) as {
    convexUrl: string;
    projectId: string;
  };

  const convex = new ConvexReactClient(config.convexUrl);
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <ConvexProvider client={convex}>
      <App projectId={config.projectId} />
    </ConvexProvider>,
  );
}

function handleStartupError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const root = document.getElementById("root");
  if (root) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:center;justify-content:center;height:100vh";
    const pre = document.createElement("pre");
    pre.style.cssText = "color:red;max-width:600px;white-space:pre-wrap";
    pre.textContent = `Startup failed: ${msg}`;
    wrapper.appendChild(pre);
    root.replaceChildren(wrapper);
  }
  throw err;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () =>
    start().catch(handleStartupError),
  );
} else {
  start().catch(handleStartupError);
}

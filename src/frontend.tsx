/**
 * Entry point for the React app. Fetches config from the Bun API server,
 * initialises Convex, and renders the App component.
 *
 * Loaded by index.html via Vite.
 */

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

async function start() {
  const res = await fetch("/api/config");
  if (!res.ok) {
    throw new Error(`Failed to fetch /api/config: ${res.status}`);
  }
  const data: unknown = await res.json();
  if (
    !data ||
    typeof data !== "object" ||
    !("convexUrl" in data) ||
    typeof (data as Record<string, unknown>).convexUrl !== "string"
  ) {
    const shape = JSON.stringify(data).slice(0, 200);
    throw new Error(
      `Server returned unexpected config format — restart the Bun server.\nExpected { convexUrl }, got: ${shape}`,
    );
  }
  const { convexUrl } = data as { convexUrl: string };

  const convex = new ConvexReactClient(convexUrl);
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Missing #root element in document");
  const root = createRoot(rootEl);
  root.render(
    <ConvexProvider client={convex}>
      <App />
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

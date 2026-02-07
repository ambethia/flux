import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Id } from "$convex/_generated/dataModel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createAppRouter } from "./lib/router";
import "./index.css";

interface AppProps {
  projectId: string;
}

export function App({ projectId }: AppProps) {
  const router = useMemo(
    () => createAppRouter({ projectId: projectId as Id<"projects"> }),
    [projectId],
  );

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

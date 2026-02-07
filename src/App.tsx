import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Id } from "$convex/_generated/dataModel";
import { createAppRouter } from "./lib/router";
import "./index.css";

export function App({ projectId }: { projectId: string }) {
  const router = useMemo(
    () => createAppRouter({ projectId: projectId as Id<"projects"> }),
    [projectId],
  );

  return <RouterProvider router={router} />;
}

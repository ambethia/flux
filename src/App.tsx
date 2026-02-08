import { RouterProvider } from "@tanstack/react-router";
import { useMemo } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { createAppRouter } from "./lib/router";
import "./index.css";

export function App() {
  const router = useMemo(() => createAppRouter(), []);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

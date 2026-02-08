import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { NotFound } from "../components/NotFound";
import { ProjectLayout } from "../components/ProjectLayout";
import { ProjectsLayout } from "../components/ProjectsLayout";
import { RootLayout } from "../components/RootLayout";
import { RouteError } from "../components/RouteError";
import { ActivityPage } from "../pages/ActivityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { IssueDetailPage } from "../pages/IssueDetailPage";
import { IssuesPage } from "../pages/IssuesPage";
import { LabelsPage } from "../pages/LabelsPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SessionDetailPage } from "../pages/SessionDetailPage";
import { SessionsPage } from "../pages/SessionsPage";
import { SettingsPage } from "../pages/SettingsPage";

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
  errorComponent: RouteError,
});

const projectsLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsLayout,
  errorComponent: RouteError,
});

const projectsIndexRoute = createRoute({
  getParentRoute: () => projectsLayoutRoute,
  path: "/",
  component: ProjectsPage,
  errorComponent: RouteError,
});

/** Layout route: resolves projectSlug → projectId via Convex query. */
const projectLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/p/$projectSlug",
  component: ProjectLayout,
  errorComponent: RouteError,
});

const issuesRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/issues",
  component: IssuesPage,
  errorComponent: RouteError,
});

const issueDetailRoute = createRoute({
  getParentRoute: () => issuesRoute,
  path: "$issueId",
  component: IssueDetailPage,
  errorComponent: RouteError,
});

const activityRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/activity",
  component: ActivityPage,
  errorComponent: RouteError,
});

const sessionsRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/sessions",
  component: SessionsPage,
  errorComponent: RouteError,
});

const sessionDetailRoute = createRoute({
  getParentRoute: () => sessionsRoute,
  path: "$sessionId",
  component: SessionDetailPage,
  errorComponent: RouteError,
});

const labelsRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/labels",
  component: LabelsPage,
  errorComponent: RouteError,
});

const settingsRoute = createRoute({
  getParentRoute: () => projectLayoutRoute,
  path: "/settings",
  component: SettingsPage,
  errorComponent: RouteError,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  projectsLayoutRoute.addChildren([projectsIndexRoute]),
  projectLayoutRoute.addChildren([
    issuesRoute.addChildren([issueDetailRoute]),
    activityRoute,
    sessionsRoute.addChildren([sessionDetailRoute]),
    labelsRoute,
    settingsRoute,
  ]),
]);

export function createAppRouter() {
  return createRouter({ routeTree });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

import { Outlet, useRouteContext, useRouter } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useIssueNotifications } from "../hooks/useIssueNotifications";
import {
  NotificationProvider,
  useNotifications,
} from "../hooks/useNotifications";
import { SSEProvider } from "../hooks/useSSE";
import {
  CreateIssueModal,
  type CreateIssueModalHandle,
} from "./CreateIssueModal";
import { Navbar } from "./Navbar";
import { SearchModal, type SearchModalHandle } from "./SearchModal";
import { Sidebar } from "./Sidebar";

/** Watches issue status transitions and fires browser notifications. */
function IssueNotificationWatcher() {
  const { projectId } = useRouteContext({ from: "__root__" });
  const { notify, ready } = useNotifications();
  const { navigate } = useRouter();
  useIssueNotifications(projectId, notify, ready, navigate);
  return null;
}

export function AppShell() {
  const searchRef = useRef<SearchModalHandle>(null);
  const createRef = useRef<CreateIssueModalHandle>(null);

  const shortcuts = useMemo(
    () => ({
      onSearch: () => searchRef.current?.open(),
      onCreateIssue: () => createRef.current?.open(),
    }),
    [],
  );
  useGlobalShortcuts(shortcuts);

  return (
    <NotificationProvider>
      <SSEProvider>
        <IssueNotificationWatcher />
        <div className="drawer lg:drawer-open">
          <input id="app-drawer" type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex flex-col">
            <Navbar onSearchClick={shortcuts.onSearch} />
            <main className="grow p-6">
              <Outlet />
            </main>
          </div>
          <div className="drawer-side">
            <label
              htmlFor="app-drawer"
              aria-label="close sidebar"
              className="drawer-overlay"
            />
            <Sidebar />
          </div>
        </div>

        <SearchModal ref={searchRef} />
        <CreateIssueModal ref={createRef} showButton={false} />
      </SSEProvider>
    </NotificationProvider>
  );
}

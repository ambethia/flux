import type { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <div className="drawer lg:drawer-open">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex flex-col">
        <Navbar />
        <main className="grow p-6">{children}</main>
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
  );
}

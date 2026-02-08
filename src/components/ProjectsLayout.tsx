import { Link, Outlet } from "@tanstack/react-router";

/**
 * Minimal layout for the top-level /projects page.
 * No sidebar or project context — just a navbar with a brand link.
 */
export function ProjectsLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="navbar w-full bg-base-300">
        <div className="flex-1 px-4">
          <Link to="/" className="font-bold text-lg hover:opacity-80">
            Flux
          </Link>
        </div>
      </div>
      <main className="grow p-6">
        <Outlet />
      </main>
    </div>
  );
}

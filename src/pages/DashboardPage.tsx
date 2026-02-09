import { Link } from "@tanstack/react-router";
import { ProjectDashboard } from "../components/ProjectDashboard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function DashboardPage() {
  useDocumentTitle("Dashboard");

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
        <ProjectDashboard />
      </main>
    </div>
  );
}

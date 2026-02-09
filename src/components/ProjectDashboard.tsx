import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "$convex/_generated/api";
import { AddProjectForm } from "./AddProjectForm";
import { FontAwesomeIcon, faPlus } from "./Icon";
import { ProjectCard } from "./ProjectCard";

export function ProjectDashboard() {
  const projects = useQuery(api.projects.listWithStats, {});
  const [showAdd, setShowAdd] = useState(false);

  if (projects === undefined) {
    return (
      <div className="flex justify-center p-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (projects.length === 0 && !showAdd) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-base-content/60 text-lg">
          No projects yet. Add one to get started.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAdd(true)}
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          Add Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Projects</h1>
        {!showAdd && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAdd(true)}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            Add Project
          </button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border border-base-300 bg-base-200 p-4">
          <AddProjectForm onCreated={() => setShowAdd(false)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} />
        ))}
      </div>
    </div>
  );
}

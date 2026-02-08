import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "$convex/_generated/api";
import { AddProjectForm } from "./AddProjectForm";
import { FontAwesomeIcon, faPlus } from "./Icon";
import { ProjectRow } from "./ProjectRow";

export function ProjectList() {
  const projects = useQuery(api.projects.list, {});
  const [showAdd, setShowAdd] = useState(false);

  if (projects === undefined) {
    return (
      <div className="flex justify-center p-8">
        <span className="loading loading-spinner loading-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-xl">Projects</h1>
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

      {projects.length === 0 ? (
        <p className="text-base-content/60">No projects yet. Add one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-zebra table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Path</th>
                <th>State</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <ProjectRow key={project._id} project={project} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

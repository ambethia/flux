import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "$convex/_generated/api";
import type { Id } from "$convex/_generated/dataModel";
import { useDismissableError } from "../hooks/useDismissableError";
import { useUpdateProject } from "../hooks/useUpdateProject";
import { ErrorBanner } from "./ErrorBanner";
import { FontAwesomeIcon, faBolt, faPen, faTrash } from "./Icon";
import { ProjectStateBadge } from "./ProjectStateBadge";

interface ProjectWithStats {
  _id: Id<"projects">;
  name: string;
  slug: string;
  path?: string;
  worktreeBase?: string;
  enabled?: boolean;
  openIssueCount: number;
  activeSessionCount: number;
}

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  const { save: saveProject, saving } = useUpdateProject(project._id);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [slugDraft, setSlugDraft] = useState(project.slug);
  const [pathDraft, setPathDraft] = useState(project.path ?? "");
  const [worktreeBaseDraft, setWorktreeBaseDraft] = useState(
    project.worktreeBase ?? "",
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { error, showError, clearError } = useDismissableError();

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setNameDraft(project.name);
    setSlugDraft(project.slug);
    setPathDraft(project.path ?? "");
    setWorktreeBaseDraft(project.worktreeBase ?? "");
    setConfirmDelete(false);
    setEditing(true);
    clearError();
  }

  function cancelEdit() {
    setEditing(false);
    clearError();
  }

  async function saveEdit() {
    if (saving) return;

    const trimmedName = nameDraft.trim();
    const trimmedSlug = slugDraft.trim();
    const trimmedPath = pathDraft.trim();
    const trimmedWorktreeBase = worktreeBaseDraft.trim();

    if (!trimmedName || !trimmedSlug) {
      showError("Name and slug are required");
      return;
    }

    const nameChanged = trimmedName !== project.name;
    const slugChanged = trimmedSlug !== project.slug;
    const pathChanged = trimmedPath !== (project.path ?? "");
    const worktreeBaseChanged =
      trimmedWorktreeBase !== (project.worktreeBase ?? "");

    if (!nameChanged && !slugChanged && !pathChanged && !worktreeBaseChanged) {
      setEditing(false);
      return;
    }

    try {
      await saveProject({
        ...(nameChanged ? { name: trimmedName } : {}),
        ...(slugChanged ? { slug: trimmedSlug } : {}),
        ...(pathChanged ? { path: trimmedPath } : {}),
        ...(worktreeBaseChanged ? { worktreeBase: trimmedWorktreeBase } : {}),
      });
      setEditing(false);
      clearError();
    } catch (err) {
      showError(err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  async function handleEnabledToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    clearError();
    try {
      await updateProject({
        projectId: project._id,
        enabled: !(project.enabled ?? false),
      });
    } catch (err) {
      showError(err);
    }
  }

  async function handleDelete() {
    try {
      await removeProject({ projectId: project._id });
    } catch (err) {
      showError(err);
      setConfirmDelete(false);
    }
  }

  function onDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(true);
  }

  if (editing) {
    return (
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body gap-3">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Name</legend>
            <input
              ref={nameInputRef}
              type="text"
              className="input input-sm w-full"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Project name"
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Slug</legend>
            <input
              type="text"
              className="input input-sm w-full font-mono text-xs"
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="project-slug"
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Path</legend>
            <input
              type="text"
              className="input input-sm w-full font-mono text-xs"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="/path/to/repo"
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Worktree Base</legend>
            <input
              type="text"
              className="input input-sm w-full font-mono text-xs"
              value={worktreeBaseDraft}
              onChange={(e) => setWorktreeBaseDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="/path/to/worktrees"
            />
          </fieldset>
          <ErrorBanner error={error} onDismiss={clearError} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveEdit}
              disabled={saving}
            >
              {saving && (
                <span className="loading loading-spinner loading-xs" />
              )}
              Save
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/p/$projectSlug/issues"
      params={{ projectSlug: project.slug }}
      className="card bg-base-200 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="card-body gap-3">
        <div className="flex items-start justify-between">
          <h2 className="card-title text-lg">{project.name}</h2>
          <div className="flex items-center gap-2">
            {project.activeSessionCount > 0 && (
              <span
                className="animate-pulse text-success"
                title={`${project.activeSessionCount} active session${project.activeSessionCount === 1 ? "" : "s"}`}
              >
                <FontAwesomeIcon icon={faBolt} aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={startEdit}
              aria-label="Edit project"
              title="Edit project"
            >
              <FontAwesomeIcon icon={faPen} aria-hidden="true" />
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn btn-error btn-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error"
                onClick={onDeleteClick}
                aria-label="Remove project"
                title="Remove project"
              >
                <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleEnabledToggle}
            className="z-10"
            aria-label={`${(project.enabled ?? false) ? "Disable" : "Enable"} project`}
          >
            <ProjectStateBadge enabled={project.enabled} />
          </button>
          <span className="text-base-content/60 text-sm">
            {project.openIssueCount} open{" "}
            {project.openIssueCount === 1 ? "issue" : "issues"}
          </span>
        </div>
        {project.path && (
          <code
            className="block truncate text-base-content/40 text-xs"
            title={project.path}
          >
            {project.path}
          </code>
        )}
        {project.worktreeBase && (
          <code
            className="block truncate text-base-content/40 text-xs"
            title={project.worktreeBase}
          >
            wt: {project.worktreeBase}
          </code>
        )}
        <ErrorBanner error={error} onDismiss={clearError} />
      </div>
    </Link>
  );
}

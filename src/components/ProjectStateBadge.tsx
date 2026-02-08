import type { ProjectStateValue } from "$convex/schema";
import { ProjectState } from "$convex/schema";
import { Icon } from "./Icon";

const STATE_CONFIG: Record<
  ProjectStateValue,
  { label: string; className: string; icon: string }
> = {
  [ProjectState.Running]: {
    label: "Running",
    className: "badge-soft badge-success",
    icon: "fa-circle-play",
  },
  [ProjectState.Paused]: {
    label: "Paused",
    className: "badge-soft badge-warning",
    icon: "fa-circle-pause",
  },
  [ProjectState.Stopped]: {
    label: "Stopped",
    className: "badge-ghost",
    icon: "fa-stop",
  },
};

export function ProjectStateBadge({
  state,
}: {
  state: ProjectStateValue | undefined;
}) {
  const resolved = state ?? ProjectState.Stopped;
  const config = STATE_CONFIG[resolved];
  return (
    <span className={`badge badge-sm gap-1 ${config.className}`}>
      <Icon name={config.icon} />
      {config.label}
    </span>
  );
}

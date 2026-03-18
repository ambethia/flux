import { Link } from "@tanstack/react-router";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "$convex/_generated/api";
import type { IssuePriorityValue } from "$convex/schema";
import { SessionStatus } from "$convex/schema";
import { NudgeInput } from "../components/NudgeInput";
import { PriorityBadge } from "../components/PriorityBadge";
import { SessionStatusBadge } from "../components/SessionStatusBadge";
import { SessionTranscript } from "../components/SessionTranscript";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useProjectId, useProjectSlug } from "../hooks/useProjectId";
import { useSSE } from "../hooks/useSSE";
import { useStickyScrollParent } from "../hooks/useStickyScroll";
import { phaseLabel, typeLabel } from "../lib/format";
import {
  groupTranscriptEvents,
  isDisplayableEvent,
} from "../lib/groupTranscriptEvents";

/** Format seconds into a compact human-readable string (e.g. "3m 12s"). */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/** Live elapsed time counter that ticks every second while the session is running. */
function ElapsedTime({
  startedAt,
  endedAt,
}: {
  startedAt: number;
  endedAt?: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (endedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endedAt]);

  const elapsed = Math.max(
    0,
    Math.floor(((endedAt ?? now) - startedAt) / 1000),
  );
  return <span>{formatElapsed(elapsed)}</span>;
}

/**
 * Living dashboard header — summarizes the current session/issue at a glance.
 * Updates in real-time as the runner progresses through issues.
 */
function DashboardHeader({
  session,
}: {
  session: {
    issueShortId: string | null;
    issueTitle: string | null;
    issuePriority: IssuePriorityValue | null;
    issueStatus: string | null;
    issueId: string;
    agent: string;
    type: string;
    phase?: string;
    status: string;
    startedAt: number;
    endedAt?: number;
    turns?: number;
    tokens?: number;
    toolCalls?: number;
    cost?: number;
    model?: string;
  };
}) {
  const projectSlug = useProjectSlug();

  return (
    <div className="rounded-lg border border-base-300 bg-base-200 p-4">
      {/* Issue row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {session.issueShortId && (
          <Link
            to="/p/$projectSlug/issues/$issueId"
            params={{ projectSlug, issueId: session.issueId }}
            className="link link-hover font-mono font-semibold text-sm"
          >
            {session.issueShortId}
          </Link>
        )}
        {session.issueTitle && (
          <span className="min-w-0 truncate text-sm">{session.issueTitle}</span>
        )}
        {session.issuePriority && (
          <PriorityBadge priority={session.issuePriority} />
        )}
      </div>

      {/* Session stats row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base-content/60 text-xs">
        <span className="flex items-center gap-1">
          <SessionStatusBadge
            status={session.status as "running" | "completed" | "failed"}
          />
        </span>
        <span>{typeLabel(session.type as "work" | "review")}</span>
        {session.phase && (
          <span>
            {phaseLabel(session.phase as "work" | "retro" | "review")}
          </span>
        )}
        <span>{session.agent}</span>
        {session.model && <span className="font-mono">{session.model}</span>}
        <ElapsedTime startedAt={session.startedAt} endedAt={session.endedAt} />
        {session.turns !== undefined && <span>{session.turns} turns</span>}
        {session.tokens !== undefined && (
          <span>{session.tokens.toLocaleString()} tokens</span>
        )}
        {session.toolCalls !== undefined && (
          <span>{session.toolCalls} tools</span>
        )}
        {session.cost !== undefined && <span>${session.cost.toFixed(4)}</span>}
      </div>
    </div>
  );
}

export function ActivityPage() {
  useDocumentTitle("Activity");
  const projectId = useProjectId();
  const projectSlug = useProjectSlug();
  const { connected } = useSSE();

  // Query for the active running session (reactive — updates in real-time)
  const activeSession = useQuery(api.sessions.getActiveWithIssue, {
    projectId,
  });

  // Query session events when we have an active session
  const {
    results: events,
    status: paginationStatus,
    loadMore,
  } = usePaginatedQuery(
    api.sessionEvents.listPaginated,
    activeSession ? { sessionId: activeSession._id } : "skip",
    { initialNumItems: 200 },
  );

  const displayableEvents = useMemo(
    () =>
      events.filter((event) =>
        isDisplayableEvent(
          event.direction,
          event.content,
          activeSession?.agent,
        ),
      ),
    [events, activeSession?.agent],
  );

  const transcriptNodes = useMemo(
    () => groupTranscriptEvents(displayableEvents, activeSession?.agent),
    [displayableEvents, activeSession?.agent],
  );

  const handleLoadMore = useCallback(() => loadMore(200), [loadMore]);

  // Sticky auto-scroll: pin the parent <main> scroll container to the bottom
  // as new transcript events arrive.
  const stickyRef = useStickyScrollParent(events.length);

  const isRunning = activeSession?.status === SessionStatus.Running;

  return (
    <div ref={stickyRef} className="flex h-full flex-col">
      {/* Header bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-xl">Activity</h1>
          <span
            className={`badge badge-sm ${connected ? "badge-success" : "badge-error"}`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        {activeSession && (
          <Link
            to="/p/$projectSlug/sessions/$sessionId"
            params={{ projectSlug, sessionId: activeSession._id }}
            className="btn btn-ghost btn-xs"
          >
            Session Detail
          </Link>
        )}
      </div>

      {/* Living dashboard header */}
      {activeSession ? (
        <div className="mb-3">
          <DashboardHeader session={activeSession} />
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-base-300 bg-base-200 px-4 py-6 text-center text-base-content/40">
          {activeSession === undefined ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <span className="italic">
              No active session — waiting for the runner to pick up an issue
            </span>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="min-h-0 grow">
        {activeSession ? (
          <SessionTranscript
            nodes={transcriptNodes}
            eventCount={displayableEvents.length}
            paginationStatus={paginationStatus}
            onLoadMore={handleLoadMore}
          />
        ) : activeSession === undefined ? (
          <div className="flex justify-center p-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : null}
      </div>

      {/* Nudge input — only when a session is active */}
      {isRunning && (
        <div className="sticky bottom-0 border-base-300 border-t bg-base-100 px-1 py-3">
          <NudgeInput />
        </div>
      )}
    </div>
  );
}

import { formatTime } from "../lib/format";

interface IssueMetadataProps {
  shortId: string;
  creationTime: number;
  updatedAt?: number;
  closedAt?: number;
  assignee?: string;
  failureCount: number;
  reviewIterations?: number;
}

export function IssueMetadata({
  shortId,
  creationTime,
  updatedAt,
  closedAt,
  assignee,
  failureCount,
  reviewIterations,
}: IssueMetadataProps) {
  return (
    <div className="rounded-lg bg-base-200 p-4">
      <h3 className="mb-3 font-medium text-base-content/60 text-sm">
        Metadata
      </h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-base-content/60">ID</dt>
        <dd className="font-mono">{shortId}</dd>

        <dt className="text-base-content/60">Created</dt>
        <dd>{formatTime(creationTime)}</dd>

        {updatedAt && (
          <>
            <dt className="text-base-content/60">Updated</dt>
            <dd>{formatTime(updatedAt)}</dd>
          </>
        )}

        {closedAt && (
          <>
            <dt className="text-base-content/60">Closed</dt>
            <dd>{formatTime(closedAt)}</dd>
          </>
        )}

        {assignee && (
          <>
            <dt className="text-base-content/60">Assignee</dt>
            <dd>{assignee}</dd>
          </>
        )}

        <dt className="text-base-content/60">Failures</dt>
        <dd>{failureCount}</dd>

        {(reviewIterations ?? 0) > 0 && (
          <>
            <dt className="text-base-content/60">Review Iterations</dt>
            <dd>{reviewIterations}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

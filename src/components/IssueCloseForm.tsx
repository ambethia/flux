import { useState } from "react";
import type { CloseTypeValue } from "$convex/schema";
import { CloseType } from "$convex/schema";
import { FontAwesomeIcon, faCircleXmark } from "./Icon";

export const CLOSE_TYPE_LABELS: Record<CloseTypeValue, string> = {
  [CloseType.Completed]: "Completed",
  [CloseType.Wontfix]: "Won't Fix",
  [CloseType.Duplicate]: "Duplicate",
  [CloseType.Noop]: "No-op",
};

interface IssueCloseFormProps {
  busy: boolean;
  saving: boolean;
  onClose: (
    closeType: CloseTypeValue,
    closeReason: string | undefined,
  ) => Promise<void>;
}

export function IssueCloseForm({ busy, saving, onClose }: IssueCloseFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [closeType, setCloseType] = useState<CloseTypeValue>(
    CloseType.Completed,
  );
  const [closeReason, setCloseReason] = useState("");

  async function handleClose() {
    try {
      await onClose(closeType, closeReason.trim() || undefined);
      setShowForm(false);
      setCloseReason("");
    } catch {
      // Parent handles error display — keep form open so user doesn't lose input
    }
  }

  if (!showForm) {
    return (
      <div>
        <button
          type="button"
          className="btn btn-outline btn-error btn-sm"
          onClick={() => setShowForm(true)}
          disabled={busy}
        >
          <FontAwesomeIcon icon={faCircleXmark} aria-hidden="true" />
          Close Issue
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-error/30 bg-base-200 p-4">
        <h3 className="font-medium">Close Issue</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="close-type-select" className="font-medium text-sm">
            Type:
          </label>
          <select
            id="close-type-select"
            className="select select-sm"
            value={closeType}
            onChange={(e) => setCloseType(e.target.value as CloseTypeValue)}
            disabled={busy}
          >
            {Object.entries(CLOSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className="textarea"
          placeholder="Reason (optional)"
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          rows={2}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-error btn-sm"
            onClick={handleClose}
            disabled={busy}
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FontAwesomeIcon icon={faCircleXmark} aria-hidden="true" />
            )}
            Confirm Close
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowForm(false)}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

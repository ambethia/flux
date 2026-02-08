import { useState } from "react";
import type { CloseTypeValue } from "$convex/schema";
import {
  FontAwesomeIcon,
  faArrowRotateLeft,
  faCirclePause,
  faCirclePlay,
} from "./Icon";
import { IssueCloseButton, IssueCloseFormPanel } from "./IssueCloseForm";

type ExpandedForm = "defer" | "close" | null;

interface IssueActionsToolbarProps {
  /** Which action buttons to show */
  showReset: boolean;
  showDefer: boolean;
  showUndefer: boolean;
  showClose: boolean;
  /** Disables all buttons */
  busy: boolean;
  /** Per-action loading states */
  resetting: boolean;
  deferring: boolean;
  undeferring: boolean;
  saving: boolean;
  /** Action handlers */
  onReset: () => void;
  onDefer: (note: string) => void;
  onUndefer: () => void;
  onClose: (
    closeType: CloseTypeValue,
    closeReason: string | undefined,
  ) => Promise<void>;
}

export function IssueActionsToolbar({
  showReset,
  showDefer,
  showUndefer,
  showClose,
  busy,
  resetting,
  deferring,
  undeferring,
  saving,
  onReset,
  onDefer,
  onUndefer,
  onClose,
}: IssueActionsToolbarProps) {
  const [expandedForm, setExpandedForm] = useState<ExpandedForm>(null);
  const [deferNote, setDeferNote] = useState("");

  const hasAnyButton = showReset || showDefer || showUndefer || showClose;
  if (!hasAnyButton) return null;

  function toggleForm(form: ExpandedForm) {
    setExpandedForm((prev) => (prev === form ? null : form));
  }

  function handleDeferSubmit() {
    onDefer(deferNote.trim() || "Deferred from UI");
    setExpandedForm(null);
    setDeferNote("");
  }

  function handleCloseCancel() {
    setExpandedForm(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Button row */}
      <div className="flex flex-wrap items-center gap-2">
        {showReset && (
          <button
            type="button"
            className="btn btn-outline btn-info btn-sm"
            onClick={onReset}
            disabled={busy}
          >
            {resetting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FontAwesomeIcon icon={faArrowRotateLeft} aria-hidden="true" />
            )}
            Reset to Open
          </button>
        )}

        {showUndefer && (
          <button
            type="button"
            className="btn btn-outline btn-info btn-sm"
            onClick={onUndefer}
            disabled={busy}
          >
            {undeferring ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FontAwesomeIcon icon={faCirclePlay} aria-hidden="true" />
            )}
            Undefer Issue
          </button>
        )}

        {showDefer && (
          <button
            type="button"
            className={`btn btn-outline btn-warning btn-sm ${expandedForm === "defer" ? "btn-active" : ""}`}
            onClick={() => toggleForm("defer")}
            disabled={busy}
          >
            <FontAwesomeIcon icon={faCirclePause} aria-hidden="true" />
            Defer Issue
          </button>
        )}

        {showClose && (
          <IssueCloseButton
            busy={busy}
            expanded={expandedForm === "close"}
            onToggle={() => toggleForm("close")}
          />
        )}
      </div>

      {/* Expanded form panels */}
      {expandedForm === "defer" && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-base-200 p-4">
          <h3 className="font-medium">Defer Issue</h3>
          <textarea
            className="textarea"
            placeholder="Reason for deferring (optional)"
            value={deferNote}
            onChange={(e) => setDeferNote(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={handleDeferSubmit}
              disabled={busy}
            >
              {deferring ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <FontAwesomeIcon icon={faCirclePause} aria-hidden="true" />
              )}
              Confirm Defer
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setExpandedForm(null);
                setDeferNote("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {expandedForm === "close" && (
        <IssueCloseFormPanel
          busy={busy}
          saving={saving}
          onClose={onClose}
          onCancel={handleCloseCancel}
        />
      )}
    </div>
  );
}

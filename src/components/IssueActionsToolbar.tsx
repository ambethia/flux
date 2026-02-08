import { useState } from "react";
import type { CloseTypeValue } from "$convex/schema";
import { FontAwesomeIcon, faArrowRotateLeft } from "./Icon";
import { IssueCloseButton, IssueCloseFormPanel } from "./IssueCloseForm";
import {
  IssueDeferButton,
  IssueDeferFormPanel,
  IssueUndeferButton,
} from "./IssueDeferForm";

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
  onDefer: (note: string) => Promise<void>;
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

  const hasAnyButton = showReset || showDefer || showUndefer || showClose;
  if (!hasAnyButton) return null;

  function toggleForm(form: ExpandedForm) {
    setExpandedForm((prev) => (prev === form ? null : form));
  }

  function handleCancel() {
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
          <IssueUndeferButton
            busy={busy}
            undeferring={undeferring}
            onUndefer={onUndefer}
          />
        )}

        {showDefer && (
          <IssueDeferButton
            busy={busy}
            expanded={expandedForm === "defer"}
            onToggle={() => toggleForm("defer")}
          />
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
        <IssueDeferFormPanel
          busy={busy}
          deferring={deferring}
          onDefer={onDefer}
          onCancel={handleCancel}
        />
      )}

      {expandedForm === "close" && (
        <IssueCloseFormPanel
          busy={busy}
          saving={saving}
          onClose={onClose}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

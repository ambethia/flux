import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";

interface IssueDescriptionEditorProps {
  description: string | undefined;
  isClosed: boolean;
  busy: boolean;
  onSave: (newDescription: string) => Promise<void>;
}

export function IssueDescriptionEditor({
  description,
  isClosed,
  busy,
  onSave,
}: IssueDescriptionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(description ?? "");
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed !== (description ?? "")) {
      await onSave(trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  return (
    <div>
      <h3 className="mb-2 font-medium text-base-content/60 text-sm">
        Description
      </h3>
      {editing ? (
        <textarea
          ref={textareaRef}
          className="textarea min-h-32 w-full"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
        />
      ) : isClosed ? (
        <div className="rounded-lg bg-base-200 p-4">
          <Markdown content={description} placeholder="No description." />
        </div>
      ) : (
        <button
          type="button"
          className="w-full cursor-pointer rounded-lg bg-base-200 p-4 text-left hover:ring-1 hover:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={startEdit}
          title="Click to edit"
          disabled={busy}
        >
          <Markdown
            content={description}
            placeholder="No description. Click to add one."
          />
        </button>
      )}
    </div>
  );
}

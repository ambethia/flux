import { useEffect, useRef, useState } from "react";

interface IssueTitleEditorProps {
  title: string;
  isClosed: boolean;
  busy: boolean;
  onSave: (newTitle: string) => Promise<void>;
}

export function IssueTitleEditor({
  title,
  isClosed,
  busy,
  onSave,
}: IssueTitleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(title);
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== title) {
      await onSave(trimmed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="input w-full font-semibold text-xl"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (isClosed) {
    return <h1 className="font-semibold text-xl">{title}</h1>;
  }

  return (
    <button
      type="button"
      className="cursor-pointer text-left font-semibold text-xl hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      onClick={startEdit}
      title="Click to edit"
      disabled={busy}
    >
      {title}
    </button>
  );
}

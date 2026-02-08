import type { ParsedLine } from "../lib/parseStreamLine";
import { summarizeToolInput } from "../lib/parseStreamLine";
import { FontAwesomeIcon, faCircleCheck, faScrewdriverWrench } from "./Icon";

/** A tool_use paired with its optional tool_result. */
export type ToolCallPair = {
  toolUse: Extract<ParsedLine, { kind: "tool_use" }>;
  toolResult: Extract<ParsedLine, { kind: "tool_result" }> | null;
};

/** A single collapsible card showing tool name + input summary, with result body. */
export function ToolCallCard({ pair }: { pair: ToolCallPair }) {
  const { toolUse, toolResult } = pair;
  const summary = summarizeToolInput(toolUse.toolName, toolUse.toolInput);

  const header = (
    <div className="flex items-center gap-2 p-3">
      <FontAwesomeIcon
        icon={faScrewdriverWrench}
        aria-hidden="true"
        className="shrink-0 text-info"
      />
      <span className="font-semibold text-info">{toolUse.toolName}</span>
      {summary && (
        <span className="truncate text-base-content/50 text-xs">{summary}</span>
      )}
      {toolResult && (
        <FontAwesomeIcon
          icon={faCircleCheck}
          aria-hidden="true"
          className="ml-auto shrink-0 text-success"
        />
      )}
    </div>
  );

  // No result yet — render as a static card (no misleading disclosure triangle)
  if (!toolResult) {
    return (
      <div className="rounded-lg bg-neutral font-mono text-neutral-content text-sm">
        {header}
      </div>
    );
  }

  return (
    <details className="group rounded-lg bg-neutral font-mono text-neutral-content text-sm">
      <summary className="cursor-pointer select-none">{header}</summary>
      <div className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words border-neutral-content/10 border-t px-3 pt-2 pb-3 text-xs">
        {toolResult.content}
      </div>
    </details>
  );
}

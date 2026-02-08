#!/bin/bash
# PostToolUse hook: runs biome check on the edited file after TS/TSX edits.
# Scoped to the single edited file to avoid O(all files) cost per edit.
# Uses JSON decision control to feed lint errors back to Claude as
# actionable feedback (decision: "block" + reason). This does NOT
# rollback the edit — PostToolUse cannot do that — but it tells Claude
# the edit introduced lint errors that must be fixed.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

if [[ ! "$FILE_PATH" =~ \.tsx?$ ]]; then
  exit 0
fi

cd "$(echo "$INPUT" | jq -r '.cwd')" || exit 0
OUTPUT=$(bunx biome check --write "$FILE_PATH" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  # Strip ANSI escape codes, trim to last 20 lines, build valid JSON via jq
  CLEAN=$(echo "$OUTPUT" | sed 's/\x1b\[[0-9;]*m//g' | tail -20)
  jq -n --arg reason "Lint errors after edit — fix before continuing:
$CLEAN" '{"decision":"block","reason":$reason}'
fi

exit 0

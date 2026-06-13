---
name: flux-cli
description: Use the Flux CLI to create, search, triage, update, comment on, defer, close, and orchestrate Flux issues. Load when asked to create/manage Flux issues, epics, dependencies, sessions, or to run Flux issue-tracker commands from an agent.
---

# Flux CLI Issue Management

Use the `flux` CLI as the source of truth for project work. Do not track TODOs only in chat when they should be issues.

## Before Running Commands

1. Run Flux commands from the git repo root when possible.
2. Verify the daemon if a command cannot connect:
   ```bash
   flux daemon status
   flux daemon start
   ```
3. Project resolution order:
   - `FLUX_PROJECT_ID` environment variable
   - `.flux` file at the git repo root
   - auto-discovery if there is exactly one project
   - interactive picker only in a TTY
4. In non-interactive agent sessions, fail fast if no project is configured. Do not rely on the interactive picker.
5. Use short IDs like `FLUX-42` for issues. Convex document IDs also work. Epic commands require epic document IDs.

## CLI Syntax

- Discover commands: `flux`, `flux issues`, `flux issues create --help`.
- Most issue/comment/session commands accept the primary identifier positionally:
  ```bash
  flux issues get FLUX-42
  flux comments create FLUX-42 --content "Status update"
  flux sessions list-by-issue FLUX-42
  ```
- Flags support `--key value` and `--key=value`.
- Boolean flags can be passed as `--flag` or `--flag true`.
- Numbers are coerced automatically.
- Pass `null` to clear nullable fields:
  ```bash
  flux issues update FLUX-42 --assignee null
  flux issues update FLUX-42 --description null
  flux issues update FLUX-42 --epicId null
  ```
- Bulk commands take JSON arrays; quote them so the shell passes valid JSON.

Valid values:
- Issue status: `open`, `in_progress`, `closed`, `deferred`, `stuck`
- Priority: `critical`, `high`, `medium`, `low`
- Close type: `completed`, `noop`, `duplicate`, `wontfix`
- Comment author: `user`, `agent`, `flux`
- Session status: `running`, `completed`, `failed`
- Session type: `work`, `review`, `planner`

## Create Good Issues

Prefer actionable, scoped issues with enough context for another agent to start immediately.

```bash
flux issues create \
  --title "Fix settings form validation for empty worktree path" \
  --priority high \
  --description $'Context:\nThe settings page accepts an empty worktree path and later orchestration fails.\n\nAcceptance criteria:\n- Empty path is rejected with a clear error.\n- Existing valid settings still save.\n\nNotes:\nCheck src/components/SettingsForm.tsx and project config validation.'
```

Priority guidance:
- `critical`: drop-everything production breakage or data loss
- `high`: important user-visible bug or blocker
- `medium`: normal product work
- `low`: cleanup, polish, non-blocking improvement

Attach to an epic when appropriate:
```bash
flux issues create --title "Add dependency graph empty state" --epicId <epicDocId>
```

Create multiple issues at once:
```bash
flux issues bulk-create --issues '[{"title":"Add loading state","priority":"medium"},{"title":"Handle empty result","priority":"low"}]'
flux issues bulk-create --epicId <epicDocId> --issues '[{"title":"Build import UI","priority":"high"}]'
```

## Find and Inspect Issues

```bash
flux issues list --status open --limit 20
flux issues ready --limit 10
flux issues search "settings validation"
flux issues get FLUX-42
flux comments list FLUX-42
flux deps list FLUX-42
```

Use `ready` for work selection: it returns open, unblocked issues eligible for the orchestrator.

## Update, Defer, Retry, and Close

Update only the fields you intend to change:
```bash
flux issues update FLUX-42 --title "Clearer title" --priority high
flux issues update FLUX-42 --status open
flux issues update FLUX-42 --assignee "pi"
```

Leave progress or decision notes as comments:
```bash
flux comments create FLUX-42 --content "Found the root cause in src/server/tools/handlers.ts; fix is in progress."
```

Defer when work should leave the ready queue; the note is required and becomes a comment:
```bash
flux issues defer FLUX-42 --note "Blocked until API contract is finalized."
flux issues undefer FLUX-42 --note "API contract landed; ready to continue."
```

Retry a stuck issue only when a fresh attempt is intentional:
```bash
flux issues retry FLUX-42
```

Close via `issues close`, not `issues update --status closed`:
```bash
flux issues close FLUX-42 --closeType completed --reason "Implemented in commit abc123."
flux issues close FLUX-43 --closeType duplicate --reason "Duplicate of FLUX-42."
```

When running as an assigned Flux agent, do not manually close or change the assigned issue's lifecycle unless explicitly instructed; the orchestrator normally manages lifecycle from the final disposition.

## Epics and Dependencies

Epics group related issues. Epic IDs are document IDs returned by epic commands.

```bash
flux epics list --status open
flux epics create --title "Settings reliability" --description "Improve validation and recovery paths."
flux epics show <epicDocId>
flux epics update <epicDocId> --title "Settings and project config reliability"
flux epics close <epicDocId> --reason "All child work completed."
```

Dependencies express ordering: the blocker must finish before the blocked issue is ready.

```bash
flux deps add --blockerId FLUX-41 --blockedId FLUX-42
flux deps remove --blockerId FLUX-41 --blockedId FLUX-42
flux deps list FLUX-42
```

## Orchestrator and Sessions

```bash
flux orchestrator status
flux orchestrator run FLUX-42
flux orchestrator kill

flux sessions list --limit 5
flux sessions list-by-issue FLUX-42 --type work
flux sessions show <sessionId>
flux issues list-by-session <sessionId>
```

Use `orchestrator run` to launch background work on a ready issue. Use `sessions show` to inspect the last transcript lines for running or completed sessions.

## Agent Habits

- Search before creating to avoid duplicates.
- Include reproduction steps, acceptance criteria, and relevant file paths in descriptions.
- Create follow-up issues for discovered work instead of expanding scope silently.
- Comment on important findings, blockers, and handoff notes.
- Prefer explicit commands that fail loudly over ad-hoc state changes.

Project quick reference: `../../../docs/flux-cli-for-agents.md`.

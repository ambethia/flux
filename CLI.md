# Flux CLI

The `flux` command talks to the running Flux daemon over HTTP and lets you manage projects, issues, sessions, prompts, and orchestrator state from the terminal.

If `flux` is not on your `PATH`, every example in this document also works as `bun run flux ...`.

## Prerequisites

- Flux is installed and configured. See [INSTALLATION.md](INSTALLATION.md).
- The daemon is reachable at `FLUX_URL` or `http://localhost:8042`.

Check the CLI entrypoint:

```bash
flux --help
```

## How Project Selection Works

The CLI scopes most commands to one Flux project. It resolves the project in this order:

1. `FLUX_PROJECT_ID`
2. `.flux` file in the git repo root
3. Auto-discovery from the daemon if exactly one project exists
4. Interactive picker in a TTY session

If you are in a git repo and pick or create a project interactively, Flux writes the selected project ID to `.flux`.

Supported `.flux` formats:

```toml
project = "k1782262nvqjfr8y0w6rj72heh84j2vf"

[planner]
schedule = "0 */2 * * *"
agenda = """
Keep the backlog focused on the next milestone.
"""
```

Legacy bare-ID files still work:

```text
k1782262nvqjfr8y0w6rj72heh84j2vf
```

## Command Shape

Tool commands use:

```bash
flux <group> <command> [primary] [options]
```

Examples:

```bash
flux issues list --status open
flux issues get FLUX-42
flux issues update FLUX-42 --priority high
flux comments create FLUX-42 --content "Investigation complete"
flux orchestrator run FLUX-42
flux sessions show <sessionId>
```

Use built-in help at any level:

```bash
flux
flux issues
flux issues update --help
```

## Argument Rules

The parser supports:

- Positional shorthand for the command's primary field
- `--key value`
- `--key=value`
- `--flag` for booleans
- `null`, `true`, `false`, integers, and floats with automatic coercion

Examples:

```bash
flux issues get FLUX-42
flux issues update FLUX-42 --assignee null
flux issues list --limit 20
flux prompts reset --phase review
```

For batch commands, pass JSON strings:

```bash
flux issues bulk-create --issues '[{"title":"Fix auth","priority":"high"},{"title":"Clean up logs"}]'
flux issues bulk-update --updates '[{"issueId":"FLUX-42","priority":"critical"},{"issueId":"FLUX-43","status":"deferred"}]'
```

## Common Command Groups

### Issues

```bash
flux issues list --status open
flux issues ready
flux issues search "review loop"
flux issues get FLUX-42
flux issues create --title "Fix planner retry semantics" --priority high
flux issues update FLUX-42 --title "Tighten planner retry semantics"
flux issues close FLUX-42 --closeType completed --reason "Fixed in 1a2b3c4"
flux issues defer FLUX-42 --note "Blocked on upstream API change"
flux issues undefer FLUX-42 --note "Upstream landed"
flux issues retry FLUX-42
flux issues list-by-session <sessionId>
```

Notes:

- `issues get`, `update`, `close`, `defer`, `undefer`, and `retry` accept a short ID like `FLUX-42` or a document ID.
- `issues close` is the intended close path. Do not use `issues update --status closed`.

### Comments

```bash
flux comments list FLUX-42
flux comments create FLUX-42 --content "Needs a migration before making this field required."
flux comments create FLUX-42 --content "User supplied context" --author user
```

### Epics

```bash
flux epics list
flux epics create --title "Planner stabilization"
flux epics show <epicId>
flux epics update <epicId> --description "Revised scope"
flux epics close <epicId> --reason "Rolled into milestone 2"
```

### Labels

```bash
flux labels list
flux labels create --name bug --color "#ef4444"
flux labels update <labelId> --color "#f97316"
flux labels delete <labelId>
```

### Dependencies

```bash
flux deps add --blockerId FLUX-42 --blockedId FLUX-43
flux deps remove --blockerId FLUX-42 --blockedId FLUX-43
flux deps list FLUX-43
```

### Sessions

```bash
flux sessions list
flux sessions list --status running
flux sessions list-by-issue FLUX-42
flux sessions list-by-issue FLUX-42 --type review
flux sessions show <sessionId>
```

### Orchestrator

```bash
flux orchestrator status
flux orchestrator run FLUX-42
flux orchestrator kill
```

Notes:

- `orchestrator run` returns immediately after queuing work.
- Use `orchestrator status` and `sessions show` to monitor the active session.

### Prompts

```bash
flux prompts get
flux prompts get-defaults
flux prompts set-work --prompt "Focus on vertical slices. No speculative abstractions."
flux prompts set-retro --prompt "Call out friction and repeated mistakes."
flux prompts set-review --prompt "Prioritize concrete regressions over style."
flux prompts reset
flux prompts reset --phase review
```

Pass an empty string to clear a single custom prompt:

```bash
flux prompts set-work --prompt ""
```

### Planner

```bash
flux planner status
flux planner run
```

The planner uses the `[planner]` section in `.flux` when present.

## Daemon Commands

These commands manage the local Flux daemon rather than calling project tools:

```bash
flux daemon install
flux daemon status
flux daemon start
flux daemon stop
flux daemon uninstall
```

Platform-specific behavior is documented in [INSTALLATION.md](INSTALLATION.md).

## Environment Variables

- `FLUX_URL`
  Base URL for the Flux daemon. Defaults to `http://localhost:8042`.
- `FLUX_PROJECT_ID`
  Explicit project override for the current command.

Examples:

```bash
FLUX_URL=http://localhost:9000 flux orchestrator status
FLUX_PROJECT_ID=k1782262nvqjfr8y0w6rj72heh84j2vf flux issues list
```

## Output Behavior

Tool commands print pretty-formatted JSON when the server returns structured data. Plain text responses are printed as-is. Validation and transport failures exit non-zero and print the error to stderr.

## Advanced Diagnostic

`flux mcp smoke-followup` is a repository diagnostic that creates and closes a temporary issue through the MCP stdio bridge to verify end-to-end follow-up tool transport.

```bash
flux mcp smoke-followup
```

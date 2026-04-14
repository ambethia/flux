# FLUX

An autonomous agent orchestrator with built-in issue tracking, realtime UI, and its own MCP server.

This README is for contributing to Flux itself. For machine setup and environment configuration, start with [INSTALLATION.md](INSTALLATION.md).

## Contributing Setup

Install the prerequisites and create `.env.local` by following [INSTALLATION.md](INSTALLATION.md), then start the app:

```bash
bun dev
```

Open `http://localhost:8042`.

`bun dev` starts the full development stack:
- Bun on `:8042` for the API server, MCP endpoints, and frontend entry point
- `convex dev` for backend sync
- Vite on `:8043` for frontend HMR behind the Bun reverse proxy

For a production-style local run:

```bash
bun run build:frontend
bun run start
```

## Development Workflow

Most work in this repo touches one of these areas:
- `src/server/` for the Bun API server, MCP routes, project APIs, and orchestrator runtime
- `src/server/orchestrator/` for agent lifecycle, scheduling, prompts, and session handling
- `src/components/`, `src/pages/`, and `src/lib/router` for the React UI
- `src/cli/` for the `flux` CLI and daemon commands
- `convex/` for schema, queries, mutations, seeds, and migrations

Useful commands:

```bash
# Run the app locally
bun dev

# Typecheck
bun run typecheck

# Apply Biome fixes/checks
bun run check

# Reset local Convex data and rerun bootstrap flow
bunx convex run nuke:all && bun run src/index.ts

# Use the local CLI
bun run flux issues list --status open
```

## Validating Changes

There is not a heavy automated test suite yet. Default validation is:
- `bun run typecheck`
- `bun run check`
- Manual verification in the browser at `http://localhost:8042`
- Manual verification of backend behavior with `bun run flux ...` or `bunx convex run ...`

If you change bootstrap or project creation behavior, use the reset flow:

```bash
bunx convex run nuke:all && bun run src/index.ts
```

If the dev daemon gets stuck, use the restart steps in [INSTALLATION.md](INSTALLATION.md).

## Project Conventions

Flux is opinionated. Before making changes, read [CLAUDE.md](CLAUDE.md), which is also symlinked as `AGENTS.md`.

The high-level rules:
- Use Bun by default, not Node-specific tooling
- Fail fast; do not add silent fallbacks or log-and-continue error handling
- Build vertical slices; do not add speculative abstractions, schema, or indexes
- Reuse schema constants and validators from `convex/schema.ts`
- Do not add new dependencies without explicit approval

If you are working from a Flux issue, commit atomically so the orchestrator does not race your commit:

```bash
git add path/to/file.ts path/to/file.tsx && git commit -m "FLUX-42: concise description"
```

## Architecture And Docs

Start here for project context:
- [docs/design.md](docs/design.md) for the architecture and core design decisions
- [CLI.md](CLI.md) for the `flux` command-line interface
- [docs/flux-cli-for-agents.md](docs/flux-cli-for-agents.md) for the Flux CLI surface used during dogfooding and agent workflows
- [docs/planner.md](docs/planner.md) for the planner design
- [INSTALLATION.md](INSTALLATION.md) for environment setup and daemon management
- [CLAUDE.md](CLAUDE.md) for coding standards and repo-specific guardrails

# FLUX

An autonomous agent orchestrator with built-in issue tracking, realtime UI, and its own MCP server.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [Convex](https://convex.dev) account (free tier works)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI (default agent provider)

## Quick Start

```bash
# Install dependencies
bun install

# Authenticate with Convex (creates .env.local)
bunx convex auth

# Start everything: Bun server + Convex sync + Vite frontend
bun dev
```

Open **http://localhost:8042** in your browser.

## Install `flux` Globally

Flux already ships with a CLI wrapper at `bin/flux`. The current install model is to keep this repo checked out somewhere permanent and place that wrapper on your `PATH`.

```bash
# From this repo
bun install

# Symlink the CLI into a directory on your PATH
mkdir -p ~/bin
ln -sf /absolute/path/to/flux/bin/flux ~/bin/flux

# If ~/bin is not already on PATH
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

After that, install the daemon from the Flux repo:

```bash
cd /absolute/path/to/flux
flux daemon install
```

Notes:

- `flux` requires Bun to be installed, because `bin/flux` executes `src/cli.ts` with Bun.
- The daemon should be installed from the Flux repo, since it resolves the source tree and local environment from that checkout.
- Flux is not packaged for `npm -g` / `bun add -g` yet. The supported path today is the checked-out repo plus a symlink on `PATH`.

`bun dev` starts three processes:

| Process | Port | Role |
|---------|------|------|
| Bun | `:8042` | API server + reverse proxy (single entry point) |
| Convex | — | Backend sync |
| Vite | `:8043` | React frontend with HMR (proxied through Bun) |

## Bootstrap Flow

When you run Flux for the first time in a git repository:

1. **Project Detection** — Flux detects the project slug from your git remote
2. **Creation** — if the project doesn't exist in Convex, you'll be prompted to create it
3. **Seeding** — animated progress bar shows real-time seeding of LLM costs, labels (bug, feature, chore, friction), and orchestrator config
4. **Splash Screen** — project status with keyboard shortcuts (`q` quit, `o` open browser, `e` enable orchestrator)

The orchestrator starts **disabled** by default. Enable it via `e` in the terminal or the web UI.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Issue** | A unit of work, like a GitHub issue — has status, priority, labels |
| **Session** | One agent run against an issue (work, review, or planner phase) |
| **Disposition** | Agent's self-reported outcome: `done`, `noop`, or `fault` |
| **ProjectRunner** | Watches a project's ready queue, picks issues, spawns agents |
| **Review loop** | After work, a reviewer agent checks commits and may create follow-ups |
| **Dependency** | Issues can block other issues — the orchestrator respects ordering |

### Issue Lifecycle

```
open → in_progress → closed (completed | noop | duplicate | wontfix)
  ↓                    ↑
  ├── deferred ────────┘  (manually postponed)
  └── stuck                (exceeded failure/review limits)
```

When an agent finishes work:
1. If `fault` — issue reopens, retry (circuit breaker at 3 failures → `stuck`)
2. If `noop` — closed as noop
3. If `done` with commits — enters review loop; reviewer may fix inline or create follow-up issues

## Usage

### CLI

The `flux` CLI manages issues, sessions, and the orchestrator via the daemon's HTTP API.

```bash
flux <group> <action> [--arg value ...]
```

### Using Flux From Other Projects

You can run `flux` from any git repository once the global `flux` command and daemon are installed:

```bash
cd ~/dev/some-other-project
flux issues list
```

Project selection works in this order:

1. `FLUX_PROJECT_ID` environment variable
2. `.flux` file at the git repo root
3. Auto-discover the only known project
4. Interactive picker/creator, which then writes `.flux`

That means the first `flux` command you run in another repo will either bind to its existing `.flux` file or prompt to select/create a Flux project for that repo.

**Managing issues:**

```bash
flux issues create --title "Fix auth bug" --priority high --body "Details..."
flux issues list
flux issues get FLUX-42
flux issues search "login"
flux issues close FLUX-42
flux issues defer FLUX-42
```

**Running the orchestrator:**

```bash
# Auto-mode: enable the orchestrator, it picks up ready issues
# (via 'e' key in TUI or the web UI)

# Manual: run a specific issue
flux orchestrator run FLUX-42

# Check status
flux orchestrator status
```

**Sessions and history:**

```bash
flux sessions list
flux sessions show <sessionId>
```

### PRD-to-Issues Workflow

If you use an agent to write a PRD, you can submit the broken-down issues directly to Flux in bulk rather than creating them one at a time:

```bash
flux issues bulk_create --issues '[
  {"title": "Add auth middleware", "priority": "high", "body": "..."},
  {"title": "Create user model", "priority": "high", "body": "..."},
  {"title": "Build settings page", "priority": "medium", "body": "..."}
]'
```

Then wire up dependencies so the orchestrator works them in the right order:

```bash
flux deps add --from FLUX-3 --to FLUX-1   # settings page waits for auth
flux deps add --from FLUX-3 --to FLUX-2   # settings page waits for user model
```

The orchestrator's ready queue only surfaces issues whose dependencies are all closed, so sequencing is automatic.

**Full workflow:**
1. Agent writes PRD
2. Agent breaks PRD into issues with priorities
3. Submit via `bulk_create`
4. Add dependency edges via `deps add`
5. Enable orchestrator — it works through them in dependency order

This also works via MCP (`mcp__flux__issues_bulk_create`, `mcp__flux__deps_add`) if your agent has MCP access.

### MCP Integration

Flux exposes an MCP server so AI tools can create and manage issues programmatically. All CLI commands have MCP equivalents (`mcp__flux__issues_create`, `mcp__flux__orchestrator_run`, etc.).

Configure in your agent's MCP settings or use the stdio transport:

```bash
bun run bin/flux-mcp-stdio.ts
```

## Running as a Daemon

Instead of keeping a terminal open with `bun dev`, you can install Flux as a background daemon that starts automatically on login.

### macOS (LaunchAgent)

```bash
flux daemon install    # Installs plist, starts immediately
```

This creates `~/Library/LaunchAgents/dev.flux.daemon.plist` with `KeepAlive` and `RunAtLoad` enabled — the daemon auto-restarts on crash and starts on login.

```bash
flux daemon status     # PID, uptime, active sessions, memory usage
flux daemon stop       # Stop (auto-restarts due to KeepAlive)
flux daemon uninstall  # Stop, unload, and remove plist
```

To restart (e.g., after code changes aren't picked up by `bun --watch`):

```bash
launchctl stop dev.flux.daemon   # launchd auto-restarts it
```

### Linux (systemd)

```bash
flux daemon install    # Creates user service, enables, starts
```

This creates `~/.config/systemd/user/dev.flux.daemon.service` with `Restart=always`.

```bash
flux daemon status
flux daemon stop
flux daemon uninstall

# Live logs via journald
journalctl --user -u dev.flux.daemon -f
```

### Verifying

```bash
curl http://localhost:8042/health    # JSON: version, uptime, projects, sessions
tail -20 ~/.flux/logs/daemon.stdout.log
```

Logs go to `~/.flux/logs/daemon.stdout.log` and `daemon.stderr.log` on both platforms.

## Architecture

- **Stack**: React + Bun + Tailwind + DaisyUI
- **Backend**: Convex (realtime persistence)
- **CLI**: OpenTUI for terminal interface
- **MCP**: Port 8042 (exposed at `/mcp/projects/:projectId`)

See [docs/design.md](docs/design.md) for detailed architecture documentation.

## Development

### Testing Bootstrap Flow

```bash
# Nuke all data and restart
bunx convex run nuke:all && bun run src/index.ts
```

### Production

```bash
bun run build:frontend   # Build frontend to dist/
bun run start            # Serve from Bun at :8042
```

---

## Bun Template Info

<details>
<summary>Click to expand original Bun template documentation</summary>

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

### APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

### Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

### Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

</details>

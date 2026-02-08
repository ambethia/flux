# Multi-Project Daemon Roadmap

**Status:** Draft
**Created:** February 2026
**Source:** Extracted from [future.md](future.md) Section 4, grounded in current architecture analysis

---

## Vision

One always-on Flux daemon process managing multiple projects. Projects are units of work that can be running, paused, or stopped. The orchestrator is persistent — it survives reboots, laptop sleep, and crashes. Agents launch from each project's working directory.

**From → To:**

| Aspect | Current (Single-Project) | Target (Multi-Project) |
|--------|--------------------------|------------------------|
| Daemon | One process per project, started manually | One daemon across all projects, always-on |
| Orchestrator | Singleton via `globalThis` | Map of `projectId → Orchestrator` |
| Project context | Inferred from CWD git remote at startup | Explicit project registry with stored paths |
| UI | Routes assume single project | Project-scoped routing (`/p/:slug/...`) |
| MCP | `projectId` baked in at handler creation | `projectId` resolved per-request |
| API | `/api/config` returns one project | `/api/projects` lists all, per-project endpoints |

---

## Current Architecture Snapshot

What already works and what doesn't, based on codebase analysis.

### Multi-Project Ready (No Changes Needed)

- **Convex schema** — All tables have `projectId` foreign keys with proper indexes (`issues.by_project_priority`, `sessions.by_project`, etc.)
- **Convex queries/mutations** — All filter by `projectId` parameter
- **ToolContext pattern** — Dependency injection carries `projectId` to all handlers
- **Git functions** — `resolveRepoRoot()`, `getCurrentHead()`, etc. accept `cwd` parameter
- **Session monitoring** — `SessionMonitor` is per-session, no global state
- **Agent spawning** — `ClaudeCodeProvider.spawn()` accepts `cwd` option

### Requires Changes

| Component | File | Issue |
|-----------|------|-------|
| Orchestrator singleton | `src/server/orchestrator/index.ts:1648-1658` | `globalThis.__fluxOrchestrator` stores one instance |
| Server startup | `src/index.ts` | `ensureProject()` called once, locks to one project |
| API config | `src/server/index.ts:14-83` | `/api/config` returns single `projectId` |
| MCP handler | `src/server/mcp.ts` | `createMcpHandler(projectId)` bound at startup |
| Frontend bootstrap | `src/frontend.tsx:12-30` | Fetches one `projectId` from `/api/config` |
| Router | `src/lib/router.ts` | `RouterContext` has fixed `projectId`, no project path segments |
| Orchestrator API | `src/server/orchestratorApi.ts` | No project parameter on enable/stop/kill |

---

## Epics

### Epic 1: Project Registry & Management

**Goal:** Users can register, list, and manage multiple projects without restarting the daemon.

**Why first:** Everything downstream (orchestrator pool, UI, MCP) needs a project registry to work against. This is the foundation.

#### Context

Currently, `ensureProject()` in `src/server/setup.ts` infers a single project from the git remote of the current working directory. The `projects` table in Convex already exists and supports multiple rows — but the server only ever creates/loads one.

#### Work

- **Project CRUD API** — New endpoints: `POST /api/projects` (register by path), `GET /api/projects` (list all), `PATCH /api/projects/:id` (update state), `DELETE /api/projects/:id` (unregister). Each project stores: `name`, `slug`, `path` (absolute), `state` (running/paused/stopped).

- **Project registration from CLI** — `flux project add [path]` registers a project. Validates the path is a git repo. Infers slug from git remote (reusing existing `inferProjectSlug()` logic but with explicit path). `flux project list` shows all registered projects with state.

- **Project state machine** — Projects have three states: `running` (orchestrator active, picks up ready issues), `paused` (orchestrator idle, no new work, finish existing), `stopped` (no orchestrator instance). State stored in Convex `projects` table (new `state` field). Transitions: `flux project pause <slug>`, `flux project resume <slug>`, `flux project stop <slug>`.

- **Remove CWD-only project detection** — `ensureProject()` becomes `loadProjects()` which loads all registered projects from Convex. On first run with no projects, fall back to current CWD-based detection and auto-register.

#### Invariant

Single source of truth for project identity is the Convex `projects` table. The filesystem path is stored but the project ID is the canonical reference.

---

### Epic 2: Orchestrator Pool

**Goal:** Run one orchestrator per active project within the same daemon process.

**Why second:** The orchestrator is the core loop. Once we have a project registry, we need each project to have its own orchestrator lifecycle.

#### Context

The orchestrator is currently a singleton cached on `globalThis.__fluxOrchestrator`. It subscribes to `api.issues.ready` for one project, manages one `activeSession`, and has one state machine (Stopped/Idle/Busy). All of this is per-project already in logic — the singleton pattern is the only bottleneck.

#### Work

- **Replace singleton with Map** — Change `getOrchestrator(projectId)` to maintain a `Map<string, Orchestrator>` on `globalThis`. Each project gets its own instance. Hot-reload preservation works the same way (the Map survives HMR).

- **Per-project Convex subscriptions** — Each `Orchestrator` already calls `convex.onUpdate(api.issues.ready, {projectId})`. With multiple instances, each subscribes independently. The Convex client handles multiplexed subscriptions natively.

- **Per-project CWD** — When spawning agents, each orchestrator uses its project's stored `path` as the CWD instead of `resolveRepoRoot()` from the daemon's CWD. The `ClaudeCodeProvider.spawn()` already accepts `cwd` — just need to pass the project's path.

- **Orchestrator lifecycle tied to project state** — When a project transitions to `running`, create/enable its orchestrator. When `paused`, call `orchestrator.stop()` (finishes current session, then idles). When `stopped`, call `orchestrator.kill()` and remove from the Map.

- **Concurrency model** — Multiple orchestrators run concurrently in the same Node/Bun event loop. Each manages its own agent subprocess independently. No shared state between orchestrators (they already don't share any).

- **Orphan recovery across projects** — On daemon startup, iterate all projects in `running` state, create orchestrators, and run orphan recovery for each (reusing existing `adoptOrphanedSession()` logic).

#### Invariant

Single session per project. Multiple projects can have active sessions concurrently, but each project runs at most one session at a time (existing constraint, preserved).

---

### Epic 3: API & MCP Multi-Project Routing

**Goal:** All API endpoints and MCP tool calls are project-scoped.

**Why third:** With the registry and orchestrator pool in place, the HTTP layer needs to route requests to the right project context.

#### Context

Currently, `startServer()` receives one `projectId` and creates a single `ToolContext` used by all routes. The MCP handler is created once with `createMcpHandler(projectId, projectSlug)`. All API endpoints implicitly operate on that one project.

#### Work

- **Project-scoped API routes** — Prefix project-specific routes with `/api/projects/:projectId/...`:
  - `POST /api/projects/:projectId/orchestrator` (enable/stop/kill/status)
  - `GET /api/projects/:projectId/config` (project-specific config)
  - `GET /sse/projects/:projectId/activity` (SSE stream scoped to project)
  - Keep `GET /api/projects` (list all) and `POST /api/projects` (register) at the top level.

- **Dynamic ToolContext creation** — Instead of one `ToolContext` at startup, create per-request contexts. Extract `projectId` from the route parameter, look up the project, and build a `ToolContext` with the correct `projectId`, `projectSlug`, and `getOrchestrator()` binding.

- **MCP project resolution** — Two options (decide during implementation):
  1. **MCP per project:** Separate MCP endpoints per project (`/mcp/:projectId`). Each agent connects to its project's endpoint.
  2. **Project in tool args:** Single MCP endpoint, but tools accept optional `projectId` parameter. Default to inferring from the agent's CWD.

  Recommendation: Option 1 is simpler and aligns with "one MCP session = one project context."

- **Backwards-compatible `/api/config`** — During transition, keep `/api/config` working by returning the "default" project (first registered, or CWD-inferred). Add deprecation path toward project-scoped config.

#### Invariant

Every tool call and API request is bound to exactly one project. No cross-project operations in a single request.

---

### Epic 4: Frontend Multi-Project UI

**Goal:** Users can see all projects, switch between them, and manage each project's issues/sessions/settings independently.

**Why fourth:** The backend is multi-project capable after Epics 1-3. The UI catches up.

#### Context

The frontend currently fetches a single `projectId` from `/api/config` at startup, passes it into `RouterContext`, and all components use it implicitly. Routes are flat: `/issues`, `/sessions`, `/settings`. No project switching exists.

#### Work

- **Project dashboard (landing page)** — Grid view showing all registered projects with: name, state (running/paused/stopped), issue counts (open/in-progress), active session indicator. Click to enter a project. Simple cards — no over-engineering.

- **Project-scoped routing** — Routes become `/p/:projectSlug/issues`, `/p/:projectSlug/sessions`, etc. The `RouterContext` loads `projectId` from the route param. The `projectSlug` in the URL is the primary navigation mechanism.

- **Project switcher** — Compact dropdown or sidebar element for switching between projects without returning to the dashboard. Shows project name + state indicator.

- **Per-project orchestrator controls** — The existing enable/stop/kill controls in the UI now target the selected project's orchestrator via the project-scoped API.

- **Cross-project activity view (stretch)** — Optional unified view showing recent activity across all projects. Low priority — per-project views come first.

#### Design Direction

Start with **project selector dropdown** (Option 1 from future.md). It's the simplest to implement and sufficient for <10 projects. Can evolve to grid dashboard + sidebar later if needed.

#### Invariant

URL always reflects which project is active. Sharing a URL (e.g., `/p/flux/issues/FLUX-42`) links directly to the right project context.

---

### Epic 5: Always-On Daemon Lifecycle

**Goal:** The Flux daemon starts on boot, survives reboots and sleep, and manages its own lifecycle without manual intervention.

**Why last:** This is a packaging/lifecycle concern, not a functional one. Multi-project works with manual `flux dev` first. Always-on is a convenience layer on top.

#### Context

Currently, `bun dev` (development) or `bun run start` (production) must be manually started. There's no service management, no auto-restart, no boot persistence. The PID watchdog and orphan recovery in the orchestrator already handle crash recovery *within* a running process — this epic handles process-level lifecycle.

#### Work

- **`flux daemon` CLI commands** — User-level process manager:
  - `flux daemon start` — Starts the daemon in the background, writes PID to `~/.flux/daemon.pid`
  - `flux daemon stop` — Graceful shutdown (stops all orchestrators, waits for active sessions to finish or timeout)
  - `flux daemon status` — Shows PID, uptime, active projects, active sessions
  - `flux daemon restart` — Stop + start
  - `flux daemon logs` — Tail `~/.flux/logs/daemon.log`

- **PID file management** — Write PID on start, remove on clean exit. On startup, check if PID file exists and if process is alive — handle stale PID files from crashes.

- **Log rotation** — Daemon output goes to `~/.flux/logs/daemon.log`. Basic rotation (keep last 5 files, 10MB each) to prevent unbounded growth.

- **macOS LaunchAgent (optional, stretch)** — `flux daemon install` creates a `~/Library/LaunchAgents/dev.flux.daemon.plist` for auto-start on login. `flux daemon uninstall` removes it. This is the "production personal" mode.

- **Graceful shutdown** — On SIGTERM/SIGINT: stop accepting new sessions, wait for active sessions to complete (with timeout), then exit. On SIGKILL: orphan recovery handles it on next startup.

- **Health check endpoint** — `/health` already exists. Extend it with: uptime, number of active projects, number of active sessions, memory usage. Used by `flux daemon status` and potential monitoring.

#### Design Direction

Start with `flux daemon start/stop/status` (Option 2 from future.md — user-level process manager). Skip OS service integration initially. Manual start is fine for early adoption. LaunchAgent support is a stretch goal.

#### Invariant

The daemon can always be recovered. A crash leaves behind a PID file and orphaned sessions — both are detected and cleaned up on next start.

---

## Dependency Graph

```
Epic 1: Project Registry
  │
  ├──→ Epic 2: Orchestrator Pool
  │      │
  │      ├──→ Epic 3: API & MCP Routing
  │      │      │
  │      │      └──→ Epic 4: Frontend UI
  │      │
  │      └──→ Epic 5: Daemon Lifecycle
  │
  (Epics 4 and 5 are independent of each other)
```

**Critical path:** Epic 1 → Epic 2 → Epic 3 → Epic 4

Epic 5 can begin after Epic 2 (it doesn't need API routing or UI).

---

## Key Design Decisions

### Decided

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Orchestrator model | Map in single process (not multi-process) | Simpler than IPC, orchestrators are lightweight (event loop + one subprocess each), Convex client is shared |
| Project identity | Convex `projects` table as source of truth | Already exists, already multi-project, already indexed |
| Session constraint | One session per project (preserved) | Existing invariant, prevents git conflicts within a project |

### To Decide During Implementation

| Decision | Options | Notes |
|----------|---------|-------|
| MCP project binding | Per-project endpoint vs. project-in-args | Leaning per-project endpoint for simplicity |
| UI navigation | Dropdown vs. grid dashboard | Start with dropdown, can evolve |
| Daemon auto-start | LaunchAgent vs. manual only | Manual first, LaunchAgent as stretch |
| Dev mode multi-project | Single `bun dev` vs. multiple | Likely single process with all projects loaded |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multiple orchestrators competing for resources | Agent subprocesses consume CPU/memory | Project `state` controls: only `running` projects spawn agents. User controls concurrency by pausing projects. |
| Convex subscription fan-out | N projects = N `onUpdate` subscriptions | Convex handles this natively. Monitor for performance at >20 projects. |
| Git conflicts between projects | None (projects are separate repos) | Each project has its own CWD. No shared git state. |
| Daemon crash loses all projects | Orchestrated work stops | PID watchdog + orphan recovery already handles per-session. Daemon-level: PID file + restart. |
| Migration from single-project | Existing users must re-register | Auto-detect: if no projects registered, infer from CWD (current behavior) and auto-register. Zero-friction migration. |

---

## Non-Goals (Explicitly Out of Scope)

- **Cross-project dependencies** — Issues in project A do not block issues in project B
- **Shared agent pools** — Each project manages its own agent sessions
- **Multi-user** — Flux remains a personal tool on one user's machine
- **Remote daemon** — No networked multi-machine orchestration
- **Anvil tools** — Covered in separate roadmap (independent of multi-project)
- **Auto-planning** — Covered in separate roadmap (can layer on after multi-project)

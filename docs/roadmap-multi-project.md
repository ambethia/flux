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
| Daemon | One process per project, started manually | One daemon across all projects, always-on via LaunchAgent |
| Orchestrator | Singleton via `globalThis` | Map of `projectId → Orchestrator` |
| Project context | Inferred from CWD git remote at startup | Explicit project registry, managed in UI |
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

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Orchestrator model | Map in single process (not multi-process) | Simpler than IPC, orchestrators are lightweight (event loop + one subprocess each), Convex client is shared |
| Project identity | Convex `projects` table as source of truth | Already exists, already multi-project, already indexed |
| Session constraint | One session per project (preserved) | Existing invariant, prevents git conflicts within a project |
| Daemon lifecycle | macOS LaunchAgent (`KeepAlive: true`) | Agents can kill/restart Flux — launchd auto-restarts. No terminal attachment. |
| Project management | Full UI + CLI | Projects registered/configured entirely in the UI (including path). CLI as secondary interface. |

### To Decide During Implementation

| Decision | Options | Notes |
|----------|---------|-------|
| MCP project binding | Per-project endpoint vs. project-in-args | Leaning per-project endpoint for simplicity |
| UI navigation | Dropdown vs. grid dashboard | Start with dropdown, can evolve |
| Dev mode multi-project | Single `bun dev` vs. multiple | Likely single process with all projects loaded |

---

## Epics

### Epic 1: Project Registry & Management

**Goal:** Users can register, list, and manage multiple projects — primarily through the UI, with CLI as a secondary interface.

**Why first:** Everything downstream (orchestrator pool, UI routing, MCP) needs a project registry to work against. This is the foundation.

#### Context

Currently, `ensureProject()` in `src/server/setup.ts` infers a single project from the git remote of the current working directory. The `projects` table in Convex already exists and supports multiple rows — but the server only ever creates/loads one.

#### Work

**1. Add `path` and `state` fields to projects schema**

Add `path` (absolute filesystem path) and `state` (`running | paused | stopped`) to the `projects` table in `convex/schema.ts`. Update `projects.create` mutation to accept `path`. Add `projects.update` mutation for state transitions and field edits.

Verify: `bunx convex dev` starts without schema errors. Run `bunx convex run projects:create '{"slug":"test","name":"Test","path":"/tmp/test"}'` and confirm the record includes `path` and `state` fields.

**2. Project CRUD API endpoints**

New HTTP endpoints on the Bun server:
- `GET /api/projects` — list all projects with state
- `POST /api/projects` — register a new project (accepts `path`, infers `slug`/`name`)
- `PATCH /api/projects/:id` — update project fields (name, slug, path, state)
- `DELETE /api/projects/:id` — unregister a project

Verify: `curl http://localhost:8042/api/projects` returns JSON array. `curl -X POST ... -d '{"path":"/some/repo"}'` creates a project and returns it with an id. `curl -X PATCH ... -d '{"state":"paused"}'` updates state. `curl -X DELETE ...` removes it.

**3. Path validation on registration**

When registering a project (API or UI), validate: directory exists, is a git repo (`git -C <path> rev-parse --git-dir`). Infer slug from git remote (reuse `inferProjectSlug()` with explicit `cwd`). Return clear error if validation fails.

Verify: `POST /api/projects` with a non-existent path returns 400 with error message. A non-git directory returns 400. A valid git repo succeeds and the inferred slug matches the remote.

**4. Replace `ensureProject()` with `loadProjects()`**

Server startup loads all registered projects from Convex instead of inferring one from CWD. On first run with zero projects, fall back to current CWD-based detection and auto-register (zero-friction migration for existing users).

Verify: Start daemon with 2+ projects in Convex. Server logs show all projects loaded. Start daemon with zero projects registered — auto-creates one from CWD like before.

**5. UI: Project management page**

A settings/admin page where users can:
- See all registered projects (name, slug, path, state)
- Add a project by entering its root directory path (text input)
- Edit a project's name, slug, and path
- Toggle project state (running/paused/stopped)
- Remove a project

Verify: Navigate to the project management page in the browser. Add a project with a valid path — it appears in the list. Edit the name — it updates. Toggle state — it reflects. Remove a project — it disappears. Add an invalid path — error is shown.

#### Invariant

Single source of truth for project identity is the Convex `projects` table. The filesystem path is stored but the project ID is the canonical reference.

---

### Epic 2: Orchestrator Pool

**Goal:** Run one orchestrator per active project within the same daemon process.

**Why second:** The orchestrator is the core loop. Once we have a project registry, we need each project to have its own orchestrator lifecycle.

#### Context

The orchestrator is currently a singleton cached on `globalThis.__fluxOrchestrator`. It subscribes to `api.issues.ready` for one project, manages one `activeSession`, and has one state machine (Stopped/Idle/Busy). All of this is per-project already in logic — the singleton pattern is the only bottleneck.

#### Work

**1. Replace singleton with `Map<projectId, Orchestrator>`**

Change `getOrchestrator(projectId)` in `src/server/orchestrator/index.ts` to maintain a `Map<string, Orchestrator>` on `globalThis`. Each project gets its own instance. Add `removeOrchestrator(projectId)` for cleanup. Hot-reload preservation works the same way (the Map survives HMR).

Verify: Call `getOrchestrator(projectA)` and `getOrchestrator(projectB)` — returns two distinct instances. Calling `getOrchestrator(projectA)` again returns the same instance (cached). HMR reload preserves both instances.

**2. Per-project CWD for agent spawning**

When spawning agents, each orchestrator uses its project's stored `path` as the CWD instead of `resolveRepoRoot()` from the daemon's CWD. Pass the project's path from the registry through the orchestrator to `ClaudeCodeProvider.spawn()`.

Verify: Register two projects with different paths. Enable orchestrators for both. Create a ready issue in each. Verify agents spawn with the correct CWD by checking the spawned process's working directory (visible in session logs or `ps` output).

**3. Orchestrator lifecycle tied to project state**

When a project transitions to `running` → create and enable its orchestrator. `paused` → `orchestrator.stop()` (finishes current session, then idles). `stopped` → `orchestrator.kill()` and remove from Map. Wire these transitions to the project state machine from Epic 1.

Verify: Set project to `running` → orchestrator starts, subscribes to ready issues. Set to `paused` → orchestrator finishes current work then stops picking up new issues. Set to `stopped` → orchestrator instance is removed, `getOrchestrator()` returns undefined for that project.

**4. Multi-project orphan recovery on startup**

On daemon startup, iterate all projects in `running` state, create orchestrators, and run orphan recovery for each. Reuses existing `adoptOrphanedSession()` logic, just applied per-project.

Verify: Start daemon, create a running session for project A, kill the daemon (`kill -9`). Restart daemon. Orphaned session for project A is detected and recovered. Project B (no orphans) starts cleanly.

**5. Concurrent orchestrator test**

Two projects with `running` state, each with a ready issue. Both orchestrators should claim and run sessions concurrently.

Verify: Create ready issues in two different projects. Enable both orchestrators. Both sessions start within seconds of each other. Both complete independently. No cross-contamination of project context in session logs.

#### Invariant

Single session per project. Multiple projects can have active sessions concurrently, but each project runs at most one session at a time.

---

### Epic 3: API & MCP Multi-Project Routing

**Goal:** All API endpoints and MCP tool calls are project-scoped at the request level.

**Why third:** With the registry and orchestrator pool in place, the HTTP layer needs to route requests to the right project context.

#### Context

Currently, `startServer()` receives one `projectId` and creates a single `ToolContext` used by all routes. The MCP handler is created once with `createMcpHandler(projectId, projectSlug)`. All API endpoints implicitly operate on that one project.

#### Work

**1. Project-scoped API routes**

Add project-prefixed routes to the Bun server:
- `POST /api/projects/:projectId/orchestrator` — enable/stop/kill/status
- `GET /api/projects/:projectId/config` — project-specific config
- `GET /sse/projects/:projectId/activity` — SSE stream scoped to project

Keep top-level routes: `GET /api/projects`, `POST /api/projects`.

Verify: `curl /api/projects/:id/orchestrator -d '{"action":"status"}'` returns status for the correct project. `curl /api/projects/:id/config` returns that project's config. SSE stream at `/sse/projects/:id/activity` only shows events for that project.

**2. Dynamic ToolContext per request**

Replace the single startup `ToolContext` with per-request context creation. Extract `projectId` from route parameters, look up the project, build a `ToolContext` with the correct `projectId`, `projectSlug`, and `getOrchestrator()` binding.

Verify: Make API calls for two different projects in the same daemon. Each returns data scoped to its project. No cross-contamination.

**3. MCP per-project endpoints**

Separate MCP endpoints per project: `/mcp/:projectId`. Each agent connects to its project's endpoint. The MCP handler builds a `ToolContext` from the URL's `projectId`. MCP sessions are keyed by `(projectId, sessionId)`.

Verify: Connect an MCP client to `/mcp/<projectA>` and call `issues_list` — returns project A's issues. Connect another client to `/mcp/<projectB>` — returns project B's issues. Tools like `orchestrator_enable` affect only the correct project.

**4. Backwards-compatible `/api/config`**

During transition, keep `/api/config` working. Return the "default" project (first registered, or the single existing project). Log a deprecation warning.

Verify: Existing frontends that fetch `/api/config` continue to work with no changes. New frontends can use `/api/projects` to discover all projects.

#### Invariant

Every tool call and API request is bound to exactly one project. No cross-project operations in a single request.

---

### Epic 4: Frontend Multi-Project UI

**Goal:** Users can see all projects, switch between them, and manage each project's issues/sessions/settings independently in the browser.

**Why fourth:** The backend is multi-project capable after Epics 1-3. The UI catches up.

#### Context

The frontend currently fetches a single `projectId` from `/api/config` at startup, passes it into `RouterContext`, and all components use it implicitly. Routes are flat: `/issues`, `/sessions`, `/settings`. No project switching exists.

#### Work

**1. Project-scoped routing**

Routes become `/p/:projectSlug/issues`, `/p/:projectSlug/sessions`, etc. The `RouterContext` loads `projectId` by looking up the slug via `GET /api/projects`. Root `/` redirects to a default project or project list.

Verify: Navigate to `/p/flux/issues` — shows Flux's issues. Navigate to `/p/forge/issues` — shows Forge's issues. Navigate to `/p/nonexistent/issues` — shows 404 or redirect. Direct URL sharing works (copy URL, open in new tab, lands on correct project).

**2. Project dashboard (landing page)**

Grid view at `/` showing all registered projects with: name, state badge (running/paused/stopped), open issue count, active session indicator. Click to navigate to `/p/:slug/issues`.

Verify: Navigate to `/` — see all projects as cards. Each card shows correct state and issue count. Click a card — navigates to that project's issues page.

**3. Project switcher in navigation**

Compact dropdown in the app shell header for switching between projects without returning to the dashboard. Shows current project name + state indicator. Dropdown lists all projects.

Verify: While on `/p/flux/issues`, click the project switcher. Select "Forge" — navigates to `/p/forge/issues` (preserves the current sub-route). Current project is highlighted in the dropdown.

**4. Per-project orchestrator controls**

The existing enable/stop/kill controls target the selected project's orchestrator via the project-scoped API (`/api/projects/:id/orchestrator`).

Verify: On project A's page, enable orchestrator — status shows "Idle" or "Busy". Switch to project B — orchestrator status reflects project B's state independently. Stop project A's orchestrator — project B is unaffected.

**5. Per-project settings page**

Settings view at `/p/:slug/settings` where users can edit the project's name, path, orchestrator config (timeout, max failures, etc.).

Verify: Navigate to `/p/flux/settings`. Edit the project name — it updates in the header and dashboard. Edit the path — persists on reload. Change session timeout — next session uses the new value.

#### Invariant

URL always reflects which project is active. Sharing a URL links directly to the right project context.

---

### Epic 5: Always-On Daemon via macOS LaunchAgent

**Goal:** The Flux daemon runs as a macOS LaunchAgent — starts on login, auto-restarts on crash, and agents can safely kill/restart the process when needed (e.g., after self-updating Flux code).

**Why last:** This is a packaging/lifecycle concern, not a functional one. Multi-project works with manual `flux dev` first. Always-on is a convenience layer.

#### Context

Currently, `bun dev` or `bun run start` must be manually started. There's no service management, no auto-restart, no boot persistence. The PID watchdog and orphan recovery handle crash recovery *within* a running process — this epic handles process-level lifecycle.

**Why LaunchAgent (not a custom PID manager):** When an agent encounters a bug in Flux itself and fixes it, it needs to restart the daemon. With a terminal-attached process, killing it orphans the session. With launchd, the agent can `kill` the process and launchd auto-restarts with the updated code. Flux becomes self-healing.

#### Work

**1. `flux daemon install` — generate and load LaunchAgent plist**

Generates `~/Library/LaunchAgents/dev.flux.daemon.plist` with `KeepAlive: true`, `RunAtLoad: true`, stdout/stderr to `~/.flux/logs/`. Runs `launchctl load` to register. Detects Bun path and Flux entry point automatically.

Verify: Run `flux daemon install`. Check `~/Library/LaunchAgents/dev.flux.daemon.plist` exists with correct paths. Run `launchctl list | grep dev.flux.daemon` — shows the job. `curl http://localhost:8042/health` returns 200.

**2. `flux daemon uninstall` — remove LaunchAgent**

Runs `launchctl unload` and deletes the plist file.

Verify: Run `flux daemon uninstall`. `launchctl list | grep dev.flux.daemon` returns nothing. Plist file is gone. Port 8042 is no longer listening.

**3. `flux daemon status` — show daemon health**

Checks `launchctl list dev.flux.daemon` for PID and status. Hits `/health` endpoint for runtime info: uptime, active projects count, active sessions count.

Verify: Run `flux daemon status` while daemon is running — shows PID, uptime, project count. Run while daemon is stopped — shows "not running".

**4. `flux daemon stop` / `flux daemon start` — temporary control**

Wraps `launchctl stop/start dev.flux.daemon` for temporary pause/resume without uninstalling.

Verify: `flux daemon stop` — daemon PID disappears, port closes. `flux daemon start` — daemon restarts. The LaunchAgent remains installed through both.

**5. Auto-restart on crash**

launchd's `KeepAlive: true` handles this natively. The daemon process exits → launchd restarts it → orphan recovery runs on startup.

Verify: `kill -9 $(pgrep -f 'flux/src/index.ts')` — daemon restarts within seconds. Create a running session, kill daemon, verify orphan recovery adopts the session on restart.

**6. Graceful shutdown on SIGTERM**

On SIGTERM (what launchd sends before SIGKILL): stop accepting new sessions, wait for active sessions to complete (configurable timeout, default 60s), then exit cleanly. Set `ExitTimeOut` in the plist to match.

Verify: Start a session, then `flux daemon stop`. Session completes (or times out) before daemon exits. No orphaned sessions after clean shutdown.

**7. Extended `/health` endpoint**

Add to existing `/health`: uptime, active project count, active session count, memory usage.

Verify: `curl http://localhost:8042/health | jq` shows all fields with correct values.

#### Design Direction

LaunchAgent is the primary always-on mechanism. `bun dev` (with `concurrently`) continues for development — the two are mutually exclusive (same port).

#### Invariant

The daemon can always be recovered. A crash triggers launchd auto-restart. Orphaned sessions are detected and cleaned up on startup.

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
  │      └──→ Epic 5: Daemon Lifecycle (independent of 3 & 4)
```

**Critical path:** Epic 1 → Epic 2 → Epic 3 → Epic 4

Epic 5 can begin after Epic 2.

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multiple orchestrators competing for resources | Agent subprocesses consume CPU/memory | Project `state` controls: only `running` projects spawn agents. User controls concurrency by pausing projects. |
| Convex subscription fan-out | N projects = N `onUpdate` subscriptions | Convex handles this natively. Monitor for performance at >20 projects. |
| Git conflicts between projects | None (projects are separate repos) | Each project has its own CWD. No shared git state. |
| Daemon crash loses all projects | Orchestrated work stops | launchd `KeepAlive` auto-restarts. Orphan recovery on startup. |
| Migration from single-project | Existing users must re-register | Auto-detect: if no projects registered, infer from CWD and auto-register. Zero-friction migration. |

---

## Non-Goals (Explicitly Out of Scope)

- **Cross-project dependencies** — Issues in project A do not block issues in project B
- **Shared agent pools** — Each project manages its own agent sessions
- **Multi-user** — Flux remains a personal tool on one user's machine
- **Remote daemon** — No networked multi-machine orchestration
- **Anvil tools** — Covered separately (independent of multi-project)
- **Auto-planning** — Covered separately (can layer on after multi-project)

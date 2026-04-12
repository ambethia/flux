# Installation

This document covers local setup for development and the optional background daemon on macOS and Linux.

## Prerequisites

- [Bun](https://bun.sh) installed and available on your `PATH`
- A Convex deployment and its `CONVEX_URL`
- Git

## Clone And Install

```bash
git clone <your-fork-or-repo-url>
cd flux
bun install
```

## Recommended: Add `flux` To Your `PATH`

This repo already includes a helper at `bin/flux`, which is a thin wrapper around `src/cli.ts`. If you plan to work on Flux regularly, put the repo's `bin/` directory on your shell `PATH` early so you can use `flux ...` directly instead of `bun run flux ...`.

For `zsh`:

```bash
echo 'export PATH="/absolute/path/to/flux/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

For `bash`:

```bash
echo 'export PATH="/absolute/path/to/flux/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Then verify:

```bash
which flux
flux --help
```

If you do not want to change your `PATH`, every command in this doc also works as `bun run flux ...`.

## Environment

Create `.env.local` in the repo root:

```bash
CONVEX_URL=https://<your-deployment>.convex.cloud
# Optional, defaults to 8042
FLUX_PORT=8042
```

`CONVEX_URL` is required. The Bun server reads it directly, and `flux daemon install` uses it when generating the service definition.

## Run Locally

```bash
bun dev
```

Then open `http://localhost:8042`.

`bun dev` starts:
- Bun on `:8042`
- `convex dev`
- Vite on `:8043`, proxied through Bun

## Production-Style Run

Build the frontend, then serve the compiled app from Bun:

```bash
bun run build:frontend
bun run start
```

## Optional Daemon Install

Use the daemon if you want Flux to stay running in the background and restart automatically.

```bash
bun run flux daemon install
```

If you already have the `flux` wrapper on your `PATH`, `flux daemon install` is equivalent.

### macOS

Flux installs a `launchd` LaunchAgent at `~/Library/LaunchAgents/dev.flux.daemon.plist`.

Useful commands:

```bash
bun run flux daemon status
bun run flux daemon uninstall
launchctl stop dev.flux.daemon
curl http://localhost:8042/health
tail -20 ~/.flux/logs/daemon.stdout.log
```

Notes:
- `launchctl stop` only stops the current process. Because the job uses `KeepAlive`, launchd will restart it.
- To fully remove the service, use `bun run flux daemon uninstall`.

### Linux

Flux installs a user-level `systemd` service at `~/.config/systemd/user/dev.flux.daemon.service`.

Useful commands:

```bash
bun run flux daemon status
bun run flux daemon start
bun run flux daemon stop
bun run flux daemon uninstall
systemctl --user status dev.flux.daemon
journalctl --user -u dev.flux.daemon -f
curl http://localhost:8042/health
```

Notes:
- The service is installed as a user unit, not a system-wide service.
- `bun run flux daemon stop` stops the service cleanly. Use `start` to bring it back.

## Troubleshooting

- `CONVEX_URL environment variable is not set`
  Set `CONVEX_URL` in `.env.local` or export it in your shell before starting Flux.
- `Could not find bun binary`
  Install Bun and make sure `which bun` resolves to a real binary on your `PATH`.
- The UI does not reflect code changes
  `bun dev` should restart automatically. If the daemon gets stuck, restart it for your platform:

```bash
# macOS
launchctl stop dev.flux.daemon

# Linux
systemctl --user restart dev.flux.daemon
```

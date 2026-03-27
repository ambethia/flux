/**
 * flux orchestrator <subcommand> — manage the orchestrator from the CLI.
 *
 * Subcommands:
 *   status
 *   run <issueId>
 */

import { getApiClient } from "./flux-api";

const FLUX_URL = process.env.FLUX_URL ?? "http://localhost:8042";

type OrchestratorStatus = {
  state: string;
  readyCount?: number;
  activeSession?: {
    sessionId: string;
    issueId?: string;
    phase?: string;
    pid?: number;
    startedAt?: number;
  } | null;
};

async function cmdStatus(): Promise<void> {
  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("orchestrator_status");
  const status = payload.status as OrchestratorStatus;

  console.log(`Project:  ${api.project.slug} (${api.project.id})`);
  console.log(`State:    ${status.state}`);

  if (status.readyCount !== undefined) {
    console.log(`Ready:    ${status.readyCount} issue(s)`);
  }

  if (status.activeSession) {
    const session = status.activeSession;
    console.log(`Session:  ${session.sessionId}`);
    if (session.phase) console.log(`Phase:    ${session.phase}`);
    if (session.pid !== undefined) console.log(`PID:      ${session.pid}`);
    if (session.startedAt) {
      console.log(`Started:  ${new Date(session.startedAt).toISOString()}`);
    }
  } else {
    console.log("Session:  none");
  }
}

async function cmdRun(args: string[]): Promise<void> {
  const issueId = args[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux orchestrator run FLUX-42)");
    process.exit(1);
  }

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("orchestrator_run", { issueId });
  const session = payload.session as { sessionId: string; pid?: number };
  console.log(`Session started: ${session.sessionId}`);
  if (session.pid !== undefined) console.log(`PID: ${session.pid}`);
}

function printUsage(): void {
  console.error(
    [
      "Usage: flux orchestrator <subcommand>",
      "",
      "Subcommands:",
      "  status         Show orchestrator state and active session info",
      "  run <issueId>  Trigger the orchestrator to work on an issue",
    ].join("\n"),
  );
}

export async function orchestratorCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "status":
      await cmdStatus();
      break;
    case "run":
      await cmdRun(rest);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

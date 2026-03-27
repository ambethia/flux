/**
 * flux sessions <subcommand> — view session history from the CLI.
 *
 * Subcommands:
 *   list [--status <status>] [--limit <n>]
 *   show <sessionId>
 */

import { getApiClient } from "./flux-api";

const FLUX_URL = process.env.FLUX_URL ?? "http://localhost:8042";

type Session = {
  _id: string;
  status: string;
  phase?: string;
  issueId?: string;
  agentName?: string;
  pid?: number;
  startedAt?: number;
  endedAt?: number;
};

function parseFlags(args: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function formatDuration(startedAt: number, endedAt?: number): string {
  const end = endedAt ?? Date.now();
  const ms = end - startedAt;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

async function cmdList(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const toolArgs: Record<string, unknown> = {};
  if (flags.status) toolArgs.status = flags.status;
  if (flags.limit) toolArgs.limit = Number(flags.limit);

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("sessions_list", toolArgs);
  const sessions = payload.sessions as Session[];

  if (sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  for (const session of sessions) {
    const duration = session.startedAt
      ? ` (${formatDuration(session.startedAt, session.endedAt)})`
      : "";
    const phase = session.phase ? ` [${session.phase}]` : "";
    console.log(
      `${session.status.padEnd(12)} ${session._id}${phase}${duration}`,
    );
  }
  console.log(`\n${payload.count as number} session(s)`);
}

async function cmdShow(args: string[]): Promise<void> {
  const { positional } = parseFlags(args);
  const sessionId = positional[0];
  if (!sessionId) {
    console.error("Error: session ID required (e.g. flux sessions show <sessionId>)");
    process.exit(1);
  }

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("sessions_show", { sessionId });
  const session = payload.session as Session;
  const transcript = payload.transcript as {
    lines: Array<{ sequence: number; direction: string; content: string; timestamp: number }>;
    totalLines: number;
    showing: string;
  };

  console.log(`Session:  ${session._id}`);
  console.log(`Status:   ${session.status}`);
  if (session.phase) console.log(`Phase:    ${session.phase}`);
  if (session.agentName) console.log(`Agent:    ${session.agentName}`);
  if (session.pid !== undefined) console.log(`PID:      ${session.pid}`);
  if (session.startedAt) {
    console.log(`Started:  ${new Date(session.startedAt).toISOString()}`);
  }
  if (session.endedAt) {
    console.log(`Ended:    ${new Date(session.endedAt).toISOString()}`);
    if (session.startedAt) {
      console.log(`Duration: ${formatDuration(session.startedAt, session.endedAt)}`);
    }
  }

  if (transcript.lines.length > 0) {
    console.log(`\nTranscript (${transcript.showing}):`);
    console.log("─".repeat(60));
    for (const line of transcript.lines) {
      console.log(line.content);
    }
  } else {
    console.log("\nNo transcript available.");
  }
}

function printUsage(): void {
  console.error(
    [
      "Usage: flux sessions <subcommand> [options]",
      "",
      "Subcommands:",
      "  list [--status <status>] [--limit <n>]",
      "    List sessions. Status: running | completed | failed",
      "",
      "  show <sessionId>",
      "    Show session detail and transcript",
    ].join("\n"),
  );
}

export async function sessionsCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "list":
      await cmdList(rest);
      break;
    case "show":
      await cmdShow(rest);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

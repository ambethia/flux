/**
 * flux issues <subcommand> — manage issues from the CLI.
 *
 * Subcommands:
 *   list [--status <status>] [--limit <n>]
 *   get <id>
 *   create --title <title> [--description <desc>] [--priority <priority>]
 *   search <query>
 *   close <id> --closeType <type> [--reason <reason>]
 *   defer <id> --note <note>
 *   undefer <id> --note <note>
 */

import { getApiClient } from "./flux-api";

const FLUX_URL = process.env.FLUX_URL ?? "http://localhost:8042";

// ── Formatting helpers ─────────────────────────────────────────────────

function formatPriority(priority: string): string {
  const badges: Record<string, string> = {
    critical: "[CRITICAL]",
    high: "[HIGH]    ",
    medium: "[MEDIUM]  ",
    low: "[LOW]     ",
  };
  return badges[priority] ?? `[${priority.toUpperCase()}]`;
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    open: "open       ",
    in_progress: "in_progress",
    closed: "closed     ",
    deferred: "deferred   ",
    stuck: "stuck      ",
  };
  return labels[status] ?? status;
}

type Issue = {
  _id: string;
  shortId: string;
  title: string;
  status: string;
  priority: string;
  description?: string;
  assignee?: string;
  createdAt?: number;
  failureCount?: number;
};

function printIssueList(issues: Issue[]): void {
  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }
  for (const issue of issues) {
    console.log(
      `${formatPriority(issue.priority)} ${formatStatus(issue.status)} ${issue.shortId.padEnd(16)} ${issue.title}`,
    );
  }
}

function printIssueDetail(issue: Issue): void {
  console.log(`ID:          ${issue.shortId} (${issue._id})`);
  console.log(`Title:       ${issue.title}`);
  console.log(`Status:      ${issue.status}`);
  console.log(`Priority:    ${issue.priority}`);
  if (issue.assignee) console.log(`Assignee:    ${issue.assignee}`);
  if (issue.failureCount !== undefined && issue.failureCount > 0) {
    console.log(`Failures:    ${issue.failureCount}`);
  }
  if (issue.createdAt) {
    console.log(`Created:     ${new Date(issue.createdAt).toISOString()}`);
  }
  if (issue.description) {
    console.log("");
    console.log("Description:");
    console.log(issue.description);
  }
}

// ── Argument parsing ───────────────────────────────────────────────────

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

function requireFlag(flags: Record<string, string>, name: string): string {
  const value = flags[name];
  if (!value) {
    console.error(`Error: --${name} is required`);
    process.exit(1);
  }
  return value;
}

// ── Subcommand handlers ────────────────────────────────────────────────

async function cmdList(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const api = await getApiClient(FLUX_URL);

  const toolArgs: Record<string, unknown> = {};
  if (flags.status) toolArgs.status = flags.status;
  if (flags.limit) toolArgs.limit = Number(flags.limit);

  const payload = await api.call("issues_list", toolArgs);
  const issues = payload.issues as Issue[];
  printIssueList(issues);
  console.log(`\n${payload.count as number} issue(s)`);
}

async function cmdGet(args: string[]): Promise<void> {
  const { positional } = parseFlags(args);
  const issueId = positional[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux issues get FLUX-42)");
    process.exit(1);
  }

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_get", { issueId });
  printIssueDetail(payload.issue as Issue);
}

async function cmdCreate(args: string[]): Promise<void> {
  const { flags } = parseFlags(args);
  const title = requireFlag(flags, "title");

  const toolArgs: Record<string, unknown> = { title };
  if (flags.description) toolArgs.description = flags.description;
  if (flags.priority) toolArgs.priority = flags.priority;

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_create", toolArgs);
  const issue = payload.issue as Issue;
  console.log(`Created: ${issue.shortId}`);
  console.log(`Title:   ${issue.title}`);
  console.log(`Status:  ${issue.status}`);
  console.log(`Priority: ${issue.priority}`);
}

async function cmdSearch(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const query = positional.join(" ");
  if (!query) {
    console.error("Error: search query required (e.g. flux issues search 'login bug')");
    process.exit(1);
  }

  const toolArgs: Record<string, unknown> = { query };
  if (flags.limit) toolArgs.limit = Number(flags.limit);

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_search", toolArgs);
  const issues = payload.issues as Issue[];
  printIssueList(issues);
  console.log(`\n${payload.count as number} result(s) for "${payload.query as string}"`);
}

async function cmdClose(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const issueId = positional[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux issues close FLUX-42 --closeType done)");
    process.exit(1);
  }
  const closeType = requireFlag(flags, "closeType");

  const toolArgs: Record<string, unknown> = { issueId, closeType };
  if (flags.reason) toolArgs.reason = flags.reason;

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_close", toolArgs);
  const issue = payload.issue as Issue;
  console.log(`Closed: ${issue.shortId} (${closeType})`);
}

async function cmdDefer(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const issueId = positional[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux issues defer FLUX-42 --note 'blocked')");
    process.exit(1);
  }
  const note = requireFlag(flags, "note");

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_defer", { issueId, note });
  const issue = payload.issue as Issue;
  console.log(`Deferred: ${issue.shortId}`);
}

async function cmdUndefer(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const issueId = positional[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux issues undefer FLUX-42 --note 'unblocked')");
    process.exit(1);
  }
  const note = requireFlag(flags, "note");

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("issues_undefer", { issueId, note });
  const issue = payload.issue as Issue;
  console.log(`Undeferred: ${issue.shortId}`);
}

// ── Usage ──────────────────────────────────────────────────────────────

function printUsage(): void {
  console.error(
    [
      "Usage: flux issues <subcommand> [options]",
      "",
      "Subcommands:",
      "  list [--status <status>] [--limit <n>]",
      "    List issues. Status: open | in_progress | closed | deferred | stuck",
      "",
      "  get <id>",
      "    Get full details for a single issue (short ID or document ID)",
      "",
      "  create --title <title> [--description <desc>] [--priority <priority>]",
      "    Create a new issue. Priority: critical | high | medium | low",
      "",
      "  search <query>",
      "    Search issues by title or short ID",
      "",
      "  close <id> --closeType <type> [--reason <reason>]",
      "    Close an issue. Type: completed | noop | duplicate | wontfix",
      "",
      "  defer <id> --note <note>",
      "    Defer an issue (remove from ready queue)",
      "",
      "  undefer <id> --note <note>",
      "    Undefer an issue (return to ready queue)",
    ].join("\n"),
  );
}

// ── Entry point ────────────────────────────────────────────────────────

export async function issuesCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "list":
      await cmdList(rest);
      break;
    case "get":
      await cmdGet(rest);
      break;
    case "create":
      await cmdCreate(rest);
      break;
    case "search":
      await cmdSearch(rest);
      break;
    case "close":
      await cmdClose(rest);
      break;
    case "defer":
      await cmdDefer(rest);
      break;
    case "undefer":
      await cmdUndefer(rest);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

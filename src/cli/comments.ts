/**
 * flux comments <subcommand> — manage issue comments from the CLI.
 *
 * Subcommands:
 *   create <issueId> --content <text> [--author <author>]
 */

import { getApiClient } from "./flux-api";

const FLUX_URL = process.env.FLUX_URL ?? "http://localhost:8042";

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

async function cmdCreate(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const issueId = positional[0];
  if (!issueId) {
    console.error("Error: issue ID required (e.g. flux comments create FLUX-42 --content 'note')");
    process.exit(1);
  }
  const content = requireFlag(flags, "content");

  const toolArgs: Record<string, unknown> = { issueId, content };
  if (flags.author) toolArgs.author = flags.author;

  const api = await getApiClient(FLUX_URL);
  const payload = await api.call("comments_create", toolArgs);
  console.log(`Comment added to ${issueId} (commentId: ${payload.commentId as string})`);
}

function printUsage(): void {
  console.error(
    [
      "Usage: flux comments <subcommand> [options]",
      "",
      "Subcommands:",
      "  create <issueId> --content <text> [--author <author>]",
      "    Add a comment to an issue. Author: user | agent | flux (default: agent)",
    ].join("\n"),
  );
}

export async function commentsCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "create":
      await cmdCreate(rest);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

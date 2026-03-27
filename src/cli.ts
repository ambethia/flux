import { daemonInstall } from "./cli/daemon-install";
import { daemonStart } from "./cli/daemon-start";
import { daemonStatus } from "./cli/daemon-status";
import { daemonStop } from "./cli/daemon-stop";
import { daemonUninstall } from "./cli/daemon-uninstall";
import { mcpSmokeFollowup } from "./cli/mcp-smoke-followup";
import { issuesCommand } from "./cli/issues";
import { commentsCommand } from "./cli/comments";
import { orchestratorCommand } from "./cli/orchestrator";
import { sessionsCommand } from "./cli/sessions";

const args = process.argv.slice(2);
const group = args[0];
const subArgs = args.slice(1);

// Exact two-word commands for daemon/mcp groups
const twoWordCommand = args.slice(0, 2).join(" ");

switch (group) {
  case "daemon":
    switch (twoWordCommand) {
      case "daemon install":
        await daemonInstall();
        break;
      case "daemon uninstall":
        await daemonUninstall();
        break;
      case "daemon status":
        await daemonStatus();
        break;
      case "daemon stop":
        await daemonStop();
        break;
      case "daemon start":
        await daemonStart();
        break;
      default:
        console.error(
          `Unknown daemon subcommand: ${subArgs[0] ?? "(none)"}\n\nDaemon commands:\n  daemon install     Install and start the daemon as a background service\n  daemon uninstall   Stop and remove the daemon background service\n  daemon status      Show daemon status, PID, uptime, and runtime info\n  daemon stop        Stop the daemon\n  daemon start       Start the daemon`,
        );
        process.exit(1);
    }
    break;

  case "mcp":
    if (twoWordCommand === "mcp smoke-followup") {
      await mcpSmokeFollowup();
    } else {
      console.error(
        `Unknown mcp subcommand: ${subArgs[0] ?? "(none)"}\n\nMCP commands:\n  mcp smoke-followup   Create and auto-close a temporary issue through the MCP stdio bridge`,
      );
      process.exit(1);
    }
    break;

  case "issues":
    await issuesCommand(subArgs);
    break;

  case "comments":
    await commentsCommand(subArgs);
    break;

  case "orchestrator":
    await orchestratorCommand(subArgs);
    break;

  case "sessions":
    await sessionsCommand(subArgs);
    break;

  default:
    console.error(
      group
        ? `Unknown command: ${args.join(" ")}`
        : [
            "Usage: flux <command>",
            "",
            "Daemon commands:",
            "  daemon install     Install and start the daemon as a background service",
            "  daemon uninstall   Stop and remove the daemon background service",
            "  daemon status      Show daemon status, PID, uptime, and runtime info",
            "  daemon stop        Stop the daemon",
            "  daemon start       Start the daemon",
            "",
            "Issue commands:",
            "  issues list [--status <status>] [--limit <n>]",
            "  issues get <id>",
            "  issues create --title <title> [--description <desc>] [--priority <p>]",
            "  issues search <query>",
            "  issues close <id> --closeType <type> [--reason <reason>]",
            "  issues defer <id> --note <note>",
            "  issues undefer <id> --note <note>",
            "",
            "Comment commands:",
            "  comments create <issueId> --content <text> [--author <author>]",
            "",
            "Orchestrator commands:",
            "  orchestrator status",
            "  orchestrator run <issueId>",
            "",
            "Session commands:",
            "  sessions list [--status <status>] [--limit <n>]",
            "  sessions show <sessionId>",
            "",
            "MCP commands:",
            "  mcp smoke-followup   Create and auto-close a temporary issue through the MCP stdio bridge",
          ].join("\n"),
    );
    process.exit(1);
}

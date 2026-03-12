import { daemonInstall } from "./cli/daemon-install";
import { daemonStart } from "./cli/daemon-start";
import { daemonStatus } from "./cli/daemon-status";
import { daemonStop } from "./cli/daemon-stop";
import { daemonUninstall } from "./cli/daemon-uninstall";
import { mcpSmokeFollowup } from "./cli/mcp-smoke-followup";

const args = process.argv.slice(2);
const command = args.join(" ");

switch (command) {
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
  case "mcp smoke-followup":
    await mcpSmokeFollowup();
    break;
  default:
    console.error(
      command
        ? `Unknown command: ${command}`
        : "Usage: flux <command>\n\nCommands:\n  daemon install     Generate and load macOS LaunchAgent plist\n  daemon uninstall   Remove macOS LaunchAgent plist\n  daemon status      Show daemon status, PID, uptime, and runtime info\n  daemon stop        Stop the daemon (launchd will restart per KeepAlive)\n  daemon start       Start the daemon\n  mcp smoke-followup Create and auto-close a temporary issue through the MCP stdio bridge",
    );
    process.exit(1);
}

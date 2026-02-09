import { daemonInstall } from "./cli/daemon-install";
import { daemonStatus } from "./cli/daemon-status";
import { daemonUninstall } from "./cli/daemon-uninstall";

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
  default:
    console.error(
      command
        ? `Unknown command: ${command}`
        : "Usage: flux <command>\n\nCommands:\n  daemon install     Generate and load macOS LaunchAgent plist\n  daemon uninstall   Remove macOS LaunchAgent plist\n  daemon status      Show daemon status, PID, uptime, and recent logs",
    );
    process.exit(1);
}

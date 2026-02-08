import { daemonInstall } from "./cli/daemon-install";
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
  default:
    console.error(
      command
        ? `Unknown command: ${command}`
        : "Usage: flux <command>\n\nCommands:\n  daemon install     Generate and load macOS LaunchAgent plist\n  daemon uninstall   Remove macOS LaunchAgent plist",
    );
    process.exit(1);
}

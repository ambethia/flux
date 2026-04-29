import { daemonInstall } from "./cli/daemon-install";
import { daemonStart } from "./cli/daemon-start";
import { daemonStatus } from "./cli/daemon-status";
import { daemonStop } from "./cli/daemon-stop";
import { daemonUninstall } from "./cli/daemon-uninstall";
import { mcpSmokeFollowup } from "./cli/mcp-smoke-followup";
import { isToolCommand, runToolCommand } from "./cli/tools";

const args = process.argv.slice(2);

/** Parse a boolean `--name` flag. Returns true if present, false otherwise. */
function takeBoolFlag(args: string[], name: string): boolean {
  const long = `--${name}`;
  const idx = args.indexOf(long);
  if (idx === -1) return false;
  args.splice(idx, 1);
  return true;
}

// Tool commands (issues, comments, epics, etc.) take priority
if (isToolCommand(args)) {
  await runToolCommand(args);
} else if (args[0] === "daemon" && args[1] === "install") {
  const installArgs = args.slice(2);
  const prodMode = takeBoolFlag(installArgs, "prod");
  if (installArgs.length > 0) {
    console.error(
      `Unknown argument(s) for 'daemon install': ${installArgs.join(" ")}`,
    );
    console.error(`Usage: flux daemon install [--prod]`);
    process.exit(1);
  }
  await daemonInstall({ mode: prodMode ? "prod" : "dev" });
} else {
  // Daemon and utility commands
  const command = args.join(" ");
  switch (command) {
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
        `Unknown command: ${command}\nRun 'flux' for available commands.`,
      );
      process.exit(1);
  }
}

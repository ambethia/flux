import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { IS_LINUX, isDaemonLoaded, LABEL, plistPath } from "./daemon-common";
import { daemonStopLinux } from "./daemon-linux";

export async function daemonStop(): Promise<void> {
  if (IS_LINUX) return daemonStopLinux();

  const plist = plistPath();

  if (!existsSync(plist)) {
    console.error(`${LABEL} is not installed. Run: flux daemon install`);
    process.exit(1);
  }

  if (!isDaemonLoaded()) {
    console.log(`${LABEL} is already stopped.`);
    return;
  }

  console.log(`Stopping ${LABEL}...`);
  execSync(`launchctl unload "${plist}"`, { stdio: "pipe" });
  console.log(`Stopped ${LABEL}. Run 'flux daemon start' to start it again.`);
}

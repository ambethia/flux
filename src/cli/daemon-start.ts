import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  IS_LINUX,
  isDaemonLoaded,
  LABEL,
  plistPath,
  readDaemonConfig,
} from "./daemon-common";
import { daemonStartLinux } from "./daemon-linux";

export async function daemonStart(): Promise<void> {
  if (IS_LINUX) return daemonStartLinux();

  const plist = plistPath();

  if (!existsSync(plist)) {
    console.error(`${LABEL} is not installed. Run: flux daemon install`);
    process.exit(1);
  }

  console.log(`Starting ${LABEL}...`);
  if (isDaemonLoaded()) {
    execSync(`launchctl start ${LABEL}`, { stdio: "pipe" });
    console.log(`Sent start signal to ${LABEL}.`);
  } else {
    execSync(`launchctl load "${plist}"`, { stdio: "pipe" });
    console.log(`Loaded and started ${LABEL}.`);
  }

  // Give the process a moment to spin up, then check status
  const { fluxPort } = readDaemonConfig();
  console.log(`\nVerify: curl http://localhost:${fluxPort}/health`);
  console.log(`Or run: flux daemon status`);
}

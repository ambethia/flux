import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LABEL = "dev.flux.daemon";
const PLIST_FILENAME = `${LABEL}.plist`;

export async function daemonUninstall(): Promise<void> {
  const home = homedir();
  const plistPath = join(home, "Library/LaunchAgents", PLIST_FILENAME);

  if (!existsSync(plistPath)) {
    console.log(
      `${LABEL} is not installed (${plistPath} does not exist). Nothing to do.`,
    );
    return;
  }

  // 1. Unload from launchd (stop the daemon)
  const isLoaded = (() => {
    try {
      execSync(`launchctl list ${LABEL}`, { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })();

  if (isLoaded) {
    console.log(`Unloading ${LABEL}...`);
    execSync(`launchctl unload "${plistPath}"`, { stdio: "pipe" });
    console.log(`Unloaded ${LABEL}`);
  } else {
    console.log(`${LABEL} is not loaded in launchd (skipping unload)`);
  }

  // 2. Delete the plist file
  unlinkSync(plistPath);
  console.log(`Removed ${plistPath}`);

  // 3. Verify removal
  try {
    execSync(`launchctl list ${LABEL}`, { stdio: "pipe" });
    throw new Error(
      `${LABEL} is still registered with launchd after unload. Manual intervention may be needed.`,
    );
  } catch (err) {
    // Expected: launchctl list should fail because the service is gone
    if (err instanceof Error && err.message.includes("still registered")) {
      throw err;
    }
  }

  console.log(`\n✓ ${LABEL} has been uninstalled`);
  console.log(
    `\nNote: Log files at ~/.flux/logs/ have been preserved. Remove them manually if desired.`,
  );
}

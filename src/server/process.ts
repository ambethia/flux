/**
 * Check if a process with the given PID is still alive.
 * Uses signal 0 (no-op) to probe liveness, then checks for zombie state.
 * Zombies (defunct processes) pass kill(0) but are not actually running —
 * they're just unreap'd entries in the process table.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // kill(0) succeeds for zombies — verify the process isn't defunct
  try {
    const result = Bun.spawnSync(["ps", "-p", String(pid), "-o", "stat="]);
    const stat = result.stdout.toString().trim();
    if (stat.startsWith("Z")) return false;
  } catch {
    // If ps fails, trust kill(0)
  }
  return true;
}

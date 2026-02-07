/**
 * Check if a process with the given PID is still alive.
 * Uses signal 0 (no-op) to probe liveness without side effects.
 * Returns false if the process has exited or the PID is invalid.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

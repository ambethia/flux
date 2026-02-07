export interface SpawnOptions {
  cwd: string;
  prompt: string;
}

export interface AgentProcess {
  pid: number;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  kill(): void;
  wait(): Promise<{ exitCode: number }>;
}

export interface AgentProvider {
  /** Provider identifier (e.g., "claude") */
  name: string;
  /** Spawn an agent process with the given prompt */
  spawn(opts: SpawnOptions): AgentProcess;
  /** Build the work prompt for an issue */
  buildWorkPrompt(issue: {
    shortId: string;
    title: string;
    description?: string;
  }): string;
}

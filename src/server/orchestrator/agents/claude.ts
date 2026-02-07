import type { AgentProcess, AgentProvider, SpawnOptions } from "./types";

export class ClaudeCodeProvider implements AgentProvider {
  name = "claude" as const;

  spawn(opts: SpawnOptions): AgentProcess {
    const proc = Bun.spawn(
      [
        "claude",
        "--output-format",
        "stream-json",
        "--print",
        "-p",
        opts.prompt,
      ],
      {
        cwd: opts.cwd,
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    return {
      pid: proc.pid,
      stdout: proc.stdout as ReadableStream<Uint8Array>,
      stderr: proc.stderr as ReadableStream<Uint8Array>,
      kill: () => proc.kill(),
      wait: async () => {
        const exitCode = await proc.exited;
        return { exitCode };
      },
    };
  }

  buildWorkPrompt(issue: {
    shortId: string;
    title: string;
    description?: string;
  }): string {
    const lines = [`## Issue ${issue.shortId}: ${issue.title}`];
    if (issue.description) {
      lines.push("", issue.description);
    }
    return lines.join("\n");
  }
}

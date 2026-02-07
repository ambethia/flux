/** Rolling window buffer for agent activity output lines. */
export class ActivityBuffer {
  private lines: string[] = [];
  private readonly maxLines: number;

  constructor(maxLines = 500) {
    this.maxLines = maxLines;
  }

  /** Add a line to the buffer. Evicts oldest if at capacity. */
  push(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.maxLines) {
      this.lines.shift();
    }
  }

  /** Get the last N lines (or all if N > buffer size). */
  getRecent(n: number): string[] {
    return this.lines.slice(-n);
  }

  /** Get all buffered lines. */
  getAll(): string[] {
    return [...this.lines];
  }

  /** Current number of buffered lines. */
  get length(): number {
    return this.lines.length;
  }

  /** Clear the buffer. */
  clear(): void {
    this.lines = [];
  }
}

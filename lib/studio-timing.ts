export type StudioPhase =
  "decision" | "upload" | "signup" | "queue" | "generation" | "export";

// A foreground interaction estimate, not a substitute for a moderated study.
// Reading/thinking gets 30 seconds after the last activity. Hidden, unfocused
// and idle decision time is excluded; provider latency is measured separately.
export class StudioTimer {
  private last: number;
  private activity: number;
  private pending = 0;
  private foreground: boolean;
  constructor(
    private phase: StudioPhase,
    at: number,
    foreground = true,
  ) {
    this.last = at;
    this.activity = at;
    this.foreground = foreground;
  }
  private advance(at: number) {
    const end =
      this.phase === "decision" ? Math.min(at, this.activity + 30000) : at;
    if (this.foreground && at - this.last <= 60000)
      this.pending += Math.max(0, end - this.last);
    this.last = Math.max(this.last, at);
  }
  interact(at: number) {
    this.advance(at);
    this.activity = at;
  }
  observe(at: number, foreground: boolean) {
    this.advance(at);
    if (foreground && !this.foreground) this.activity = at;
    this.foreground = foreground;
  }
  drain(at: number) {
    this.advance(at);
    const milliseconds = Math.floor(this.pending);
    this.pending -= milliseconds;
    return milliseconds;
  }
}

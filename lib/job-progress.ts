type Timer = ReturnType<typeof setInterval>;

// Keep background work moving while a workspace is open. An advance request
// can stay open for a whole image render, so progress comes from a small
// status check instead, and everything reloads only when that status changes.
export function watchJobs({
  advance,
  status,
  reload,
  hidden = () => document.hidden,
  every = 2000,
  schedule = (callback, ms) => setInterval(callback, ms),
  unschedule = (timer) => clearInterval(timer),
}: {
  advance: () => Promise<unknown>;
  status: () => Promise<unknown>;
  reload: () => Promise<unknown>;
  hidden?: () => boolean;
  every?: number;
  schedule?: (callback: () => void, ms: number) => Timer;
  unschedule?: (timer: Timer) => void;
}) {
  let advancing = false,
    checking = false,
    again = false,
    stopped = false,
    seen = "";
  async function check() {
    if (stopped || hidden()) return;
    if (checking) {
      again = true;
      return;
    }
    checking = true;
    try {
      const snapshot = JSON.stringify(await status());
      if (snapshot !== seen && !stopped) {
        await reload();
        seen = snapshot;
      }
    } catch {
      // The next check tries again.
    } finally {
      checking = false;
      if (again) {
        again = false;
        void check();
      }
    }
  }
  // Each advance is followed by one status check, so a result the page saved
  // itself shows at once. While a render holds the advance open, progress
  // comes from a check on each interval instead.
  const timer = schedule(() => {
    if (stopped || hidden()) return;
    if (advancing) return void check();
    advancing = true;
    void advance()
      .catch(() => {})
      .finally(() => {
        advancing = false;
        void check();
      });
  }, every);
  return () => {
    stopped = true;
    unschedule(timer);
  };
}

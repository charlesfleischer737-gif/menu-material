import { workerHealthSnapshot } from "./worker-health";

type Timer = ReturnType<typeof setInterval>;

// Keep background work moving while a workspace is open. An advance request
// can stay open for a whole image render, so progress comes from a small
// status check instead, and everything reloads only when that status changes.
// A healthy background worker starts and finishes images itself, so the page
// only watches. Without one, an open page is what starts queued work, so a
// background tab keeps doing that, at a slower pace.
export function watchJobs({
  advance,
  status,
  reload,
  hidden = () => document.hidden,
  workerHealthy = workerHealthSnapshot,
  every = 2000,
  hiddenEvery = 8000,
  healthEvery = 60000,
  schedule = (callback, ms) => setInterval(callback, ms),
  unschedule = (timer) => clearInterval(timer),
}: {
  advance: () => Promise<unknown>;
  status: () => Promise<unknown>;
  reload: () => Promise<unknown>;
  hidden?: () => boolean;
  /** Whether the background worker checked in, as of the last reload. */
  workerHealthy?: () => boolean;
  every?: number;
  hiddenEvery?: number;
  healthEvery?: number;
  schedule?: (callback: () => void, ms: number) => Timer;
  unschedule?: (timer: Timer) => void;
}) {
  let advancing = false,
    checking = false,
    again = false,
    stopped = false,
    seen = "",
    waited = 0,
    sinceReload = 0;
  const ticks = (ms: number) => Math.max(1, Math.round(ms / every));
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
        sinceReload = 0;
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
  // comes from a check on each interval instead. Hidden pages skip checks.
  const timer = schedule(() => {
    if (stopped) return;
    if (workerHealthy()) {
      // The worker's health is only as fresh as the last reload: reload now
      // and then, so a page notices a worker that stops and takes over.
      if (++sinceReload >= ticks(healthEvery)) {
        sinceReload = 0;
        void reload().catch(() => {});
      } else void check();
      return;
    }
    if (advancing) return void check();
    if (hidden() && ++waited < ticks(hiddenEvery)) return;
    waited = 0;
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

// An image call reports no progress of its own, so the bar follows elapsed time
// against how long recent images with the same settings took. It fills evenly,
// slows once that time has passed and never completes on its own: only the
// saved result ends it.
export const TYPICAL_RENDER_MS = 45000;
// Until five images with a quality have finished. Outside benchmarks of this
// model put low and medium within seconds of each other, and high about ten
// seconds slower.
const DEFAULT_RENDER_MS: Record<string, number> = {
  low: 30000,
  medium: 30000,
  high: TYPICAL_RENDER_MS,
  xhigh: 60000,
  max: 90000,
};
const STARTED = 0.05,
  ON_TIME = 0.9,
  CEILING = 0.98;

/** The time within which three in four recent images finished. */
export function typicalRenderMs(samples: number[], quality = "") {
  const times = samples
    .filter((ms) => Number.isFinite(ms) && ms > 0)
    .sort((a, b) => a - b);
  if (times.length < 5) return DEFAULT_RENDER_MS[quality] ?? TYPICAL_RENDER_MS;
  const time = times[Math.ceil(times.length * 0.75) - 1];
  return Math.min(150000, Math.max(10000, Math.round(time)));
}

// To the nearest five seconds; the typical time already runs long.
function duration(ms: number) {
  const seconds = Math.round(ms / 5000) * 5;
  return seconds < 60
    ? `${seconds} seconds`
    : seconds < 90
      ? "a minute"
      : `${Math.round(seconds / 60)} minutes`;
}

/** For example "about 45 seconds": how long most images take. */
export const typicalWait = (typical = TYPICAL_RENDER_MS) =>
  `about ${duration(typical)}`;

export function creationProgress({
  queuedFor,
  sentFor,
  typical = TYPICAL_RENDER_MS,
}: {
  /** Milliseconds since the image was requested. */
  queuedFor: number;
  /** Milliseconds since it was sent for creation, or null while it waits. */
  sentFor: number | null;
  typical?: number;
}) {
  if (sentFor === null) {
    const waited = Math.max(0, queuedFor);
    return {
      value: STARTED * Math.min(1, waited / 3000),
      stage: waited > 10000 ? "Waiting for the studio" : "Getting started",
      time: "",
    };
  }
  const elapsed = Math.max(0, sentFor),
    share = elapsed / Math.max(1, typical),
    left = typical - elapsed;
  return {
    value:
      share <= 1
        ? STARTED + (ON_TIME - STARTED) * share
        : ON_TIME + (CEILING - ON_TIME) * (1 - Math.exp(-(share - 1) * 1.5)),
    stage: "Creating your photo",
    time:
      left <= 0
        ? "Taking longer than usual"
        : left <= 5000
          ? "Almost done"
          : `About ${duration(left)} left`,
  };
}

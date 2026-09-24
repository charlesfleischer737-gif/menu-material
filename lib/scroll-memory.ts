// Back, Forward and reload return every page and workspace view to where it
// was scrolled. Each history entry keeps its own position under the keys the
// router (vinext) also restores from on popstate. Entries the app adds itself
// (workspace sections, the guest studio, Studio sheets) never had one, so the
// router scrolled to their #hash target instead, and as none exists, to the
// top. Home and the workspace also render after their data arrives, too late
// for the browser's own restoration.
const X = "__vinext_scrollX";
const Y = "__vinext_scrollY";

type Entry = Record<string, unknown>;
type Position = { x: number; y: number };

const asEntry = (state: unknown): Entry | null =>
  state && typeof state === "object" && !Array.isArray(state)
    ? (state as Entry)
    : null;

let restoring = false;
let cancelRestore: (() => void) | null = null;

/** The position saved on a history entry, if any. */
export function savedScroll(
  state: unknown = window.history.state,
): Position | null {
  const entry = asEntry(state);
  if (!entry || typeof entry[Y] !== "number") return null;
  return { x: Number(entry[X]) || 0, y: entry[Y] };
}

/** Saves the current position on the current history entry. */
export function rememberScroll() {
  if (restoring) return;
  const entry = asEntry(window.history.state) ?? {};
  const { scrollX: x, scrollY: y } = window;
  if (entry[X] === x && entry[Y] === y) return;
  try {
    // Like the router's own save, this bypasses its patched replaceState:
    // the address is unchanged, so there is nothing for it to render.
    window.History.prototype.replaceState.call(
      window.history,
      { ...entry, [X]: x, [Y]: y },
      "",
    );
  } catch {
    // Browsers limit how often history may change. A missed save only means
    // Back returns to the previous one.
  }
}

const ownerInput = ["wheel", "touchstart", "keydown", "pointerdown"];

/**
 * Returns to a saved position once the page is tall enough to show it.
 * Holding it for a few frames outlasts anything else that scrolls on arrival;
 * the owner's own scrolling, tapping or typing ends the attempt at once.
 */
export function restoreScroll(target = savedScroll(), timeout = 4000) {
  cancelRestore?.();
  if (!target) return;
  const started = window.performance.now();
  let frame = 0;
  let held = 0;
  const stop = () => {
    window.cancelAnimationFrame(frame);
    for (const type of ownerInput) window.removeEventListener(type, stop);
    restoring = false;
    cancelRestore = null;
  };
  const step = () => {
    const elapsed = window.performance.now() - started;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    // After the timeout, settle for as far as the page now reaches.
    if (room + 1 >= target.y || elapsed > timeout) {
      const top = Math.max(0, Math.min(target.y, room));
      if (Math.abs(window.scrollY - top) > 1) {
        held = 0;
        window.scrollTo({ left: target.x, top, behavior: "instant" });
      } else if (++held >= 3) return stop();
    }
    if (elapsed > timeout * 2) return stop();
    frame = window.requestAnimationFrame(step);
  };
  for (const type of ownerInput)
    window.addEventListener(type, stop, { passive: true });
  restoring = true;
  cancelRestore = stop;
  frame = window.requestAnimationFrame(step);
}

/**
 * Keeps the current entry's position up to date and restores positions on
 * Back, Forward and reload. Returns a cleanup.
 */
export function watchScroll(delay = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(rememberScroll, delay);
  };
  const restore = () => restoreScroll();
  const [load] = window.performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  if (load?.type === "back_forward" || load?.type === "reload") restoreScroll();
  window.addEventListener("scroll", save, { passive: true });
  window.addEventListener("pagehide", rememberScroll);
  window.addEventListener("popstate", restore);
  return () => {
    clearTimeout(timer);
    cancelRestore?.();
    window.removeEventListener("scroll", save);
    window.removeEventListener("pagehide", rememberScroll);
    window.removeEventListener("popstate", restore);
  };
}

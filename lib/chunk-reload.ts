// A tab opened before a deploy can ask for code-split files that the new
// deploy no longer serves (their names carry a content hash). Loading the page
// again picks up the current files. These helpers recognize that failure and
// reload once; a guard stops a file that is really missing from causing a
// reload loop, and the caller then shows its own message.

const reloadedAt = "menu-material:reloaded-for-update";
const guardMs = 60_000;
let reloading = false;

/** A failed dynamic import or code-split stylesheet, as browsers and Vite word it. */
export function isChunkLoadError(error: unknown) {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk \S+ failed/i.test(
    text,
  );
}

/**
 * Reloads the page to pick up a newer deploy, at most once a minute per tab.
 * Returns false, without reloading, while offline (the browser would show its
 * offline page), without session storage, or inside that minute.
 */
export function reloadForNewVersion() {
  if (reloading) return true;
  if (navigator.onLine === false) return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem(reloadedAt) || 0) < guardMs)
      return false;
    sessionStorage.setItem(reloadedAt, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  location.reload();
  return true;
}

/**
 * Wraps a dynamic import. A stale-deploy failure reloads the page, and the
 * import never settles so loading states stay up until it does; any other
 * failure rejects as before.
 */
export function loadFresh<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    if (isChunkLoadError(error) && reloadForNewVersion())
      return new Promise<T>(() => {});
    throw error;
  });
}

/**
 * Vite reports a code-split file that fails to load with this window event,
 * whichever code imported it. Returns a function that stops listening.
 */
export function reloadOnPreloadError() {
  const reload = () => void reloadForNewVersion();
  window.addEventListener("vite:preloadError", reload);
  return () => window.removeEventListener("vite:preloadError", reload);
}

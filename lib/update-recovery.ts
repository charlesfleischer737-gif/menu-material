// A deploy replaces the files an open tab loads on demand, such as a
// workspace page or a dialog, so afterwards they can fail to load. Reload once
// to pick up the new version. Another failure within a minute keeps the
// page's usual error, so an outage cannot cause a reload loop. Editors still
// back up and confirm unsaved changes before the page unloads.
const key = "menu-material:update-reload";
export function recoverFromUpdates({
  target = window as Pick<Window, "addEventListener" | "removeEventListener">,
  online = () => navigator.onLine,
  storage = (): Pick<Storage, "getItem" | "setItem"> => sessionStorage,
  reload = () => location.reload(),
  now = () => Date.now(),
} = {}) {
  const recover = () => {
    if (!online()) return;
    try {
      const store = storage();
      if (now() - Number(store.getItem(key) || 0) < 60000) return;
      store.setItem(key, String(now()));
    } catch {
      // Without storage a reload could repeat, so the error is shown instead.
      return;
    }
    reload();
  };
  // Vite reports every file that fails to load on demand with this event.
  target.addEventListener("vite:preloadError", recover);
  return () => target.removeEventListener("vite:preloadError", recover);
}

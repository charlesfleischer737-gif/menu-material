// These preferences only select a workspace; all saved content stays on the server.
export function workspacePreferenceKey(userId: string, restaurantId: string) {
  return `plateworthy:workspace:${userId}:${restaurantId}`;
}

export function readPreference(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function rememberPreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Browsers that block storage can still open tools and server-saved drafts.
  }
}

export function resolveWorkspace(
  hash: string,
  remembered: string,
  admin: boolean,
) {
  const valid = ["studio", "menu", "post", "library", "tools", "campaigns"];
  const requested = hash.replace(/^#/, "");
  if (requested === "home") return "studio";
  if (requested === "admin" && admin) return "admin";
  if (valid.includes(requested)) return requested;
  return valid.includes(remembered) ? remembered : null;
}

export function hasSavedContent(row: Record<string, any>) {
  const draft = row.draft || {};
  return !!(row.kind === "studio"
    ? draft.sourceId || draft.description || draft.resultId || draft.jobId
    : row.kind === "menu"
      ? draft.rows?.length || draft.importId
      : row.kind === "post" && (draft.items?.length || draft.title));
}

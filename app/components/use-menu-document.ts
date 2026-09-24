"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { api, type Row } from "@/lib/client";
import { draftStatus } from "@/lib/workspace-status";
import {
  menuDocumentSchema,
  newMenuDocument,
  type MenuDocument,
} from "@/lib/menu-document";

export type SavedMenu = {
  id: string;
  draft: MenuDocument;
  revision: number;
  published: Row | null;
  publishedRevision: number | null;
  publishedAt: number | null;
  isPrimary: boolean;
  updatedAt: number;
};
export function useMenuDocument(restaurantId: string) {
  const [menus, setMenus] = useState<SavedMenu[]>([]),
    [record, setRecord] = useState<SavedMenu | null>(null),
    [draft, setDraft] = useState<MenuDocument>(newMenuDocument),
    [status, setStatus] = useState("Loading your menus…"),
    [error, setError] = useState(""),
    [historyVersion, setHistoryVersion] = useState(0),
    [recovered, setRecovered] = useState(false);
  const current = useRef<MenuDocument>(draft),
    recordRef = useRef<SavedMenu | null>(null),
    saved = useRef(""),
    flight = useRef<Promise<void> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    undo = useRef<MenuDocument[]>([]),
    redo = useRef<MenuDocument[]>([]),
    mounted = useRef(true);
  const conflict = useRef(false);
  const pendingCreate = useRef<{ id: string; value: string } | null>(null);
  const key = (id: string) => `menu-material:menu-v2:${restaurantId}:${id}`;
  function remember(value: MenuDocument) {
    const r = recordRef.current;
    if (!r) return;
    try {
      localStorage.setItem(
        key(r.id),
        JSON.stringify({
          draft: value,
          revision: r.revision,
          conflict: conflict.current,
        }),
      );
    } catch {
      /* The server save still runs when local storage is unavailable. */
    }
  }
  function updateRecord(next: SavedMenu) {
    recordRef.current = next;
    if (mounted.current) {
      setRecord(next);
      setMenus((rows) =>
        rows.some((r) => r.id === next.id)
          ? rows.map((r) => (r.id === next.id ? next : r))
          : [next, ...rows],
      );
    }
  }
  function load(next: SavedMenu) {
    let value = next.draft,
      recovered = false;
    conflict.current = false;
    try {
      const cache = JSON.parse(localStorage.getItem(key(next.id)) || "null");
      if (
        cache?.draft &&
        JSON.stringify(cache.draft) !== JSON.stringify(next.draft)
      ) {
        value = menuDocumentSchema.parse(cache.draft);
        recovered = true;
        if (cache.conflict || cache.revision !== next.revision) {
          conflict.current = true;
          setError(
            "This menu has newer saved changes. Your local edits are preserved. Download a recovery copy, then reload the saved menu before continuing.",
          );
        }
      }
    } catch {
      /* An invalid local copy never replaces the saved menu. */
    }
    current.current = value;
    saved.current = JSON.stringify(next.draft);
    updateRecord(next);
    setDraft(value);
    setRecovered(recovered);
    undo.current = [];
    redo.current = [];
    setHistoryVersion((n) => n + 1);
    setStatus(recovered ? "Recovered unsaved edits" : draftStatus.saved);
    try {
      localStorage.setItem(
        `menu-material:active-menu:${restaurantId}`,
        next.id,
      );
    } catch {}
  }
  async function initialize() {
    try {
      const result = await api("menus/initialize", {});
      if (!mounted.current) return;
      setMenus(result.menus);
      let chosen: string | null = null;
      try {
        chosen = localStorage.getItem(
          `menu-material:active-menu:${restaurantId}`,
        );
      } catch {}
      const selected =
        result.menus.find((r: SavedMenu) => r.id === chosen) || result.menus[0];
      if (selected) load(selected);
      else await create(newMenuDocument());
    } catch (e) {
      setError((e as Error).message);
      setStatus("Could not load menus");
    }
  }
  const initializeOnMount = useEffectEvent(initialize);
  useEffect(() => {
    mounted.current = true;
    // Skip React's discarded mount before starting the external load/create request.
    let active = true;
    queueMicrotask(() => {
      if (active) void initializeOnMount();
    });
    return () => {
      active = false;
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [restaurantId]);
  // A My Dishes edit can update this menu on the server; follow it when there
  // are no local edits (otherwise the usual conflict recovery applies).
  const followServerUpdate = useEffectEvent(async (ids: string[]) => {
    const row = recordRef.current;
    if (!row || !ids.includes(row.id) || flight.current) return;
    if (JSON.stringify(current.current) !== saved.current) return;
    try {
      const next = (await api(`menus/${row.id}`)) as SavedMenu;
      if (
        mounted.current &&
        recordRef.current?.id === next.id &&
        JSON.stringify(current.current) === saved.current
      )
        load(next);
    } catch {
      /* The next save reports any conflict with recovery options. */
    }
  });
  useEffect(() => {
    const listener = (event: Event) =>
      void followServerUpdate(
        ((event as CustomEvent).detail?.ids as string[]) || [],
      );
    window.addEventListener("menu-material:menus-changed", listener);
    return () =>
      window.removeEventListener("menu-material:menus-changed", listener);
  }, []);
  async function saveNow() {
    if (timer.current) clearTimeout(timer.current);
    if (flight.current) {
      await flight.current;
      return saveNow();
    }
    if (conflict.current)
      throw Error(
        "Reload the saved menu before saving or publishing. Your local edits are preserved.",
      );
    const row = recordRef.current,
      value = current.current;
    if (!row || JSON.stringify(value) === saved.current) return;
    const serialized = JSON.stringify(value);
    setStatus(draftStatus.saving);
    const promise = (async () => {
      try {
        const result = (await api(
          `menus/${row.id}`,
          { revision: row.revision, draft: value },
          "PUT",
        )) as SavedMenu;
        saved.current = serialized;
        updateRecord(result);
        setError("");
        const isCurrent = JSON.stringify(current.current) === serialized;
        setStatus(isCurrent ? draftStatus.saved : "Unsaved changes");
        if (isCurrent) {
          try {
            localStorage.removeItem(key(row.id));
          } catch {}
        } else remember(current.current);
      } catch (e) {
        if ((e as Error & { status?: number }).status === 409)
          conflict.current = true;
        setError((e as Error).message);
        setStatus(draftStatus.failed);
        remember(current.current);
        throw e;
      }
    })();
    flight.current = promise;
    try {
      await promise;
    } finally {
      flight.current = null;
    }
    if (JSON.stringify(current.current) !== saved.current) await saveNow();
  }
  function change(
    value: MenuDocument | ((before: MenuDocument) => MenuDocument),
    history = true,
  ) {
    const next = typeof value === "function" ? value(current.current) : value;
    if (JSON.stringify(next) === JSON.stringify(current.current)) return;
    if (history) {
      undo.current = [...undo.current.slice(-59), current.current];
      redo.current = [];
    }
    current.current = next;
    setDraft(next);
    remember(next);
    setHistoryVersion((n) => n + 1);
    setStatus("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNow().catch(() => {}), 650);
  }
  async function select(id: string) {
    await saveNow();
    setError("");
    const next = (await api(`menus/${id}`)) as SavedMenu;
    load(next);
  }
  async function create(value = newMenuDocument()) {
    await saveNow();
    const serialized = JSON.stringify(value);
    if (pendingCreate.current?.value !== serialized)
      pendingCreate.current = { id: crypto.randomUUID(), value: serialized };
    const next = (await api("menus", {
      id: pendingCreate.current.id,
      draft: value,
    })) as SavedMenu;
    pendingCreate.current = null;
    setError("");
    load(next);
    return next;
  }
  async function reload() {
    const row = recordRef.current;
    if (!row) return;
    if (timer.current) clearTimeout(timer.current);
    try {
      localStorage.setItem(
        key(row.id) + ":recovery",
        JSON.stringify(current.current),
      );
      localStorage.removeItem(key(row.id));
    } catch {}
    setError("");
    load((await api(`menus/${row.id}`)) as SavedMenu);
  }
  function back() {
    const value = undo.current.pop();
    if (!value) return;
    redo.current.push(current.current);
    change(value, false);
  }
  function forward() {
    const value = redo.current.pop();
    if (!value) return;
    undo.current.push(current.current);
    change(value, false);
  }
  async function refreshList() {
    const result = await api("menus");
    setMenus(result.menus);
    return result.menus as SavedMenu[];
  }
  async function accept(next: SavedMenu, resetHistory = false) {
    saved.current = JSON.stringify(next.draft);
    current.current = next.draft;
    setDraft(next.draft);
    updateRecord(next);
    // Changes that went live can't be undone from the editor's history.
    if (resetHistory) {
      undo.current = [];
      redo.current = [];
      setHistoryVersion((n) => n + 1);
    }
    await refreshList();
  }
  async function flush() {
    await saveNow();
    return recordRef.current;
  }
  return {
    menus,
    record,
    draft,
    change,
    saveNow,
    flush,
    select,
    create,
    reload,
    initialize,
    refreshList,
    accept,
    // The newest draft, including edits made earlier in the same event.
    latest: () => current.current,
    status,
    error,
    recovered,
    hasUnsavedChanges:
      record !== null && JSON.stringify(draft) !== JSON.stringify(record.draft),
    canUndo: historyVersion >= 0 && undo.current.length > 0,
    canRedo: redo.current.length > 0,
    undo: back,
    redo: forward,
  };
}

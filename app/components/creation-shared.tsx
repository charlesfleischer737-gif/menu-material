"use client";
import { draftStatus } from "@/lib/workspace-status";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Check, LoaderCircle, RotateCw } from "lucide-react";
import { api, dishCount, type Row } from "@/lib/client";
import WorkspacePlaceholder from "./workspace-placeholder";
import CreativeHeader from "./creative-header";
import { createPhotoPreviewRenderer, imageBitmap } from "@/lib/photo-export";
import { latestFrame } from "@/lib/latest-frame";
import { emptyAdjustments, type Adjustments } from "@/lib/studio";
import {
  hasSavedContent,
  readPreference,
  rememberPreference,
} from "@/lib/workspace-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
export function track(
  kind: string,
  entityId?: string,
  details: Row = {},
  eventKey?: string,
) {
  void api("creation-events", {
    kind,
    entityId: entityId || undefined,
    details,
    eventKey: eventKey || crypto.randomUUID(),
  }).catch(() => {});
}
export function useAction() {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function act(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      lock.current = false;
    }
  }
  return { busy, error, notice, setError, setNotice, act };
}
export function useCreationDraft(
  kind: string,
  initial: Row,
  workspaceKey: string,
) {
  const preferenceKey = `${workspaceKey}:draft:${kind}`;
  const recoveryKey = `${preferenceKey}:unsaved`;
  const [draft, setDraft] = useState<Row>(initial),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Opening saved work…"),
    [loadError, setLoadError] = useState(""),
    [saveError, setSaveError] = useState(""),
    // The draft's id once it exists on the server. Activity is recorded
    // against saved work only: the server rejects unknown drafts.
    [storedId, setStoredId] = useState("");
  const meta = useRef({ id: "", revision: 0 }),
    latest = useRef(draft),
    saved = useRef(""),
    saving = useRef<Promise<void> | null>(null),
    live = useRef(true),
    loading = useRef(0),
    initialRef = useRef(initial);
  function backup() {
    try {
      sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({
          ...meta.current,
          draft: latest.current,
          saved: saved.current,
        }),
      );
    } catch {
      /* An unavailable browser backup must never prevent a server save. */
    }
  }
  function forgetBackup() {
    try {
      sessionStorage.removeItem(recoveryKey);
    } catch {}
  }
  const load = useCallback(async () => {
    const request = ++loading.current;
    setLoadError("");
    setStatus("Opening saved work…");
    try {
      const data = await api(`creation-drafts?kind=${kind}`);
      const remembered = readPreference(preferenceKey);
      let row = data.drafts.find((d: Row) => d.id === remembered);
      if (!row && remembered) {
        try {
          row = (await api(`creation-drafts/${remembered}`)).draft;
        } catch (e) {
          if ((e as { status?: number }).status !== 404) throw e;
        }
      }
      if (row?.archived_at || row?.kind !== kind) row = undefined;
      row ||= data.drafts.find(hasSavedContent) || data.drafts[0];
      if (!live.current || request !== loading.current) return;
      let value = row
        ? { ...initialRef.current, ...row.draft }
        : initialRef.current;
      meta.current = {
        id: row?.id || crypto.randomUUID(),
        revision: row?.revision || 0,
      };
      saved.current = JSON.stringify(value);
      let recovered = false;
      try {
        const pending = JSON.parse(
          sessionStorage.getItem(recoveryKey) || "null",
        );
        if (
          pending?.id &&
          pending.draft &&
          JSON.stringify(pending.draft) !== pending.saved
        ) {
          value = pending.draft;
          meta.current = { id: pending.id, revision: pending.revision };
          saved.current = pending.saved;
          recovered = true;
        }
      } catch {}
      latest.current = value;
      setDraft(value);
      setStoredId(meta.current.revision > 0 ? meta.current.id : "");
      setReady(true);
      if (row) rememberPreference(preferenceKey, meta.current.id);
      setStatus(
        recovered
          ? "Recovered unsaved changes. Saving…"
          : row
            ? draftStatus.saved
            : "Ready when you are",
      );
    } catch (e) {
      if (live.current && request === loading.current) {
        setLoadError((e as Error).message);
        setStatus("Saved work could not be opened.");
      }
    }
  }, [kind, preferenceKey, recoveryKey]);
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
      loading.current++;
    };
  }, [load]);
  const save = useCallback(async () => {
    if (saving.current) return saving.current;
    const run = async () => {
      let wrote = false;
      while (
        meta.current.id &&
        JSON.stringify(latest.current) !== saved.current
      ) {
        setStatus(draftStatus.saving);
        const content = JSON.stringify(latest.current);
        const data = await api("creation-drafts", {
          ...meta.current,
          kind,
          draft: JSON.parse(content),
        });
        meta.current.revision = data.revision;
        saved.current = content;
        wrote = true;
        setStoredId(meta.current.id);
        rememberPreference(preferenceKey, meta.current.id);
        window.dispatchEvent(new Event("menu-material:draft-saved"));
      }
      forgetBackup();
      setSaveError("");
      // "Draft saved" reports a save: nothing written and nothing pending
      // (such as opening an empty tool) leaves the status as it was.
      setStatus((current) =>
        wrote ||
        current === draftStatus.saving ||
        current === draftStatus.failed
          ? draftStatus.saved
          : current,
      );
    };
    const pending = run();
    saving.current = pending;
    try {
      await pending;
    } catch (e) {
      backup();
      setSaveError((e as Error).message);
      setStatus(draftStatus.failed);
      throw e;
    } finally {
      if (saving.current === pending) saving.current = null;
    }
  }, [kind, preferenceKey, recoveryKey]);
  function change(patch: Row) {
    const next = { ...latest.current, ...patch };
    const content = JSON.stringify(next);
    if (content === JSON.stringify(latest.current)) return;
    latest.current = next;
    setDraft(next);
    if (content === saved.current && !saving.current) {
      forgetBackup();
      setSaveError("");
      setStatus(draftStatus.saved);
    } else {
      backup();
      setStatus(draftStatus.saving);
    }
  }
  useEffect(() => {
    if (!ready || JSON.stringify(draft) === saved.current) return;
    const timer = setTimeout(() => void save().catch(() => {}), 500);
    return () => clearTimeout(timer);
  }, [draft, ready, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (meta.current.id && JSON.stringify(latest.current) !== saved.current) {
        backup();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const reconnect = () => {
      if (meta.current.id && JSON.stringify(latest.current) !== saved.current)
        void save().catch(() => {});
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("online", reconnect);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("online", reconnect);
    };
  }, [save]);
  async function start(value: Row, row?: Row) {
    await save();
    meta.current = {
      id: row?.id || crypto.randomUUID(),
      revision: row?.revision || 0,
    };
    latest.current = value;
    saved.current = row ? JSON.stringify(value) : "";
    setDraft(value);
    setStoredId(row ? meta.current.id : "");
    setStatus(draftStatus.saving);
    backup();
    await save();
    rememberPreference(preferenceKey, meta.current.id);
  }
  async function resume(id: string) {
    await save();
    const row = (await api(`creation-drafts/${id}`)).draft;
    if (row.kind !== kind || row.archived_at)
      throw Error("Restore this saved work before opening it.");
    await start({ ...initialRef.current, ...row.draft }, row);
  }
  async function saveCopy() {
    if (saving.current) await saving.current.catch(() => {});
    meta.current = { id: crypto.randomUUID(), revision: 0 };
    saved.current = "";
    setStoredId("");
    backup();
    await save();
    setDraft({ ...latest.current });
  }
  async function openLatest() {
    const previous = meta.current.id;
    // Preserve this window's work before replacing it with the server version.
    if (JSON.stringify(latest.current) !== saved.current) await saveCopy();
    try {
      await resume(previous);
    } catch (e) {
      setSaveError("Your copy is saved. " + (e as Error).message);
      throw e;
    }
  }
  function clear() {
    meta.current = { id: crypto.randomUUID(), revision: 0 };
    latest.current = initialRef.current;
    saved.current = JSON.stringify(latest.current);
    forgetBackup();
    setDraft(latest.current);
    setStoredId("");
    setSaveError("");
    setStatus("Ready when you are");
    rememberPreference(preferenceKey, "");
  }
  return {
    draft,
    change,
    save,
    start,
    resume,
    ready,
    status,
    id: meta.current.id,
    storedId,
    stored: () => meta.current.revision > 0,
    read: () => latest.current,
    loadError,
    saveError,
    retryLoad: load,
    saveCopy,
    openLatest,
    clear,
  };
}
export function DraftRecovery({
  store,
  title = "Your saved work",
}: {
  store: ReturnType<typeof useCreationDraft>;
  title?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function recover(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (store.ready && !store.saveError) return null;
  if (!store.ready && !store.loadError)
    return <WorkspacePlaceholder title={title} message={store.status} />;
  return (
    <div className="cx-panel cx-draft-recovery" role="alert">
      <h2>
        {store.ready
          ? "Your changes are still here"
          : "Let’s reopen your saved work"}
      </h2>
      <p>{error || store.saveError || store.loadError}</p>
      {store.ready && (
        <p>
          Retry the save, keep this version as a new copy, or open the latest
          version after saving this one as a copy.
        </p>
      )}
      <div className="cx-button-row">
        <button
          className="cx-button"
          disabled={busy}
          onClick={() =>
            void recover(store.ready ? store.save : store.retryLoad)
          }
        >
          {busy ? "Working…" : store.ready ? "Retry save" : "Retry opening"}
        </button>
        {store.ready && (
          <>
            <button
              className="cx-secondary"
              disabled={busy}
              onClick={() => void recover(store.saveCopy)}
            >
              Save my changes as a copy
            </button>
            <button
              className="cx-secondary"
              disabled={busy}
              onClick={() => void recover(store.openLatest)}
            >
              Keep a copy & open latest
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export function SavedDrafts({
  kind,
  store,
  disabled = false,
  onResume,
}: {
  kind: "studio" | "menu" | "post";
  store: ReturnType<typeof useCreationDraft>;
  disabled?: boolean;
  onResume?: () => void;
}) {
  const [open, setOpen] = useState(false),
    [drafts, setDrafts] = useState<Row[] | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("active"),
    [next, setNext] = useState<number | null>(null),
    [rename, setRename] = useState(""),
    [name, setName] = useState("");
  const request = useRef(0);
  const label =
    kind === "studio"
      ? "Saved photos"
      : kind === "menu"
        ? "Saved menus"
        : "Saved posts";
  const load = useCallback(
    async (offset = 0) => {
      const current = ++request.current;
      const query = new URLSearchParams({
        kind,
        offset: String(offset),
        search,
        archived: String(filter === "archived"),
        favorites: String(filter === "favorites"),
      });
      const data = await api(`creation-drafts?${query}`);
      if (current !== request.current) return;
      setDrafts((previous) =>
        offset
          ? [
              ...(previous || []),
              ...data.drafts.filter(
                (d: Row) => !previous?.some((p) => p.id === d.id),
              ),
            ]
          : data.drafts,
      );
      setNext(data.nextOffset);
    },
    [kind, search, filter],
  );
  useEffect(() => {
    if (!open) return;
    setDrafts(null);
    setError("");
    const timer = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      200,
    );
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [open, load]);
  useEffect(() => {
    if (!open) return;
    const refreshSaved = () => void load().catch((e) => setError(e.message));
    window.addEventListener("menu-material:draft-saved", refreshSaved);
    return () =>
      window.removeEventListener("menu-material:draft-saved", refreshSaved);
  }, [open, load]);
  async function act(key: string, fn: () => Promise<void>) {
    setWorking(key);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking("");
    }
  }
  async function update(row: Row, patch: Row) {
    if (patch.archived && row.id === store.id) await store.save();
    await api(`creation-drafts/${row.id}/metadata`, patch);
    if (patch.archived && row.id === store.id) store.clear();
    await load();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="cx-link" disabled={disabled}>
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="cx-workspace-popover cx-draft-dialog">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Find, name and reuse your work. Archiving a draft does not change
            your published menu or delete its photos.
          </DialogDescription>
        </DialogHeader>
        <DraftRecovery store={store} />
        <div className="cx-draft-filters">
          <label className="field">
            Search saved work
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
            />
          </label>
          <label className="field">
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="active">All active</option>
              <option value="favorites">Favorites</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
        {error && (
          <div role="alert">
            <p className="cx-feedback">{error}</p>
            <button
              className="cx-link"
              disabled={!!working}
              onClick={() => void act("load", load)}
            >
              Retry loading
            </button>
          </div>
        )}
        {!drafts && !error && <p role="status">Opening saved work…</p>}
        {drafts?.length === 0 && <p>No saved work matches this view.</p>}
        <div className="cx-draft-list">
          {drafts?.map((row) => {
            const draft = row.draft;
            const title =
              row.name ||
              draft.name ||
              draft.title ||
              (kind === "menu"
                ? `${dishCount(draft.rows?.length || 0)} · Menu`
                : `Untitled ${kind === "studio" ? "photo" : "post"}`);
            const photoId =
              kind === "studio"
                ? draft.resultId || draft.sourceId
                : kind === "post"
                  ? draft.items?.[0]?.photoId
                  : draft.rows?.find((r: Row) => r.photoId)?.photoId;
            return (
              <div key={row.id} className="cx-saved-card">
                <button
                  className="cx-draft-item"
                  disabled={!!working || !!row.archived_at}
                  aria-current={row.id === store.id ? "true" : undefined}
                  onClick={() =>
                    void act(row.id, async () => {
                      await store.resume(row.id);
                      onResume?.();
                      setOpen(false);
                    })
                  }
                >
                  {photoId && (
                    <img
                      src={`/api/assets/${photoId}`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <span>
                    <b>
                      {row.favorite ? "★ " : ""}
                      {title}
                    </b>
                    <small>
                      {row.id === store.id ? "Currently open · " : ""}Edited{" "}
                      {new Date(row.updated_at).toLocaleString()}
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                {rename === row.id ? (
                  <form
                    className="cx-draft-rename"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(row.id, async () => {
                        await update(row, { name });
                        setRename("");
                      });
                    }}
                  >
                    <label className="field">
                      Name
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        required
                      />
                    </label>
                    <button className="cx-link" disabled={!!working}>
                      Save name
                    </button>
                    <button
                      type="button"
                      className="cx-link"
                      onClick={() => setRename("")}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="cx-draft-actions">
                    <button
                      disabled={!!working}
                      onClick={() => {
                        setRename(row.id);
                        setName(title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      disabled={!!working}
                      aria-pressed={!!row.favorite}
                      aria-label={`${row.favorite ? "Unfavorite" : "Favorite"} ${title}`}
                      onClick={() =>
                        void act(row.id, () =>
                          update(row, { favorite: !row.favorite }),
                        )
                      }
                    >
                      {row.favorite ? "Unfavorite" : "Favorite"}
                    </button>
                    <button
                      disabled={!!working}
                      onClick={() =>
                        void act(row.id, async () => {
                          if (row.id === store.id) await store.save();
                          await api(`creation-drafts/${row.id}/duplicate`, {});
                          setFilter("active");
                          await load();
                        })
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      disabled={!!working}
                      onClick={() =>
                        void act(row.id, () =>
                          update(row, { archived: !row.archived_at }),
                        )
                      }
                    >
                      {row.archived_at ? "Restore" : "Archive"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {next !== null && (
          <button
            className="cx-secondary"
            disabled={!!working}
            onClick={() => void act("load", () => load(next))}
          >
            {working === "load" ? "Loading…" : "Load more"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function ToolHeader({
  title,
  status,
  children,
}: {
  title: string;
  status: string;
  children?: ReactNode;
}) {
  return (
    <CreativeHeader title={title} status={status} className="cx-feature-header">
      {children}
    </CreativeHeader>
  );
}
export function Feedback({
  busy,
  error,
  notice,
}: {
  busy: string;
  error: string;
  notice?: string;
}) {
  return (
    <>
      {busy && (
        <p className="cx-feedback" role="status">
          <LoaderCircle className="cx-spin" size={17} />
          {busy}
        </p>
      )}
      {error && (
        <p className="cx-feedback cx-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="cx-feedback" role="status">
          <Check size={17} />
          {notice}
        </p>
      )}
    </>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="cx-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PhotoFrame({
  src,
  ratio = 1,
  edits = emptyAdjustments,
  onChange,
  label = "Your photo · layout preview",
  onReadyChange,
}: {
  src: string;
  ratio?: number;
  edits?: Adjustments;
  onChange?: (e: Adjustments) => void;
  label?: string;
  onReadyChange?: (ready: boolean) => void;
}) {
  const readyCallback = useRef(onReadyChange);
  readyCallback.current = onReadyChange;
  const canvas = useRef<HTMLCanvasElement>(null),
    im = useRef<ImageBitmap | null>(null),
    [attempt, setAttempt] = useState(0),
    [load, setLoad] = useState({ src, status: "loading", error: "" }),
    drag = useRef<{ x: number; y: number; ex: number; ey: number } | null>(
      null,
    );
  const [preview] = useState(createPhotoPreviewRenderer);
  const [frames] = useState(() =>
    latestFrame<{
      canvas: HTMLCanvasElement;
      bitmap: ImageBitmap;
      ratio: number;
      edits: Adjustments;
      src: string;
    }>((frame) => {
      try {
        preview.draw(
          frame.canvas,
          frame.bitmap,
          800,
          Math.round(800 / frame.ratio),
          frame.edits,
        );
        readyCallback.current?.(true);
      } catch {
        readyCallback.current?.(false);
        setLoad({
          src: frame.src,
          status: "error",
          error: "This photo preview couldn’t update. Please try again.",
        });
      }
    }),
  );
  const ready = load.src === src && load.status === "ready";
  const error = load.src === src ? load.error : "";
  useLayoutEffect(() => {
    const controller = new AbortController();
    let owned: ImageBitmap | null = null;
    frames.clear();
    preview.clear();
    drag.current = null;
    readyCallback.current?.(false);
    setLoad({ src, status: "loading", error: "" });
    if (canvas.current) {
      canvas.current.width = 0;
      canvas.current.height = 0;
    }
    imageBitmap(src, controller.signal)
      .then((b) => {
        if (controller.signal.aborted) {
          b.close();
          return;
        }
        owned = b;
        im.current = b;
        setLoad({ src, status: "ready", error: "" });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoad({
            src,
            status: "error",
            error: "This photo couldn’t be opened. Please try again.",
          });
      });
    return () => {
      controller.abort();
      frames.clear();
      preview.clear();
      owned?.close();
      if (im.current === owned) im.current = null;
    };
  }, [src, attempt, preview, frames]);
  useLayoutEffect(() => {
    readyCallback.current?.(false);
    if (ready && canvas.current && im.current)
      frames.push({
        canvas: canvas.current,
        bitmap: im.current,
        ratio,
        edits,
        src,
      });
  }, [ready, load, edits, ratio, src, frames]);
  return (
    <figure className="cx-photo-frame">
      <div
        className={onChange && ready ? "cx-draggable" : ""}
        style={{ aspectRatio: ratio }}
        role="group"
        aria-label="Photo preview"
        tabIndex={-1}
        aria-busy={!ready && !error}
        onPointerDown={(e) => {
          if (!onChange || !ready) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ex: edits.x,
            ey: edits.y,
          };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !onChange || !ready) return;
          const bounds = e.currentTarget.getBoundingClientRect();
          onChange({
            ...edits,
            x: Math.max(
              0,
              Math.min(
                100,
                drag.current.ex -
                  ((e.clientX - drag.current.x) / bounds.width) * 100,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                100,
                drag.current.ey -
                  ((e.clientY - drag.current.y) / bounds.height) * 100,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <canvas
          ref={canvas}
          aria-label={label}
          role="img"
          style={{ visibility: ready ? "visible" : "hidden" }}
        />
        {!ready && (
          <div className="cx-photo-frame-status">
            <p role={error ? "alert" : "status"}>
              {error || "Opening your photo…"}
            </p>
            {error && (
              <button
                className="cx-link"
                onClick={() => {
                  canvas.current?.parentElement?.focus();
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
      <figcaption>
        {label}
        {onChange && ready && <span>Drag to position</span>}
      </figcaption>
    </figure>
  );
}
export function CropControls({
  value,
  onChange,
  quick = false,
  allowFit = true,
  section = "all",
  showValues = false,
}: {
  value: Adjustments;
  onChange: (e: Adjustments) => void;
  quick?: boolean;
  allowFit?: boolean;
  section?: "all" | "crop" | "light";
  showValues?: boolean;
}) {
  const e = { ...emptyAdjustments, ...value };
  return (
    <div className="cx-crop-controls">
      {allowFit && section !== "light" && (
        <div className="cx-segment" aria-label="Photo fit">
          <button
            aria-pressed={e.fit}
            onClick={() => onChange({ ...e, fit: true, zoom: 1 })}
          >
            Fit whole dish
          </button>
          <button
            aria-pressed={!e.fit}
            onClick={() => onChange({ ...e, fit: false })}
          >
            Fill frame
          </button>
        </div>
      )}
      {[
        ...(section !== "light"
          ? [
              ["Horizontal position", "x", 0, 100, 1],
              ["Vertical position", "y", 0, 100, 1],
              ["Zoom", "zoom", 1, 2, 0.01],
            ]
          : []),
        ...(quick && section !== "crop"
          ? [
              ["Brightness", "brightness", 80, 120, 1],
              ["Contrast", "contrast", 80, 120, 1],
              ["Warmth", "warmth", -30, 30, 1],
            ]
          : []),
      ].map(([label, key, min, max, step]) => (
        <label className="cx-range" key={String(key)}>
          <span>{label}</span>
          {showValues && (
            <span className="cx-range-value" aria-hidden="true">
              {key === "zoom"
                ? `${Number(e.zoom).toFixed(2)}×`
                : key === "warmth"
                  ? e.warmth
                  : `${e[key as keyof Adjustments]}%`}
            </span>
          )}
          <input
            type="range"
            min={Number(min)}
            max={Number(max)}
            step={Number(step)}
            value={e[key as keyof Adjustments] as number}
            onChange={(ev) =>
              onChange({ ...e, [key]: Number(ev.target.value) })
            }
          />
        </label>
      ))}
      {quick && section !== "light" && (
        <button
          className="cx-link"
          onClick={() => onChange({ ...e, rotate: (e.rotate + 90) % 360 })}
        >
          <RotateCw size={16} />
          Rotate 90°
        </button>
      )}
    </div>
  );
}

export function useStepFocus(step: number, ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (ref.current?.getClientRects().length) {
        ref.current
          .querySelector<HTMLElement>("h1")
          ?.focus({ preventScroll: true });
        ref.current.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step, ready]);
  return ref;
}

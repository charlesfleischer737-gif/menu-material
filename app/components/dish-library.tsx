"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Images,
  Check,
  ChevronDown,
  Star,
  Archive,
  UtensilsCrossed,
  CircleAlert,
  SlidersHorizontal,
  Download,
  Package,
  Megaphone,
  BookOpen,
} from "lucide-react";
import { api, dishCount, money, normalizePhoto, type Row } from "@/lib/client";
import { preferredPhoto, dishPhotos, dishStatus } from "@/lib/dish-library";
import { downloadPhotoItem, photoLineage } from "@/lib/photo-destinations";
import { lookProfile } from "@/lib/photo-pack";
import { PhotoFinishSheet } from "./photo-finish-sheet";
import { PhotoPackSheet } from "./photo-pack-sheet";
import { photoActionLabels } from "./photo-hub-actions";
import { workspacePreferenceKey } from "@/lib/workspace-navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Feedback, Field, useAction } from "./creation-shared";
import DietaryPicker from "./dietary-picker";
import { ConfirmDelete } from "./controls";
import CreativeHeader from "./creative-header";
import PhotoDownloads from "./photo-downloads";

export default function DishLibrary({
  state,
  refresh,
  onPhoto,
  onDestination,
  onImports,
  onOpenWork,
}: {
  state: Row;
  refresh: () => Promise<void>;
  onPhoto: (id?: string, photoId?: string, destination?: string) => void;
  onDestination: (where: string, did: string, aid: string, extra?: Row) => void;
  onImports: () => void;
  onOpenWork: (kind: string, id: string) => void;
}) {
  const action = useAction();
  const [search, setSearch] = useState(""),
    [section, setSection] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("recent"),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [downloadIds, setDownloadIds] = useState<string[]>([]),
    [photoUse, setPhotoUse] = useState<{
      kind: "download" | "pack";
      dish: Row;
      photo: Row;
    } | null>(null);
  const [detail, setDetail] = useState<Row | null>(null),
    [chosen, setChosen] = useState(""),
    [dirty, setDirty] = useState(false),
    [usage, setUsage] = useState<Row[]>([]),
    [usageError, setUsageError] = useState("");
  const [archived, setArchived] = useState(false),
    [undo, setUndo] = useState<Row | null>(null),
    [deleting, setDeleting] = useState("");
  const [adding, setAdding] = useState(false),
    [newName, setNewName] = useState(""),
    [uploads, setUploads] = useState<Row[]>([]);
  const files = useRef<HTMLInputElement>(null),
    uploadRows = useRef<Row[]>([]);
  useEffect(() => {
    uploadRows.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => uploadRows.current.forEach((u) => URL.revokeObjectURL(u.url)),
    [],
  );
  useEffect(() => {
    if (!detail) return;
    let live = true;
    setUsage([]);
    setUsageError("");
    api(`library/${detail.id}/usage`)
      .then((data) => {
        if (live) setUsage(data.usage);
      })
      .catch((e) => {
        if (live) setUsageError(e.message);
      });
    return () => {
      live = false;
    };
  }, [detail?.id, state.dishes]);
  const allDishes: Row[] = state.dishes;
  const dishes = allDishes
    .filter(
      (d) =>
        !!d.archived_at === archived &&
        (!section || d.category === section) &&
        (!status || dishStatus(d, state.assets) === status) &&
        `${d.name} ${d.description} ${d.category}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (b.updated_at || b.created_at) - (a.updated_at || a.created_at),
    );
  const filterCount = Number(!!section) + Number(!!status) + Number(archived);
  const clearFilters = () => {
    if (archived) {
      setSelected([]);
      setSelecting(false);
      if (selected.length)
        action.setNotice("Selection cleared when returning to active dishes.");
    }
    setSearch("");
    setSection("");
    setStatus("");
    setSort("recent");
    setArchived(false);
  };
  const currentDish =
    detail && (allDishes.find((d) => d.id === detail.id) || detail);
  const photos = detail ? dishPhotos(detail, state.assets) : [];
  const current =
    photos.find((a) => a.id === chosen) ||
    (currentDish && preferredPhoto(currentDish, state.assets));
  function open(d: Row) {
    action.setNotice("");
    action.setError("");
    setDetail({ ...d, price: d.price / 100, available: !!d.available });
    setChosen(preferredPhoto(d, state.assets)?.id || "");
    setDirty(false);
  }
  function edit(p: Row) {
    action.setNotice("");
    action.setError("");
    setDetail((d) => ({ ...d, ...p }));
    setDirty(true);
  }
  function close() {
    if (action.busy) return;
    if (!dirty || window.confirm("Discard unsaved dish details?")) {
      setDetail(null);
      setDirty(false);
    }
  }
  function reuse(d: Row, a: Row, where: string) {
    if (dirty && !window.confirm("Discard unsaved dish details and continue?"))
      return;
    setDetail(null);
    setDirty(false);
    onDestination(where, d.id, a.id, { quick: true });
  }
  // The same actions, with the same names, as a finished photo in Photo Studio.
  // Called as a function, not rendered as a component: an inner component
  // type would remount (and close the menu) on every state refresh.
  function photoUseMenu(dish: Row, photo: Row) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="cx-link">
            Use photo <ChevronDown size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="cx-workspace-popover" align="end">
          <DropdownMenuItem
            onSelect={() => setPhotoUse({ kind: "download", dish, photo })}
          >
            <Download size={16} aria-hidden="true" />
            {photoActionLabels.download}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setPhotoUse({ kind: "pack", dish, photo })}
          >
            <Package size={16} aria-hidden="true" />
            {photoActionLabels.pack}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reuse(dish, photo, "post")}>
            <Megaphone size={16} aria-hidden="true" />
            {photoActionLabels.post}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reuse(dish, photo, "menu")}>
            <BookOpen size={16} aria-hidden="true" />
            {photoActionLabels.menu}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  const usedPhoto =
    photoUse &&
    (state.assets.find((a: Row) => a.id === photoUse.photo.id) ||
      photoUse.photo);
  const usedName =
    (photoUse && allDishes.find((d) => d.id === photoUse.dish.id)?.name) ||
    photoUse?.dish.name ||
    "";
  const usedLineage = usedPhoto ? photoLineage(state, usedPhoto) : null;
  const usedStyle = lookProfile(
    usedLineage?.lookId || "",
    state.restaurant.style,
  );
  const usedFromPhoto = usedPhoto
    ? downloadPhotoItem(state, usedPhoto, usedName).fromPhoto
    : false;
  async function archiveDish(d: Row, value: boolean) {
    await api(`library/${d.id}`, { archived: value });
    await refresh();
    setUndo({ id: d.id, name: d.name, archived: !value });
    setDetail(null);
    setSelected((ids) => ids.filter((id) => id !== d.id));
    action.setNotice(
      value
        ? `${d.name} archived. Existing posts and published menus stay available.`
        : `${d.name} restored.`,
    );
  }
  async function uploadAll() {
    for (const item of uploads) {
      if (item.assetId) continue;
      if (!item.name.trim()) throw Error("Name each dish before uploading.");
      setUploads((prev) =>
        prev.map((u) =>
          u.key === item.key ? { ...u, status: "Uploading…" } : u,
        ),
      );
      try {
        const dishId =
          item.dishId ||
          (await api("dishes", { name: item.name, confirmed: true })).id;
        setUploads((prev) =>
          prev.map((u) => (u.key === item.key ? { ...u, dishId } : u)),
        );
        const fd = new FormData();
        fd.set("dishId", dishId);
        fd.set("file", item.file);
        fd.set("normalized", await normalizePhoto(item.file), "working.jpg");
        const data = await api("assets", fd);
        setUploads((prev) =>
          prev.map((u) =>
            u.key === item.key
              ? { ...u, dishId, assetId: data.id, status: "Needs review" }
              : u,
          ),
        );
      } catch (e) {
        setUploads((prev) =>
          prev.map((u) =>
            u.key === item.key ? { ...u, status: (e as Error).message } : u,
          ),
        );
        await refresh();
        throw e;
      }
    }
    await refresh();
    action.setNotice("Photos uploaded. Open each dish to review its photo.");
  }
  return (
    <section className="mm-workspace mm-library">
      <CreativeHeader
        title="My Dishes"
        status={dishCount(allDishes.filter((d) => !d.archived_at).length)}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cx-btn">
                <Plus size={16} /> Add dishes <ChevronDown size={15} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="cx-workspace-popover" align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setAdding(true);
                  setNewName("");
                }}
              >
                Add a dish
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => files.current?.click()}>
                Upload photos
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onImports}>
                Import a menu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Feedback {...action} />
      {undo && (
        <div className="mm-inline mm-muted">
          <button
            className="cx-link"
            disabled={!!action.busy}
            onClick={() =>
              action.act("Undoing archive", async () => {
                for (const id of undo.ids || [undo.id])
                  await api(`library/${id}`, { archived: undo.archived });
                await refresh();
                setUndo(null);
                action.setNotice("Archive change undone.");
              })
            }
          >
            Undo {undo.archived ? "restore" : "archive"}
          </button>
        </div>
      )}
      <div className="mm-toolbar mm-library-toolbar">
        <input
          type="search"
          aria-label="Find a dish"
          placeholder="Find a dish…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          className="cx-btn cx-secondary"
          onClick={() => setFiltersOpen(true)}
          aria-label={`Filters${filterCount ? `, ${filterCount} active` : ""}`}
        >
          <SlidersHorizontal size={16} /> Filters{" "}
          {filterCount > 0 && (
            <span className="mm-filter-count">{filterCount}</span>
          )}
        </button>
        <button
          className="cx-btn cx-secondary mm-select-toggle"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting(!selecting);
            setSelected([]);
          }}
        >
          {selecting ? "Done" : "Select"}
        </button>
      </div>
      {(search || filterCount > 0 || sort !== "recent") && (
        <div className="mm-filter-summary">
          <span>
            {dishes.length} {archived ? "archived " : ""}
            {dishes.length === 1 ? "dish" : "dishes"}
            {sort === "name" ? " · Name A–Z" : ""}
          </span>
          {dishes.length > 0 && (
            <button className="cx-link" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          className="cx-app mm-drawer mm-filter-drawer"
          aria-describedby={undefined}
        >
          <SheetTitle>Filter your dishes</SheetTitle>
          <div className="mm-filter-fields">
            <Field label="Section">
              <select
                value={section}
                onChange={(event) => setSection(event.target.value)}
              >
                <option value="">All sections</option>
                {[...new Set(allDishes.map((dish) => dish.category))].map(
                  (name) => (
                    <option key={name}>{name}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Photo status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All photos</option>
                {["Approved", "Needs review", "No photo"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Sort dishes">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Recently updated</option>
                <option value="name">Name A–Z</option>
              </select>
            </Field>
            <label className="cx-check mm-archive-filter">
              <input
                type="checkbox"
                checked={archived}
                onChange={(event) => {
                  setArchived(event.target.checked);
                  setSelected([]);
                  setSelecting(false);
                  if (selected.length)
                    action.setNotice(
                      "Selection cleared when switching between active and archived dishes.",
                    );
                }}
              />{" "}
              Show archived dishes
            </label>
          </div>
          <footer className="mm-filter-footer">
            <p role="status">
              {dishes.length} matching {dishes.length === 1 ? "dish" : "dishes"}
            </p>
            <button className="cx-btn" onClick={() => setFiltersOpen(false)}>
              Show results
            </button>
            <button className="cx-link" onClick={clearFilters}>
              Reset filters & sort
            </button>
          </footer>
        </SheetContent>
      </Sheet>
      {selected.length > 0 && (
        <div className="mm-bulk">
          <strong>{selected.length} selected</strong>
          <button
            className="cx-link"
            onClick={() => {
              const ids = selected
                .map((id) =>
                  preferredPhoto(
                    allDishes.find((d) => d.id === id)!,
                    state.assets,
                  ),
                )
                .filter((a) => a?.approved_at)
                .map((a) => a.id);
              if (ids.length !== selected.length)
                action.setError(
                  "Choose dishes with approved photos to download.",
                );
              else setDownloadIds(ids);
            }}
          >
            Download photos
          </button>
          <button
            className="cx-link"
            disabled={!!action.busy}
            onClick={() =>
              action.act("Updating dishes", async () => {
                for (const id of selected)
                  await api(`library/${id}`, { archived: !archived });
                await refresh();
                setUndo({ ids: [...selected], archived });
                setSelected([]);
                action.setNotice(
                  archived
                    ? "Dishes restored."
                    : "Dishes archived. Their saved work remains available.",
                );
              })
            }
          >
            {archived ? "Restore" : "Archive"}
          </button>
        </div>
      )}
      {!dishes.length ? (
        <div className="mm-empty">
          <Images size={32} />
          <h2>
            {search || section || status
              ? "No dishes match these filters."
              : archived
                ? "No archived dishes."
                : "Your dishes, ready for their next appearance."}
          </h2>
          <button
            className="cx-link"
            onClick={() => {
              if (search || section || status) {
                setSearch("");
                setSection("");
                setStatus("");
              } else if (archived) {
                setArchived(false);
              } else {
                setAdding(true);
                setNewName("");
              }
            }}
          >
            {search || section || status
              ? "Clear filters"
              : archived
                ? "View active dishes"
                : "Add your first dish"}
          </button>
        </div>
      ) : (
        <div className="mm-library-grid">
          {dishes.map((d) => {
            const a = preferredPhoto(d, state.assets);
            const label = dishStatus(d, state.assets);
            return (
              <article
                className="mm-dish-card"
                key={d.id}
                data-selected={selecting && selected.includes(d.id)}
                data-has-photo={!!a}
              >
                <button
                  className="mm-dish-open"
                  aria-label={`Open ${d.name}`}
                  onClick={() => open(d)}
                >
                  {a ? (
                    <img
                      src={`/api/assets/${a.id}`}
                      alt={d.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="mm-dish-placeholder">
                      <UtensilsCrossed size={20} />
                      <span>No photo yet</span>
                    </div>
                  )}
                  <span>
                    <span className="mm-dish-title">
                      <strong>{d.name}</strong>
                      {Number.isFinite(d.price) && (
                        <span className="mm-dish-price">
                          {money(d.price, state.restaurant.currency)}
                        </span>
                      )}
                    </span>
                    <small>
                      {d.sample ? "Sample · stays off menus" : d.category}
                    </small>
                  </span>
                </button>
                {selecting && (
                  <label className="mm-card-select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${d.name}`}
                      checked={selected.includes(d.id)}
                      disabled={
                        !selected.includes(d.id) && selected.length >= 10
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, d.id]
                            : selected.filter((id) => id !== d.id),
                        )
                      }
                    />
                  </label>
                )}
                <footer>
                  <span
                    className={`mm-status ${a?.approved_at ? "ready" : a ? "needs-review" : ""}`}
                  >
                    {a?.approved_at ? (
                      <Check size={15} aria-hidden="true" />
                    ) : a ? (
                      <CircleAlert size={15} aria-hidden="true" />
                    ) : (
                      <Images size={15} aria-hidden="true" />
                    )}{" "}
                    {label}
                  </span>
                  {a?.approved_at ? (
                    photoUseMenu(d, a)
                  ) : (
                    <button className="cx-link" onClick={() => open(d)}>
                      {a ? "Review" : "Add photo"}
                    </button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <Sheet
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <SheetContent
          className="cx-app mm-drawer mm-dish-detail-drawer"
          aria-describedby={undefined}
          closeDisabled={!!action.busy}
        >
          <SheetTitle>{detail?.name}</SheetTitle>
          <fieldset className="mm-dish-detail-body" disabled={!!action.busy}>
            {detail && (
              <>
                <div className="mm-detail-grid">
                  <div>
                    {current ? (
                      <img
                        className="mm-detail-photo"
                        src={`/api/assets/${current.id}`}
                        alt={detail.name}
                      />
                    ) : (
                      <div className="mm-detail-photo mm-empty">
                        <Images size={40} />
                        <p>No photo yet</p>
                      </div>
                    )}
                    {!!photos.length && (
                      <div
                        className="mm-version-list"
                        aria-label="Photo versions"
                      >
                        {photos.map((a, n) => (
                          <button
                            key={a.id}
                            aria-pressed={current?.id === a.id}
                            onClick={() => setChosen(a.id)}
                          >
                            <img
                              src={`/api/assets/${a.id}`}
                              alt={
                                a.kind === "source"
                                  ? "Original"
                                  : `Version ${n + 1}`
                              }
                            />
                            <small>
                              {a.id === currentDish?.preferred_photo_id
                                ? "Main photo"
                                : a.kind === "source"
                                  ? "Original"
                                  : a.approved_at
                                    ? "Approved"
                                    : "Needs review"}
                            </small>
                          </button>
                        ))}
                      </div>
                    )}
                    {current && (
                      <p className="mm-muted">
                        {new Date(current.created_at).toLocaleDateString()} ·{" "}
                        {current.kind === "source"
                          ? "Original photo"
                          : current.kind === "edited"
                            ? "Adjusted version"
                            : "Studio version"}
                      </p>
                    )}
                    <div className="mm-detail-actions">
                      {current?.approved_at ? (
                        <>
                          {photoUseMenu(detail, current)}
                          <button
                            className="cx-link"
                            disabled={
                              current.id === currentDish?.preferred_photo_id ||
                              !!action.busy
                            }
                            onClick={() =>
                              action.act("Setting main photo", async () => {
                                await api(`library/${detail.id}`, {
                                  preferredPhotoId: current.id,
                                });
                                await refresh();
                                action.setNotice(
                                  "Main photo updated for new creations.",
                                );
                              })
                            }
                          >
                            <Star size={15} />
                            {current.id === currentDish?.preferred_photo_id
                              ? "Main photo"
                              : "Make main photo"}
                          </button>
                        </>
                      ) : current ? (
                        <label className="cx-check">
                          <input
                            type="checkbox"
                            checked={false}
                            disabled={!!action.busy}
                            onChange={() =>
                              action.act("Approving photo", async () => {
                                await api(`assets/${current.id}/approve`, {
                                  accurate: true,
                                });
                                await refresh();
                                action.setNotice(
                                  "Photo approved and ready to use.",
                                );
                              })
                            }
                          />
                          This photo accurately shows the dish I serve
                        </label>
                      ) : null}
                      <button
                        className="cx-link"
                        onClick={() => {
                          if (
                            dirty &&
                            !window.confirm(
                              "Discard unsaved dish details and continue?",
                            )
                          )
                            return;
                          setDetail(null);
                          setDirty(false);
                          onPhoto(detail.id, current?.id);
                        }}
                      >
                        {current ? "Open in Photo Studio" : "Add a photo"}
                      </button>
                    </div>
                    {photos.some((a) => a.kind === "source") && (
                      <a
                        className="cx-link"
                        download
                        href={`/api/assets/${photos.find((a) => a.kind === "source")!.id}?original=1&download=1`}
                      >
                        Download untouched original
                      </a>
                    )}
                    <details className="mm-divider mm-dish-usage">
                      <summary>
                        Used in {usage.length} saved{" "}
                        {usage.length === 1 ? "design" : "designs"}
                      </summary>
                      {usageError ? (
                        <p role="alert" className="mm-muted">
                          {usageError}
                        </p>
                      ) : usage.length ? (
                        usage.map((u) => (
                          <div key={u.id} className="mm-inline">
                            <button
                              className="cx-link"
                              onClick={() => {
                                if (
                                  dirty &&
                                  !window.confirm(
                                    "Discard unsaved dish details and continue?",
                                  )
                                )
                                  return;
                                setDetail(null);
                                setDirty(false);
                                onOpenWork(u.kind, u.id);
                              }}
                            >
                              {u.title}
                            </button>
                            <span className="mm-muted">
                              {u.kind === "post" ? "Post" : "Menu"}
                              {u.changed ? " · Details changed" : ""}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="mm-muted">
                          No saved posts or menus use this dish yet.
                        </p>
                      )}
                      <p className="mm-muted">
                        Saved designs keep their details. Publish menu changes
                        when you’re ready.
                      </p>
                    </details>
                  </div>
                  <fieldset className="mm-dish-fields" disabled={!!action.busy}>
                    <Field label="Dish name">
                      <input
                        maxLength={100}
                        value={detail.name}
                        onChange={(e) => edit({ name: e.target.value })}
                      />
                    </Field>
                    <Field label={`Price (${state.restaurant.currency})`}>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step=".01"
                        value={detail.price}
                        onChange={(e) => edit({ price: e.target.value })}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        rows={4}
                        maxLength={2000}
                        value={detail.description}
                        onChange={(e) => edit({ description: e.target.value })}
                      />
                    </Field>
                    <Field label="Section">
                      <input
                        maxLength={100}
                        value={detail.category}
                        onChange={(e) => edit({ category: e.target.value })}
                      />
                    </Field>
                    <div className="mm-dish-dietary">
                      <span className="mm-dish-dietary-title">
                        Dietary & allergens
                      </span>
                      <DietaryPicker
                        value={detail.dietary || []}
                        disabled={!!action.busy}
                        fieldClass="cx-field"
                        onChange={(dietary) => edit({ dietary })}
                      />
                    </div>
                    <label className="cx-check">
                      <input
                        type="checkbox"
                        checked={detail.available}
                        onChange={(e) => edit({ available: e.target.checked })}
                      />
                      Available
                    </label>
                    {dirty && (
                      <p className="mm-muted">
                        Menus showing this dish get these changes, including
                        live menus. Details you changed on a menu stay as they
                        are.
                      </p>
                    )}
                    <div className="mm-divider">
                      <button
                        className="cx-link"
                        disabled={!!action.busy}
                        onClick={() =>
                          action.act("Updating dish", () =>
                            archiveDish(detail, !detail.archived_at),
                          )
                        }
                      >
                        <Archive size={16} />
                        {detail.archived_at ? "Restore dish" : "Archive dish"}
                      </button>
                      {current && (
                        <details>
                          <summary className="mm-muted">
                            Manage this photo
                          </summary>
                          <button
                            className="cx-link"
                            onClick={() => setDeleting(current.id)}
                          >
                            Delete photo permanently
                          </button>
                        </details>
                      )}
                    </div>
                  </fieldset>
                </div>
              </>
            )}
          </fieldset>
          {detail && (
            <footer className="mm-dish-detail-footer">
              <Feedback {...action} />
              {!action.notice && !action.error && !action.busy && (
                <span className="mm-muted" role="status">
                  {dirty ? "Unsaved changes" : "Details saved"}
                </span>
              )}
              <button
                className="cx-btn"
                disabled={!dirty || !!action.busy}
                onClick={() =>
                  action.act("Saving dish", async () => {
                    if (
                      detail.price === "" ||
                      !Number.isFinite(Number(detail.price)) ||
                      Number(detail.price) < 0 ||
                      Number(detail.price) > 1000000
                    )
                      throw Error(
                        "Enter a price from 0 to 1,000,000. Use 0 only if this dish is free.",
                      );
                    const saved = await api(`dishes/${detail.id}`, {
                      ...detail,
                      price: Number(detail.price),
                      confirmed: true,
                    });
                    await refresh();
                    setDetail((d) => ({ ...d, revision: saved.revision }));
                    setDirty(false);
                    const menus = (saved.menus || []) as Row[];
                    if (menus.length)
                      window.dispatchEvent(
                        new CustomEvent("menu-material:menus-changed", {
                          detail: { ids: menus.map((m) => m.id) },
                        }),
                      );
                    action.setNotice(
                      menus.length
                        ? `Dish details saved and updated on ${menus
                            .map((m) => `${m.name}${m.live ? " (live)" : ""}`)
                            .join(", ")}.`
                        : "Dish details saved.",
                    );
                  })
                }
              >
                Save details
              </button>
            </footer>
          )}
        </SheetContent>
      </Sheet>
      <input
        ref={files}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic,image/heif"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = "";
          if (list.length > 10) {
            action.setError("Upload up to 10 photos at a time.");
            return;
          }
          setUploads(
            list.map((file) => ({
              key: crypto.randomUUID(),
              file,
              url: URL.createObjectURL(file),
              name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
              status: "Ready to upload",
            })),
          );
        }}
      />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent
          className="cx-app mm-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Add a dish</DialogTitle>
          <Field label="Dish name">
            <input
              autoFocus
              value={newName}
              maxLength={100}
              onChange={(e) => setNewName(e.target.value)}
            />
          </Field>
          <p className="mm-muted">
            You can add a photo and other details later.
          </p>
          <Feedback {...action} />
          <button
            className="cx-btn"
            disabled={!newName.trim() || !!action.busy}
            onClick={() =>
              action.act("Adding dish", async () => {
                const { id, revision } = await api("dishes", {
                  name: newName,
                  confirmed: true,
                });
                await refresh();
                setAdding(false);
                open({
                  id,
                  revision,
                  name: newName,
                  description: "",
                  category: "Dishes",
                  price: 0,
                  available: true,
                });
              })
            }
          >
            Add dish
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={uploads.length > 0}
        onOpenChange={(v) => {
          if (!v && !action.busy) {
            uploads.forEach((u) => URL.revokeObjectURL(u.url));
            setUploads([]);
          }
        }}
      >
        <DialogContent
          className="cx-app mm-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Upload dish photos</DialogTitle>
          <p className="mm-muted">
            One dish per photo. Check the names, then upload. Originals are
            retained.
          </p>
          <div className="mm-upload-rows">
            {uploads.map((u) => (
              <div className="mm-upload-row" key={u.key}>
                <img src={u.url} alt="Photo to upload" />
                <div>
                  <input
                    aria-label={`Dish name for ${u.file.name}`}
                    value={u.name}
                    maxLength={100}
                    disabled={!!u.dishId}
                    onChange={(e) =>
                      setUploads((prev) =>
                        prev.map((x) =>
                          x.key === u.key ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <p role="status">{u.status}</p>
                </div>
                {u.assetId && <Check size={18} />}
              </div>
            ))}
          </div>
          <Feedback {...action} />
          <button
            className="cx-btn"
            disabled={!!action.busy || uploads.some((u) => !u.name.trim())}
            onClick={() =>
              uploads.every((u) => u.assetId)
                ? (uploads.forEach((u) => URL.revokeObjectURL(u.url)),
                  setUploads([]))
                : action.act("Uploading photos", uploadAll)
            }
          >
            {uploads.every((u) => u.assetId)
              ? "Done"
              : action.busy || "Upload photos"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={downloadIds.length > 0}
        onOpenChange={(v) => {
          if (!v) setDownloadIds([]);
        }}
      >
        <DialogContent
          className="cx-app cx-export-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>
            {downloadIds.length > 1
              ? "Download selected photos"
              : "Download photo"}
          </DialogTitle>
          <PhotoDownloads
            key={downloadIds.join(":")}
            items={downloadIds
              .map((id) => {
                const a = state.assets.find(
                  (a: Row) => a.id === id && a.approved_at,
                );
                const d = a && allDishes.find((d) => d.id === a.dish_id);
                return a && d ? downloadPhotoItem(state, a, d.name) : null;
              })
              .filter((item) => item !== null)}
            preferenceKey={workspacePreferenceKey(
              state.user.id,
              state.restaurant.id,
            )}
            onPromote={(item) => {
              setDownloadIds([]);
              reuse({ id: item.dishId }, { id: item.assetId }, "post");
            }}
          />
        </DialogContent>
      </Dialog>
      {photoUse?.kind === "download" && usedPhoto && (
        <PhotoFinishSheet
          key={`download-${usedPhoto.id}`}
          open
          onOpenChange={(value) => {
            if (!value) setPhotoUse(null);
          }}
          assetId={usedPhoto.id}
          dishId={photoUse.dish.id}
          name={usedName}
          fromPhoto={usedFromPhoto}
          approved={!!usedPhoto.approved_at}
          initialFormat={usedLineage?.format || "menu"}
          style={usedStyle}
          onApprove={async () => {
            await api(`assets/${usedPhoto.id}/approve`, { accurate: true });
            await refresh();
          }}
          onPack={() => setPhotoUse({ ...photoUse, kind: "pack" })}
        />
      )}
      {photoUse?.kind === "pack" && usedPhoto?.approved_at && (
        <PhotoPackSheet
          key={`pack-${usedPhoto.id}`}
          open
          onOpenChange={(value) => {
            if (!value) setPhotoUse(null);
          }}
          assetId={usedPhoto.id}
          name={usedName}
          fromPhoto={usedFromPhoto}
          style={usedStyle}
        />
      )}
      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting("")}
        onConfirm={() => {
          const id = deleting;
          setDeleting("");
          void action.act("Deleting photo", async () => {
            await api(`assets/${id}`, undefined, "DELETE");
            await refresh();
            setChosen("");
            action.setNotice(
              "Photo deleted. Published references were removed.",
            );
          });
        }}
      />
    </section>
  );
}

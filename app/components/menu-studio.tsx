"use client";
import WorkspaceTabs from "./workspace-tabs";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  Download,
  FileText,
  History,
  ImagePlus,
  LayoutTemplate,
  List,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Redo2,
  Settings2,
  Share2,
  Smartphone,
  Undo2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { api, dishCount, downloadBlob, type Row } from "@/lib/client";
import {
  entryPrice,
  menuPrice,
  menuPurposeDefaults,
  menuPurposePatch,
  newMenuDocument,
  newMenuEntry,
  type DesignedMenu,
  type MenuDocument,
  type MenuEntry,
  type MenuSection,
} from "@/lib/menu-document";
import {
  menuDesignCollection,
  menuDesignSpec,
  recommendMenuDesigns,
} from "@/lib/menu-design-system";
import {
  attachAddonToDishAbove,
  blockingChecks,
  menuPublishChecks,
  restaurantSettingsChanged,
  withLibraryLinks,
} from "@/lib/menu-checks";
import { addonLabel, inferMenuPurpose, isAddonName } from "@/lib/menu-paste";
import { normalizeDietary } from "@/lib/dietary";
import type { MenuContact } from "@/lib/restaurant-contact";
import type { MenuPdfResult } from "@/lib/menu-pdf-v2";
import { useMenuDocument, type SavedMenu } from "./use-menu-document";
import MenuProof from "./menu-proof";
import MenuDocumentView from "./menu-document-view";
import MenuStats, { MenuStatsSummary, useMenuStats } from "./menu-stats";
import MenuQuickUpdate, { type QuickChange } from "./menu-quick-update";
import WorkspaceActionBar from "./workspace-action-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  MenuActionContext,
  MenuDetailsInspector,
  MenuDesignInspector,
  MenuDialog,
  MenuItemInspector,
  MenuSectionInspector,
} from "./menu-studio-controls";
import {
  MenuDesignPicker,
  MenuSourceDialog,
  MenuImportReview,
  MenuDeliveryDialog,
  MenuShareDialog,
} from "./menu-studio-dialogs";

export type MenuStudioProps = {
  state: Row;
  refresh: () => Promise<void>;
  seed: Row | null;
  onSeedUsed: () => void;
  onPhoto: (dishId: string, photoId?: string) => void;
};
export default function MenuStudio({
  state,
  refresh,
  seed,
  onSeedUsed,
  onPhoto,
}: MenuStudioProps) {
  const store = useMenuDocument(state.restaurant.id),
    { draft, record, change } = store;
  const [selected, setSelected] = useState(""),
    [panel, setPanel] = useState("content"),
    [preview, setPreview] = useState("print"),
    [dialog, setDialog] = useState(""),
    [source, setSource] = useState("file"),
    [mobilePanel, setMobilePanel] = useState("preview"),
    [focusPreview, setFocusPreview] = useState(false),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [proof, setProof] = useState<MenuPdfResult | null>(null),
    [history, setHistory] = useState<Row[]>([]),
    [archivedMenus, setArchivedMenus] = useState<SavedMenu[]>([]),
    [newName, setNewName] = useState(""),
    [query, setQuery] = useState("");
  const linking = useRef(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const stats = useMenuStats(
    `${record?.publishedAt || 0}:${store.menus.filter((m) => m.published).length}`,
  );
  const seedHandled = useRef(""),
    inspectorRef = useRef<HTMLElement>(null),
    actionLock = useRef(false),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restaurant = {
      name: state.restaurant.name,
      currency: state.restaurant.currency,
      logoId: state.restaurant.logo_id,
      style: state.restaurant.style,
      orderingUrl: state.restaurant.ordering_url,
    },
    menu: DesignedMenu = { ...draft, restaurant, documentId: record?.id };
  // Guests see the restaurant's live contact details; the phone preview does too.
  const contact: MenuContact = {
    address: state.restaurant.address || "",
    phone: state.restaurant.phone || "",
    reservationUrl: state.restaurant.reservation_url || "",
    orderingUrl: state.restaurant.ordering_url || "",
    hours: state.restaurant.hours || [],
    timezone: state.restaurant.timezone,
  };
  const items = draft.sections.flatMap((s) => s.items),
    item = items.find((i) => i.id === selected),
    section = draft.sections.find(
      (s) => s.id === selected || s.items.some((i) => i.id === selected),
    ),
    sampleDishIds = (state.dishes as Row[])
      .filter((d) => d.sample)
      .map((d) => d.id as string),
    checks = menuPublishChecks(draft, {
      restaurantName: state.restaurant.name,
      sampleDishIds,
      correctionPhotoIds: (state.assets as Row[])
        .filter((a) => a.needs_correction)
        .map((a) => a.id as string),
    }),
    issues = blockingChecks(checks),
    spec = menuDesignSpec(draft.design);
  // Dishes guests would see without a photo, where My Dishes has none either.
  const photographed = new Set(
      (state.assets as Row[])
        .filter((a) => a.dish_id && a.approved_at)
        .map((a) => a.dish_id as string),
    ),
    needPhotos = items.filter(
      (i) =>
        i.visible && !i.photoId && !(i.dishId && photographed.has(i.dishId)),
    );
  function tell(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 6500);
  }
  async function act(label: string, fn: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      actionLock.current = false;
      setBusy("");
    }
  }
  function patch(value: Partial<MenuDocument>) {
    change((before) => ({ ...before, ...value }));
  }
  function editItem(id: string, value: Partial<MenuEntry>) {
    change((before) => ({
      ...before,
      sections: before.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === id ? { ...i, ...value } : i)),
      })),
    }));
  }
  function select(id: string) {
    setFocusPreview(false);
    setSelected(id);
    setPanel("content");
    setMobilePanel("details");
    if (window.matchMedia("(max-width: 1100px)").matches) {
      requestAnimationFrame(() => {
        const inspector = inspectorRef.current;
        if (!inspector) return;
        const fields = [
          ...inspector.querySelectorAll<HTMLInputElement>(
            'input:not([type="checkbox"]):not([type="hidden"])',
          ),
        ].slice(0, 2);
        const first = fields[0]?.getBoundingClientRect();
        const last = fields.at(-1)?.getBoundingClientRect();
        const safeTop =
          window.innerWidth <= 760
            ? (document.querySelector(".cx-sidebar")?.getBoundingClientRect()
                .height || 0) + 16
            : 16;
        if (first && last) {
          const offset =
            first.top < safeTop
              ? first.top - safeTop
              : last.bottom > window.innerHeight - 24
                ? Math.min(
                    first.top - safeTop,
                    last.bottom - window.innerHeight + 24,
                  )
                : 0;
          if (offset) window.scrollBy({ top: offset, behavior: "instant" });
        }
        inspector.focus({ preventScroll: true });
      });
    }
  }
  function addItem(sectionId = section?.id) {
    const entry = newMenuEntry();
    let sid = sectionId || draft.sections[0]?.id;
    change((before) => {
      let sections = before.sections;
      if (!sid) {
        sid = crypto.randomUUID();
        sections = [
          {
            id: sid,
            name: "From the kitchen",
            description: "",
            pageBreakBefore: false,
            items: [],
          },
        ];
      }
      return {
        ...before,
        sections: sections.map((s) =>
          s.id === sid ? { ...s, items: [...s.items, entry] } : s,
        ),
      };
    });
    select(entry.id);
  }
  function addSection() {
    const next: MenuSection = {
      id: crypto.randomUUID(),
      name: "New section",
      description: "",
      pageBreakBefore: false,
      items: [],
    };
    patch({ sections: [...draft.sections, next] });
    select(next.id);
  }
  function append(
    sections: MenuSection[],
    importId: string | null = null,
    originalText?: string,
  ) {
    const added = sections.flatMap((s) => s.items),
      withPhotos = added.filter((i) => i.photoId).length,
      needsLook = added.filter((i) => !i.sourceReviewed).length;
    // A new menu takes its type from its sections: breakfast, pastries and
    // coffee make a café menu, not "Dinner".
    const inferred =
      !items.length && draft.purpose === "dinner"
        ? inferMenuPurpose(sections.map((s) => s.name))
        : null;
    const typed =
      inferred && inferred !== draft.purpose
        ? menuPurposePatch(draft, inferred)
        : null;
    change((before) => {
      const hadPhotos = before.sections.some((s) =>
        s.items.some((i) => i.photoId),
      );
      // Dishes join the menu's section of the same name instead of repeating
      // its heading, while it has room (a section holds up to 100 dishes).
      let merged = before.sections;
      for (const section of sections) {
        const key = section.name.trim().toLowerCase();
        const index = key
          ? merged.findIndex(
              (s) =>
                s.name.trim().toLowerCase() === key &&
                s.items.length + section.items.length <= 100,
            )
          : -1;
        merged =
          index < 0
            ? [...merged, section]
            : merged.map((s, i) =>
                i === index
                  ? { ...s, items: [...s.items, ...section.items] }
                  : s,
              );
      }
      const next: MenuDocument = {
        ...before,
        ...typed,
        importSourceId: importId || before.importSourceId,
        importSourceText: originalText ?? before.importSourceText,
        // Show the dishes' approved photos when they're the menu's first ones.
        layout:
          withPhotos && !hadPhotos && before.layout === "classic"
            ? "featured"
            : before.layout,
        sections: merged,
      };
      // An untouched new menu starts in the design that best fits its type.
      if (typed && before.design === "bistro")
        next.design = recommendMenuDesigns(next)[0]?.id ?? before.design;
      return next;
    });
    setDialog("");
    select(sections[0]?.items[0]?.id || "");
    void linkToLibrary();
    tell(
      [
        `${dishCount(added.length)} added.`,
        withPhotos
          ? `${withPhotos === added.length ? "Their" : withPhotos} photos are on the menu.`
          : "",
        typed
          ? `Set up as a ${menuPurposeDefaults(inferred!).name.toLowerCase()}; change the type in Details.`
          : "",
        needsLook && needsLook === added.length
          ? "Check them against your original before publishing."
          : needsLook
            ? `${needsLook} ${needsLook === 1 ? "needs" : "need"} a closer look before publishing.`
            : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  function attachAddon(entryId: string) {
    const entry = items.find((i) => i.id === entryId),
      owner = draft.sections.find((s) => s.items.some((i) => i.id === entryId));
    const above =
      owner?.items[owner.items.findIndex((i) => i.id === entryId) - 1];
    if (!entry || !above) return;
    const label = addonLabel(entry.name);
    change((before) => attachAddonToDishAbove(before, entryId, label));
    if (selected === entryId) select(above.id);
    tell(
      `${label} is now an add-on for ${above.name}. Use Undo to reverse it.`,
    );
  }
  function applyPurpose(purpose: MenuDocument["purpose"]) {
    patch(menuPurposePatch(draft, purpose));
    tell(
      `Now a ${menuPurposeDefaults(purpose).name.toLowerCase()}. You can change the type in Details.`,
    );
  }
  // Reviewed dishes join My Dishes, so they can have photos and follow dish
  // edits. Links merge into the newest draft without an undo step.
  async function linkToLibrary(ids?: string[]) {
    const latest = store.latest(),
      menuId = record?.id;
    const entries = latest.sections.flatMap((s) =>
      s.items
        .filter(
          (i) =>
            !i.dishId &&
            i.sourceReviewed &&
            i.name.trim() &&
            i.name.trim().length <= 100 &&
            s.name.trim() &&
            s.name.trim().length <= 100 &&
            (!ids || ids.includes(i.id)),
        )
        .map((i) => ({
          id: i.id,
          name: i.name.trim(),
          description: i.description,
          category: s.name.trim(),
          price: libraryPrice(i),
          available: i.available,
          dietary: i.dietary,
        })),
    );
    if (!entries.length || !menuId || linking.current) return;
    linking.current = true;
    try {
      const { links } = await api(`menus/${menuId}/library`, {
        entries: entries.slice(0, 200),
      });
      store.change((before) => withLibraryLinks(before, links), false);
      await refresh();
    } catch (e) {
      setError(
        `Your dishes are on the menu, but they couldn’t be added to My Dishes. ${(e as Error).message}`,
      );
    } finally {
      linking.current = false;
    }
  }
  async function addPhotos() {
    await act("Getting your dishes ready for photos", async () => {
      await linkToLibrary();
      const target = store
        .latest()
        .sections.flatMap((s) => s.items)
        .find(
          (i) =>
            i.visible && !i.photoId && i.dishId && !photographed.has(i.dishId),
        );
      if (!target) {
        tell(
          items.some((i) => !i.sourceReviewed)
            ? "Review your imported dishes first, then add their photos."
            : "Every dish on this menu has a photo.",
        );
        return;
      }
      await store.saveNow();
      onPhoto(target.dishId!);
    });
  }
  function reorder<T>(values: T[], index: number, direction: number) {
    const next = [...values];
    const dest = index + direction;
    if (dest < 0 || dest >= next.length) return values;
    [next[index], next[dest]] = [next[dest], next[index]];
    return next;
  }
  const consumeSeed = useEffectEvent(() => {
    if (!record || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
    if (seed.draftId)
      void act("Opening saved menu", async () => {
        await store.select(seed.draftId);
        setSelected("");
      });
    else if (seed.openImport) {
      setSource("file");
      setDialog("source");
    } else if (seed.dishId) {
      const dish = (state.dishes as Row[]).find((d) => d.id === seed.dishId);
      if (dish) {
        const existing = items.find((i) => i.dishId === dish.id);
        if (existing) {
          if (seed.photoId)
            editItem(existing.id, { photoId: seed.photoId, featured: true });
          select(existing.id);
        } else {
          const entry = newMenuEntry({
            dishId: dish.id,
            name: dish.name,
            description: dish.description,
            price: dish.price,
            dietary: normalizeDietary(dish.dietary),
            photoId: seed.photoId || null,
            featured: !!seed.photoId,
            available: !!dish.available,
          });
          const target = draft.sections.find((s) => s.name === dish.category);
          if (target)
            patch({
              sections: draft.sections.map((s) =>
                s.id === target.id ? { ...s, items: [...s.items, entry] } : s,
              ),
            });
          else
            append([
              {
                id: crypto.randomUUID(),
                name: dish.category || "Dishes",
                description: "",
                pageBreakBefore: false,
                items: [entry],
              },
            ]);
          select(entry.id);
        }
        if (seed.photoId) patch({ layout: "featured" });
        if (seed.print) setPreview("print");
      }
    }
    onSeedUsed();
  });
  useEffect(() => {
    // Deliver cross-workspace commands after mounting; discard a superseded command.
    let active = true;
    queueMicrotask(() => {
      if (active) consumeSeed();
    });
    return () => {
      active = false;
    };
  }, [seed?.token, record?.id]);
  const keyboardUndo = useEffectEvent((forward: boolean) =>
    forward ? store.redo() : store.undo(),
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        !(e.metaKey || e.ctrlKey) ||
        e.key.toLowerCase() !== "z" ||
        (e.target as HTMLElement).matches(
          "input,textarea,[contenteditable=true]",
        ) ||
        dialog
      )
        return;
      e.preventDefault();
      keyboardUndo(e.shiftKey);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dialog]);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  async function openHistory() {
    await store.saveNow();
    const result = await api(`menus/${record!.id}/history`);
    setHistory(result.history);
    setDialog("history");
  }
  async function documentAction(
    action: string,
    extra: Row = {},
    resetHistory = false,
  ) {
    const latest = await store.flush();
    if (!latest) throw Error("The menu is still loading.");
    const result = await api(`menus/${latest.id}/${action}`, {
      revision: latest.revision,
      ...extra,
    });
    if (result.draft) await store.accept(result as SavedMenu, resetHistory);
    else if (action === "archive") {
      const rows = await store.refreshList();
      if (rows[0]) await store.select(rows[0].id);
      else await store.create();
      setSelected("");
    } else await store.reload();
    await refresh();
    return result;
  }
  async function applyQuickUpdate(changes: QuickChange[], message: string) {
    let confirmation: string | null = null;
    await act("Updating your live menu", async () => {
      // Live changes can't be undone from the editor, so its history resets.
      const result = await documentAction("live", { changes }, true);
      const others = (result.menus || []) as Row[];
      confirmation = others.length
        ? `${message} Also updated on ${others.map((m) => m.name).join(", ")}.`
        : message;
    });
    return confirmation;
  }
  if (!record)
    return (
      <section className="md-studio">
        <div className="md-loading">
          <span className="md-eyebrow">Menu studio</span>
          <h1>Menus</h1>
          <p role="status">{store.status}</p>
          {store.error && (
            <>
              <p role="alert">{store.error}</p>
              <button
                className="md-button"
                onClick={() => void store.initialize()}
              >
                Try again
              </button>
            </>
          )}
        </div>
      </section>
    );
  // The live menu keeps the name, logo, colors and currency it was published
  // with until it's published again.
  const settingsChanged = restaurantSettingsChanged(
    record.published,
    state.restaurant,
  );
  const draftLive =
    !!record.published &&
    !store.hasUnsavedChanges &&
    record.publishedRevision === record.revision;
  // Nothing new to publish: the live menu shows this draft.
  const upToDate = draftLive && !settingsChanged;
  return (
    <MenuActionContext.Provider value={{ busy, error: error || store.error }}>
      <section
        className={`md-studio md-mobile-${mobilePanel}${focusPreview ? " md-focus-preview" : ""}`}
        aria-label="Menu Studio"
        aria-busy={!!busy}
        data-action-layout
      >
        <header className="md-studio-header">
          <div className="md-document-heading">
            <button
              className="md-document-picker"
              onClick={() => setDialog("library")}
            >
              <h1>{draft.name || "Untitled menu"}</h1>
              <ChevronDown size={18} />
            </button>
            <div className="md-status-row">
              <span className="md-save-status" role="status">
                {(!!items.length ||
                  !!draft.sections.length ||
                  !!record.published ||
                  !!store.error) && (
                  <>
                    <i className={store.error ? "is-error" : ""} />
                    {store.status}
                  </>
                )}
                {record.published && (
                  <span>
                    ·{" "}
                    {upToDate
                      ? "Published"
                      : draftLive
                        ? "Republish to apply your restaurant settings"
                        : "Live menu has an older version"}
                  </span>
                )}
              </span>
              <MenuStatsSummary
                stats={stats}
                onOpen={() => setStatsOpen(true)}
              />
            </div>
          </div>
          <WorkspaceActionBar className="md-header-actions">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="md-icon md-more-actions"
                  aria-label="More menu actions"
                >
                  <MoreHorizontal size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="workspace-action-menu"
                align="start"
                side="top"
              >
                <DropdownMenuItem
                  disabled={!store.canUndo || !!busy}
                  onSelect={store.undo}
                >
                  <Undo2 size={16} /> Undo change
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!store.canRedo || !!busy}
                  onSelect={store.redo}
                >
                  <Redo2 size={16} /> Redo change
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!items.length || !!busy}
                  onSelect={() => setDialog("export")}
                >
                  <Download size={16} /> Export PDF
                </DropdownMenuItem>
                {record.published && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setDialog("share")}>
                      <Share2 size={16} /> Share live menu
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="md-undo">
              <button
                className="md-icon"
                aria-label="Undo menu change"
                title="Undo"
                disabled={!store.canUndo || !!busy}
                onClick={store.undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="md-icon"
                aria-label="Redo menu change"
                title="Redo"
                disabled={!store.canRedo || !!busy}
                onClick={store.redo}
              >
                <Redo2 size={17} />
              </button>
            </div>
            {record.published && (
              <button
                className="md-button md-secondary md-quick-button"
                disabled={!!busy}
                onClick={() => setDialog("quick")}
              >
                <Zap size={16} /> Quick update
              </button>
            )}
            {record.published && (
              <button
                className="md-button md-secondary md-share-button"
                onClick={() => setDialog("share")}
              >
                <Share2 size={16} /> Share
              </button>
            )}
            <button
              className="md-button md-secondary md-export-button"
              disabled={!items.length || !!busy}
              onClick={() => setDialog("export")}
            >
              <Download size={16} /> Export PDF
            </button>
            <button
              className={`md-button${upToDate ? " md-secondary" : ""}`}
              disabled={!items.length || !!busy}
              title={
                upToDate
                  ? "Your live menu is up to date. Open to republish it."
                  : draftLive
                    ? "Republish to apply your restaurant settings."
                    : undefined
              }
              onClick={() => setDialog("publish")}
            >
              {upToDate ? (
                <>
                  <Check size={16} /> Published
                </>
              ) : record.published ? (
                "Publish changes"
              ) : (
                "Publish menu"
              )}
            </button>
          </WorkspaceActionBar>
        </header>
        <MenuStats
          stats={stats}
          open={statsOpen}
          setOpen={setStatsOpen}
          onShare={record.published ? () => setDialog("share") : undefined}
        />
        {(error || store.error) && (
          <div className="md-notice md-error" role="alert">
            <span>{error || store.error}</span>
            {store.error ? (
              <div>
                <button
                  onClick={() =>
                    downloadBlob(
                      new Blob([JSON.stringify(draft, null, 2)], {
                        type: "application/json",
                      }),
                      "menu-recovery.json",
                    )
                  }
                >
                  Download recovery copy
                </button>
                <button
                  onClick={() => void act("Reloading saved menu", store.reload)}
                >
                  Reload saved menu
                </button>
                <button onClick={() => void act("Saving menu", store.saveNow)}>
                  Retry save
                </button>
              </div>
            ) : (
              <button
                className="md-icon"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        {notice && (
          <div className="md-notice md-success" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {busy && (
          <div className="md-working" role="status">
            {busy}…
          </div>
        )}
        <nav className="md-mobile-nav" aria-label="Menu workspace">
          <button
            aria-pressed={mobilePanel === "outline"}
            onClick={() => setMobilePanel("outline")}
          >
            <List size={16} /> On the menu
          </button>
          <button
            aria-pressed={mobilePanel === "preview"}
            onClick={() => setMobilePanel("preview")}
          >
            <FileText size={16} /> Preview
          </button>
          <button
            aria-pressed={mobilePanel === "details"}
            onClick={() => setMobilePanel("details")}
          >
            <Settings2 size={16} /> Edit & design
          </button>
        </nav>
        {!items.length && !draft.sections.length ? (
          <div className="md-start">
            <div className="md-start-copy">
              <span className="md-eyebrow">New menu</span>
              <h2>Add your dishes</h2>
              <p>
                Import the menu you have, pick from My Dishes or start blank.
                Type, spacing and pages are handled for you.
              </p>
              <div className="md-start-actions">
                <button
                  className="md-button"
                  onClick={() => {
                    setSource("file");
                    setDialog("source");
                  }}
                >
                  <Upload size={17} /> Import your menu
                </button>
                <button
                  className="md-button md-secondary"
                  onClick={() => {
                    setSource("library");
                    setDialog("source");
                  }}
                >
                  <BookOpen size={17} /> Use my dishes
                </button>
              </div>
              <button className="md-text-button" onClick={() => addItem()}>
                Start with a blank menu <Plus size={14} />
              </button>
              <div className="md-start-note">
                {menuDesignCollection.length} designs. Print-ready pages. A
                matching menu for every phone.
              </div>
            </div>
            <div className="md-start-art" aria-hidden="true">
              <div className="md-art-card md-art-back">
                <span>THE CORNER HOUSE</span>
                <strong>
                  GOOD
                  <br />
                  FOOD.
                  <br />
                  GOOD
                  <br />
                  COMPANY.
                </strong>
                <i>From our kitchen, with love.</i>
              </div>
              <div className="md-art-card md-art-front">
                <span>YOUR RESTAURANT</span>
                <strong>At the table</strong>
                <em>A season of good things</em>
                <hr />
                <b>TO BEGIN</b>
                <p>
                  Something worth sharing <i>12</i>
                </p>
                <small>Thoughtful ingredients, simply prepared</small>
                <p>
                  A familiar favorite <i>16</i>
                </p>
                <small>Made just the way you love it</small>
                <hr />
                <b>FROM THE KITCHEN</b>
                <p>
                  The chef’s special <i>28</i>
                </p>
                <small>The best of what’s in season</small>
              </div>
            </div>
          </div>
        ) : (
          <div className="md-workspace">
            <aside className="md-outline" aria-label="Menu contents">
              <div className="md-outline-heading">
                <h2>On the menu</h2>
                <span>{dishCount(items.length)}</span>
              </div>
              <input
                className="md-outline-search"
                type="search"
                placeholder="Find a dish…"
                aria-label="Find a dish to edit"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="md-outline-sections">
                {draft.sections.map((s) => (
                  <div className="md-outline-section" key={s.id}>
                    <button
                      className={`md-section-name ${selected === s.id ? "is-selected" : ""}`}
                      aria-pressed={selected === s.id}
                      onClick={() => select(s.id)}
                    >
                      <span>{s.name || "Untitled section"}</span>
                      <small>{s.items.length}</small>
                    </button>
                    {s.items
                      .filter(
                        (i) =>
                          !query ||
                          `${i.name} ${s.name}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((i) => (
                        <button
                          key={i.id}
                          className={`md-outline-item ${selected === i.id ? "is-selected" : ""} ${!i.visible ? "is-hidden" : ""}`}
                          aria-pressed={selected === i.id}
                          onClick={() => select(i.id)}
                        >
                          {i.photoId && (
                            <img src={`/api/assets/${i.photoId}`} alt="" />
                          )}
                          <span>
                            {i.name || "Untitled dish"}
                            {!i.sourceReviewed && <small>Needs review</small>}
                            {!i.visible && <small>Hidden</small>}
                          </span>
                          <small>{entryPrice(i, menu)}</small>
                        </button>
                      ))}
                    <button
                      className="md-outline-add"
                      aria-label={`Add dish to ${s.name || "Untitled section"}`}
                      onClick={() => addItem(s.id)}
                    >
                      <Plus size={13} /> Add dish
                    </button>
                  </div>
                ))}
              </div>
              <div className="md-outline-bottom">
                <button className="md-button md-secondary" onClick={addSection}>
                  <Plus size={15} /> Add section
                </button>
                <button
                  className="md-text-button"
                  onClick={() => {
                    setSource("library");
                    setDialog("source");
                  }}
                >
                  <ImagePlus size={15} /> Add from library or file
                </button>
                {draft.importSourceId && (
                  <a
                    className="md-text-button"
                    href={`/api/imports/${draft.importSourceId}/original`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={15} /> Open original menu
                  </a>
                )}
                {items.some((i) => !i.sourceReviewed) && (
                  <button
                    className="md-text-button"
                    onClick={() => setDialog("review")}
                  >
                    Review imported details
                  </button>
                )}
                <button
                  className="md-text-button"
                  onClick={() => setDialog("bulk")}
                >
                  Update prices together
                </button>
              </div>
            </aside>
            <section className="md-stage" aria-label="Menu preview">
              <div className="md-stage-toolbar">
                <button
                  className="md-text-button md-focus-toggle"
                  aria-label={
                    focusPreview ? "Exit focus preview" : "Focus preview"
                  }
                  title={focusPreview ? "Exit focus preview" : "Focus preview"}
                  aria-pressed={focusPreview}
                  onClick={() => setFocusPreview((value) => !value)}
                >
                  {focusPreview ? (
                    <Minimize2 size={16} />
                  ) : (
                    <Maximize2 size={16} />
                  )}
                  <span>{focusPreview ? "Exit focus" : "Focus preview"}</span>
                </button>
                <div
                  className="md-segment"
                  role="group"
                  aria-label="Menu preview format"
                >
                  <button
                    aria-pressed={preview === "print"}
                    onClick={() => setPreview("print")}
                  >
                    <FileText size={15} /> Print
                  </button>
                  <button
                    aria-pressed={preview === "phone"}
                    onClick={() => setPreview("phone")}
                  >
                    <Smartphone size={15} /> Phone
                  </button>
                </div>
                <button
                  className="md-design-label"
                  onClick={() => setDialog("design")}
                >
                  <LayoutTemplate size={15} />
                  <span className="md-toolbar-design-name">{spec.name}</span>
                  <span className="md-toolbar-design-short">Design</span>
                  <ChevronDown size={13} />
                </button>
              </div>
              <div className="md-preview-hint">
                Click a dish to edit it. Every detail stays yours.
              </div>
              {preview === "print" ? (
                <MenuProof
                  menu={menu}
                  selected={selected}
                  onSelect={select}
                  onResult={setProof}
                />
              ) : (
                <div className="md-phone-stage">
                  <div className="md-phone-frame">
                    <div className="md-phone-speaker" />
                    <MenuDocumentView
                      menu={{ ...menu, contact }}
                      preview
                      onSelect={select}
                    />
                  </div>
                </div>
              )}
              <div className="md-quality-strip">
                {issues.length ? (
                  <button
                    onClick={() =>
                      issues[0].fix === "restaurant-name"
                        ? setDialog("publish")
                        : items.some((i) => !i.sourceReviewed)
                          ? setDialog("review")
                          : select(
                              issues[0].entryId || issues[0].sectionId || "",
                            )
                    }
                  >
                    <span className="md-attention-dot" />
                    {issues.length} {issues.length === 1 ? "detail" : "details"}{" "}
                    to review
                  </button>
                ) : (
                  <span>
                    <Check size={14} /> Content ready
                  </span>
                )}
                {needPhotos.length > 0 && (
                  <button
                    className="md-photo-prompt"
                    disabled={!!busy}
                    onClick={() => void addPhotos()}
                  >
                    <Camera size={14} aria-hidden="true" />
                    {needPhotos.length}{" "}
                    {needPhotos.length === 1 ? "dish has" : "dishes have"} no
                    photo · Add photos
                  </button>
                )}
                <span>
                  {proof
                    ? `${proof.pages} ${proof.pages === 1 ? "page" : "pages"} · `
                    : ""}
                  {items.filter((i) => i.visible).length} visible dishes
                </span>
                {!!proof?.warnings.length && (
                  <button onClick={() => setDialog("export")}>
                    {proof.warnings.length} print{" "}
                    {proof.warnings.length === 1 ? "note" : "notes"}
                  </button>
                )}
              </div>
            </section>
            <aside
              ref={inspectorRef}
              tabIndex={-1}
              className="md-inspector"
              aria-label="Menu editing controls"
            >
              <WorkspaceTabs
                value={panel}
                onValueChange={setPanel}
                label="Editing options"
                options={[
                  { value: "content", label: "Content" },
                  { value: "design", label: "Design" },
                  { value: "details", label: "Details" },
                ]}
              >
                {panel === "design" ? (
                  <MenuDesignInspector
                    menu={draft}
                    change={patch}
                    choose={() => setDialog("design")}
                  />
                ) : panel === "details" ? (
                  <MenuDetailsInspector menu={draft} change={patch} />
                ) : item && section ? (
                  <MenuItemInspector
                    key={item.id}
                    item={item}
                    section={section}
                    sections={draft.sections}
                    assets={state.assets || []}
                    menuId={record.id}
                    onLibrary={() => setDialog("dish-library")}
                    addonFor={
                      isAddonName(item.name) && item.priceMode === "single"
                        ? section.items[
                            section.items.findIndex((i) => i.id === item.id) - 1
                          ]?.name
                        : undefined
                    }
                    attachAddon={() => attachAddon(item.id)}
                    addToLibrary={() =>
                      void act("Adding to My Dishes", () =>
                        linkToLibrary([item.id]),
                      )
                    }
                    change={(v) => {
                      editItem(item.id, v);
                      // A dish checked against the original joins My Dishes.
                      if (v.sourceReviewed && !item.dishId)
                        queueMicrotask(() => void linkToLibrary([item.id]));
                    }}
                    onPhoto={() =>
                      void act("Saving menu", async () => {
                        await store.saveNow();
                        onPhoto(item.dishId!, item.photoId || undefined);
                      })
                    }
                    remove={() => {
                      patch({
                        sections: draft.sections.map((s) => ({
                          ...s,
                          items: s.items.filter((i) => i.id !== item.id),
                        })),
                      });
                      select(section.id);
                      tell("Dish removed. Use Undo to bring it back.");
                    }}
                    move={(id) =>
                      patch({
                        sections: draft.sections.map((s) => ({
                          ...s,
                          items:
                            s.id === id
                              ? [
                                  ...s.items.filter((i) => i.id !== item.id),
                                  item,
                                ]
                              : s.items.filter((i) => i.id !== item.id),
                        })),
                      })
                    }
                    reorder={(direction) =>
                      patch({
                        sections: draft.sections.map((s) =>
                          s.id === section.id
                            ? {
                                ...s,
                                items: reorder(
                                  s.items,
                                  s.items.findIndex((i) => i.id === item.id),
                                  direction,
                                ),
                              }
                            : s,
                        ),
                      })
                    }
                  />
                ) : section ? (
                  <MenuSectionInspector
                    section={section}
                    index={draft.sections.indexOf(section)}
                    count={draft.sections.length}
                    change={(v) =>
                      patch({
                        sections: draft.sections.map((s) =>
                          s.id === section.id ? { ...s, ...v } : s,
                        ),
                      })
                    }
                    add={() => addItem(section.id)}
                    reorder={(direction) =>
                      patch({
                        sections: reorder(
                          draft.sections,
                          draft.sections.indexOf(section),
                          direction,
                        ),
                      })
                    }
                    remove={() => {
                      patch({
                        sections: draft.sections.filter(
                          (s) => s.id !== section.id,
                        ),
                      });
                      setSelected("");
                      tell(
                        "Section removed. Use Undo to restore it and its dishes.",
                      );
                    }}
                  />
                ) : (
                  <div className="md-inspector-welcome">
                    <span className="md-inspector-orbit">
                      <Settings2 size={24} />
                    </span>
                    <h3>Edit your menu</h3>
                    <p>
                      Select a dish or section to edit its details, or choose a
                      different design.
                    </p>
                    <button
                      className="md-button md-secondary"
                      onClick={() => setDialog("design")}
                    >
                      Explore designs
                    </button>
                    <button
                      className="md-text-button md-link"
                      onClick={() => setPanel("details")}
                    >
                      Edit the menu title & notes
                    </button>
                  </div>
                )}
              </WorkspaceTabs>
            </aside>
          </div>
        )}
        {dialog === "design" && (
          <MenuDesignPicker
            menu={menu}
            close={() => setDialog("")}
            apply={(design) => {
              patch({ design });
              setDialog("");
              setPanel("design");
              tell(
                `${menuDesignSpec(design).name} applied. Your content and photo choices are preserved.`,
              );
            }}
          />
        )}
        {dialog === "review" && (
          <MenuImportReview
            menu={draft}
            change={patch}
            close={() => {
              setDialog("");
              void linkToLibrary();
            }}
          />
        )}
        {dialog === "source" && (
          <MenuSourceDialog
            mode={source}
            setMode={setSource}
            state={state}
            close={() => setDialog("")}
            append={append}
            refresh={refresh}
            onMenu={items.flatMap((i) => (i.dishId ? [i.dishId] : []))}
          />
        )}
        {(dialog === "export" || dialog === "publish") && (
          <MenuDeliveryDialog
            mode={dialog}
            menu={menu}
            contact={contact}
            record={record}
            checks={checks}
            restaurant={state.restaurant}
            close={() => setDialog("")}
            select={(id) => {
              setDialog("");
              select(id);
            }}
            removeItem={(id) =>
              change((before) => ({
                ...before,
                sections: before.sections.map((s) => ({
                  ...s,
                  items: s.items.filter((i) => i.id !== id),
                })),
              }))
            }
            attachAddon={attachAddon}
            applyPurpose={applyPurpose}
            saveRestaurantName={async (name) => {
              await api("restaurant/name", { name });
              await refresh();
            }}
            published={async (address) => {
              const first = !record.published;
              await documentAction("publish", address ? { address } : {});
              // Share opens by itself when a menu first goes live; later
              // updates keep the same link and QR code.
              setDialog(first ? "share" : "");
              tell(
                first
                  ? "Your menu is live. Future edits stay private until you publish again."
                  : "Your changes are live. Future edits stay private until you publish again.",
              );
            }}
            save={async () => {
              await store.saveNow();
            }}
            setProfile={(printProfile) => patch({ printProfile })}
          />
        )}
        {dialog === "quick" && record.published && (
          <MenuQuickUpdate
            live={record.published}
            busy={!!busy}
            close={() => setDialog("")}
            apply={applyQuickUpdate}
          />
        )}
        {dialog === "share" && (
          <MenuShareDialog
            record={record}
            restaurant={state.restaurant}
            origin={state.menuOrigin}
            fallbackName={
              store.menus.find((m) => m.published && m.id !== record.id)?.draft
                .name
            }
            close={() => setDialog("")}
            action={async (action) => {
              const wasMain = record.isPrimary;
              await documentAction(action, { confirmed: true });
              if (action === "unpublish") setDialog("");
              tell(
                action === "primary"
                  ? "This is now the menu on your restaurant’s main QR code."
                  : wasMain
                    ? "This menu is offline. Its draft is saved, and it becomes your main menu again when you publish it."
                    : "This menu is offline. Its draft is saved.",
              );
            }}
          />
        )}
        {dialog === "library" && (
          <MenuDialog
            title="Your menus"
            description="A menu for every service, season, and occasion."
            close={() => setDialog("")}
          >
            <div className="md-menu-library">
              {store.menus.map((m) => (
                <button
                  key={m.id}
                  disabled={!!busy}
                  className={m.id === record.id ? "is-selected" : ""}
                  onClick={() =>
                    void act("Opening menu", async () => {
                      await store.select(m.id);
                      setSelected("");
                      setDialog("");
                    })
                  }
                >
                  <span
                    className="md-menu-swatch"
                    style={{
                      background: menuDesignSpec(m.draft.design).paper,
                      color: menuDesignSpec(m.draft.design).color,
                    }}
                  >
                    <FileText size={24} />
                  </span>
                  <span>
                    <strong>
                      {m.id === record.id ? draft.name : m.draft.name}
                    </strong>
                    <small>
                      {m.draft.sections.reduce((n, s) => n + s.items.length, 0)}{" "}
                      dishes · {m.published ? "Published" : "Draft"}
                      {m.isPrimary ? " · Main menu" : ""}
                      {restaurantSettingsChanged(m.published, state.restaurant)
                        ? " · Republish to apply your restaurant settings"
                        : ""}
                    </small>
                  </span>
                  {m.id === record.id && <Check size={17} />}
                </button>
              ))}
            </div>
            <div className="md-dialog-actions">
              <button
                className="md-button"
                onClick={() => {
                  setNewName("");
                  setDialog("new");
                }}
              >
                <Plus size={16} /> New menu
              </button>
              <button
                className="md-button md-secondary"
                disabled={!!busy}
                onClick={() =>
                  void act("Duplicating menu", async () => {
                    await store.create({
                      ...draft,
                      name: `${draft.name.slice(0, 105)} — copy`,
                    });
                    setDialog("");
                    tell("An independent copy is ready to edit.");
                  })
                }
              >
                Duplicate current
              </button>
            </div>
            <div className="md-library-tools">
              <button
                className="md-text-button"
                disabled={!!busy}
                onClick={() =>
                  void act("Loading archived menus", async () => {
                    const result = await api("menus/archived");
                    setArchivedMenus(result.menus);
                    setDialog("archived");
                  })
                }
              >
                Archived menus
              </button>
              <button
                className="md-text-button"
                disabled={!!busy}
                onClick={() =>
                  void act("Loading publication history", openHistory)
                }
              >
                <History size={15} /> Publication history
              </button>
              <button
                className="md-text-button md-danger"
                onClick={() => setDialog("archive")}
              >
                Archive current menu
              </button>
            </div>
          </MenuDialog>
        )}
        {dialog === "archived" && (
          <MenuDialog
            title="Archived menus"
            description="Restore a menu as a private draft. Its publication history is kept."
            close={() => setDialog("library")}
          >
            <div className="md-history">
              {archivedMenus.length ? (
                archivedMenus.map((m) => (
                  <div key={m.id}>
                    <strong>{m.draft.name}</strong>
                    <button
                      className="md-button md-secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void act("Restoring menu", async () => {
                          await store.saveNow();
                          const restored = await api(
                            `menus/${m.id}/unarchive`,
                            { revision: m.revision },
                          );
                          await store.accept(restored as SavedMenu);
                          setSelected("");
                          setDialog("");
                          tell("Menu restored as a private draft.");
                        })
                      }
                    >
                      Restore menu
                    </button>
                  </div>
                ))
              ) : (
                <p className="md-help">No archived menus.</p>
              )}
            </div>
          </MenuDialog>
        )}
        {dialog === "dish-library" && item && section && (
          <MenuDialog
            title={item.dishId ? "Update My Dishes" : "Save to My Dishes"}
            description="Keep these details in your dish library for new menus. Your other menus and your live menu don’t change; guests see this edit when you publish this menu."
            close={() => setDialog("")}
          >
            <h3>{item.name || "Untitled dish"}</h3>
            <p className="md-help">{item.description}</p>
            <p className="md-help">
              Section: {section.name}
              {item.priceMode === "single" && item.price !== null
                ? ` · Price: ${menuPrice(item.price, restaurant.currency)}`
                : " · Size prices and add-ons stay on this menu."}
            </p>
            {(!item.sourceReviewed ||
              !item.name ||
              item.name.length > 100 ||
              section.name.length > 100) && (
              <p className="md-inline-error">
                Review this dish first. The library supports dish and section
                names up to 100 characters.
              </p>
            )}
            <button
              className="md-button"
              disabled={
                !!busy ||
                !item.sourceReviewed ||
                !item.name ||
                item.name.length > 100 ||
                section.name.length > 100
              }
              onClick={() =>
                void act("Saving dish details", async () => {
                  await store.saveNow();
                  const existing = (state.dishes as Row[]).find(
                    (d) => d.id === item.dishId,
                  );
                  const result = await api(
                    item.dishId ? `dishes/${item.dishId}` : "dishes",
                    {
                      ...existing,
                      creationId: item.dishId || crypto.randomUUID(),
                      revision: existing?.revision,
                      name: item.name,
                      description: item.description,
                      category: section.name,
                      price:
                        item.priceMode === "single" && item.price !== null
                          ? item.price / 100
                          : (existing?.price || 0) / 100,
                      available: item.available,
                      dietary: item.dietary,
                      confirmed: true,
                      // This menu already has the edit; other menus and
                      // live menus keep theirs.
                      syncMenus: false,
                    },
                  );
                  editItem(item.id, { dishId: result.id });
                  await store.saveNow();
                  await refresh();
                  setDialog("");
                  tell(
                    item.dishId
                      ? "My Dishes updated. Your other menus and live menus are unchanged."
                      : "Saved to My Dishes. You can now use its photos on this menu.",
                  );
                })
              }
            >
              {item.dishId ? "Update dish library" : "Save dish to library"}
            </button>
          </MenuDialog>
        )}
        {dialog === "new" && (
          <MenuDialog
            title="Create a menu"
            description="Give it a name so you can find it again."
            close={() => setDialog("")}
          >
            <Field label="Menu name">
              <input
                autoFocus
                value={newName}
                maxLength={120}
                placeholder="Weekend brunch"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim())
                    void act("Creating menu", async () => {
                      await store.create(
                        newMenuDocument({ name: newName, title: newName }),
                      );
                      setSelected("");
                      setDialog("");
                    });
                }}
              />
            </Field>
            <div className="md-dialog-actions">
              <button
                className="md-button"
                disabled={!newName.trim() || !!busy}
                onClick={() =>
                  void act("Creating menu", async () => {
                    await store.create(
                      newMenuDocument({ name: newName, title: newName }),
                    );
                    setSelected("");
                    setDialog("");
                  })
                }
              >
                Create menu
              </button>
            </div>
          </MenuDialog>
        )}
        {dialog === "archive" && (
          <MenuDialog
            title={`Archive ${draft.name}?`}
            description="This menu will leave your active collection and go offline. Download a recovery copy first if you want a local backup."
            close={() => setDialog("")}
          >
            <div className="md-dialog-actions">
              <button
                className="md-button"
                disabled={!!busy}
                onClick={() =>
                  void act("Archiving menu", async () => {
                    await documentAction("archive", { confirmed: true });
                    setDialog("");
                    tell("Menu archived.");
                  })
                }
              >
                Archive menu
              </button>
              <button
                className="md-button md-secondary"
                onClick={() =>
                  downloadBlob(
                    new Blob([JSON.stringify(draft, null, 2)], {
                      type: "application/json",
                    }),
                    `${draft.name}-backup.json`,
                  )
                }
              >
                Download backup
              </button>
            </div>
          </MenuDialog>
        )}
        {dialog === "history" && (
          <MenuDialog
            title="Publication history"
            description="Restore a previous version as a draft. Your live menu changes only when you publish."
            close={() => setDialog("")}
          >
            <div className="md-history">
              {history.length ? (
                history.map((h) => (
                  <div key={h.id}>
                    <div>
                      <strong>{new Date(h.createdAt).toLocaleString()}</strong>
                      <small>Revision {h.revision}</small>
                    </div>
                    <button
                      className="md-button md-secondary md-small"
                      disabled={!!busy}
                      onClick={() =>
                        void act("Restoring draft", async () => {
                          await documentAction("restore", { historyId: h.id });
                          setSelected("");
                          setDialog("");
                          tell(
                            "Previous publication restored as a draft. Review before publishing.",
                          );
                        })
                      }
                    >
                      Restore as draft
                    </button>
                  </div>
                ))
              ) : (
                <p>Published versions will appear here.</p>
              )}
            </div>
          </MenuDialog>
        )}
        {dialog === "bulk" && (
          <MenuBulkPrices
            menu={draft}
            close={() => setDialog("")}
            apply={(sections) => {
              patch({ sections });
              setDialog("");
              tell(
                "Prices updated in this menu. Use Undo to reverse the change.",
              );
            }}
          />
        )}
        {dialog && (error || busy) && (
          <div className="md-modal-status" role={error ? "alert" : "status"}>
            {error || `${busy}…`}
          </div>
        )}
      </section>
    </MenuActionContext.Provider>
  );
}

/** The single price My Dishes keeps for a menu dish ("from" for sizes). */
function libraryPrice(item: MenuEntry) {
  if (item.priceMode === "single") return item.price ?? 0;
  if (item.priceMode === "variants" && item.variants.length)
    return Math.min(...item.variants.map((v) => v.price));
  return 0;
}
function MenuBulkPrices({
  menu,
  close,
  apply,
}: {
  menu: MenuDocument;
  close: () => void;
  apply: (sections: MenuSection[]) => void;
}) {
  const [section, setSection] = useState(""),
    [percent, setPercent] = useState("5");
  const amount = Number(percent),
    valid =
      percent.trim() &&
      Number.isFinite(amount) &&
      amount >= -100 &&
      amount <= 100;
  const count = menu.sections
    .filter((s) => !section || s.id === section)
    .reduce((n, s) => n + s.items.length, 0);
  return (
    <MenuDialog
      title="Adjust menu prices"
      description="Update dish, size, and add-on prices together. Your dish library is unchanged."
      close={close}
    >
      <Field label="Apply to">
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">Every section</option>
          {menu.sections.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Percentage change"
        hint="Use a negative number to reduce prices. Prices round to the nearest cent."
      >
        <input
          type="number"
          min="-100"
          max="100"
          step="0.5"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
      </Field>
      <div className="md-dialog-actions">
        <button
          className="md-button"
          disabled={!valid || !count}
          onClick={() => {
            const adjust = (p: number) =>
              Math.min(100000000, Math.round(p * (1 + amount / 100)));
            apply(
              menu.sections.map((s) =>
                section && s.id !== section
                  ? s
                  : {
                      ...s,
                      items: s.items.map((i) => ({
                        ...i,
                        price: i.price == null ? null : adjust(i.price),
                        variants: i.variants.map((v) => ({
                          ...v,
                          price: adjust(v.price),
                        })),
                        additions: i.additions.map((v) => ({
                          ...v,
                          price: adjust(v.price),
                        })),
                      })),
                    },
              ),
            );
          }}
        >
          Update {dishCount(count)}{" "}
          {valid && `by ${amount > 0 ? "+" : ""}${amount}%`}
        </button>
      </div>
    </MenuDialog>
  );
}

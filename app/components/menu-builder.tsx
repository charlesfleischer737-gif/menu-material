"use client";
import { workspacePreferenceKey } from "@/lib/workspace-navigation";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  ArrowUp,
  ArrowDown,
  Plus,
  ArrowRight,
  BookOpen,
  Check,
  Smartphone,
  Printer,
  Sparkles,
} from "lucide-react";
import { api, downloadBlob, money, type Row } from "@/lib/client";
import { looks, styleFor } from "@/lib/studio";
import { menuPdf } from "@/lib/creation-export";
import MenuView from "./menu-view";
import MenuPhoto from "./menu-photo";
import CreativeHeader from "./creative-header";
import WorkspaceControls from "./workspace-controls";
import { preferredPhoto } from "@/lib/dish-library";
import {
  menuCrop,
  menuDesigns,
  menuDesignPreset,
  menuChanges,
  duplicateMenuRows,
} from "@/lib/menu-design";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import PrintPreview from "./print-preview";
import MenuTemplatePreview from "./menu-template-preview";
import MenuSharing from "./menu-sharing";
import {
  Feedback,
  Field,
  DraftRecovery,
  SavedDrafts,
  track,
  useAction,
  useCreationDraft,
  useStepFocus,
} from "./creation-shared";
const sharedFields = [
  "name",
  "description",
  "category",
  "price",
  "available",
  "portion",
  "plating",
  "setting",
  "preserve",
];
function dishFacts(d: Row) {
  return Object.fromEntries(
    sharedFields.map((key) => {
      const value =
        d[key] ??
        (key === "setting"
          ? "Natural daylight"
          : key === "category"
            ? "Dishes"
            : key === "price"
              ? 0
              : "");
      return [
        key,
        key === "available"
          ? !!d[key]
          : ["name", "description", "category"].includes(key)
            ? String(value).trim()
            : value,
      ];
    }),
  );
}
function withBaseline(d: Row) {
  return { ...d, _synced: dishFacts(d) };
}
function newerRows(rows: Row[], dishes: Row[]) {
  return rows.filter(
    (row) =>
      row.id &&
      row._synced &&
      dishes.some(
        (d) =>
          d.id === row.id &&
          JSON.stringify(dishFacts(d)) !== JSON.stringify(row._synced),
      ),
  );
}
function fromMenu(state: Row) {
  return state.restaurant.menuDraft.sections
    .flatMap((s: Row) =>
      s.items.map((i: Row) => {
        const d = state.dishes.find((d: Row) => d.id === i.dishId);
        return d
          ? {
              ...withBaseline(d),
              category: s.name,
              price: d.price / 100,
              available: !!d.available,
              photoId: i.photoId || "",
              featured:
                i.featured ??
                (state.restaurant.menuDraft.layout === "featured" &&
                  s.items[0] === i),
              crop: i.crop,
              rowId: d.id,
            }
          : null;
      }),
    )
    .filter(Boolean);
}
function blank() {
  return {
    rowId: crypto.randomUUID(),
    id: "",
    name: "",
    description: "",
    category: "Dishes",
    price: "",
    available: true,
    photoId: "",
  };
}
function menuContent(
  rows: Row[],
  restaurant: Row,
  layout: string,
  appearance: string,
  paper: string,
  options: Row = {},
) {
  const sections: Row[] = [];
  for (const row of rows) {
    let s = sections.find((s) => s.name === row.category);
    if (!s) {
      s = {
        id: String(sections.length),
        name: row.category || "Dishes",
        items: [],
      };
      sections.push(s);
    }
    s.items.push({
      ...row,
      id: row.id || row.rowId,
      price:
        row.price === "" || row.price == null
          ? NaN
          : Math.round(Number(row.price) * 100),
      photoId: row.photoId || null,
    });
  }
  return {
    restaurant: { ...restaurant, logoId: restaurant.logo_id },
    sections,
    design: options.design || "bistro",
    density: options.density || "comfortable",
    printProfile: options.printProfile || "home",
    title: options.title || "",
    layout,
    appearance,
    paper,
  };
}
export default function MenuBuilder({
  state,
  refresh,
  seed,
  onSeedUsed,
  onPhoto,
}: {
  state: Row;
  refresh: () => Promise<void>;
  seed: Row | null;
  onSeedUsed: () => void;
  onPhoto: (dishId: string, photoId?: string) => void;
}) {
  const store = useCreationDraft(
      "menu",
      {
        step: 1,
        rows: fromMenu(state),
        layout: state.restaurant.menuDraft.layout || "classic",
        appearance: state.restaurant.menuDraft.appearance || "light",
        paper: state.restaurant.menuDraft.paper || "letter",
        design: state.restaurant.menuDraft.design || "bistro",
        density: state.restaurant.menuDraft.density || "comfortable",
        printProfile: state.restaurant.menuDraft.printProfile || "home",
        title: state.restaurant.menuDraft.title || "",
        reviewed: false,
        importId: "",
        batchId: "",
        batch: null,
        batchSelected: [],
        batchLook: "restaurant",
      },
      workspacePreferenceKey(state.user.id, state.restaurant.id),
    ),
    { draft: b, change, save, ready, status } = store;
  const root = useStepFocus(b.step, ready);
  const action = useAction(),
    { act, busy, setNotice } = action;
  const [selected, setSelected] = useState(""),
    [panel, setPanel] = useState("dishes"),
    [mobileControls, setMobileControls] = useState(false),
    [query, setQuery] = useState(""),
    [importOpen, setImportOpen] = useState(false),
    [batchOpen, setBatchOpen] = useState(false),
    [completion, setCompletion] = useState(false),
    [destination, setDestination] = useState("publish"),
    [sharing, setSharing] = useState(false),
    [bulkOpen, setBulkOpen] = useState(false),
    [bulkSection, setBulkSection] = useState(""),
    [bulkName, setBulkName] = useState(""),
    [bulkPercent, setBulkPercent] = useState(""),
    [removed, setRemoved] = useState<{ row: Row; index: number } | null>(null);
  const [chooseDishes, setChooseDishes] = useState(false),
    [preview, setPreview] = useState("phone"),
    [pdf, setPdf] = useState<{
      url: string;
      blob: Blob;
      warnings: string[];
      pages: number;
    } | null>(null),
    [pdfError, setPdfError] = useState("");
  const seedHandled = useRef(""),
    pdfUrl = useRef(""),
    batchKey = useRef("");
  const rows: Row[] = b.rows || [],
    menu = menuContent(
      rows,
      state.restaurant,
      b.layout,
      b.appearance,
      b.paper,
      b,
    ),
    sampleJob =
      b.batch && state.jobs.find((j: Row) => j.id === b.batch.sampleJobId),
    sampleOutput =
      b.batch &&
      state.outputs.find(
        (o: Row) => o.job_id === b.batch.sampleJobId && o.asset_id,
      ),
    sampleAsset =
      sampleOutput &&
      state.assets.find((a: Row) => a.id === sampleOutput.asset_id);
  useEffect(() => {
    if (!ready || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
    void act("Adding your dish", async () => {
      if (seed.openImport) {
        setImportOpen(true);
        onSeedUsed();
        return;
      }
      if (seed.draftId) {
        await store.resume(seed.draftId);
        onSeedUsed();
        return;
      }
      if (seed.importId) {
        change({ importId: seed.importId, rows: [], step: 2, reviewed: false });
        await save();
        if (state.aiConnected) await readImport(seed.importId);
        else
          setNotice(
            "Your menu file is saved. Add dishes manually while automatic reading is awaiting its connection.",
          );
      } else if (seed.dishId) {
        const d = state.dishes.find((d: Row) => d.id === seed.dishId);
        if (d) {
          const row = {
            ...withBaseline(d),
            rowId: d.id,
            price: d.price / 100,
            available: !!d.available,
            photoId: seed.photoId || "",
          };
          change({
            rows: rows.some((r) => r.id === d.id)
              ? rows.map((r) =>
                  r.id === d.id ? { ...r, photoId: row.photoId } : r,
                )
              : [...rows, row],
            step: b.step === 4 ? 4 : 2,
            reviewed: false,
          });
        }
      } else change({ step: 1 });
      if (seed.print) setPreview("print");
      await save();
      onSeedUsed();
    });
  }, [seed, ready]);
  useEffect(() => {
    if (
      !ready ||
      (preview !== "print" && !(completion && destination === "print"))
    )
      return;
    let active = true;
    const timer = setTimeout(() => {
      setPdfError("");
      setPdf(null);
      menuPdf({
        ...menu,
        qrUrl: state.restaurant.published
          ? location.origin + "/m/" + state.restaurant.slug
          : undefined,
      })
        .then((result) => {
          if (!active) return;
          if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
          const url = URL.createObjectURL(result.blob);
          pdfUrl.current = url;
          setPdf({ ...result, url });
        })
        .catch((e) => {
          if (active) setPdfError(e.message);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    ready,
    preview,
    completion,
    destination,
    b.design,
    b.density,
    b.printProfile,
    b.title,
    b.rows,
    b.layout,
    b.appearance,
    b.paper,
    state.restaurant.published_at,
    state.restaurant.style,
    state.restaurant.name,
    state.restaurant.logo_id,
  ]);
  useEffect(
    () => () => {
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    },
    [],
  );
  async function saveRows() {
    if (b.importId && rows.some((r) => !r.importReviewed))
      throw Error("Check each imported dish against the original first.");
    if (
      rows.some(
        (r) =>
          !r.name.trim() ||
          !r.category.trim() ||
          r.price === "" ||
          r.price === null ||
          !Number.isFinite(Number(r.price)) ||
          Number(r.price) > 1000000 ||
          Number(r.price) < 0,
      )
    )
      throw Error(
        "Check the name, section and price for every dish. Enter 0 only if it is free.",
      );
    const current = await api("state");
    if (newerRows(rows, current.dishes).length) {
      await refresh();
      throw Error(
        "Some dishes have newer details in My Dishes. Use the latest details below, then review your menu again.",
      );
    }
    let next = rows;
    if (b.importId) {
      await api(`imports/${b.importId}/review`, {
        confirmed: true,
        replace: true,
        items: rows.map((r) => ({ ...r, price: Number(r.price) })),
      });
      const s = await api("state");
      next = fromMenu(s);
      change({ rows: next, importId: "" });
      await save();
    } else {
      next = [];
      for (const r of rows) {
        const saved = await api("dishes" + (r.id ? "/" + r.id : ""), {
          ...r,
          price: Number(r.price),
          available: !!r.available,
          confirmed: true,
        });
        next.push({
          ...r,
          id: saved.id,
          revision: saved.revision,
          rowId: r.rowId || saved.id,
          _synced: dishFacts({
            ...r,
            price: Math.round(Number(r.price) * 100),
          }),
        });
        change({ rows: [...next, ...rows.slice(next.length)] });
        await save();
      }
    }
    const content = menuContent(
      next,
      state.restaurant,
      b.layout,
      b.appearance,
      b.paper,
      b,
    );
    await api("menu", {
      design: b.design,
      density: b.density,
      printProfile: b.printProfile,
      title: b.title,
      layout: b.layout,
      appearance: b.appearance,
      paper: b.paper,
      sections: content.sections.map((s) => ({
        ...s,
        items: s.items.map((i: Row) => ({
          dishId: i.id,
          photoId: i.photoId || null,
          featured: i.featured,
          crop: i.crop,
        })),
      })),
    });
    change({ rows: next });
    await save();
    await refresh();
    return next;
  }
  async function importFile(file: File) {
    const form = new FormData();
    form.set("file", file);
    const imp = await api("imports", form);
    await store.start({
      ...b,
      importId: imp.id,
      rows: [],
      step: 2,
      reviewed: false,
      batch: null,
      batchId: "",
      batchSelected: [],
    });
    await save();
    await refresh();
    if (!state.aiConnected) {
      setNotice(
        "Your menu file is saved. Automatic reading is awaiting its connection; you can add dishes below or return later.",
      );
      return;
    }
    await readImport(imp.id);
  }
  async function readImport(id: string) {
    await api(`imports/${id}/extract`, {});
    const s = await api("state");
    const imp = s.imports.find((i: Row) => i.id === id);
    change({
      rows: JSON.parse(imp.draft).map((r: Row) => ({
        ...r,
        rowId: crypto.randomUUID(),
        id: "",
        photoId: "",
        available: true,
        importReviewed: false,
      })),
      reviewed: false,
    });
    await save();
    await refresh();
  }
  function edit(index: number, patch: Row) {
    change({
      rows: rows.map((r, i) =>
        i === index
          ? {
              ...r,
              ...patch,
              ...(b.importId && !("importReviewed" in patch)
                ? { importReviewed: false }
                : {}),
            }
          : r,
      ),
      reviewed: false,
    });
  }
  function addDish(d: Row) {
    const photo = preferredPhoto(d, state.assets);
    change({
      rows: [
        ...rows,
        {
          ...withBaseline(d),
          rowId: d.id,
          price: d.price / 100,
          available: !!d.available,
          photoId: photo?.approved_at ? photo.id : "",
        },
      ],
      reviewed: false,
    });
  }
  async function startBatch() {
    const items = b.batchSelected.map((did: string) => ({
      dishId: did,
      sourceId: state.assets.find(
        (a: Row) => a.dish_id === did && a.kind === "source",
      )?.id,
    }));
    batchKey.current ||= crypto.randomUUID();
    const data = await api("photo-batches", {
      batchId: batchKey.current,
      items,
      style: styleFor({ look: b.batchLook }, state.restaurant),
    });
    change({ batchId: batchKey.current, batch: data.batch });
    await save();
    await refresh();
    void api("jobs/tick", {})
      .then(refresh)
      .catch(() => {});
  }
  if (!ready) return <DraftRecovery store={store} />;
  const selectedIndex = rows.findIndex((r) => r.rowId === selected),
    row = rows[selectedIndex];
  const sections = [...new Set(rows.map((r) => r.category || "Dishes"))];
  const changes = menuChanges(menu, state.restaurant.published);
  const duplicates = duplicateMenuRows(rows);
  const imported = state.imports.find((i: Row) => i.id === b.importId);
  const outstanding = rows.filter((r) => !r.importReviewed).length;
  function patch(patch: Row) {
    change({ ...patch, reviewed: false });
  }
  function move(index: number, delta: number) {
    const group = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.category === rows[index].category);
    const position = group.findIndex(({ i }) => i === index),
      target = group[position + delta]?.i;
    if (target === undefined) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ rows: next });
  }
  function moveSection(section: string, delta: number) {
    const order = [...sections],
      index = order.indexOf(section),
      target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    patch({
      rows: order.flatMap((s) =>
        rows.filter((r) => (r.category || "Dishes") === s),
      ),
    });
  }
  function addBlank() {
    const next = blank();
    patch({ rows: [...rows, next] });
    setSelected(next.rowId);
    setPanel("dishes");
    setMobileControls(true);
  }
  function syncFacts() {
    const changed = new Set(newerRows(rows, state.dishes).map((r) => r.id));
    patch({
      rows: rows.map((r) => {
        const d = state.dishes.find((d: Row) => d.id === r.id);
        return changed.has(r.id) && d
          ? {
              ...r,
              ...withBaseline(d),
              rowId: r.rowId,
              price: d.price / 100,
              available: !!d.available,
            }
          : r;
      }),
    });
  }
  async function reviewMenu() {
    if (!rows.length) throw Error("Add a dish to your menu first.");
    if (b.importId && outstanding) {
      setImportOpen(true);
      throw Error(
        "Review every imported dish against your original menu first.",
      );
    }
    await saveRows();
    change({ reviewed: false });
    setCompletion(true);
    setDestination(preview === "print" ? "print" : "publish");
  }
  return (
    <section className="mm-workspace mm-menu-workspace" ref={root}>
      <CreativeHeader
        title="Menus"
        status={status}
        action={
          rows.length ? (
            <button
              className="cx-btn"
              disabled={!!busy}
              onClick={() => act("Checking your menu", reviewMenu)}
            >
              Review & use <ArrowRight size={16} />
            </button>
          ) : undefined
        }
      >
        <SavedDrafts kind="menu" store={store} disabled={!!busy} />
        <button
          className="cx-link"
          disabled={!!busy}
          onClick={() =>
            act("Starting menu", async () => {
              await store.start({
                ...b,
                rows: [],
                importId: "",
                reviewed: false,
                batch: null,
                batchId: "",
                batchSelected: [],
              });
              setSelected("");
            })
          }
        >
          <Plus size={16} />
          New
        </button>
        {state.restaurant.published && (
          <button className="cx-link" onClick={() => setSharing(true)}>
            Link & QR
          </button>
        )}
      </CreativeHeader>
      <DraftRecovery store={store} />
      <Feedback {...action} />
      {!!newerRows(rows, state.dishes).length && (
        <div className="mm-fact-notice">
          <strong>
            {newerRows(rows, state.dishes).length} dishes have updated details
            in My Dishes.
          </strong>
          <button className="cx-link" onClick={syncFacts}>
            Review latest details
          </button>
        </div>
      )}
      {!!b.importId && (
        <div className="mm-fact-notice">
          <span>
            {outstanding
              ? `${outstanding} imported dishes to check`
              : "Imported dishes checked"}
          </span>
          <button className="cx-link" onClick={() => setImportOpen(true)}>
            Compare with original
          </button>
        </div>
      )}
      {!rows.length && !b.importId ? (
        <div className="mm-menu-start">
          <span className="mm-kicker">
            A MENU THAT FEELS LIKE YOUR RESTAURANT
          </span>
          <h2>Bring your dishes to the table.</h2>
          <p className="mm-muted">
            One menu, beautifully prepared for phones and print.
          </p>
          <button className="cx-btn" onClick={() => setChooseDishes(true)}>
            Choose from My Dishes
          </button>
          <div className="mm-inline">
            <button className="cx-link" onClick={() => setImportOpen(true)}>
              Import an existing menu
            </button>
            <button className="cx-link" onClick={addBlank}>
              Add your first dish
            </button>
          </div>
        </div>
      ) : (
        <div className="mm-menu-grid">
          <WorkspaceControls
            className="mm-menu-controls"
            open={mobileControls}
            onOpenChange={setMobileControls}
            title="Edit menu"
          >
            <button
              className="cx-link mm-mobile-edit"
              onClick={() => setMobileControls(false)}
            >
              Done editing
            </button>
            <div
              className="mm-inspector-tabs"
              role="group"
              aria-label="Menu controls"
            >
              {["dishes", "design"].map((p) => (
                <button
                  key={p}
                  aria-pressed={panel === p}
                  onClick={() => setPanel(p)}
                >
                  {p === "dishes" ? "Dishes" : "Design"}
                </button>
              ))}
            </div>
            {panel === "dishes" ? (
              <>
                <div className="mm-menu-outline">
                  {sections.map((section, sectionIndex) => (
                    <details key={section} open className="mm-outline-section">
                      <summary>
                        {section}{" "}
                        <small>
                          {
                            rows.filter(
                              (r) => (r.category || "Dishes") === section,
                            ).length
                          }
                        </small>
                      </summary>
                      <div className="mm-section-order">
                        <button
                          className="cx-link"
                          aria-label={`Move ${section} section earlier`}
                          disabled={!sectionIndex}
                          onClick={() => moveSection(section, -1)}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          className="cx-link"
                          aria-label={`Move ${section} section later`}
                          disabled={sectionIndex === sections.length - 1}
                          onClick={() => moveSection(section, 1)}
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                      {rows
                        .filter((r) => (r.category || "Dishes") === section)
                        .map((r) => (
                          <button
                            key={r.rowId}
                            aria-pressed={selected === r.rowId}
                            onClick={() => setSelected(r.rowId)}
                          >
                            <span>{r.name || "Untitled dish"}</span>
                            <small>
                              {r.price === "" || r.price == null
                                ? "Set price"
                                : money(
                                    Math.round(Number(r.price) * 100),
                                    state.restaurant.currency,
                                  )}
                            </small>
                          </button>
                        ))}
                    </details>
                  ))}
                </div>
                <div className="mm-inline">
                  <button
                    className="cx-link"
                    onClick={() => setChooseDishes(true)}
                  >
                    <Plus size={15} />
                    From My Dishes
                  </button>
                  <button className="cx-link" onClick={addBlank}>
                    New dish
                  </button>
                </div>
                {row ? (
                  <div className="mm-selected-dish">
                    <div className="mm-inline">
                      <h2>{row.name || "New dish"}</h2>
                      <button
                        className="cx-link"
                        aria-label="Move dish up"
                        disabled={
                          !rows
                            .slice(0, selectedIndex)
                            .some((r) => r.category === row.category)
                        }
                        onClick={() => move(selectedIndex, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="cx-link"
                        aria-label="Move dish down"
                        disabled={
                          !rows
                            .slice(selectedIndex + 1)
                            .some((r) => r.category === row.category)
                        }
                        onClick={() => move(selectedIndex, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                    <Field label="Dish name">
                      <input
                        maxLength={100}
                        value={row.name}
                        onChange={(e) =>
                          edit(selectedIndex, { name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={row.description || ""}
                        onChange={(e) =>
                          edit(selectedIndex, { description: e.target.value })
                        }
                      />
                    </Field>
                    <div className="mm-field-pair">
                      <Field label="Section">
                        <input
                          list="mm-menu-sections"
                          maxLength={100}
                          value={row.category}
                          onChange={(e) =>
                            edit(selectedIndex, { category: e.target.value })
                          }
                        />
                        <datalist id="mm-menu-sections">
                          {sections.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </Field>
                      <Field label={`Price (${state.restaurant.currency})`}>
                        <input
                          type="number"
                          min="0"
                          max="1000000"
                          step=".01"
                          value={row.price ?? ""}
                          onChange={(e) =>
                            edit(selectedIndex, { price: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <label className="cx-check">
                      <input
                        type="checkbox"
                        checked={row.available}
                        onChange={(e) =>
                          edit(selectedIndex, { available: e.target.checked })
                        }
                      />
                      Available
                    </label>
                    <Field label="Menu photo">
                      <select
                        value={row.photoId || ""}
                        onChange={(e) =>
                          edit(selectedIndex, { photoId: e.target.value })
                        }
                      >
                        <option value="">Text only</option>
                        {state.assets
                          .filter(
                            (a: Row) =>
                              a.dish_id === row.id &&
                              a.approved_at &&
                              !a.deleted_at,
                          )
                          .map((a: Row, n: number) => (
                            <option key={a.id} value={a.id}>
                              {state.dishes.find((d: Row) => d.id === row.id)
                                ?.preferred_photo_id === a.id
                                ? "Main photo"
                                : a.kind === "source"
                                  ? "Original"
                                  : `Approved photo ${n + 1}`}
                            </option>
                          ))}
                      </select>
                    </Field>
                    {row.photoId && b.layout === "featured" && (
                      <label className="cx-check">
                        <input
                          type="checkbox"
                          checked={!!row.featured}
                          onChange={(e) =>
                            patch({
                              rows: rows.map((r) =>
                                r.category === row.category
                                  ? {
                                      ...r,
                                      featured:
                                        r.rowId === row.rowId &&
                                        e.target.checked,
                                    }
                                  : r,
                              ),
                            })
                          }
                        />
                        Feature this photo for {row.category}
                      </label>
                    )}
                    {row.photoId && b.layout !== "classic" && (
                      <details>
                        <summary>Photo framing</summary>
                        <MenuPhoto
                          photoId={row.photoId}
                          crop={row.crop}
                          featured={b.layout === "featured"}
                        />
                        <div className="mm-segments">
                          <button
                            aria-pressed={row.crop?.fit !== false}
                            onClick={() =>
                              edit(selectedIndex, {
                                crop: {
                                  ...menuCrop(row.crop),
                                  fit: true,
                                  zoom: 1,
                                },
                              })
                            }
                          >
                            Whole photo
                          </button>
                          <button
                            aria-pressed={row.crop?.fit === false}
                            onClick={() =>
                              edit(selectedIndex, {
                                crop: { ...menuCrop(row.crop), fit: false },
                              })
                            }
                          >
                            Fill frame
                          </button>
                        </div>
                        {row.crop?.fit === false &&
                          ["x", "y", "zoom"].map((k) => (
                            <label className="cx-range" key={k}>
                              <span>
                                {k === "x"
                                  ? "Horizontal"
                                  : k === "y"
                                    ? "Vertical"
                                    : "Zoom"}
                              </span>
                              <input
                                type="range"
                                min={k === "zoom" ? 1 : 0}
                                max={k === "zoom" ? 2 : 100}
                                step={k === "zoom" ? 0.01 : 1}
                                value={
                                  menuCrop(row.crop)[k as "x" | "y" | "zoom"]
                                }
                                onChange={(e) =>
                                  edit(selectedIndex, {
                                    crop: {
                                      ...menuCrop(row.crop),
                                      [k]: Number(e.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                      </details>
                    )}
                    <button
                      className="cx-link mm-divider"
                      onClick={() => {
                        const removed = row;
                        patch({
                          rows: rows.filter((r) => r.rowId !== row.rowId),
                        });
                        setSelected("");
                        setRemoved({ row: removed, index: selectedIndex });
                      }}
                    >
                      Remove from this menu
                    </button>
                  </div>
                ) : (
                  <p className="mm-muted mm-divider">
                    Select a dish in the menu to edit its details.
                  </p>
                )}
                <details className="mm-divider">
                  <summary>More menu tools</summary>
                  <button
                    className="cx-link"
                    onClick={() => setImportOpen(true)}
                  >
                    Import another menu
                  </button>
                  <button className="cx-link" onClick={() => setBulkOpen(true)}>
                    Edit a section or prices
                  </button>
                  <button
                    className="cx-link"
                    disabled={!!busy}
                    onClick={() =>
                      act("Saving dishes", async () => {
                        await saveRows();
                        setBatchOpen(true);
                      })
                    }
                  >
                    Prepare photos as a group
                  </button>
                </details>
              </>
            ) : (
              <>
                <div className="mm-menu-designs">
                  {menuDesigns.map((d) => (
                    <button
                      key={d.id}
                      aria-pressed={(b.design || "bistro") === d.id}
                      onClick={() => patch(menuDesignPreset(menu, d.id))}
                    >
                      <MenuTemplatePreview menu={menu} design={d.id} />
                      <strong>{d.name}</strong>
                      <small>{d.note}</small>
                    </button>
                  ))}
                </div>
                <Field label="Menu title (optional)">
                  <input
                    maxLength={100}
                    value={b.title || ""}
                    placeholder="Dinner, brunch, drinks…"
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </Field>
                <Field label="Photography">
                  <select
                    value={b.layout}
                    onChange={(e) =>
                      patch({
                        layout: e.target.value,
                        ...(e.target.value === "featured"
                          ? {
                              rows: rows.map((r) => ({
                                ...r,
                                featured: !!r.featured,
                              })),
                            }
                          : {}),
                      })
                    }
                  >
                    <option value="classic">Beautiful type, no photos</option>
                    <option value="grid">A photo for each dish</option>
                    <option value="featured">Selected featured photos</option>
                  </select>
                </Field>
                {b.layout === "featured" && !rows.some((r) => r.featured) && (
                  <p className="mm-muted">
                    Your first photo leads the menu. Choose “Feature this photo”
                    on a dish to change it.
                  </p>
                )}
                <Field label="Spacing">
                  <select
                    value={b.density || "comfortable"}
                    onChange={(e) => patch({ density: e.target.value })}
                  >
                    <option value="spacious">Generous</option>
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                  </select>
                </Field>
                <Field label="Background">
                  <select
                    value={b.appearance}
                    onChange={(e) => patch({ appearance: e.target.value })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </Field>
                <details className="mm-divider" open={preview === "print"}>
                  <summary>Print setup</summary>
                  <Field label="Paper">
                    <select
                      value={b.paper}
                      onChange={(e) => patch({ paper: e.target.value })}
                    >
                      <option value="letter">US Letter</option>
                      <option value="a4">A4</option>
                    </select>
                  </Field>
                  <Field label="Print destination">
                    <select
                      value={b.printProfile || "home"}
                      onChange={(e) => patch({ printProfile: e.target.value })}
                    >
                      <option value="home">
                        Home or office · finished page size
                      </option>
                      <option value="press">
                        Print shop · bleed & crop marks
                      </option>
                    </select>
                  </Field>
                  <p className="mm-muted">
                    Print shop files include ⅛-inch bleed. Color is RGB; ask
                    your printer if they require a specific color profile.
                  </p>
                </details>
                <p className="mm-muted">
                  Your restaurant colors and logo, with typography chosen for
                  each design.
                </p>
              </>
            )}
          </WorkspaceControls>
          <main className="mm-menu-stage">
            <div className="mm-stage-toolbar">
              <div className="mm-segments" aria-label="Menu preview format">
                {["phone", "print"].map((p) => (
                  <button
                    key={p}
                    aria-pressed={preview === p}
                    onClick={() => setPreview(p)}
                  >
                    {p === "phone" ? (
                      <Smartphone size={16} />
                    ) : (
                      <Printer size={16} />
                    )}{" "}
                    {p === "phone" ? "Phone" : "Print"}
                  </button>
                ))}
              </div>
              <button
                className="cx-link mm-mobile-edit"
                onClick={() => setMobileControls(true)}
              >
                Edit menu
              </button>
              <span className="mm-muted">
                {preview === "phone"
                  ? "390 px · guest view"
                  : pdf
                    ? `${pdf.pages} pages · ${b.paper === "a4" ? "A4" : "US Letter"}`
                    : "Preparing print…"}
              </span>
            </div>
            {removed && (
              <div className="mm-fact-notice">
                {removed.row.name} removed.
                <button
                  className="cx-link"
                  onClick={() => {
                    const next = [...rows];
                    next.splice(removed.index, 0, removed.row);
                    patch({ rows: next });
                    setRemoved(null);
                  }}
                >
                  Undo
                </button>
              </div>
            )}
            {preview === "phone" ? (
              <div className="mm-phone-preview">
                <MenuView
                  preview
                  menu={menu}
                  onSelect={(id) => {
                    const r = rows.find((r) => (r.id || r.rowId) === id);
                    if (r) {
                      setSelected(r.rowId);
                      setPanel("dishes");
                      setMobileControls(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="mm-print-preview">
                {pdf ? (
                  <PrintPreview blob={pdf.blob} pages={pdf.pages} />
                ) : (
                  <p role={pdfError ? "alert" : "status"}>
                    {pdfError || "Preparing the actual print file…"}
                  </p>
                )}
                {pdf?.warnings.map((w) => (
                  <p className="mm-output-notes" key={w}>
                    {w}
                  </p>
                ))}
              </div>
            )}
            <p className="mm-preview-caption">
              {state.restaurant.published
                ? `${changes.length} unpublished ${changes.length === 1 ? "change" : "changes"}. Your live menu stays as it is until you publish.`
                : "Private draft. Publish when it is ready for guests."}
            </p>
          </main>
        </div>
      )}
      <Dialog open={chooseDishes} onOpenChange={setChooseDishes}>
        <DialogContent
          className="cx-app mm-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Add dishes to your menu</DialogTitle>
          <input
            type="search"
            aria-label="Search your dishes"
            placeholder="Find a dish…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mm-menu-dish-picker">
            {state.dishes
              .filter(
                (d: Row) =>
                  !d.archived_at &&
                  `${d.name} ${d.category}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((d: Row) => {
                const photo = preferredPhoto(d, state.assets),
                  exists = rows.some((r) => r.id === d.id);
                return (
                  <button
                    key={d.id}
                    disabled={exists}
                    onClick={() => {
                      addDish(d);
                      setSelected(d.id);
                    }}
                  >
                    {photo && <img src={`/api/assets/${photo.id}`} alt="" />}
                    <span>
                      <b>{d.name}</b>
                      <small>
                        {d.category} ·{" "}
                        {money(d.price, state.restaurant.currency)}
                      </small>
                    </span>
                    {exists ? <Check size={17} /> : <Plus size={17} />}
                  </button>
                );
              })}
          </div>
          <button className="cx-btn" onClick={() => setChooseDishes(false)}>
            Done
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={importOpen}
        onOpenChange={(v) => {
          if (!busy) setImportOpen(v);
        }}
      >
        <DialogContent
          className="cx-app mm-dialog mm-import-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>
            {b.importId ? "Check your imported menu" : "Import a menu"}
          </DialogTitle>
          {!b.importId ? (
            <>
              <p className="mm-muted">
                Upload a photo or PDF. Your current menu will stay saved as a
                separate draft.
              </p>
              <label className="cx-btn">
                <Upload size={16} />
                Choose menu file
                <input
                  hidden
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={!!busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void act("Reading your menu", () => importFile(file));
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          ) : (
            <>
              <div className="mm-import-compare">
                <div className="mm-import-source">
                  {imported?.mime === "application/pdf" ? (
                    <iframe
                      title="Original menu"
                      src={`/api/imports/${b.importId}/original`}
                    />
                  ) : (
                    <img
                      alt="Original uploaded menu"
                      src={`/api/imports/${b.importId}/original`}
                    />
                  )}
                </div>
                <div className="mm-import-rows">
                  {!rows.length && (
                    <>
                      <p>
                        {imported?.error ||
                          "Your file is saved. Read it automatically or add dishes alongside the original."}
                      </p>
                      <button
                        className="cx-btn"
                        disabled={!!busy || !state.aiConnected}
                        onClick={() =>
                          act("Reading your menu", () => readImport(b.importId))
                        }
                      >
                        Read menu
                      </button>
                      <button className="cx-link" onClick={addBlank}>
                        Add a dish
                      </button>
                    </>
                  )}
                  {rows.map((r, index) => (
                    <div
                      key={r.rowId}
                      className={`mm-import-row ${r.importReviewed ? "is-reviewed" : ""}`}
                    >
                      <div className="mm-inline">
                        <strong>Dish {index + 1}</strong>
                        {duplicates.has(index) && (
                          <span className="mm-warning">
                            Repeated name — check both
                          </span>
                        )}
                        {r.uncertain?.length > 0 && (
                          <span className="mm-warning">
                            Check {r.uncertain.join(", ")}
                          </span>
                        )}
                      </div>
                      <Field label="Name">
                        <input
                          value={r.name}
                          maxLength={100}
                          onChange={(e) =>
                            edit(index, {
                              name: e.target.value,
                              importReviewed: false,
                            })
                          }
                        />
                      </Field>
                      <div className="mm-field-pair">
                        <Field label="Section">
                          <input
                            maxLength={100}
                            value={r.category}
                            onChange={(e) =>
                              edit(index, {
                                category: e.target.value,
                                importReviewed: false,
                              })
                            }
                          />
                        </Field>
                        <Field label="Price">
                          <input
                            type="number"
                            min="0"
                            step=".01"
                            value={r.price ?? ""}
                            placeholder="Unreadable"
                            onChange={(e) =>
                              edit(index, {
                                price: e.target.value,
                                importReviewed: false,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Description">
                        <textarea
                          rows={2}
                          maxLength={2000}
                          value={r.description}
                          onChange={(e) =>
                            edit(index, {
                              description: e.target.value,
                              importReviewed: false,
                            })
                          }
                        />
                      </Field>
                      <div className="mm-inline">
                        <label className="cx-check">
                          <input
                            type="checkbox"
                            checked={!!r.importReviewed}
                            disabled={
                              !r.name?.trim() ||
                              r.price == null ||
                              r.price === "" ||
                              Number(r.price) < 0 ||
                              !r.category?.trim()
                            }
                            onChange={(e) =>
                              edit(index, { importReviewed: e.target.checked })
                            }
                          />
                          Checked against original
                        </label>
                        <button
                          className="cx-link"
                          onClick={() =>
                            patch({ rows: rows.filter((_, i) => i !== index) })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {rows.length > 0 && (
                <div className="mm-import-footer">
                  <span>
                    {rows.length - outstanding} of {rows.length} checked
                  </span>
                  <button className="cx-link" onClick={() => setBulkOpen(true)}>
                    Edit a section or prices
                  </button>
                  <button
                    className="cx-btn"
                    disabled={!!busy || !!outstanding}
                    onClick={() =>
                      act("Saving checked dishes", async () => {
                        await saveRows();
                        setImportOpen(false);
                      })
                    }
                  >
                    Use checked dishes
                  </button>
                </div>
              )}
            </>
          )}
          <Feedback {...action} />
        </DialogContent>
      </Dialog>
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent
          className="cx-app mm-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Edit a section</DialogTitle>
          <Field label="Section to edit">
            <select
              value={bulkSection}
              onChange={(e) => setBulkSection(e.target.value)}
            >
              <option value="">Choose a section</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="New section name (optional)">
            <input
              maxLength={100}
              value={bulkName}
              onChange={(e) => setBulkName(e.target.value)}
            />
          </Field>
          <Field label="Price change (%) · optional">
            <input
              type="number"
              min="-100"
              max="1000"
              placeholder="For example, 5 or -10"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
            />
          </Field>
          <p className="mm-muted">
            Applies to {rows.filter((r) => r.category === bulkSection).length}{" "}
            dishes. Prices round to the nearest cent. Imported dishes must be
            checked again.
          </p>
          <button
            className="cx-btn"
            disabled={
              !bulkSection ||
              (!bulkName.trim() && bulkPercent === "") ||
              !Number.isFinite(Number(bulkPercent)) ||
              Number(bulkPercent) < -100 ||
              Number(bulkPercent) > 1000
            }
            onClick={() => {
              patch({
                rows: rows.map((r) =>
                  r.category === bulkSection
                    ? {
                        ...r,
                        category: bulkName.trim() || r.category,
                        price:
                          r.price === "" || r.price == null
                            ? r.price
                            : Math.round(
                                Number(r.price) *
                                  (1 + Number(bulkPercent) / 100) *
                                  100,
                              ) / 100,
                        importReviewed: false,
                      }
                    : r,
                ),
              });
              setBulkOpen(false);
              setBulkName("");
              setBulkPercent("");
            }}
          >
            Apply to section
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={completion} onOpenChange={setCompletion}>
        <DialogContent
          className="cx-app mm-dialog mm-menu-completion"
          aria-describedby={undefined}
        >
          <DialogTitle>Ready for your guests</DialogTitle>
          <div className="mm-segments">
            <button
              aria-pressed={destination === "publish"}
              onClick={() => setDestination("publish")}
            >
              Digital menu
            </button>
            <button
              aria-pressed={destination === "print"}
              onClick={() => setDestination("print")}
            >
              Print PDF
            </button>
          </div>
          {destination === "publish" ? (
            <>
              <p>Your existing link and QR code will keep working.</p>
              <div className="mm-publish-diff">
                <strong>
                  {changes.length
                    ? "Changes guests will see"
                    : "Your live menu is up to date"}
                </strong>
                {changes.map((c, n) => (
                  <p key={n}>{c}</p>
                ))}
              </div>
              <label className="cx-check">
                <input
                  type="checkbox"
                  checked={b.reviewed}
                  onChange={(e) => change({ reviewed: e.target.checked })}
                />
                I’ve checked the dishes, prices, photos, and availability.
              </label>
              <button
                className="cx-btn"
                disabled={!!busy || !b.reviewed || !changes.length}
                onClick={() =>
                  act("Publishing your menu", async () => {
                    await saveRows();
                    await api("menu/publish", {});
                    await refresh();
                    setCompletion(false);
                    setSharing(true);
                    setNotice(
                      "Your menu is live. The same link and QR code now show these changes.",
                    );
                  })
                }
              >
                {state.restaurant.published
                  ? "Publish changes"
                  : "Publish menu"}
              </button>
            </>
          ) : (
            <>
              {pdf ? (
                <>
                  <PrintPreview blob={pdf.blob} pages={pdf.pages} />
                  <p className="mm-muted">
                    {pdf.pages} {pdf.pages === 1 ? "page" : "pages"} ·{" "}
                    {b.paper === "a4" ? "A4" : "US Letter"} ·{" "}
                    {b.printProfile === "press"
                      ? "⅛-inch bleed and crop marks"
                      : "Finished page size"}
                  </p>
                  {pdf.warnings.map((w) => (
                    <p className="mm-output-notes" key={w}>
                      {w}
                    </p>
                  ))}
                  <label className="cx-check">
                    <input
                      type="checkbox"
                      checked={b.reviewed}
                      onChange={(e) => change({ reviewed: e.target.checked })}
                    />
                    I’ve checked each page and the print notes.
                  </label>
                  <button
                    className="cx-btn"
                    disabled={!!busy || !b.reviewed}
                    onClick={() => {
                      downloadBlob(
                        pdf.blob,
                        `${state.restaurant.slug}-menu-${b.paper}${b.printProfile === "press" ? "-print-shop" : ""}.pdf`,
                      );
                      setNotice("Your menu PDF download has started.");
                      track("export_complete", undefined, {
                        tool: "menu",
                        format: "pdf",
                      });
                    }}
                  >
                    Download print PDF
                  </button>
                </>
              ) : (
                <p role={pdfError ? "alert" : "status"}>
                  {pdfError || "Preparing your print file…"}
                </p>
              )}
            </>
          )}
          <Feedback {...action} />
        </DialogContent>
      </Dialog>
      <Dialog open={sharing} onOpenChange={setSharing}>
        <DialogContent
          className="cx-app mm-dialog mm-sharing-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Your published menu</DialogTitle>
          <MenuSharing
            restaurant={state.restaurant}
            busy={!!busy}
            act={act}
            refresh={refresh}
            notice={setNotice}
          />
          <Feedback {...action} />
        </DialogContent>
      </Dialog>
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent
          className="cx-app mm-dialog mm-batch-dialog"
          aria-describedby={undefined}
        >
          <DialogTitle>Prepare a consistent set of photos</DialogTitle>
          <div className="cx-batch-layout">
            <div className="cx-menu-photo-list">
              {rows.map((r) => {
                const original = state.assets.find(
                    (a: Row) => a.dish_id === r.id && a.kind === "source",
                  ),
                  approved = state.assets.find(
                    (a: Row) => a.dish_id === r.id && a.approved_at,
                  );
                return (
                  <article key={r.rowId}>
                    {r.photoId || approved ? (
                      <img
                        src={`/api/assets/${r.photoId || approved?.id}`}
                        alt={r.name}
                      />
                    ) : original ? (
                      <img src={`/api/assets/${original.id}`} alt={r.name} />
                    ) : (
                      <span className="cx-photo-empty">
                        <BookOpen size={22} />
                      </span>
                    )}
                    <div>
                      <b>{r.name}</b>
                      <small>
                        {approved
                          ? "Approved photo available"
                          : original
                            ? "Original photo saved"
                            : "Text-only dish"}
                      </small>
                      {approved && r.photoId !== approved.id && (
                        <button
                          className="cx-link"
                          onClick={() =>
                            change({
                              rows: rows.map((x) =>
                                x.id === r.id
                                  ? { ...x, photoId: approved.id }
                                  : x,
                              ),
                            })
                          }
                        >
                          Use approved photo in this menu
                        </button>
                      )}
                    </div>
                    {original ? (
                      <label className="cx-check">
                        <input
                          aria-label={`Improve ${r.name}`}
                          type="checkbox"
                          checked={b.batchSelected.includes(r.id)}
                          disabled={!!b.batch}
                          onChange={(e) =>
                            change({
                              batchSelected: e.target.checked
                                ? [...b.batchSelected, r.id]
                                : b.batchSelected.filter(
                                    (id: string) => id !== r.id,
                                  ),
                            })
                          }
                        />
                        Improve
                      </label>
                    ) : (
                      <button className="cx-link" onClick={() => onPhoto(r.id)}>
                        Add photo <ArrowRight size={15} />
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            <aside className="cx-panel">
              <span className="cx-pill">
                <Sparkles size={14} />
                Try one, then the rest
              </span>
              <h2>A consistent look, without the guesswork.</h2>
              <p>
                Select up to five dishes. Create the first photo, approve its
                look, then apply it to the remaining dishes.
              </p>
              {!b.batch ? (
                <>
                  <Field label="The look for this batch">
                    <select
                      value={b.batchLook}
                      onChange={(e) => change({ batchLook: e.target.value })}
                    >
                      {looks
                        .filter(
                          (l) =>
                            l.id !== "reference" &&
                            (!l.legacy || l.id === b.batchLook),
                        )
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.group} · {l.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <button
                    className="cx-btn cx-full"
                    disabled={
                      !!busy ||
                      b.batchSelected.length < 1 ||
                      b.batchSelected.length > 5 ||
                      !state.aiConnected ||
                      state.remaining < 1
                    }
                    onClick={() =>
                      act("Creating your first batch photo", startBatch)
                    }
                  >
                    Create first photo · 1 image
                  </button>
                  <small>
                    {b.batchSelected.length} selected ·{" "}
                    {Math.max(0, b.batchSelected.length - 1)} will wait for your
                    approval
                  </small>
                  {!state.aiConnected && (
                    <p className="cx-hint">
                      Image creation is awaiting its service connection. You can
                      continue with approved photos or a text-only menu.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h3>
                    {sampleAsset?.approved_at
                      ? "First photo approved"
                      : sampleOutput
                        ? "Review your first photo"
                        : sampleJob?.status === "failed"
                          ? "First photo needs attention"
                          : "Creating your first photo…"}
                  </h3>
                  {sampleOutput && (
                    <button
                      className="cx-sample-photo"
                      onClick={() =>
                        onPhoto(b.batch.items[0].dishId, sampleOutput.asset_id)
                      }
                    >
                      <img
                        src={`/api/assets/${sampleOutput.asset_id}`}
                        alt="First photo in your selected batch"
                      />
                      <span>
                        {sampleAsset?.approved_at
                          ? "View approved photo"
                          : "Review & approve this photo"}{" "}
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  )}
                  {sampleJob?.status === "failed" && (
                    <button
                      className="cx-link"
                      disabled={!!busy}
                      onClick={() =>
                        act("Retrying the first photo", async () => {
                          await api(
                            `photo-batches/${b.batchId}/retry-sample`,
                            {},
                          );
                          await refresh();
                          void api("jobs/tick", {})
                            .then(refresh)
                            .catch(() => {});
                        })
                      }
                    >
                      Retry first photo · 1 image
                    </button>
                  )}
                  {!b.batch.continued && b.batch.items.length > 1 && (
                    <button
                      className="cx-btn cx-full"
                      disabled={
                        !!busy ||
                        !sampleAsset?.approved_at ||
                        state.remaining < b.batch.items.length - 1
                      }
                      onClick={() =>
                        act("Creating the remaining photos", async () => {
                          await api(`photo-batches/${b.batchId}/continue`, {
                            remainingCount: b.batch.items.length - 1,
                          });
                          change({ batch: { ...b.batch, continued: true } });
                          await save();
                          await refresh();
                        })
                      }
                    >
                      Apply to remaining {b.batch.items.length - 1} ·{" "}
                      {b.batch.items.length - 1} images
                    </button>
                  )}
                  {b.batch.continued && (
                    <p className="cx-hint">
                      The remaining selected dishes are in progress. Successful
                      photos stay saved.
                    </p>
                  )}
                  {state.batchItems
                    .filter((i: Row) => i.batch_id === b.batchId)
                    .map((i: Row) => (
                      <div key={i.id} className="cx-batch-status">
                        <span>
                          {rows.find((r) => r.id === i.dish_id)?.name} ·{" "}
                          {i.job_status || i.status}
                        </span>
                        {i.status === "failed" ||
                        i.job_status === "failed" ||
                        i.job_status === "partial" ? (
                          <button
                            className="cx-link"
                            disabled={!!busy}
                            onClick={() =>
                              act("Retrying only failed photos", async () => {
                                await api("batches/retry", { id: i.id });
                                await refresh();
                              })
                            }
                          >
                            Retry failed
                          </button>
                        ) : null}
                        {state.outputs.find(
                          (o: Row) => o.job_id === i.job_id && o.asset_id,
                        ) && (
                          <button
                            className="cx-link"
                            onClick={() =>
                              onPhoto(
                                i.dish_id,
                                state.outputs.find(
                                  (o: Row) =>
                                    o.job_id === i.job_id && o.asset_id,
                                ).asset_id,
                              )
                            }
                          >
                            Review photo
                          </button>
                        )}
                      </div>
                    ))}
                  <button
                    className="cx-link"
                    onClick={() => {
                      batchKey.current = "";
                      change({ batch: null, batchId: "", batchSelected: [] });
                    }}
                  >
                    Choose another group
                  </button>
                </>
              )}
            </aside>
          </div>

          <Feedback {...action} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

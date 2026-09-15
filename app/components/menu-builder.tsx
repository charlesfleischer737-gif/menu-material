"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Images,
  Plus,
  ArrowRight,
  BookOpen,
  Check,
  Trash2,
  Smartphone,
  Printer,
  Download,
  QrCode,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { api, downloadBlob, type Row } from "@/lib/client";
import { looks, styleFor } from "@/lib/studio";
import { menuPdf } from "@/lib/creation-export";
import MenuView from "./menu-view";
import PrintPreview from "./print-preview";
import {
  Feedback,
  Field,
  Footer,
  Heading,
  Steps,
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
      price: Math.round(Number(row.price) * 100),
      photoId: row.photoId || null,
    });
  }
  return {
    restaurant: { ...restaurant, logoId: restaurant.logo_id },
    sections,
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
  const store = useCreationDraft("menu", {
      step: 1,
      rows: fromMenu(state),
      layout: state.restaurant.menuDraft.layout || "classic",
      appearance: state.restaurant.menuDraft.appearance || "light",
      paper: state.restaurant.menuDraft.paper || "letter",
      reviewed: false,
      importId: "",
      batchId: "",
      batch: null,
      batchSelected: [],
      batchLook: "restaurant",
    }),
    { draft: b, change, save, ready, status } = store;
  const root = useStepFocus(b.step, ready);
  const action = useAction(),
    { act, busy, setNotice } = action;
  const [chooseDishes, setChooseDishes] = useState(false),
    [preview, setPreview] = useState("phone"),
    [pdf, setPdf] = useState<{
      url: string;
      blob: Blob;
      warnings: string[];
      pages: number;
    } | null>(null),
    [pdfError, setPdfError] = useState(""),
    [qr, setQr] = useState("");
  const seedHandled = useRef(""),
    pdfUrl = useRef(""),
    batchKey = useRef("");
  const rows: Row[] = b.rows || [],
    menu = menuContent(rows, state.restaurant, b.layout, b.appearance, b.paper),
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
    if (!ready || b.step !== 5) return;
    let active = true;
    setPdfError("");
    setPdf(null);
    const timer = setTimeout(() => {
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
    b.step,
    b.rows,
    b.layout,
    b.appearance,
    b.paper,
    state.restaurant.published_at,
  ]);
  useEffect(
    () => () => {
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    },
    [],
  );
  async function saveRows() {
    if (
      rows.some(
        (r) =>
          !r.name.trim() ||
          !r.category.trim() ||
          r.price === "" ||
          r.price === null ||
          !Number.isFinite(Number(r.price)) ||
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
    );
    await api("menu", {
      layout: b.layout,
      appearance: b.appearance,
      paper: b.paper,
      sections: content.sections.map((s) => ({
        ...s,
        items: s.items.map((i: Row) => ({
          dishId: i.id,
          photoId: i.photoId || null,
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
    change({ importId: imp.id, rows: [], step: 2, reviewed: false });
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
    await api(`imports/${id}/read`, {});
    const s = await api("state");
    const imp = s.imports.find((i: Row) => i.id === id);
    change({
      rows: JSON.parse(imp.draft).map((r: Row) => ({
        ...r,
        rowId: crypto.randomUUID(),
        id: "",
        photoId: "",
        available: true,
      })),
      reviewed: false,
    });
    await save();
    await refresh();
  }
  function edit(index: number, patch: Row) {
    change({
      rows: rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
      reviewed: false,
    });
  }
  function addDish(d: Row) {
    const photo = state.assets.find(
      (a: Row) => a.dish_id === d.id && a.approved_at,
    );
    change({
      rows: [
        ...rows,
        {
          ...withBaseline(d),
          rowId: d.id,
          price: d.price / 100,
          available: !!d.available,
          photoId: photo?.id || "",
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
  const titles = [
    "A menu that feels like you.",
    "Let’s get the details right.",
    "Find your menu’s look.",
    "Give your dishes a little polish.",
    "Your menu, ready to serve.",
  ];
  if (!ready)
    return (
      <p className="cx-feedback" role="status">
        {status}
      </p>
    );
  return (
    <section className="cx-tool" ref={root}>
      <div className="cx-tool-top">
        <span className="cx-save">{status}</span>
        <span className="cx-pill">
          {state.restaurant.published
            ? "Published menu + private edits"
            : "Private menu draft"}
        </span>
      </div>
      <Steps
        labels={["Start", "Your dishes", "Design", "Photos", "Preview & use"]}
        step={b.step}
        onBack={(n) => change({ step: n })}
      />
      <Heading eyebrow="MENU BUILDER" title={titles[b.step - 1]}>
        {b.step === 1
          ? "Start with what you have. We’ll help you turn it into a menu you’re proud of."
          : b.step === 2
            ? "Review names, descriptions and prices. Nothing goes live until you publish."
            : b.step === 3
              ? "Your content, instantly styled. Choose a look for the screen and the table."
              : b.step === 4
                ? "Use approved photos, or try the look on one dish before creating the rest."
                : "Preview your digital menu and real print pages, then choose how to use them."}
      </Heading>
      <Feedback {...action} />
      {newerRows(rows, state.dishes).length > 0 && (
        <div className="cx-panel cx-shared-update" role="status">
          <h3>Newer details in My Dishes</h3>
          <p>
            A dish changed since you opened this menu. Bring in its latest
            details before continuing.
          </p>
          <button
            className="cx-btn cx-secondary"
            onClick={() => {
              const changed = new Set(
                newerRows(rows, state.dishes).map((r) => r.id),
              );
              change({
                rows: rows.map((r) => {
                  const d = state.dishes.find((d: Row) => d.id === r.id);
                  return d && changed.has(r.id)
                    ? {
                        ...r,
                        ...withBaseline(d),
                        price: d.price / 100,
                        available: !!d.available,
                      }
                    : r;
                }),
                step: 2,
                reviewed: false,
              });
            }}
          >
            Use latest dish details
          </button>
        </div>
      )}

      {b.step === 1 && (
        <>
          <div className="cx-start-cards">
            <label className="cx-start-card">
              <Upload size={28} />
              <h2>Upload an existing menu</h2>
              <p>
                Bring a clear photo or PDF. Check the extracted details before
                using them.
              </p>
              <span>
                Choose a file <ArrowRight size={16} />
              </span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                hidden
                disabled={!!busy}
                onChange={(e) => {
                  if (e.target.files?.[0])
                    void act("Reading your menu", () =>
                      importFile(e.target.files![0]),
                    );
                }}
              />
            </label>
            <button
              className="cx-start-card"
              onClick={() => {
                setChooseDishes(true);
                change({ step: 2 });
              }}
            >
              <Images size={28} />
              <h2>Use My Dishes</h2>
              <p>
                Your saved dishes, prices and approved photos, ready to arrange.
              </p>
              <span>
                Choose your dishes <ArrowRight size={16} />
              </span>
            </button>
            <button
              className="cx-start-card"
              onClick={() =>
                change({ step: 2, rows: rows.length ? rows : [blank()] })
              }
            >
              <Plus size={28} />
              <h2>Start simple</h2>
              <p>
                Add a few dishes. A beautiful text menu is a great place to
                begin.
              </p>
              <span>
                Build your menu <ArrowRight size={16} />
              </span>
            </button>
          </div>
          {rows.length > 0 && (
            <button
              className="cx-btn cx-secondary"
              onClick={() => change({ step: 2 })}
            >
              Continue your saved menu · {rows.length} dishes{" "}
              <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      {b.step === 2 && (
        <>
          <div className="cx-section-line">
            <span>
              {rows.length} dishes · prices in {state.restaurant.currency}
            </span>
            <button
              className="cx-link"
              onClick={() => setChooseDishes((v) => !v)}
            >
              <Images size={16} />
              Add from My Dishes
            </button>
          </div>
          {chooseDishes && (
            <div className="cx-panel cx-library-picker">
              {state.dishes.length === 0 ? (
                <p>Your dish library is empty. Add a dish below.</p>
              ) : (
                state.dishes
                  .filter((d: Row) => !rows.some((r) => r.id === d.id))
                  .map((d: Row) => (
                    <button
                      className="cx-btn cx-secondary"
                      key={d.id}
                      onClick={() => addDish(d)}
                    >
                      <Plus size={15} />
                      {d.name}
                    </button>
                  ))
              )}
            </div>
          )}
          {b.importId && (
            <div className="cx-hint">
              <b>Review required.</b> Check the wording and every price against
              your original menu. Missing prices are highlighted.
              {!rows.length && (
                <button
                  className="cx-link"
                  disabled={!!busy || !state.aiConnected}
                  onClick={() =>
                    act("Reading your saved menu", () => readImport(b.importId))
                  }
                >
                  Read saved menu
                </button>
              )}
            </div>
          )}
          <div className="cx-menu-rows">
            {rows.map((r, i) => (
              <article key={r.rowId} className="cx-menu-row">
                <div className="cx-menu-row-heading">
                  <span className="cx-row-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <b>{r.name || "New dish"}</b>
                  <button
                    className="cx-icon"
                    aria-label={`Remove ${r.name || "dish " + (i + 1)} from this menu`}
                    onClick={() =>
                      change({
                        rows: rows.filter((_, j) => i !== j),
                        reviewed: false,
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="cx-menu-fields">
                  <Field label="Dish name">
                    <input
                      value={r.name}
                      maxLength={100}
                      onChange={(e) => edit(i, { name: e.target.value })}
                      placeholder="Roasted tomato pasta"
                    />
                  </Field>
                  <Field label="Section">
                    <input
                      value={r.category}
                      maxLength={100}
                      onChange={(e) => edit(i, { category: e.target.value })}
                      placeholder="Mains"
                    />
                  </Field>
                  <Field label="Price">
                    <input
                      className={
                        r.price === null || r.price === "" ? "cx-uncertain" : ""
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      value={r.price ?? ""}
                      onChange={(e) => edit(i, { price: e.target.value })}
                      placeholder="Check price"
                    />
                  </Field>
                </div>
                <Field label="Description (optional)">
                  <input
                    value={r.description}
                    maxLength={2000}
                    onChange={(e) => edit(i, { description: e.target.value })}
                    placeholder="Use your own confirmed ingredients and description"
                  />
                </Field>
                <div className="cx-section-line">
                  <label className="cx-check">
                    <input
                      type="checkbox"
                      checked={r.available}
                      onChange={(e) => edit(i, { available: e.target.checked })}
                    />
                    Available to order
                  </label>
                  {r.id && (
                    <Field label="Menu photo">
                      <select
                        value={r.photoId || ""}
                        onChange={(e) => edit(i, { photoId: e.target.value })}
                      >
                        <option value="">Text only</option>
                        {state.assets
                          .filter(
                            (a: Row) => a.dish_id === r.id && a.approved_at,
                          )
                          .map((a: Row, j: number) => (
                            <option value={a.id} key={a.id}>
                              Approved photo {j + 1}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                </div>
              </article>
            ))}
          </div>
          <button
            className="cx-btn cx-secondary"
            disabled={rows.length >= 60}
            onClick={() =>
              change({ rows: [...rows, blank()], reviewed: false })
            }
          >
            <Plus size={17} />
            Add a dish
          </button>
          <label className="cx-check cx-confirm">
            <input
              type="checkbox"
              checked={b.reviewed}
              onChange={(e) => change({ reviewed: e.target.checked })}
            />
            I’ve checked the names, descriptions, availability and prices.
          </label>
          <Footer
            back={() => change({ step: 1 })}
            label="Choose a design"
            next={() =>
              act("Saving your menu content", async () => {
                await saveRows();
                change({ step: 3 });
                await save();
              })
            }
            disabled={!rows.length || !b.reviewed}
            busy={!!busy}
          />
        </>
      )}
      {b.step === 3 && (
        <>
          <div className="cx-menu-templates">
            {[
              [
                "classic",
                "Classic text",
                "Beautifully simple. Every dish gets its moment.",
              ],
              [
                "grid",
                "Photo grid",
                "Put your approved food photos front and center.",
              ],
              [
                "featured",
                "Featured dish",
                "Lead with a signature dish in each section.",
              ],
            ].map(([id, title, desc]) => (
              <button
                key={id}
                className="cx-template-card"
                aria-pressed={b.layout === id}
                onClick={() => change({ layout: id })}
              >
                <div className="cx-mini-menu" aria-hidden="true" inert>
                  <MenuView menu={{ ...menu, layout: id }} preview />
                </div>
                <div>
                  <b>{title}</b>
                  <small>{desc}</small>
                  {b.layout === id && <Check size={18} />}
                </div>
              </button>
            ))}
          </div>
          <p className="cx-hint">
            {rows.filter((r) => r.photoId).length < rows.length / 2
              ? "Classic text works beautifully while you build up your photo library."
              : "Your menu already has approved photos. Try Photo grid to make them stand out."}
          </p>
          <div className="cx-panel cx-design-settings">
            <Field label="Paper size">
              <select
                value={b.paper}
                onChange={(e) => change({ paper: e.target.value })}
              >
                <option value="letter">US Letter</option>
                <option value="a4">A4</option>
              </select>
            </Field>
            <Field label="Appearance">
              <select
                value={b.appearance}
                onChange={(e) => change({ appearance: e.target.value })}
              >
                <option value="light">Light & fresh</option>
                <option value="dark">Dark & elegant</option>
              </select>
            </Field>
            <p>Restaurant colors and logo carry through automatically.</p>
          </div>
          <Footer
            back={() => change({ step: 2 })}
            label="Check your photos"
            next={() =>
              act("Saving your design", async () => {
                await saveRows();
                change({ step: 4 });
                await save();
              })
            }
            busy={!!busy}
            note="Design changes use no images"
          />
        </>
      )}
      {b.step === 4 && (
        <>
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
          <Footer
            back={() => change({ step: 3 })}
            label="Preview my menu"
            next={() =>
              act("Preparing your menu preview", async () => {
                await saveRows();
                change({ step: 5 });
                await save();
              })
            }
            busy={!!busy}
            note="Photo improvements are optional"
          />
        </>
      )}
      {b.step === 5 && (
        <>
          <div className="cx-studio-grid">
            <div>
              <div className="cx-segment cx-preview-switch">
                <button
                  aria-pressed={preview === "phone"}
                  onClick={() => setPreview("phone")}
                >
                  <Smartphone size={17} />
                  Phone menu
                </button>
                <button
                  aria-pressed={preview === "print"}
                  onClick={() => setPreview("print")}
                >
                  <Printer size={17} />
                  Print pages
                </button>
              </div>
              {preview === "phone" ? (
                <div className="cx-phone-menu">
                  <MenuView menu={menu} preview />
                </div>
              ) : (
                <div className="cx-print-preview">
                  {pdf ? (
                    <>
                      <PrintPreview blob={pdf.blob} pages={pdf.pages} />
                      <p>
                        {pdf.pages} {pdf.pages === 1 ? "page" : "pages"} ·{" "}
                        {b.paper === "a4" ? "A4" : "US Letter"} · sharp text ·
                        home-print margins
                      </p>
                    </>
                  ) : (
                    <p role="status">
                      {pdfError || "Preparing your print pages…"}
                    </p>
                  )}
                </div>
              )}
            </div>
            <aside className="cx-panel">
              <h2>Ready for your guests.</h2>
              <p>
                Publish your digital menu when the details look right. Its link
                stays the same as your menu changes.
              </p>
              <button
                className="cx-btn cx-full"
                disabled={!!busy || !b.reviewed}
                onClick={() =>
                  act("Publishing your menu", async () => {
                    await saveRows();
                    await api("menu/publish", {});
                    await refresh();
                    setNotice("Your menu is published at its stable link.");
                  })
                }
              >
                <BookOpen size={17} />
                {state.restaurant.published
                  ? "Publish menu updates"
                  : "Publish menu"}
              </button>
              {state.restaurant.published && (
                <a
                  className="cx-link"
                  href={"/m/" + state.restaurant.slug}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open published menu <ExternalLink size={15} />
                </a>
              )}
              <div className="cx-rule" />
              <h3>Make it print-ready.</h3>
              <Field label="Paper size">
                <select
                  value={b.paper}
                  onChange={(e) => change({ paper: e.target.value })}
                >
                  <option value="letter">US Letter</option>
                  <option value="a4">A4</option>
                </select>
              </Field>
              {pdf?.warnings.map((w) => (
                <p className="cx-hint" key={w}>
                  {w}
                </p>
              ))}
              {pdfError && (
                <p role="alert" className="cx-feedback cx-error">
                  {pdfError}
                </p>
              )}
              <button
                className="cx-btn cx-secondary cx-full"
                disabled={!pdf || !!busy}
                onClick={() => {
                  if (pdf) {
                    downloadBlob(
                      pdf.blob,
                      `${state.restaurant.slug}-menu-${new Date().toISOString().slice(0, 10)}.pdf`,
                    );
                    track("export_complete", undefined, {
                      format: "menu-pdf",
                      pages: pdf.pages,
                    });
                  }
                }}
              >
                <Download size={17} />
                Download print PDF
              </button>
              <button
                className="cx-btn cx-secondary cx-full"
                disabled={!state.restaurant.published || !!busy}
                onClick={() =>
                  act("Preparing your QR code", async () => {
                    const { default: QR } = await import("qrcode");
                    const url = await QR.toDataURL(
                      location.origin + "/m/" + state.restaurant.slug,
                      { width: 1000, margin: 4, errorCorrectionLevel: "M" },
                    );
                    setQr(url);
                    downloadBlob(
                      await (await fetch(url)).blob(),
                      `${state.restaurant.slug}-menu-qr.png`,
                    );
                  })
                }
              >
                <QrCode size={17} />
                Download menu QR
              </button>
              {qr && (
                <img
                  src={qr}
                  alt="QR code for your published menu"
                  className="cx-qr"
                />
              )}
              <p className="cx-hint">
                Price edits change your draft. Publish to update the digital
                menu, and download a fresh PDF for new printed copies.
              </p>
              {!b.reviewed && (
                <button className="cx-link" onClick={() => change({ step: 2 })}>
                  Review your updated details before publishing
                </button>
              )}
            </aside>
          </div>
          <Footer
            back={() => change({ step: 4 })}
            label="Save my menu draft"
            next={() =>
              act("Saving your draft", async () => {
                await saveRows();
                setNotice(
                  "Your menu draft is saved. Publish when you’re ready.",
                );
              })
            }
            busy={!!busy}
          />
        </>
      )}
    </section>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Plus,
  Printer,
  QrCode,
  Upload,
} from "lucide-react";
import { api, dishCount, downloadBlob, type Row } from "@/lib/client";
import {
  menuDocumentSchema,
  newMenuEntry,
  type DesignedMenu,
  type MenuDocument,
  type MenuSection,
} from "@/lib/menu-document";
import {
  designReason,
  menuDesignCollection,
  menuDesignSpec,
  recommendMenuDesigns,
} from "@/lib/menu-design-system";
import { parsePastedMenu } from "@/lib/menu-paste";
import { preferredPhoto } from "@/lib/dish-library";
import type { MenuCheck } from "@/lib/menu-checks";
import {
  isPlaceholderRestaurantName,
  menuAddressProblem,
  slugify,
} from "@/lib/restaurant-identity";
import type { MenuPdfResult } from "@/lib/menu-pdf-v2";
import type { SavedMenu } from "./use-menu-document";
import { Field, MenuDialog, MoneyInput, Toggle } from "./menu-studio-controls";
import MenuProof from "./menu-proof";

export function MenuDesignPicker({
  menu,
  close,
  apply,
}: {
  menu: DesignedMenu;
  close: () => void;
  apply: (design: MenuDocument["design"]) => void;
}) {
  const [selected, setSelected] = useState(menu.design),
    [all, setAll] = useState(false),
    [detail, setDetail] = useState(false);
  const recommended = recommendMenuDesigns(menu),
    designs = all ? menuDesignCollection : recommended,
    spec = menuDesignSpec(selected);
  return (
    <MenuDialog
      title={detail ? spec.name : "Choose a design"}
      description={
        detail
          ? designReason(menu, selected)
          : "Considered designs, composed with your actual dishes. Choose one to inspect every page."
      }
      close={close}
      wide
    >
      {detail ? (
        <>
          <button className="md-text-button" onClick={() => setDetail(false)}>
            <ArrowLeft size={15} /> Back to designs
          </button>
          <div className="md-design-full-preview">
            <MenuProof menu={{ ...menu, design: selected }} />
          </div>
          <div className="md-dialog-actions md-sticky-actions">
            <span>Your content, photos, and colors stay yours.</span>
            <button className="md-button" onClick={() => apply(selected)}>
              Use {spec.name}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="md-design-picker-tabs">
            <div className="md-segment">
              <button aria-pressed={!all} onClick={() => setAll(false)}>
                Recommended for you
              </button>
              <button aria-pressed={all} onClick={() => setAll(true)}>
                All {menuDesignCollection.length} designs
              </button>
            </div>
            <span>
              {dishCount(menu.sections.reduce((n, s) => n + s.items.length, 0))}{" "}
              · {menu.purpose}
            </span>
          </div>
          <div className="md-design-grid">
            {designs.map((d) => (
              <button
                key={d.id}
                className={`md-design-card ${menu.design === d.id ? "is-current" : ""}`}
                onClick={() => {
                  setSelected(d.id);
                  setDetail(true);
                }}
              >
                <div className="md-design-card-proof">
                  <MenuProof menu={{ ...menu, design: d.id }} compact />
                  {menu.design === d.id && (
                    <span className="md-design-current">
                      <Check size={12} /> Current
                    </span>
                  )}
                </div>
                <div className="md-design-card-copy">
                  <span>{d.category}</span>
                  <h3>{d.name}</h3>
                  <p>{d.description}</p>
                  <strong>Preview every page →</strong>
                </div>
              </button>
            ))}
          </div>
          <p className="md-help">
            Each design has its own typography and composition. Your chosen
            palette and photo settings carry across.
          </p>
        </>
      )}
    </MenuDialog>
  );
}

const sectionOrder = [
  ["breakfast", "brunch", "morning"],
  ["bakery", "pastr", "bread"],
  ["snack", "small plate", "share", "appetizer", "starter", "antipast"],
  ["soup", "salad"],
  [
    "main",
    "entrée",
    "entree",
    "plate",
    "pasta",
    "pizza",
    "burger",
    "sandwich",
    "taco",
    "bowl",
  ],
  ["side"],
  ["dessert", "sweet"],
  ["kid"],
  ["coffee", "tea", "drink", "beverage", "juice", "smoothie"],
  ["cocktail", "wine", "beer", "bar"],
];
export function MenuSourceDialog({
  mode,
  setMode,
  state,
  close,
  append,
  refresh,
}: {
  mode: string;
  setMode: (mode: string) => void;
  state: Row;
  close: () => void;
  append: (
    sections: MenuSection[],
    importId?: string | null,
    originalText?: string,
  ) => void;
  refresh: () => Promise<void>;
}) {
  const [text, setText] = useState(""),
    [chosen, setChosen] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [importId, setImportId] = useState(""),
    [importName, setImportName] = useState(""),
    [review, setReview] = useState<MenuSection[] | null>(null);
  const upload = useRef<HTMLInputElement>(null),
    backup = useRef<HTMLInputElement>(null),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  // Sample dishes (from "Try a sample") never go on a guest menu.
  const dishes = (state.dishes as Row[]).filter(
    (d) =>
      !d.sample &&
      !d.archived_at &&
      `${d.name} ${d.category}`.toLowerCase().includes(search.toLowerCase()),
  );
  function group(rows: Row[], imported = false) {
    const sections: MenuSection[] = [];
    let featured = 0;
    for (const row of rows) {
      // Library dishes bring their approved photo; a few lead the menu.
      const photo = imported
        ? null
        : preferredPhoto(row, (state.assets as Row[]) || []);
      const photoId = photo?.approved_at ? (photo.id as string) : null;
      const name = row.category || "Dishes";
      let section = sections.find((s) => s.name === name);
      if (!section) {
        section = {
          id: crypto.randomUUID(),
          name,
          description: "",
          pageBreakBefore: false,
          items: [],
        };
        sections.push(section);
      }
      section.items.push(
        newMenuEntry({
          dishId: imported ? null : row.id,
          name: row.name,
          description: row.description || "",
          price:
            row.price == null
              ? null
              : imported
                ? Math.round(Number(row.price) * 100)
                : row.price,
          available: row.available !== false && row.available !== 0,
          photoId,
          featured: !!photoId && featured++ < 4,
          sourceReviewed: !imported,
          sourceUncertain: imported ? row.uncertain || [] : [],
        }),
      );
    }
    // Courses in the order guests read them; unknown sections keep their place.
    const course = (name: string) => {
      const key = name.toLowerCase();
      const index = sectionOrder.findIndex((words) =>
        words.some((word) => key.includes(word)),
      );
      return index < 0 ? sectionOrder.length / 2 : index;
    };
    return imported
      ? sections
      : sections
          .map((section, index) => ({ section, index }))
          .sort(
            (a, b) =>
              course(a.section.name) - course(b.section.name) ||
              a.index - b.index,
          )
          .map(({ section }) => section);
  }
  async function read(id: string) {
    setBusy("Reading your menu. This can take a minute");
    setError("");
    try {
      await api(`imports/${id}/extract`, {});
      const latest = await api("state");
      const entry = latest.imports.find((i: Row) => i.id === id);
      if (!entry?.draft)
        throw Error(
          "The menu text is not ready yet. Try reading the saved file again.",
        );
      if (active.current) setReview(group(JSON.parse(entry.draft), true));
      await refresh();
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy("");
    }
  }
  async function importFile(f: File) {
    setError("");
    if (f.size > 4 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, or PDF smaller than 4 MB.");
      return;
    }
    setBusy("Saving the original menu");
    try {
      const form = new FormData();
      form.set("file", f);
      const result = await api("imports", form);
      setImportId(result.id);
      setImportName(f.name);
      await refresh();
      if (state.aiConnected) await read(result.id);
      else
        setError(
          "Your original is saved. Automatic reading is not connected; paste the text or add dishes manually.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <MenuDialog
      title={review ? "Review imported dishes" : "Add dishes"}
      description={
        review
          ? "Nothing goes live yet. Dishes the reader was unsure about are marked so you can check them against the original."
          : "Start with what you have. Every dish stays editable."
      }
      close={close}
      wide={!!review}
    >
      {review ? (
        <>
          <div className="md-import-review">
            <div className="md-import-source">
              {importId ? (
                <>
                  <a
                    href={`/api/imports/${importId}/original`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open {importName || "original menu"}{" "}
                    <ExternalLink size={14} />
                  </a>
                  <iframe
                    src={`/api/imports/${importId}/original`}
                    title="Original menu for comparison"
                  />
                </>
              ) : (
                <pre>{text}</pre>
              )}
            </div>
            <div className="md-import-extracted">
              {review.map((s) => (
                <section key={s.id}>
                  <h3>{s.name}</h3>
                  {s.items.map((i) => (
                    <div key={i.id}>
                      <strong>{i.name}</strong>
                      <span>
                        {i.price == null
                          ? "Price needs review"
                          : new Intl.NumberFormat("en", {
                              style: "currency",
                              currency: state.restaurant.currency,
                            }).format(i.price / 100)}
                      </span>
                      {i.description && <p>{i.description}</p>}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
          <div className="md-dialog-actions">
            <button
              className="md-button"
              onClick={() =>
                append(
                  review.map((s) => ({
                    ...s,
                    items: s.items.map((i) => ({
                      ...i,
                      // Automatic check: anything the reader was unsure about,
                      // or a missing price, stays marked for a closer look.
                      sourceReviewed:
                        !i.sourceUncertain.length &&
                        (i.priceMode !== "single" || i.price != null),
                    })),
                  })),
                  importId || null,
                  importId ? "" : text,
                )
              }
            >
              <Plus size={16} /> Add{" "}
              {dishCount(review.reduce((n, s) => n + s.items.length, 0))}
            </button>
            <button
              className="md-button md-secondary"
              onClick={() => setReview(null)}
            >
              Back
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className="md-source-tabs md-segment"
            role="group"
            aria-label="Menu source"
          >
            <button
              aria-pressed={mode === "file"}
              onClick={() => setMode("file")}
            >
              <Upload size={15} /> Upload menu
            </button>
            <button
              aria-pressed={mode === "paste"}
              onClick={() => setMode("paste")}
            >
              <FileText size={15} /> Paste text
            </button>
            <button
              aria-pressed={mode === "library"}
              onClick={() => setMode("library")}
            >
              <BookOpen size={15} /> My dishes
            </button>
          </div>
          {mode === "file" && (
            <>
              <input
                ref={upload}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importFile(f);
                }}
              />
              <button
                className="md-upload-zone"
                disabled={!!busy}
                onClick={() => upload.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy && e.dataTransfer.files[0])
                    void importFile(e.dataTransfer.files[0]);
                }}
              >
                <span>
                  <Upload size={25} />
                </span>
                <strong>{busy || "Drop your existing menu here"}</strong>
                <p>or choose a file</p>
                <small>JPEG, PNG, or PDF · up to 4 MB</small>
              </button>
              <p className="md-help">
                We read names, descriptions, sections, and explicit prices. You
                review the facts before publishing. Complex options may need a
                little editing.
              </p>
              {importId && (
                <div className="md-saved-source">
                  <span>{importName || "Original menu"} is saved.</span>
                  <button
                    className="md-text-button"
                    disabled={!!busy || !state.aiConnected}
                    onClick={() => void read(importId)}
                  >
                    Read saved file again
                  </button>
                </div>
              )}
              {!!state.imports?.length && (
                <details className="md-details">
                  <summary>Previously uploaded menus</summary>
                  <div className="md-prior-imports">
                    {state.imports.map((i: Row) => (
                      <button
                        disabled={!!busy}
                        key={i.id}
                        onClick={() => {
                          setImportId(i.id);
                          setImportName(i.name);
                          if (i.draft && JSON.parse(i.draft).length)
                            setReview(group(JSON.parse(i.draft), true));
                          else void read(i.id);
                        }}
                      >
                        <FileText size={17} />
                        <span>
                          {i.name}
                          <small>
                            {i.status === "reading"
                              ? "Reading"
                              : i.status === "failed"
                                ? "Reading interrupted · retry"
                                : "Saved original"}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <input
                ref={backup}
                hidden
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const value = menuDocumentSchema.parse(
                      JSON.parse(await f.text()),
                    );
                    append(
                      value.sections.map((s) => ({
                        ...s,
                        id: crypto.randomUUID(),
                        items: s.items.map((i) => ({
                          ...i,
                          id: crypto.randomUUID(),
                        })),
                      })),
                      value.importSourceId,
                      value.importSourceText,
                    );
                  } catch {
                    setError(
                      "This file is not a supported menu recovery copy.",
                    );
                  }
                }}
              />
              <button
                className="md-text-button"
                onClick={() => backup.current?.click()}
              >
                Import dishes from a menu recovery copy
              </button>
            </>
          )}
          {mode === "paste" && (
            <>
              <Field
                label="Your menu text"
                hint="Put section headings on their own line. Keep each dish’s price at the end of its line."
              >
                <textarea
                  rows={13}
                  value={text}
                  maxLength={60000}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    "TO BEGIN\nMarinated olives 7.00\nCitrus peel, rosemary, bay leaf\n\nFROM THE KITCHEN\nRoast chicken — potato purée, charred leeks 28.00"
                  }
                />
              </Field>
              <button
                className="md-button"
                disabled={!text.trim()}
                onClick={() => {
                  const parsed = parsePastedMenu(text);
                  if (!parsed.length)
                    setError("Add some dish names and prices first.");
                  else {
                    setImportId("");
                    setReview(parsed);
                  }
                }}
              >
                Review extracted dishes
              </button>
            </>
          )}
          {mode === "library" && (
            <>
              <input
                className="md-library-search"
                type="search"
                aria-label="Search dish library"
                placeholder="Search your dishes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="md-dish-picker">
                {dishes.length ? (
                  dishes.map((d) => (
                    <label key={d.id}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(d.id)}
                        onChange={(e) =>
                          setChosen((before) =>
                            e.target.checked
                              ? [...before, d.id]
                              : before.filter((id) => id !== d.id),
                          )
                        }
                      />
                      <span>
                        <strong>{d.name}</strong>
                        <small>
                          {d.category}
                          {d.description ? ` · ${d.description}` : ""}
                        </small>
                      </span>
                      <span>
                        {d.price == null
                          ? ""
                          : new Intl.NumberFormat("en", {
                              style: "currency",
                              currency: state.restaurant.currency,
                            }).format(d.price / 100)}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="md-empty-note">
                    {search
                      ? "No dishes match your search."
                      : "Your dish library is empty. Upload a menu, paste text, or start with a blank menu."}
                  </p>
                )}
              </div>
              <div className="md-dialog-actions">
                <button
                  className="md-button"
                  disabled={!chosen.length}
                  onClick={() =>
                    append(
                      group(
                        state.dishes.filter((d: Row) => chosen.includes(d.id)),
                      ),
                    )
                  }
                >
                  Add {chosen.length || "selected"}{" "}
                  {chosen.length === 1 ? "dish" : "dishes"}
                </button>
                {dishes.length > 0 && (
                  <button
                    className="md-text-button"
                    onClick={() => setChosen(dishes.map((d) => d.id))}
                  >
                    Select all shown
                  </button>
                )}
              </div>
              <p className="md-help">
                Dish details are copied into this menu so you can tailor prices
                and descriptions for each service.
              </p>
            </>
          )}
        </>
      )}
      {error && (
        <p className="md-notice md-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="md-import-progress" role="status">
          {busy}… You can return to this saved file if you close the dialog.
        </p>
      )}
    </MenuDialog>
  );
}

export function MenuImportReview({
  menu,
  change,
  close,
}: {
  menu: MenuDocument;
  change: (patch: Partial<MenuDocument>) => void;
  close: () => void;
}) {
  const remaining = menu.sections
    .flatMap((s) => s.items)
    .filter((i) => !i.sourceReviewed).length;
  const edit = (
    id: string,
    patch: Partial<MenuDocument["sections"][number]["items"][number]>,
  ) =>
    change({
      sections: menu.sections.map((s) => ({
        ...s,
        items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      })),
    });
  return (
    <MenuDialog
      title="Review imported dishes"
      description="Compare each marked dish with your original and correct anything that needs it. Everything else was read with confidence."
      close={close}
      wide
    >
      <div
        className={`md-import-review ${!menu.importSourceId && !menu.importSourceText ? "md-review-without-source" : ""}`}
      >
        {(menu.importSourceId || menu.importSourceText) && (
          <div className="md-import-source">
            {menu.importSourceId ? (
              <>
                <a
                  href={`/api/imports/${menu.importSourceId}/original`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original menu <ExternalLink size={14} />
                </a>
                <iframe
                  src={`/api/imports/${menu.importSourceId}/original`}
                  title="Original menu for review"
                />
              </>
            ) : (
              <pre>{menu.importSourceText}</pre>
            )}
          </div>
        )}
        <div className="md-review-fields">
          {menu.sections.map((s) => (
            <section key={s.id}>
              <h3>{s.name}</h3>
              {s.items.map((i) => (
                <div key={i.id} className="md-review-dish">
                  <div className="md-review-dish-heading">
                    <strong>{i.name || "Untitled dish"}</strong>
                    <span>
                      {i.sourceReviewed ? "Looks right" : "Needs review"}
                    </span>
                  </div>
                  {!!i.sourceUncertain?.length && (
                    <p className="md-inline-error">
                      The reader was unsure about:{" "}
                      {i.sourceUncertain.join(", ")}.
                    </p>
                  )}
                  <Field label="Dish name">
                    <input
                      value={i.name}
                      maxLength={120}
                      onChange={(e) => edit(i.id, { name: e.target.value })}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={i.description}
                      rows={2}
                      maxLength={2000}
                      onChange={(e) =>
                        edit(i.id, { description: e.target.value })
                      }
                    />
                  </Field>
                  {i.priceMode === "single" && (
                    <Field label="Price">
                      <MoneyInput
                        value={i.price}
                        onChange={(price) => edit(i.id, { price })}
                      />
                    </Field>
                  )}
                  <Toggle
                    label="Looks right"
                    checked={i.sourceReviewed}
                    onChange={(sourceReviewed) =>
                      edit(i.id, { sourceReviewed })
                    }
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
      <div className="md-dialog-actions">
        <button className="md-button" onClick={close}>
          Done
        </button>
        <p className="md-help">
          {remaining
            ? `${remaining} ${remaining === 1 ? "dish" : "dishes"} still marked for a closer look.`
            : "Every imported dish is ready."}
        </p>
      </div>
    </MenuDialog>
  );
}

function publicationChanges(before: Row | null, menu: DesignedMenu) {
  if (!before)
    return [
      "Your first published version. Guests will see the dishes and details shown here.",
    ];
  const old = new Map<string, Row>(
      (before.sections || [])
        .flatMap((s: Row) => s.items)
        .map((i: Row) => [i.id, i] as const),
    ),
    current = menu.sections.flatMap((s) => s.items),
    notes: string[] = [];
  const added = current.filter((i) => !old.has(i.id)),
    removed = [...old.keys()].filter((id) => !current.some((i) => i.id === id)),
    edited = current.filter(
      (i) =>
        old.has(i.id) && JSON.stringify(i) !== JSON.stringify(old.get(i.id)),
    );
  if (added.length)
    notes.push(
      `${added.length} ${added.length === 1 ? "dish added" : "dishes added"}`,
    );
  if (removed.length)
    notes.push(
      `${removed.length} ${removed.length === 1 ? "dish removed" : "dishes removed"}`,
    );
  for (const i of edited.slice(0, 8)) {
    const previous = old.get(i.id)!;
    const fields = [
      previous.price !== i.price ||
      previous.priceMode !== i.priceMode ||
      JSON.stringify(previous.variants) !== JSON.stringify(i.variants)
        ? "pricing"
        : "",
      previous.name !== i.name || previous.description !== i.description
        ? "wording"
        : "",
      previous.available !== i.available || previous.visible !== i.visible
        ? "availability"
        : "",
      previous.photoId !== i.photoId || previous.featured !== i.featured
        ? "photo"
        : "",
    ].filter(Boolean);
    notes.push(`${i.name}: ${fields.join(", ") || "details"} updated`);
  }
  if (edited.length > 8) notes.push(`${edited.length - 8} more dishes updated`);
  if (
    [
      "design",
      "layout",
      "appearance",
      "colorMode",
      "color",
      "density",
      "title",
      "subtitle",
      "footer",
      "fixedPrice",
    ].some((key) => before[key] !== menu[key as keyof DesignedMenu])
  )
    notes.push("Menu design or guest notes updated");
  if (!notes.length)
    notes.push("Republish the current menu and restaurant details.");
  return notes;
}
function isAutomaticAddress(restaurant: Row) {
  return (
    restaurant.slug === "local-pilot" ||
    String(restaurant.slug).endsWith("-" + String(restaurant.id).slice(0, 8))
  );
}
function CheckFix({
  check,
  restaurant,
  select,
  removeItem,
  saveRestaurantName,
}: {
  check: MenuCheck;
  restaurant: Row;
  select: (id: string) => void;
  removeItem: (id: string) => void;
  saveRestaurantName: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(
      isPlaceholderRestaurantName(restaurant.name) ? "" : restaurant.name,
    ),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  if (check.fix === "restaurant-name")
    return (
      <form
        className="md-check-fix"
        onSubmit={async (e) => {
          e.preventDefault();
          if (isPlaceholderRestaurantName(name)) {
            setError("Enter your restaurant’s real name.");
            return;
          }
          setSaving(true);
          setError("");
          try {
            await saveRestaurantName(name.trim());
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <input
          aria-label="Restaurant name"
          value={name}
          maxLength={100}
          disabled={saving}
          placeholder="Corner House Kitchen"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="md-button md-secondary" disabled={saving}>
          {saving ? "Saving…" : "Save name"}
        </button>
        {error && (
          <small className="md-inline-error" role="alert">
            {error}
          </small>
        )}
      </form>
    );
  if (check.fix === "remove" && check.entryId)
    return (
      <button
        className="md-text-button"
        onClick={() => removeItem(check.entryId!)}
      >
        Remove from menu
      </button>
    );
  if (check.entryId || check.sectionId)
    return (
      <button
        className="md-text-button"
        onClick={() => select(check.entryId || check.sectionId || "")}
      >
        Edit
      </button>
    );
  return null;
}
export function MenuDeliveryDialog({
  mode,
  menu,
  record,
  checks,
  restaurant,
  close,
  select,
  removeItem,
  saveRestaurantName,
  published,
  save,
  setProfile,
}: {
  mode: string;
  menu: DesignedMenu;
  record: SavedMenu;
  checks: MenuCheck[];
  restaurant: Row;
  close: () => void;
  select: (id: string) => void;
  removeItem: (id: string) => void;
  saveRestaurantName: (name: string) => Promise<void>;
  published: (address?: string) => Promise<void>;
  save: () => Promise<void>;
  setProfile: (profile: MenuDocument["printProfile"]) => void;
}) {
  const [proof, setProof] = useState<MenuPdfResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [downloaded, setDownloaded] = useState(false),
    [exportNotes, setExportNotes] = useState<string[]>([]),
    [address, setAddress] = useState(""),
    [addressState, setAddressState] = useState<
      "checking" | "available" | "taken" | ""
    >("");
  const isPrint = mode === "export",
    blocking = checks.filter((c) => c.level === "block"),
    warnings = checks.filter((c) => c.level === "warn"),
    // The first publication chooses the menu address that QR codes will use.
    choosingAddress =
      !isPrint &&
      !record.published &&
      !restaurant.published &&
      isAutomaticAddress(restaurant) &&
      !isPlaceholderRestaurantName(restaurant.name),
    addressProblem = choosingAddress ? menuAddressProblem(address) : "",
    changes = useMemo(
      () => publicationChanges(record.published, menu),
      [record.published, menu],
    );
  useEffect(() => {
    if (!choosingAddress) return;
    let active = true;
    api(`restaurant/address?check=${slugify(restaurant.name)}`)
      .then((result) => {
        if (!active) return;
        const next = result.available ? result.requested : result.suggestion;
        setAddress(next);
        setAddressState("available");
      })
      .catch(() => {
        if (active) setAddress(slugify(restaurant.name));
      });
    return () => {
      active = false;
    };
  }, [choosingAddress, restaurant.name]);
  useEffect(() => {
    if (!choosingAddress || !address || menuAddressProblem(address)) return;
    let active = true;
    const timer = setTimeout(() => {
      setAddressState("checking");
      api(`restaurant/address?check=${encodeURIComponent(address)}`)
        .then((result) => {
          if (active) setAddressState(result.available ? "available" : "taken");
        })
        .catch(() => {
          if (active) setAddressState("");
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [choosingAddress, address]);
  async function deliver() {
    setBusy(true);
    setError("");
    try {
      await save();
      if (blocking.length) throw Error(blocking[0].message);
      if (isPrint) {
        if (!proof || proof.signature !== JSON.stringify(menu))
          throw Error("Wait for the current menu preview before downloading.");
        const result = proof;
        setExportNotes(result.warnings);
        downloadBlob(
          result.blob,
          `${menu.restaurant.name}-${menu.title || menu.name}-${menu.paper}${menu.printProfile === "press" ? "-print-shop" : ""}.pdf`,
        );
        setDownloaded(true);
      } else await published(choosingAddress ? address : undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const action = isPrint ? "exporting" : "publishing";
  return (
    <MenuDialog
      title={
        isPrint
          ? "Export PDF"
          : record.published
            ? "Publish changes"
            : "Publish menu"
      }
      description={
        isPrint
          ? "Check every page, choose your print setup, and save the finished PDF."
          : "Your draft stays private until you publish. Here’s what guests will see."
      }
      close={busy ? () => {} : close}
      wide
    >
      <div className="md-delivery-layout">
        <div className="md-delivery-preview">
          <MenuProof menu={menu} onResult={setProof} production={isPrint} />
        </div>
        <div className="md-delivery-controls">
          <h3>{menu.title || menu.name}</h3>
          <p className="md-help">
            {menuDesignSpec(menu.design).name} ·{" "}
            {proof
              ? `${proof.pages} ${proof.pages === 1 ? "page" : "pages"}`
              : "Preparing preview"}{" "}
            · {menu.paper === "a4" ? "A4" : "US Letter"}
          </p>
          <div
            className={`md-checks ${blocking.length ? "has-blocking" : "is-clear"}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {blocking.length ? (
                `${blocking.length} ${blocking.length === 1 ? "thing" : "things"} to fix before ${action}`
              ) : (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" /> Automatic checks
                  passed
                </>
              )}
            </strong>
            {!!(blocking.length || warnings.length) && (
              <ul>
                {[...blocking, ...warnings].slice(0, 10).map((check) => (
                  <li
                    key={check.id}
                    className={
                      check.level === "block" ? "is-blocking" : "is-warning"
                    }
                  >
                    <span>{check.message}</span>
                    <CheckFix
                      check={check}
                      restaurant={restaurant}
                      select={select}
                      removeItem={removeItem}
                      saveRestaurantName={saveRestaurantName}
                    />
                  </li>
                ))}
              </ul>
            )}
            {blocking.length + warnings.length > 10 && (
              <small>
                And {blocking.length + warnings.length - 10} more in the editor.
              </small>
            )}
            <small>
              Checked: restaurant name, dish names, prices, sample dishes,
              duplicates and descriptions.
            </small>
          </div>
          {isPrint ? (
            <>
              <Field label="Where will you print?">
                <select
                  value={menu.printProfile}
                  disabled={busy}
                  onChange={(e) =>
                    setProfile(e.target.value as MenuDocument["printProfile"])
                  }
                >
                  <option value="home">Home or restaurant printer</option>
                  <option value="press">Professional print shop</option>
                </select>
              </Field>
              <p className="md-help">
                {menu.printProfile === "press"
                  ? "Adds ⅛-inch artwork bleed and crop marks around the finished page. The PDF uses RGB color; confirm color requirements with your printer."
                  : "A finished-size PDF with generous margins. Print at 100% or Actual size for the intended type size."}
              </p>
              <div className="md-print-facts">
                <span>
                  <CheckCircle2 size={15} /> Embedded fonts & sharp text
                </span>
                <span>
                  <CheckCircle2 size={15} /> Dishes stay together on the page
                </span>
                <span>
                  <CheckCircle2 size={15} /> Photos checked at their printed
                  size
                </span>
              </div>
            </>
          ) : (
            <>
              {choosingAddress && (
                <Field label="Menu address">
                  <div className="md-address-input">
                    <span aria-hidden="true">/m/</span>
                    <input
                      value={address}
                      maxLength={60}
                      disabled={busy}
                      aria-describedby="md-address-help"
                      onChange={(e) =>
                        setAddress(
                          e.target.value.toLowerCase().replace(/\s+/g, "-"),
                        )
                      }
                    />
                  </div>
                  <small id="md-address-help" className="md-help">
                    {addressProblem ||
                      (addressState === "taken"
                        ? "That address is taken. Try another."
                        : addressState === "checking"
                          ? "Checking…"
                          : "Your QR code and link use this address. You can change it later; old links keep working.")}
                  </small>
                </Field>
              )}
              <ul className="md-change-list">
                {changes.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <p className="md-help">
                The menu link and QR code keep working when you publish an
                update. Previous publications are saved in your menu history.
              </p>
            </>
          )}
          {!!(exportNotes.length || proof?.warnings.length) && (
            <div className="md-print-notes">
              <strong>Print notes</strong>
              <ul>
                {(exportNotes.length ? exportNotes : proof?.warnings || []).map(
                  (note, i) => (
                    <li key={i}>{note}</li>
                  ),
                )}
              </ul>
            </div>
          )}
          {error && (
            <p className="md-inline-error" role="alert">
              {error}
            </p>
          )}
          {downloaded && (
            <p className="md-success-text" role="status">
              <Check size={16} /> PDF prepared. Print one copy to check the
              paper and color before a full run.
            </p>
          )}
          <button
            className="md-button md-full"
            disabled={
              busy ||
              !!blocking.length ||
              (isPrint
                ? !proof || proof.signature !== JSON.stringify(menu)
                : !!addressProblem || addressState === "taken")
            }
            onClick={() => void deliver()}
          >
            {isPrint && <Download size={17} />}
            {busy
              ? isPrint
                ? "Preparing PDF…"
                : "Publishing…"
              : isPrint
                ? downloaded
                  ? "Download PDF again"
                  : "Download PDF"
                : record.published
                  ? "Publish changes"
                  : "Publish menu"}
          </button>
          <button className="md-text-button" disabled={busy} onClick={close}>
            <ArrowLeft size={14} /> Keep editing
          </button>
        </div>
      </div>
    </MenuDialog>
  );
}

export function MenuShareDialog({
  record,
  restaurant,
  close,
  action,
}: {
  record: SavedMenu;
  restaurant: Row;
  close: () => void;
  action: (action: string) => Promise<void>;
}) {
  const [qr, setQr] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [checked, setChecked] = useState(false),
    [offline, setOffline] = useState(false),
    [main, setMain] = useState(record.isPrimary);
  useEffect(() => {
    let active = true;
    const link = `${location.origin}/m/${encodeURIComponent(restaurant.slug)}${main ? "" : `?menu=${record.id}`}`;
    void import("qrcode")
      .then(({ default: QR }) =>
        QR.toDataURL(link, {
          width: 1000,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#183e31", light: "#ffffff" },
        }),
      )
      .then((value) => {
        if (active) {
          setQr(value);
          setUrl(link);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "The QR code could not load. Try closing and reopening Share.",
          );
      });
    void fetch(
      `/api/public/${encodeURIComponent(restaurant.slug)}${main ? "" : `?menu=${record.id}`}`,
      { credentials: "omit", redirect: "error", cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw Error();
        const result = (await response.json()) as Row;
        if (!result.menu) throw Error();
        if (active) setChecked(true);
      })
      .catch(() => {
        if (active)
          setError(
            "Guest access could not be verified. Open the menu link before sharing or printing.",
          );
      });
    return () => {
      active = false;
    };
  }, [restaurant.slug, record.id, main]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const publishedRestaurant = record.published?.restaurant || restaurant;
  return (
    <MenuDialog
      title="Share your menu"
      description="Share your live menu. Your draft edits stay private."
      close={close}
    >
      <div className="md-share-status">
        <CheckCircle2 size={17} /> Published
        {checked && " · Guest access checked"}
      </div>
      <Field label="Link destination">
        <select
          value={main ? "main" : "this"}
          onChange={(e) => {
            setQr("");
            setUrl("");
            setChecked(false);
            setCopied(false);
            setMain(e.target.value === "main");
          }}
        >
          <option value="this">This menu · {record.draft.title}</option>
          <option value="main">Restaurant’s main menu</option>
        </select>
      </Field>
      <Field label="Guest menu link">
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
      </Field>
      <div className="md-dialog-actions">
        <button
          className="md-button"
          disabled={busy || !url}
          onClick={() =>
            void run(async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            })
          }
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          className="md-button md-secondary"
          href={url || undefined}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} /> Open menu
        </a>
      </div>
      <div className="md-share-qr">
        {qr ? (
          <img
            src={qr}
            alt="Scan to open the published menu"
            width={160}
            height={160}
          />
        ) : (
          <QrCode size={80} />
        )}
        <div>
          <h3>Menu QR code</h3>
          <p>Put a card at the table, by the register, or in a takeaway bag.</p>
          <button
            className="md-text-button"
            disabled={!qr || busy}
            onClick={() =>
              void run(async () => {
                const { menuQrCard } = await import("@/lib/qr-card");
                downloadBlob(
                  await menuQrCard(publishedRestaurant, url, qr),
                  `${restaurant.slug}-menu-card-4x6.pdf`,
                );
              })
            }
          >
            <Printer size={15} /> Download 4 × 6 table card
          </button>
          <button
            className="md-text-button"
            disabled={!qr || busy}
            onClick={() =>
              void run(async () =>
                downloadBlob(
                  await (await fetch(qr)).blob(),
                  `${restaurant.slug}-menu-qr.png`,
                ),
              )
            }
          >
            <Download size={15} /> Save QR image
          </button>
        </div>
      </div>
      <p className="md-help">
        {main
          ? "This QR follows your restaurant’s main menu. You can choose a new main menu without reprinting the code."
          : "This QR always opens this specific menu, including future published updates."}{" "}
        Keep the white border and scan a printed copy before putting it out.
      </p>
      {!record.isPrimary && (
        <button
          className="md-button md-secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await action("primary");
              setMain(true);
            })
          }
        >
          Make this my main menu
        </button>
      )}
      <details className="md-details">
        <summary>Menu visibility</summary>
        <p className="md-help">
          Take this menu offline while keeping its saved draft and publication
          history.
        </p>
        {offline ? (
          <div className="md-dialog-actions">
            <button
              className="md-button"
              disabled={busy}
              onClick={() => void run(() => action("unpublish"))}
            >
              Confirm take offline
            </button>
            <button
              className="md-text-button"
              onClick={() => setOffline(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="md-text-button md-danger"
            onClick={() => setOffline(true)}
          >
            Take menu offline
          </button>
        )}
      </details>
      {error && (
        <p className="md-inline-error" role="alert">
          {error}
        </p>
      )}
    </MenuDialog>
  );
}

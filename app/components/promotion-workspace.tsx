"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Download,
  Check,
  Copy,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CreativeHeader from "./creative-header";
import { draftStatus } from "@/lib/workspace-status";
import {
  api,
  downloadBlob,
  money,
  normalizePhoto,
  type Row,
} from "@/lib/client";
import {
  defaultStyle,
  localTime,
  localToInstant,
  offerTypes,
} from "@/lib/promotions";
import {
  exportFormats,
  offerBlob,
  renderOffer,
  type ExportFormat,
} from "@/lib/offer-export";

function comparable(value: unknown): string {
  return JSON.stringify(value, (k, v) =>
    k === "revision"
      ? undefined
      : v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((key) => [key, v[key]]),
          )
        : v,
  );
}
function sameContent(a: Row | null, b: Row | null) {
  return (
    comparable({ ...a, activeMs: 0 }) === comparable({ ...b, activeMs: 0 })
  );
}
class DraftSaveError extends Error {}

function initial(r: Row, seed: Row = {}) {
  let start = Date.now(),
    end = start + 4 * 3600000;
  const today = localTime(start, r.timezone).slice(0, 10);
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(today + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    const hours = r.hours?.find((h: Row) => h.day === date.getUTCDay());
    if (!hours || hours.closed) continue;
    const day = date.toISOString().slice(0, 10);
    if (hours.close <= hours.open) date.setUTCDate(date.getUTCDate() + 1);
    try {
      const opens = localToInstant(day + "T" + hours.open, r.timezone),
        closes = localToInstant(
          date.toISOString().slice(0, 10) + "T" + hours.close,
          r.timezone,
        );
      if (closes > start) {
        start = Math.max(start, opens);
        end = closes;
        break;
      }
    } catch {}
  }
  return {
    type: "special",
    title: "",
    description: "",
    price: 0,
    caption: "",
    startsLocal: localTime(start, r.timezone),
    endsLocal: localTime(end, r.timezone),
    occurrence: "earlier",
    items: [],
    style: { ...defaultStyle, ...r.style },
    useDefaults: true,
    editMode: "preserve",
    template: "classic",
    cropX: 50,
    cropY: 50,
    activeMs: 0,
    ...seed,
  };
}
export function OfferPreview({
  draft,
  restaurant,
  dishes,
  format,
  onChoosePhoto,
}: {
  draft: Row;
  restaurant: Row;
  dishes: Row[];
  format: ExportFormat;
  onChoosePhoto: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; error: string } | null>(
    null,
  );
  const previewKey = comparable({ draft, restaurant, dishes, format, attempt });
  const loading = result?.key !== previewKey;
  const error = !loading ? result?.error : "";
  const needsPhoto =
    error === "Choose a dish photo first." ||
    error?.startsWith("This photo is too small");
  useEffect(() => {
    let cancelled = false;
    const work = document.createElement("canvas");
    renderOffer(work, draft, restaurant, dishes, format)
      .then(() => {
        if (cancelled || !canvas.current) return;
        canvas.current.width = work.width;
        canvas.current.height = work.height;
        canvas.current.getContext("2d")!.drawImage(work, 0, 0);
        setResult({ key: previewKey, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setResult({ key: previewKey, error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [draft, restaurant, dishes, format, previewKey]);
  return (
    <div
      className={"offer-canvas " + (format === "story" ? "story-canvas" : "")}
      style={{
        aspectRatio: `${exportFormats[format].width} / ${exportFormats[format].height}`,
      }}
      aria-busy={loading}
      data-preview-error={!!result?.error}
    >
      <canvas
        ref={canvas}
        role="img"
        aria-hidden={loading || !!error}
        style={{ visibility: loading || error ? "hidden" : "visible" }}
        aria-label={`${exportFormats[format].label}: ${draft.title || "Draft special"}, ${money(draft.price, restaurant.currency)}`}
      />
      {loading && (
        <p className="promotion-preview-state" role="status">
          Preparing preview…
        </p>
      )}
      {error && (
        <div className="promotion-preview-state" role="alert">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={
              needsPhoto
                ? onChoosePhoto
                : () => setAttempt((value) => value + 1)
            }
          >
            {needsPhoto ? "Choose a photo" : "Retry preview"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PromotionWorkspace({
  state,
  refresh,
  active,
  seed,
  onSeedUsed,
}: {
  state: Row;
  refresh: () => Promise<void>;
  active: boolean;
  seed?: Row | null;
  onSeedUsed?: () => void;
}) {
  const [selected, setSelected] = useState<Row | null>(null),
    [form, setForm] = useState<Row | null>(null),
    [status, setStatus] = useState(""),
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [format, setFormat] = useState<ExportFormat>("feed"),
    [accurate, setAccurate] = useState(false),
    [revision, setRevision] = useState(""),
    [newDish, setNewDish] = useState<Row | null>(null),
    [recovery, setRecovery] = useState<Row | null>(null),
    [advice, setAdvice] = useState("");
  const saved = useRef<Row | null>(null),
    current = useRef<Row | null>(null),
    saving = useRef<Promise<Row> | null>(null),
    lastInput = useRef(0),
    actionLock = useRef(false),
    generationKey = useRef(""),
    seedUsed = useRef<Row | null>(null),
    saveFailed = useRef(false),
    offerHeading = useRef<HTMLHeadingElement>(null),
    photoHeading = useRef<HTMLHeadingElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  const r = state.restaurant;
  const recoveryKey = (id: string) => `menu-material-pending:${r.id}:${id}`;
  const update = (key: string, value: unknown) => {
    const next = { ...current.current!, [key]: value };
    current.current = next;
    setForm(next);
    setAccurate(false);
    setStatus(draftStatus.saving);
    setNotice("");
    lastInput.current = Date.now();
  };
  const persist = useCallback(async (): Promise<Row> => {
    while (saving.current) await saving.current;
    const previous = saved.current,
      draft = current.current;
    if (!previous || !draft) throw Error("Choose a promotion first.");
    if (comparable(draft) === comparable(previous.draft)) {
      saveFailed.current = false;
      setSaveError("");
      setStatus(draftStatus.saved);
      return previous;
    }
    if (!sameContent(draft, previous.draft)) setStatus(draftStatus.saving);
    const promise = api("promotions/" + previous.id, {
      ...draft,
      revision: previous.revision,
    });
    saving.current = promise;
    try {
      const data = await promise;
      saved.current = data.promotion;
      saveFailed.current = false;
      setSaveError("");
      const latestIsSaved = sameContent(current.current, draft);
      try {
        if (latestIsSaved) sessionStorage.removeItem(recoveryKey(previous.id));
        else
          sessionStorage.setItem(
            recoveryKey(previous.id),
            JSON.stringify({
              revision: data.promotion.revision,
              draft: current.current,
            }),
          );
      } catch {}
      setSelected(data.promotion);
      setStatus(latestIsSaved ? draftStatus.saved : draftStatus.saving);
      return data.promotion;
    } catch (error) {
      saveFailed.current = true;
      setStatus(draftStatus.failed);
      setSaveError((error as Error).message);
      throw new DraftSaveError((error as Error).message);
    } finally {
      saving.current = null;
    }
  }, [r.id]);
  useEffect(() => {
    if (!form) return;
    if (saved.current && comparable(form) !== comparable(saved.current.draft)) {
      try {
        sessionStorage.setItem(
          recoveryKey(saved.current.id),
          JSON.stringify({ revision: saved.current.revision, draft: form }),
        );
      } catch {}
    }
    const timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [form, persist]);
  useEffect(() => {
    if (!active || !form) return;
    const input = () => {
      lastInput.current = Date.now();
    };
    window.addEventListener("pointerdown", input);
    window.addEventListener("keydown", input);
    const interval = setInterval(() => {
      if (
        !document.hidden &&
        Date.now() - lastInput.current < 30000 &&
        !busy &&
        current.current
      )
        current.current = {
          ...current.current,
          activeMs: current.current.activeMs + 1000,
        };
    }, 1000);
    return () => {
      clearInterval(interval);
      window.removeEventListener("pointerdown", input);
      window.removeEventListener("keydown", input);
    };
  }, [active, !!form, busy]);
  useEffect(() => {
    const t = setInterval(() => {
      if (current.current && !saveFailed.current)
        void persist().catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [persist]);
  const action = async (label: string, fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof DraftSaveError)) setError((e as Error).message);
    } finally {
      setBusy("");
      actionLock.current = false;
    }
  };
  const open = async (p: Row) => {
    if (current.current) await persist();
    p = (await api("promotions/" + p.id)).promotion;
    let pending: Row | null = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(recoveryKey(p.id)) || "null");
    } catch {}
    const restored = pending?.revision === p.revision;
    saved.current = p;
    current.current = restored ? pending!.draft : p.draft;
    setSelected(p);
    setForm(current.current);
    setRecovery(pending && !restored ? pending.draft : null);
    setAccurate(false);
    setStatus(restored ? draftStatus.saving : draftStatus.saved);
    setSaveError("");
    saveFailed.current = false;
    setNotice("");
    setError("");
    history.replaceState(null, "", "#promotion/" + p.id);
  };
  const create = async (value: Row = {}) => {
    if (current.current) await persist();
    const data = await api("promotions", initial(r, value));
    await open(data.promotion);
    await refresh();
  };
  useEffect(() => {
    if (!active || selected) return;
    const id = location.hash.match(/^#promotion\/(.+)$/)?.[1];
    const p = state.promotions?.find((x: Row) => x.id === id);
    if (p)
      void Promise.resolve().then(() =>
        action("Opening campaign", () => open(p)),
      );
  }, [active, state.promotions]);
  useEffect(() => {
    if (seed && seedUsed.current !== seed) {
      seedUsed.current = seed;
      void action("Preparing suggestion", async () => {
        await create(seed);
        onSeedUsed?.();
      });
    }
  }, [seed]);
  const dishes: Row[] = state.dishes || [],
    assets: Row[] = state.assets || [];
  const selectedDish = form?.items[0]
    ? dishes.find((d) => d.id === form.items[0].dishId)
    : null;
  const selectedAsset = form?.items[0]
    ? assets.find((a) => a.id === form.items[0].photoId)
    : null;
  const selectedJob =
    selectedAsset?.kind === "generated"
      ? state.jobs.find((j: Row) =>
          state.outputs.some(
            (o: Row) => o.job_id === j.id && o.asset_id === selectedAsset.id,
          ),
        )
      : null;
  const originalId =
    selectedJob?.source_id ||
    assets.find((a) => a.dish_id === selectedDish?.id && a.kind === "source")
      ?.id;
  const jobs =
    state.jobs?.filter((j: Row) => j.dish_id === selectedDish?.id) || [];
  const latestJob = jobs[0];
  const generating = jobs.some((j: Row) =>
    ["queued", "processing"].includes(j.status),
  );
  const choose = (did: string) => {
    const dish = dishes.find((d) => d.id === did);
    if (!dish) return;
    const photo =
      assets.find(
        (a) =>
          a.dish_id === did &&
          a.approved_at &&
          ["source", "generated"].includes(a.kind),
      ) || assets.find((a) => a.dish_id === did && a.kind === "source");
    const next = {
      ...current.current!,
      items: [{ dishId: did, quantity: 1, photoId: photo?.id || null }],
      title: dish.name,
      description: dish.description.slice(0, 500),
      price: dish.price,
      caption: `${dish.name}. ${dish.description}`.slice(0, 2200),
    };
    current.current = next;
    setForm(next);
    setAccurate(false);
    setStatus(draftStatus.saving);
    setNotice("");
    generationKey.current = "";
  };
  async function upload(file: File, did: string) {
    const { photoAdvice } = await import("@/lib/photo-advice");
    setAdvice(await photoAdvice(file));
    const fd = new FormData();
    fd.set("file", file);
    fd.set("normalized", await normalizePhoto(file), "dish.jpg");
    fd.set("dishId", did);
    const a = await api("assets", fd);
    update(
      "items",
      current.current!.items.map((i: Row) =>
        i.dishId === did ? { ...i, photoId: a.id } : i,
      ),
    );
    await persist();
    await refresh();
  }
  const isApproved =
    !!selected?.approved_hash &&
    comparable({ ...form, activeMs: 0 }) ===
      comparable({ ...selected?.draft, activeMs: 0 });
  return (
    <section className="promotion-workspace">
      <CreativeHeader
        title="Campaigns"
        status={busy ? `${busy}…` : form ? status : undefined}
        action={
          <Button
            disabled={!!busy}
            onClick={() => action("Starting campaign", () => create())}
          >
            <Plus /> New campaign
          </Button>
        }
      />
      {error && (
        <p className="promotion-error" role="alert">
          {error}
        </p>
      )}
      {(state.promotions || []).length > 0 && (
        <div className="promotion-selection">
          <label className="field">
            Saved campaigns
            <select
              value={selected?.id || ""}
              disabled={!!busy}
              onChange={(event) => {
                const campaign = state.promotions.find(
                  (p: Row) => p.id === event.target.value,
                );
                if (campaign)
                  void action("Opening campaign", () => open(campaign));
              }}
            >
              <option value="" disabled>
                Choose a campaign
              </option>
              {state.promotions.map((p: Row) => (
                <option key={p.id} value={p.id}>
                  {(p.id === selected?.id ? form?.title : p.draft.title) ||
                    "Untitled special"}{" "}
                  · {p.status}
                </option>
              ))}
            </select>
          </label>
          {form && (
            <Button
              className="promotion-jump"
              variant="outline"
              onClick={() => {
                reviewHeading.current?.scrollIntoView({
                  block: "start",
                  behavior: "instant",
                });
                reviewHeading.current?.focus({ preventScroll: true });
              }}
            >
              Review package
            </Button>
          )}
        </div>
      )}
      {!form ? (
        <div className="cx-empty promotion-empty">
          <Sparkles />
          <h2>Make tonight’s special easy to share.</h2>
          <p>
            Start with a saved dish. Review a food photo, feed graphic, Story
            and counter sign, then publish to your menu.
          </p>
          <Button
            disabled={!!busy}
            onClick={() => action("Starting special", () => create())}
          >
            Create a special
          </Button>
        </div>
      ) : (
        <>
          {saveError && (
            <div
              className="promotion-save-error"
              data-pending={busy === "Saving draft"}
            >
              <p role={busy === "Saving draft" ? "status" : "alert"}>
                {busy === "Saving draft"
                  ? "Saving your latest changes…"
                  : `${saveError} Your edits are still in this form.`}
              </p>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  action("Saving draft", async () => {
                    await persist();
                  })
                }
              >
                {busy === "Saving draft" ? "Saving…" : "Retry save"}
              </Button>
            </div>
          )}
          {recovery && (
            <div className="notice" role="status">
              This browser has unsaved edits from an earlier version.{" "}
              <Button
                variant="outline"
                onClick={() => {
                  current.current = recovery;
                  setForm(recovery);
                  setRecovery(null);
                  setStatus(draftStatus.saving);
                  setNotice("");
                }}
              >
                Restore these edits for review
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRecovery(null);
                  sessionStorage.removeItem(recoveryKey(selected!.id));
                }}
              >
                Keep saved version
              </Button>
            </div>
          )}
          <div className="promotion-status" role="status">
            <span>
              {isApproved ? "Package approved" : "Package needs review"}
            </span>
            <span>
              {selected?.status || "Draft"} · {r.timezone}
            </span>
          </div>
          <fieldset className="promotion-fields" disabled={!!busy}>
            <legend className="sr-only">Campaign details and review</legend>
            <div className="promotion-grid">
              <div className="promotion-editor">
                <div className="panel">
                  <h2
                    ref={offerHeading}
                    tabIndex={-1}
                    className="promotion-section-title"
                  >
                    Your offer
                  </h2>
                  <label className="field">
                    What are you promoting?
                    <select
                      value={form.type}
                      onChange={(e) => update("type", e.target.value)}
                    >
                      {Object.entries(offerTypes).map(([v, label]) => (
                        <option value={v} key={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Dish
                    <select
                      aria-label="Dish"
                      value={form.items[0]?.dishId || ""}
                      onChange={(e) => choose(e.target.value)}
                    >
                      <option value="">Select a saved dish</option>
                      {dishes.map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.name}
                          {!d.available ? " · unavailable" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setNewDish({
                        name: "",
                        description: "",
                        category: "Dishes",
                        price: form.price / 100,
                        confirmed: false,
                      })
                    }
                  >
                    <Plus /> Add a new dish
                  </Button>
                  {newDish && (
                    <div className="inline-dish">
                      <label className="field">
                        Dish name
                        <input
                          value={newDish.name}
                          maxLength={100}
                          onChange={(e) =>
                            setNewDish({ ...newDish, name: e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        Dish description
                        <textarea
                          value={newDish.description}
                          maxLength={2000}
                          onChange={(e) =>
                            setNewDish({
                              ...newDish,
                              description: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Category
                        <input
                          value={newDish.category}
                          onChange={(e) =>
                            setNewDish({ ...newDish, category: e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        Menu price ({r.currency})
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newDish.price || 0}
                          onChange={(e) =>
                            setNewDish({
                              ...newDish,
                              price: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="check-label">
                        <input
                          type="checkbox"
                          checked={newDish.confirmed}
                          onChange={(e) =>
                            setNewDish({
                              ...newDish,
                              confirmed: e.target.checked,
                            })
                          }
                        />{" "}
                        These details match the dish we serve.
                      </label>
                      <div className="button-row">
                        <Button
                          disabled={!!busy || !newDish.confirmed}
                          onClick={() =>
                            action("Saving dish", async () => {
                              const d = await api("dishes", {
                                ...newDish,
                                price: newDish.price || 0,
                                setting: r.style.photoStyle,
                              });
                              const next = {
                                ...current.current!,
                                title: newDish.name,
                                price: Math.round((newDish.price || 0) * 100),
                                description: newDish.description.slice(0, 500),
                                items: [
                                  { dishId: d.id, quantity: 1, photoId: null },
                                ],
                              };
                              current.current = next;
                              setForm(next);
                              await persist();
                              setNewDish(null);
                              await refresh();
                            })
                          }
                        >
                          Save dish
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setNewDish(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {form.items.length > 0 && (
                    <div className="offer-items">
                      {form.items.map((item: Row, i: number) => (
                        <div key={item.dishId}>
                          <span>
                            {dishes.find((d) => d.id === item.dishId)?.name}
                          </span>
                          <label>
                            Quantity
                            <input
                              type="number"
                              aria-label={`Quantity for ${dishes.find((d) => d.id === item.dishId)?.name || "dish"}`}
                              min="1"
                              max="100"
                              value={item.quantity}
                              onChange={(e) =>
                                update(
                                  "items",
                                  form.items.map((x: Row, j: number) =>
                                    j === i
                                      ? {
                                          ...x,
                                          quantity: Number(e.target.value),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </label>
                          {i > 0 && (
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${dishes.find((d) => d.id === item.dishId)?.name || "dish"} from offer`}
                              onClick={() =>
                                update(
                                  "items",
                                  form.items.filter(
                                    (_: Row, j: number) => j !== i,
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.type !== "special" && form.items.length < 6 && (
                    <label className="field">
                      Add to this offer
                      <select
                        value=""
                        onChange={(e) => {
                          const d = dishes.find((d) => d.id === e.target.value);
                          if (d)
                            update("items", [
                              ...form.items,
                              {
                                dishId: d.id,
                                quantity: 1,
                                photoId:
                                  assets.find(
                                    (a) =>
                                      a.dish_id === d.id &&
                                      a.approved_at &&
                                      ["source", "generated"].includes(a.kind),
                                  )?.id || null,
                              },
                            ]);
                        }}
                      >
                        <option value="">Choose an approved dish</option>
                        {dishes
                          .filter(
                            (d) =>
                              !form.items.some((i: Row) => i.dishId === d.id) &&
                              assets.some(
                                (a) => a.dish_id === d.id && a.approved_at,
                              ),
                          )
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <label className="field">
                    Offer title
                    <input
                      value={form.title}
                      maxLength={90}
                      onChange={(e) => update("title", e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Offer price ({r.currency})
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price / 100}
                      onChange={(e) =>
                        update(
                          "price",
                          Math.round(Number(e.target.value) * 100),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Offer description
                    <textarea
                      rows={3}
                      value={form.description}
                      maxLength={500}
                      onChange={(e) => update("description", e.target.value)}
                    />
                  </label>
                  <div className="two-fields">
                    <label className="field">
                      Starts
                      <input
                        type="datetime-local"
                        value={form.startsLocal}
                        onChange={(e) => update("startsLocal", e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Ends
                      <input
                        type="datetime-local"
                        value={form.endsLocal}
                        onChange={(e) => update("endsLocal", e.target.value)}
                      />
                    </label>
                  </div>
                  <p className="fine">
                    Times are in {r.timezone}. Your special leaves the menu
                    automatically at the end time.
                  </p>
                  <details className="dish-options">
                    <summary>Clock-change timing</summary>
                    <label className="field">
                      If a time occurs twice
                      <select
                        value={form.occurrence}
                        onChange={(e) => update("occurrence", e.target.value)}
                      >
                        <option value="earlier">First occurrence</option>
                        <option value="later">Second occurrence</option>
                      </select>
                    </label>
                  </details>
                </div>
                {selectedDish && (
                  <div className="panel">
                    <h2
                      ref={photoHeading}
                      tabIndex={-1}
                      className="promotion-section-title"
                    >
                      Food photo
                    </h2>
                    <label className="field">
                      Fresh photo (optional)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/heic,.heic"
                        disabled={!!busy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f)
                            void action("Saving photo", () =>
                              upload(f, selectedDish.id),
                            );
                        }}
                      />
                    </label>
                    <p className="fine">
                      Your actual dish gives the best starting point. Show the
                      whole plate, shoot near a window and keep the phone
                      steady.
                    </p>
                    {advice && <p className="capture-advice">{advice}</p>}
                    <div className="comparison">
                      {originalId && (
                        <figure>
                          <img
                            src={"/api/assets/" + originalId}
                            alt="Original dish"
                          />
                          <figcaption>Original upload</figcaption>
                        </figure>
                      )}
                      {selectedAsset && (
                        <figure>
                          <img
                            src={"/api/assets/" + selectedAsset.id}
                            alt="Selected food image"
                          />
                          <figcaption>
                            {selectedAsset.kind === "generated"
                              ? selectedJob?.input_method === "description"
                                ? "Created from description"
                                : "AI edited photo"
                              : "Original photo"}
                            {selectedAsset.approved_at
                              ? " · Approved"
                              : " · Needs review"}
                          </figcaption>
                        </figure>
                      )}
                    </div>
                    <div className="photo-choices">
                      {assets
                        .filter(
                          (a) =>
                            a.dish_id === selectedDish.id &&
                            ["source", "generated"].includes(a.kind),
                        )
                        .map((a) => (
                          <button
                            title={
                              a.kind === "source"
                                ? "Original upload"
                                : "Generated version"
                            }
                            aria-label={"Select " + a.name}
                            className={
                              selectedAsset?.id === a.id ? "selected" : ""
                            }
                            key={a.id}
                            onClick={() =>
                              update(
                                "items",
                                form.items.map((i: Row, j: number) =>
                                  j === 0 ? { ...i, photoId: a.id } : i,
                                ),
                              )
                            }
                          >
                            <img src={"/api/assets/" + a.id} alt={a.name} />
                            {a.approved_at && <Check size={14} />}
                          </button>
                        ))}
                    </div>
                    <label className="field">
                      Editing approach
                      <select
                        value={form.editMode || "preserve"}
                        onChange={(e) => update("editMode", e.target.value)}
                      >
                        <option value="preserve">
                          Preserve my dish · light, color, surroundings
                        </option>
                        <option value="style">Style the surroundings</option>
                      </select>
                    </label>
                    <label className="field">
                      Targeted adjustment
                      <textarea
                        rows={2}
                        value={revision}
                        onChange={(e) => {
                          setRevision(e.target.value);
                          generationKey.current = "";
                        }}
                        placeholder="e.g. Soften the shadows; keep all 3 pieces and the tray"
                        maxLength={1000}
                      />
                    </label>
                    <p className="fine">
                      Must stay consistent:{" "}
                      {selectedDish.preserve ||
                        "Ingredients, count, portion, plating and packaging."}{" "}
                      Review remains essential; food changes are not reliably
                      detected automatically.
                    </p>
                    <Button
                      variant="outline"
                      disabled={!!busy || generating || !state.aiConnected}
                      onClick={() =>
                        action("Requesting photo options", async () => {
                          await persist();
                          generationKey.current ||= crypto.randomUUID();
                          await api("jobs", {
                            dishId: selectedDish.id,
                            sourceId: originalId || undefined,
                            parentId:
                              selectedAsset?.kind === "generated"
                                ? selectedAsset.id
                                : undefined,
                            revision,
                            style: form.style,
                            editMode: form.editMode || "preserve",
                            requestKey: generationKey.current,
                          });
                          generationKey.current = "";
                          await refresh();
                        })
                      }
                    >
                      <Sparkles />
                      {generating
                        ? "Creating photo options…"
                        : originalId
                          ? "Enhance photo · 1 image"
                          : "Create from description · 1 image"}
                    </Button>
                    {generating && (
                      <p role="status" className="fine">
                        Generation is in progress. Your offer is saved; you can
                        keep editing its price and caption.
                      </p>
                    )}
                    {latestJob &&
                      ["failed", "partial"].includes(latestJob.status) && (
                        <p className="capture-advice">
                          {latestJob.status === "partial"
                            ? "One option is ready; another failed. You can use the successful photo."
                            : "Photo creation failed. Your draft is saved. Try creating again."}
                        </p>
                      )}
                  </div>
                )}
                <details className="panel">
                  <summary>Style for this promotion</summary>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={form.useDefaults}
                      onChange={(e) => {
                        update("useDefaults", e.target.checked);
                        if (e.target.checked)
                          update("style", { ...defaultStyle, ...r.style });
                      }}
                    />{" "}
                    Use restaurant defaults
                  </label>
                  {!form.useDefaults && (
                    <>
                      <div className="two-fields">
                        {["primary", "accent"].map((k) => (
                          <label className="field" key={k}>
                            {k === "primary" ? "Brand color" : "Accent color"}
                            <input
                              type="color"
                              value={form.style[k]}
                              onChange={(e) =>
                                update("style", {
                                  ...form.style,
                                  [k]: e.target.value,
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <label className="field">
                        Photo style
                        <input
                          value={form.style.photoStyle}
                          onChange={(e) =>
                            update("style", {
                              ...form.style,
                              photoStyle: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        Caption tone
                        <input
                          value={form.style.tone}
                          onChange={(e) =>
                            update("style", {
                              ...form.style,
                              tone: e.target.value,
                            })
                          }
                        />
                      </label>
                    </>
                  )}
                  <label className="field">
                    Graphic template
                    <select
                      value={form.template}
                      onChange={(e) => update("template", e.target.value)}
                    >
                      <option value="classic">Classic · white space</option>
                      <option value="bold">Bold · brand color</option>
                    </select>
                  </label>
                </details>
              </div>
              <div className="promotion-preview-column">
                <div className="panel preview-panel">
                  <div className="promotion-review-heading">
                    <h2
                      ref={reviewHeading}
                      tabIndex={-1}
                      className="promotion-section-title"
                    >
                      Review your package
                    </h2>
                    <Button
                      className="promotion-jump"
                      variant="ghost"
                      onClick={() => {
                        offerHeading.current?.scrollIntoView({
                          block: "start",
                          behavior: "instant",
                        });
                        offerHeading.current?.focus({ preventScroll: true });
                      }}
                    >
                      Back to offer
                    </Button>
                  </div>
                  <label className="field">
                    Preview & download format
                    <select
                      value={format}
                      onChange={(event) =>
                        setFormat(event.target.value as ExportFormat)
                      }
                    >
                      {Object.entries(exportFormats).map(([value, option]) => (
                        <option value={value} key={value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <OfferPreview
                    draft={form}
                    restaurant={r}
                    dishes={dishes}
                    format={format}
                    onChoosePhoto={() => {
                      const heading =
                        photoHeading.current || offerHeading.current;
                      heading?.scrollIntoView({
                        block: "start",
                        behavior: "instant",
                      });
                      heading?.focus({ preventScroll: true });
                    }}
                  />
                  <details className="dish-options">
                    <summary>Adjust crop</summary>
                    {["cropX", "cropY"].map((k) => (
                      <label className="field" key={k}>
                        {k === "cropX"
                          ? "Horizontal position"
                          : "Vertical position"}
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={form[k]}
                          onChange={(e) => update(k, Number(e.target.value))}
                        />
                      </label>
                    ))}
                    <p className="fine">
                      Clean crops contain only the first selected dish’s photo.
                      Use the dish library for the other photos.
                    </p>
                    {format === "doordash" && (
                      <p className="fine">
                        Landscape, no text, no enlargement; under 2 MB. Keep the
                        full dish visible.{" "}
                        <a
                          href="https://help.doordash.com/en-us/merchants/article/common-rejection-reasons"
                          target="_blank"
                          rel="noreferrer"
                        >
                          DoorDash guidance
                        </a>{" "}
                        checked September 15, 2026. Acceptance is decided by
                        DoorDash.
                      </p>
                    )}
                  </details>
                  <label className="field">
                    Editable caption
                    <textarea
                      rows={5}
                      value={form.caption}
                      maxLength={2200}
                      onChange={(e) => update("caption", e.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    disabled={!!busy || !selectedDish || !state.aiConnected}
                    onClick={() =>
                      action("Writing caption", async () => {
                        const savedOffer = await persist();
                        const c = await api("captions/generate", {
                          promotionId: savedOffer.id,
                          dishId: selectedDish!.id,
                        });
                        update("caption", c.body);
                        await persist();
                      })
                    }
                  >
                    Suggest caption
                  </Button>
                  <div className="hosted-special-preview">
                    <span className="eyebrow">HOSTED MENU PREVIEW</span>
                    <div>
                      <strong>{form.title || "Your special"}</strong>
                      <b>{money(form.price, r.currency)}</b>
                    </div>
                    <p>{form.description}</p>
                    <small>
                      {form.items
                        .map(
                          (i: Row) =>
                            `${i.quantity} × ${dishes.find((d) => d.id === i.dishId)?.name || ""}`,
                        )
                        .join(" · ")}
                    </small>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={accurate}
                      onChange={(e) => setAccurate(e.target.checked)}
                    />{" "}
                    I checked the food, quantities, price, caption and times.
                  </label>
                  <Button
                    className="wide"
                    disabled={!!busy || !accurate || !form.items.length}
                    onClick={() =>
                      action("Approving package", async () => {
                        let p = await persist();
                        for (const i of form.items) {
                          const a = assets.find((x) => x.id === i.photoId);
                          if (!a) throw Error("Select a photo for each dish.");
                          if (!a.approved_at)
                            await api("assets/" + a.id + "/approve", {
                              accurate: true,
                            });
                        }
                        await api("promotions/" + p.id + "/approve", {
                          revision: p.revision,
                          accurate: true,
                        });
                        p = (await api("promotions/" + p.id)).promotion;
                        saved.current = p;
                        setSelected(p);
                        setStatus(draftStatus.saved);
                        await refresh();
                      })
                    }
                  >
                    <Check /> Approve package
                  </Button>
                  <div className="button-row package-actions">
                    <Button
                      variant="outline"
                      disabled={!!busy || !isApproved}
                      onClick={() =>
                        action("Preparing download", async () => {
                          const savedOffer = await persist();
                          const p = (await api("promotions/" + savedOffer.id))
                            .promotion;
                          if (!p.approved_hash)
                            throw Error("Approve the updated package first.");
                          const c = document.createElement("canvas");
                          await renderOffer(c, p.draft, r, dishes, format);
                          const blob = await offerBlob(c, format);
                          downloadBlob(
                            blob,
                            `${p.draft.title.replace(/[^a-z0-9]/gi, "-").slice(0, 50)}-${format}.${blob.type === "image/png" ? "png" : "jpg"}`,
                          );
                          await api("promotions/" + p.id + "/export", {
                            revision: p.revision,
                            format,
                          });
                          setNotice(
                            "Download started. This does not publish your campaign.",
                          );
                        })
                      }
                    >
                      <Download /> Download{" "}
                      {format === "sign"
                        ? "sign"
                        : format === "clean"
                          ? "photo"
                          : format}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!!busy || !isApproved}
                      onClick={() =>
                        action("Copying caption", async () => {
                          const p = await persist();
                          await navigator.clipboard.writeText(p.draft.caption);
                          await api("promotions/" + p.id + "/copy-caption", {
                            revision: p.revision,
                          });
                          setNotice("Caption copied.");
                        })
                      }
                    >
                      <Copy /> Copy caption
                    </Button>
                  </div>
                  <Button
                    className="wide"
                    variant="outline"
                    disabled={!!busy || !isApproved}
                    onClick={() =>
                      action("Publishing to your menu", async () => {
                        const p = await persist();
                        await api("promotions/" + p.id + "/publish", {
                          revision: p.revision,
                        });
                        const latest = (await api("promotions/" + p.id))
                          .promotion;
                        saved.current = latest;
                        setSelected(latest);
                        await refresh();
                        setStatus(draftStatus.saved);
                      })
                    }
                  >
                    Publish special to hosted menu
                  </Button>
                  <p className="promotion-action-feedback" role="status">
                    {busy || notice}
                  </p>
                  <p className="fine">
                    Downloads and copied captions are ready to share yourself.
                    Only “Publish special” puts this offer on your hosted menu.
                  </p>
                  {selected?.published && (
                    <div className="button-row">
                      <Button
                        variant="outline"
                        onClick={() =>
                          action("Marking sold out", async () => {
                            await api(
                              "promotions/" + selected.id + "/sold-out",
                              {},
                            );
                            await open(
                              (await api("promotions/" + selected.id))
                                .promotion,
                            );
                            await refresh();
                          })
                        }
                      >
                        Sold out
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          action("Unpublishing special", async () => {
                            await api(
                              "promotions/" + selected.id + "/unpublish",
                              {},
                            );
                            await open(
                              (await api("promotions/" + selected.id))
                                .promotion,
                            );
                            await refresh();
                          })
                        }
                      >
                        Unpublish
                      </Button>
                    </div>
                  )}
                  {r.published && (
                    <Button asChild variant="ghost">
                      <a href={"/m/" + r.slug} target="_blank" rel="noreferrer">
                        <ExternalLink size={16} /> Open hosted menu
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </fieldset>
        </>
      )}
    </section>
  );
}

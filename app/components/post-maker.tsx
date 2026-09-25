"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  ImagePlus,
  Check,
  ChevronDown,
  Download,
} from "lucide-react";
import { api, downloadBlob, type Row } from "@/lib/client";
import {
  isPlaceholderRestaurantName,
  restaurantNameMessage,
} from "@/lib/restaurant-identity";
import { workspacePreferenceKey } from "@/lib/workspace-navigation";
import { brandPostFields, brandTypefaces } from "@/lib/restaurant-look";
import {
  preferredPhoto,
  dishPhotos,
  dishSnapshot,
  changedDishFacts,
} from "@/lib/dish-library";
import {
  captionPlaceholder,
  currentCaption,
  postCaption,
  postDefaults,
  postDetailError,
  postFromPhoto,
  postPhotoError,
  updatePost,
} from "@/lib/post-flow";
import {
  postTemplates,
  applyPostTemplate,
  ownerChoices,
} from "@/lib/post-templates";
import {
  carouselSlides,
  postSize,
  postSlideCount,
  recommendedDesigns,
} from "@/lib/post-composition";
import { campaignZip, renderPost } from "@/lib/creation-export";
import { postShape } from "@/lib/sharing";
import { emptyAdjustments } from "@/lib/studio";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CropControls,
  Feedback,
  Field,
  DraftRecovery,
  SavedDrafts,
  track,
  useAction,
  useCreationDraft,
} from "./creation-shared";
import CreativeHeader from "./creative-header";
import WorkspaceActionBar from "./workspace-action-bar";
import WorkspaceControls from "./workspace-controls";
import WorkspaceTabs from "./workspace-tabs";
import PostSharing from "./post-sharing";
import { PostCanvas } from "./post-canvas";
export { PostCanvas } from "./post-canvas";
const initial = (restaurant: Row, version = 1) => ({
  step: 1,
  compositionVersion: version,
  items: [],
  occasion: "showcase",
  title: "",
  description: "",
  price: "",
  showPrice: false,
  validity: "",
  template: "chef",
  kicker: "",
  cta: "",
  textMode: "minimal",
  showBrand: true,
  textPlacement: "auto",
  channels: ["feed", "story"],
  feedShape: "4:5",
  // A carousel opens on its offer; without a cover, the first slide carries it.
  carouselCover: true,
  layouts: Object.fromEntries(
    ["feed", "story", "carousel"].map((k) => [
      k,
      { ...emptyAdjustments, fit: false, autoFrame: true },
    ]),
  ),
  caption: "",
  captionMode: "auto",
  reviewed: false,
  voice: restaurant.style?.tone || "Warm and welcoming",
  ...brandPostFields(restaurant.style),
  typography: "template",
});
export default function PostMaker({
  state,
  refresh,
  active = true,
  seed,
  onSeedUsed,
  onPhoto,
}: {
  state: Row;
  refresh?: () => Promise<void>;
  active?: boolean;
  seed: Row | null;
  onSeedUsed: () => void;
  onPhoto: () => void;
}) {
  const store = useCreationDraft(
    "post",
    initial(state.restaurant),
    workspacePreferenceKey(state.user.id, state.restaurant.id),
  );
  const { draft: b, change, save, start, ready, status } = store;
  const action = useAction();
  const { act, busy } = action;
  const [photoIndex, setPhotoIndex] = useState(0),
    [panel, setPanel] = useState("details"),
    [picker, setPicker] = useState(false),
    [query, setQuery] = useState(""),
    [versions, setVersions] = useState<Record<string, string>>({}),
    [moreDesigns, setMoreDesigns] = useState(false),
    [desiredChannel, setChannel] = useState("feed"),
    [desiredSlide, setSlide] = useState(0),
    [exporting, setExporting] = useState(false),
    [issues, setIssues] = useState<string[]>([]),
    [proofIssues, setProofIssues] = useState<string[]>([]),
    [restaurantName, setRestaurantName] = useState(""),
    [mobileControls, setMobileControls] = useState(false);
  const handled = useRef("");
  const controlsTrigger = useRef<HTMLButtonElement>(null);
  const items: Row[] = b.items || [];
  // Automatic checks before sharing; they replace an "I checked" box.
  const namePlaceholder = isPlaceholderRestaurantName(state.restaurant.name);
  const captionName = captionPlaceholder(b.caption || "");
  const postChecks = [
    ...(namePlaceholder ? [restaurantNameMessage] : []),
    ...(captionName && !namePlaceholder
      ? [
          `Your caption still says “${captionName}”. Change it to your restaurant’s name.`,
        ]
      : []),
    ...(b.showPrice && (b.price === "" || Number(b.price) <= 0)
      ? ["Add the price, or turn off Show price."]
      : []),
  ];
  const postReady = !postChecks.length;
  const approved: Row[] = state.dishes
    .filter((d: Row) => !d.archived_at)
    .map((d: Row) => ({ ...d, photo: preferredPhoto(d, state.assets) }))
    .filter((d: Row) => d.photo?.approved_at);
  // Approved versions, leaving out any reported as "Something changed in my food".
  const photoChoices = (d: Row) =>
    dishPhotos(d, state.assets).filter(
      (a) => a.approved_at && !a.needs_correction,
    );
  const photoProblem = postPhotoError(b, state.assets);
  const stale = items.filter((item) => {
    const d = state.dishes.find((d: Row) => d.id === item.dishId);
    return d && changedDishFacts(item.facts, d).length;
  });
  const availableChannels = [
    "feed",
    "story",
    ...(items.length > 1 ? ["carousel"] : []),
  ];
  const channel = availableChannels.includes(desiredChannel)
    ? desiredChannel
    : "feed";
  const slide = Math.min(
    desiredSlide,
    Math.max(0, postSlideCount(b, channel) - 1),
  );
  const slides = carouselSlides(b);
  const selectedSlide = channel === "carousel" ? slides[slide] : null;
  const selectedItem =
    selectedSlide?.kind === "dish"
      ? selectedSlide.items[0]
      : items[Math.min(photoIndex, items.length - 1)];
  function update(p: Row) {
    change(updatePost(b, p, state.restaurant));
  }
  function updateItem(index: number, p: Row) {
    update({
      items: items.map((item, i) => (i === index ? { ...item, ...p } : item)),
    });
  }
  function applyDesign(id: string) {
    const patch = applyPostTemplate({ ...b, compositionVersion: 2 }, id);
    update({ ...patch, compositionVersion: 2 });
  }
  useEffect(() => {
    if (!ready || !seed || handled.current === seed.token) return;
    handled.current = seed.token;
    void act("Opening post", async () => {
      if (seed.draftId) await store.resume(seed.draftId);
      else {
        const d = state.dishes.find((d: Row) => d.id === seed.dishId),
          a = state.assets.find(
            (a: Row) =>
              a.id === seed.photoId &&
              a.approved_at &&
              !a.needs_correction &&
              a.dish_id === d?.id,
          );
        if (d && a) {
          const draft = {
            ...postFromPhoto(
              initial(state.restaurant, 2),
              d,
              a,
              state.restaurant,
              true,
            ),
            ...(seed.occasion ? { occasion: seed.occasion } : {}),
          };
          // Open on the design made for this dish, not a fixed default.
          const lead = recommendedDesigns(draft, state.restaurant)[0];
          await start({
            ...draft,
            ...applyPostTemplate(draft, lead),
            compositionVersion: 2,
          });
          track("photo_reused", a.id, { dishId: d.id, destination: "post" });
        }
      }
      setPanel("design");
      onSeedUsed();
    });
  }, [ready, seed]);
  // An automatic caption follows the restaurant, such as a name that
  // replaced "Your restaurant".
  useEffect(() => {
    if (ready) change(currentCaption(store.read(), state.restaurant));
  }, [ready, store.id, state.restaurant.name, state.restaurant.currency]);
  function choose(d: Row) {
    if (items.length >= 6 && !items.some((i) => i.dishId === d.id)) {
      action.setError("Choose up to six photos. Remove one to add another.");
      return;
    }
    const a = photoChoices(d).find((a) => a.id === versions[d.id]) || d.photo;
    const existing = items.findIndex((i) => i.dishId === d.id);
    if (existing >= 0) {
      updateItem(existing, { photoId: a.id });
      setPicker(false);
      return;
    }
    if (items.some((i) => i.photoId === a.id)) {
      setPicker(false);
      return;
    }
    const first = !items.length;
    const item = {
      key: crypto.randomUUID(),
      dishId: d.id,
      photoId: a.id,
      name: d.name,
      category: d.category,
      quantity: 1,
      facts: dishSnapshot(d),
    };
    const lead = first
      ? recommendedDesigns({ ...b, items: [item] }, state.restaurant)[0]
      : "";
    const words = postDefaults([item]);
    // Later dishes update the words the owner hasn't changed (see updatePost).
    update({
      items: [...items, item],
      ...(first
        ? {
            ...applyPostTemplate({ ...b, items: [item], ...words }, lead),
            compositionVersion: 2,
            ...words,
            captionMode: "auto",
          }
        : {}),
      channels: items.length
        ? [...new Set([...b.channels, "carousel"])]
        : b.channels,
    });
    setPicker(false);
    setPanel(first ? "design" : "details");
  }
  function refreshFacts() {
    const next = items.map((i) => {
      const d = state.dishes.find((d: Row) => d.id === i.dishId);
      return d
        ? { ...i, name: d.name, category: d.category, facts: dishSnapshot(d) }
        : i;
    });
    // A headline, description or price the owner hasn't changed follows the dish.
    update({ items: next, factsReviewed: true });
  }
  async function caption(mode = "draft") {
    const data = await api("post-caption", {
      dishIds: [...new Set(items.map((i) => i.dishId))],
      quantities: items.map((i) => ({
        dishId: i.dishId,
        quantity: i.quantity,
      })),
      title: b.title,
      description: b.description || "",
      price: b.showPrice ? b.price : null,
      validity: b.validity || "",
      occasion: b.occasion,
      voice: b.voice || state.restaurant.style?.tone || "Warm and welcoming",
      mode,
      caption: b.caption || "",
    });
    update({ caption: data.body, captionMode: "custom" });
  }
  async function openExport() {
    const error = postDetailError(b, state.assets);
    if (error) throw Error(error);
    if (!b.channels.length) throw Error("Choose at least one format.");
    if (stale.length)
      throw Error("Review the changed dish details before exporting.");
    if (b.captionNeedsReview)
      throw Error("Review your caption after the details changed.");
    // Group identical notes so each reads once: "Post and Story: …".
    const warnings = new Map<string, string[]>();
    for (const format of b.channels)
      for (let n = 0; n < postSlideCount(b, format); n++) {
        const result = await renderPost(
          document.createElement("canvas"),
          b,
          state.restaurant,
          format,
          n,
          { scale: 0.25 },
        );
        const label =
          format === "feed"
            ? "Post"
            : format === "story"
              ? "Story"
              : `Carousel slide ${n + 1}`;
        for (const w of result.warnings)
          warnings.set(w, [...(warnings.get(w) || []), label]);
      }
    const list = new Intl.ListFormat("en", { type: "conjunction" });
    setProofIssues(
      [...warnings].map(
        ([w, labels]) => `${list.format([...new Set(labels)])}: ${w}`,
      ),
    );
    change({ reviewed: false });
    await save();
    setExporting(true);
  }
  if (!ready) return <DraftRecovery store={store} title="Post Maker" />;
  const candidates = moreDesigns
    ? postTemplates
    : recommendedDesigns(b, state.restaurant).map((id) =>
        postTemplates.find((t) => t.id === id)!,
      );
  const editingIndex = selectedItem ? items.indexOf(selectedItem) : 0;
  // A carousel's cover frames its photos apart from their own dish slides.
  const frame = selectedSlide?.kind === "cover" ? "cover" : channel;
  const edits = {
    ...emptyAdjustments,
    fit: true,
    ...b.layouts?.[channel],
    ...selectedItem?.layouts?.[frame],
  };
  return (
    <section className="mm-workspace mm-post-workspace" data-action-layout>
      <CreativeHeader
        title="Post Maker"
        status={status}
        action={
          items.length ? (
            <WorkspaceActionBar>
              <button
                className="cx-btn"
                disabled={!!busy}
                onClick={() => act("Checking your formats", openExport)}
              >
                {busy === "Checking your formats"
                  ? "Checking…"
                  : "Review & export"}
                <Download size={16} />
              </button>
            </WorkspaceActionBar>
          ) : undefined
        }
      >
        <SavedDrafts kind="post" store={store} disabled={!!busy} />
        <button
          className="cx-link"
          disabled={!!busy}
          onClick={() =>
            act("Starting post", async () => {
              await start(initial(state.restaurant, 2));
              setPanel("details");
              setSlide(0);
            })
          }
        >
          <Plus size={16} />
          New
        </button>
      </CreativeHeader>
      <DraftRecovery store={store} />
      <Feedback {...action} />
      {stale.length > 0 && (
        <div className="mm-fact-notice">
          <strong>
            Dish details changed: {stale.map((i) => i.name).join(", ")}.
          </strong>
          <p>
            Review the latest names, prices, and availability before using this
            design.
          </p>
          <button className="cx-link" onClick={refreshFacts}>
            Use latest dish details
          </button>
        </div>
      )}
      {items.length > 0 && photoProblem && (
        <div className="mm-fact-notice">
          <strong>{photoProblem}</strong>
          <button className="cx-link" onClick={() => setPicker(true)}>
            Choose a photo
          </button>
        </div>
      )}
      {!items.length ? (
        <div className="mm-post-start">
          <div>
            <span className="mm-kicker">Make something worth sharing</span>
            <h2>
              Start with a dish.
              <br />
              We’ll bring the design.
            </h2>
            <p className="mm-muted">
              Your approved photo, your restaurant’s look, and a matching post
              and Story.
            </p>
            <div className="mm-post-start-actions">
              <button className="cx-btn" onClick={() => setPicker(true)}>
                <ImagePlus size={18} />
                Choose a dish
              </button>
              {!approved.length && (
                <button className="cx-link" onClick={onPhoto}>
                  Prepare a photo in Photo Studio
                </button>
              )}
            </div>
          </div>
          <div className="mm-start-photos">
            {approved.slice(0, 3).map((d) => (
              <button key={d.id} onClick={() => choose(d)}>
                <img src={`/api/assets/${d.photo.id}`} alt={d.name} />
                <span>{d.name}</span>
              </button>
            ))}
            {!approved.length && (
              <div className="mm-start-empty">
                <ImagePlus size={54} />
                <p>Your approved dishes will appear here.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mm-editor-grid">
            <div className="mm-stage">
              <div className="mm-stage-toolbar">
                <div
                  className="mm-segments"
                  role="group"
                  aria-label="Preview format"
                >
                  {availableChannels.map((c) => (
                    <button
                      key={c}
                      aria-pressed={channel === c}
                      onClick={() => {
                        setChannel(c);
                        setSlide(0);
                      }}
                    >
                      {c === "feed"
                        ? "Post"
                        : c === "story"
                          ? "Story"
                          : "Carousel"}
                    </button>
                  ))}
                </div>
                <button
                  ref={controlsTrigger}
                  className="cx-link mm-mobile-edit"
                  aria-haspopup="dialog"
                  aria-expanded={mobileControls}
                  onClick={() => setMobileControls(!mobileControls)}
                >
                  {mobileControls ? "Close edits" : "Edit design"}
                </button>
                <span className="mm-muted">
                  {postSize(b, channel).width} × {postSize(b, channel).height}
                </span>
              </div>
              <div
                className={`mm-main-canvas ${channel === "story" ? "is-story" : channel === "feed" && postShape(b) === "3:4" ? "is-tall" : ""}`}
              >
                <PostCanvas
                  draft={b}
                  restaurant={state.restaurant}
                  channel={channel}
                  slide={slide}
                  onQuality={setIssues}
                />
              </div>
              {channel === "carousel" && (
                <div className="mm-slide-strip" aria-label="Carousel slides">
                  {slides.map((s, i) => (
                    <button
                      key={s.key + i}
                      aria-pressed={slide === i}
                      onClick={() => setSlide(i)}
                    >
                      <span>{i + 1}</span>
                      {s.kind === "cover"
                        ? "Cover"
                        : s.kind === "closing"
                          ? "Closing"
                          : s.title}
                    </button>
                  ))}
                </div>
              )}
              {issues.length > 0 && (
                <div className="mm-output-notes" role="status">
                  {issues.map((i) => (
                    <p key={i}>{i}</p>
                  ))}
                </div>
              )}
              <div className="mm-recommendation-heading">
                <span>Made for your dish</span>
                <button
                  className="cx-link"
                  onClick={() => setMoreDesigns(!moreDesigns)}
                >
                  {moreDesigns ? "Recommended" : "More designs"}
                  <ChevronDown size={14} />
                </button>
              </div>
              <div
                className={`mm-design-strip ${moreDesigns ? "expanded" : ""}`}
              >
                {candidates.map((t) => (
                  <button
                    key={t.id}
                    className="mm-design-choice"
                    aria-pressed={b.template === t.id}
                    onClick={() => applyDesign(t.id)}
                  >
                    <PostCanvas
                      thumbnail
                      draft={{
                        ...b,
                        ...applyPostTemplate(
                          { ...b, compositionVersion: 2 },
                          t.id,
                        ),
                        compositionVersion: 2,
                      }}
                      restaurant={state.restaurant}
                      channel="feed"
                    />
                    <span>
                      {t.name}
                      {b.template === t.id && <Check size={14} />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <WorkspaceControls
              className="mm-inspector"
              active={active}
              returnFocusRef={controlsTrigger}
              open={mobileControls}
              onOpenChange={setMobileControls}
              title="Edit post"
            >
              <WorkspaceTabs
                value={panel}
                onValueChange={setPanel}
                label="Edit post"
                options={["details", "design", "photo", "caption"].map((p) => ({
                  value: p,
                  label: p[0].toUpperCase() + p.slice(1),
                }))}
              >
                {panel === "details" && (
                  <>
                    <Field label="Purpose">
                      <select
                        value={b.occasion}
                        onChange={(e) => update({ occasion: e.target.value })}
                      >
                        <option value="showcase">Showcase a dish</option>
                        <option value="special">Today’s special</option>
                        <option value="combo">Meal or offer</option>
                        <option value="event">Event</option>
                      </select>
                    </Field>
                    <div className="mm-post-items">
                      {items.map((i, index) => (
                        <div key={i.key || i.photoId} className="mm-post-item">
                          <img src={`/api/assets/${i.photoId}`} alt={i.name} />
                          <div>
                            <b>{i.name}</b>
                            {b.occasion === "combo" && (
                              <input
                                aria-label={`Quantity of ${i.name}`}
                                type="number"
                                min="1"
                                max="100"
                                value={i.quantity}
                                onChange={(e) =>
                                  updateItem(index, {
                                    quantity: Number(e.target.value),
                                  })
                                }
                              />
                            )}
                            <div className="mm-inline">
                              <button
                                className="cx-link cx-icon"
                                aria-label={`Move ${i.name} earlier`}
                                disabled={!index}
                                onClick={() => {
                                  const next = [...items];
                                  [next[index - 1], next[index]] = [
                                    next[index],
                                    next[index - 1],
                                  ];
                                  update({ items: next });
                                }}
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                className="cx-link cx-icon"
                                aria-label={`Move ${i.name} later`}
                                disabled={index === items.length - 1}
                                onClick={() => {
                                  const next = [...items];
                                  [next[index + 1], next[index]] = [
                                    next[index],
                                    next[index + 1],
                                  ];
                                  update({ items: next });
                                }}
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                className="cx-link cx-icon cx-danger"
                                aria-label={`Remove ${i.name}`}
                                onClick={() =>
                                  update({
                                    items: items.filter((_, n) => n !== index),
                                  })
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="cx-link"
                      disabled={items.length >= 6}
                      onClick={() => setPicker(true)}
                    >
                      <Plus size={15} />
                      Add another photo {items.length >= 6 ? "· limit 6" : ""}
                    </button>
                    <Field label="Headline">
                      <textarea
                        rows={2}
                        value={b.title}
                        maxLength={90}
                        onChange={(e) => update({ title: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Description"
                      hint={
                        b.textMode === "full"
                          ? "In your caption, and on the image while Design includes a short description."
                          : "In your caption. Design can also show it on the image."
                      }
                    >
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={b.description}
                        onChange={(e) =>
                          update({ description: e.target.value })
                        }
                      />
                    </Field>
                    <label className="cx-check">
                      <input
                        type="checkbox"
                        checked={b.showPrice}
                        onChange={(e) =>
                          update({ showPrice: e.target.checked })
                        }
                      />
                      Show {b.occasion === "combo" ? "offer " : ""}price
                    </label>
                    {b.showPrice && (
                      <Field label={`Price (${state.restaurant.currency})`}>
                        <input
                          type="number"
                          min="0"
                          step=".01"
                          value={b.price}
                          onChange={(e) => update({ price: e.target.value })}
                        />
                      </Field>
                    )}
                    <Field
                      label={
                        b.occasion === "event"
                          ? "Event date & time"
                          : "Date or availability (optional)"
                      }
                    >
                      <input
                        value={b.validity}
                        maxLength={100}
                        onChange={(e) => update({ validity: e.target.value })}
                      />
                    </Field>
                    {items.length > 1 && (
                      <details className="mm-divider">
                        <summary>Carousel structure</summary>
                        <label className="cx-check">
                          <input
                            type="checkbox"
                            checked={!!b.carouselCover}
                            onChange={(e) =>
                              update({ carouselCover: e.target.checked })
                            }
                          />
                          Start with a cover
                        </label>
                        <Field label="Closing invitation (optional)">
                          <input
                            maxLength={90}
                            value={b.carouselClosing || ""}
                            onChange={(e) =>
                              update({ carouselClosing: e.target.value })
                            }
                          />
                        </Field>
                        <p className="mm-muted">
                          Each dish gets its own slide. Without a cover, the
                          first slide shows the price, date and call to action.
                          Select a slide to edit its headline and framing.
                        </p>
                      </details>
                    )}
                  </>
                )}
                {panel === "design" && (
                  <>
                    <h2>Design</h2>
                    <p className="mm-muted">
                      Your restaurant colors carry through each design. The
                      photo and layout adapt to each format.
                    </p>
                    {b.compositionVersion !== 2 ? (
                      // Older designs render at 4:5 only; the improved one offers 3:4.
                      <button
                        className="cx-btn cx-secondary"
                        onClick={() => applyDesign(b.template)}
                      >
                        Use the improved composition
                      </button>
                    ) : (
                      <div className="cx-field">
                        <span id="post-shape-label">Post shape</span>
                        <div
                          className="mm-segments"
                          role="group"
                          aria-labelledby="post-shape-label"
                        >
                          {[
                            ["4:5", "Portrait 4:5"],
                            ["3:4", "Tall 3:4"],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              aria-pressed={(b.feedShape || "4:5") === value}
                              onClick={() => {
                                update({ feedShape: value });
                                setChannel("feed");
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <small>
                          Tall 3:4 fills Instagram’s profile grid. Stories stay
                          9:16 and carousels 4:5.
                        </small>
                      </div>
                    )}
                    <Field label="Text on the image">
                      <select
                        value={b.textMode || "minimal"}
                        onChange={(e) =>
                          update({
                            textMode: e.target.value,
                            chosen: [
                              ...new Set([...ownerChoices(b), "textMode"]),
                            ],
                          })
                        }
                      >
                        <option value="photo">Photo only</option>
                        <option value="minimal">Headline & essentials</option>
                        <option value="full">
                          Include a short description
                        </option>
                      </select>
                    </Field>
                    <label className="cx-check">
                      <input
                        type="checkbox"
                        checked={b.showBrand ?? true}
                        onChange={(e) =>
                          update({
                            showBrand: e.target.checked,
                            chosen: [
                              ...new Set([...ownerChoices(b), "showBrand"]),
                            ],
                          })
                        }
                      />
                      Restaurant name & logo
                    </label>
                    {["editorial", "afterdark"].includes(b.template) && (
                      <Field label="Text placement">
                        <select
                          value={b.textPlacement || "auto"}
                          onChange={(e) =>
                            update({
                              textPlacement: e.target.value,
                              compositionVersion: 2,
                            })
                          }
                        >
                          <option value="auto">Designed placement</option>
                          <option value="top">At the top</option>
                          <option value="bottom">At the bottom</option>
                        </select>
                      </Field>
                    )}
                    <Field label="Small heading (optional)">
                      <input
                        value={b.kicker || ""}
                        maxLength={45}
                        onChange={(e) => update({ kicker: e.target.value })}
                      />
                    </Field>
                    <Field label="Call to action (optional)">
                      <input
                        value={b.cta || ""}
                        maxLength={80}
                        onChange={(e) => update({ cta: e.target.value })}
                      />
                    </Field>
                    <details className="mm-divider">
                      <summary>Fine-tune this design</summary>
                      <Field label="Brand color">
                        <input
                          type="color"
                          value={b.color}
                          onChange={(e) =>
                            update({
                              color: e.target.value,
                              brandMode: "custom",
                            })
                          }
                        />
                      </Field>
                      <Field label="Accent color">
                        <input
                          type="color"
                          value={b.accent}
                          onChange={(e) =>
                            update({
                              accent: e.target.value,
                              brandMode: "custom",
                            })
                          }
                        />
                      </Field>
                      <Field label="Typography">
                        <select
                          value={b.typography || "template"}
                          onChange={(e) =>
                            update({ typography: e.target.value })
                          }
                        >
                          <option value="template">
                            This design’s typography
                          </option>
                          {brandTypefaces.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <button
                        className="cx-link"
                        onClick={() =>
                          update({
                            ...brandPostFields(state.restaurant.style),
                            voice:
                              state.restaurant.style?.tone ||
                              "Warm and welcoming",
                          })
                        }
                      >
                        Apply current restaurant look
                      </button>
                    </details>
                  </>
                )}
                {panel === "photo" && (
                  <>
                    <h2>
                      {selectedSlide?.kind === "dish"
                        ? selectedItem.name
                        : selectedSlide?.kind === "cover"
                          ? "Cover framing"
                          : selectedSlide?.kind === "closing"
                            ? "Closing slide"
                            : "Photo framing"}
                    </h2>
                    {items.length > 1 &&
                      (channel !== "carousel" ||
                        selectedSlide?.kind === "cover") && (
                        <Field label="Photo to adjust">
                          <select
                            value={editingIndex}
                            onChange={(e) => {
                              setPhotoIndex(Number(e.target.value));
                            }}
                          >
                            {items.map((i, n) => (
                              <option key={i.photoId} value={n}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    {selectedSlide?.kind === "dish" && (
                      <Field label="Slide headline">
                        <input
                          value={selectedItem.headline ?? selectedItem.name}
                          maxLength={90}
                          onChange={(e) =>
                            updateItem(editingIndex, {
                              headline: e.target.value,
                            })
                          }
                        />
                      </Field>
                    )}
                    {selectedSlide?.kind === "closing" ? (
                      <p className="mm-muted">
                        The closing slide has no photo. Its words come from
                        Closing invitation in Details.
                      </p>
                    ) : (
                      <>
                        <p className="mm-muted">
                          Automatic framing keeps the dish whole and extends a
                          plain background to fit the shape. Fit shows the
                          entire photo; Fill crops to the frame. Each format and
                          carousel slide keeps its own framing.
                        </p>
                        <CropControls
                          value={edits}
                          onChange={(p) => {
                            if (selectedItem)
                              updateItem(editingIndex, {
                                layouts: {
                                  ...selectedItem.layouts,
                                  [frame]: { ...edits, ...p, autoFrame: false },
                                },
                              });
                            else
                              update({
                                layouts: {
                                  ...b.layouts,
                                  [channel]: {
                                    ...edits,
                                    ...p,
                                    autoFrame: false,
                                  },
                                },
                              });
                          }}
                        />
                        <button
                          className="cx-link"
                          onClick={() => {
                            const automatic = {
                              ...emptyAdjustments,
                              fit: false,
                              autoFrame: true,
                            };
                            if (selectedItem)
                              updateItem(editingIndex, {
                                layouts: {
                                  ...selectedItem.layouts,
                                  [frame]: automatic,
                                },
                              });
                            else
                              update({
                                layouts: { ...b.layouts, [channel]: automatic },
                              });
                          }}
                        >
                          Back to automatic framing
                        </button>
                      </>
                    )}
                  </>
                )}
                {panel === "caption" && (
                  <>
                    <h2>Caption</h2>
                    <Field label="Writing voice">
                      <input
                        maxLength={150}
                        value={
                          b.voice ||
                          state.restaurant.style?.tone ||
                          "Warm and welcoming"
                        }
                        onChange={(e) => change({ voice: e.target.value })}
                      />
                    </Field>
                    <Field label="Caption">
                      <textarea
                        rows={10}
                        maxLength={2200}
                        value={b.caption || ""}
                        onChange={(e) => update({ caption: e.target.value })}
                      />
                    </Field>
                    {b.captionNeedsReview && (
                      <div className="mm-fact-notice">
                        Your dish or offer details changed.
                        <button
                          className="cx-link"
                          onClick={() => change({ captionNeedsReview: false })}
                        >
                          I’ve checked the caption
                        </button>
                      </div>
                    )}
                    <div className="mm-inline">
                      <button
                        className="cx-link"
                        disabled={!!busy || !state.aiConnected}
                        onClick={() => act("Writing caption", () => caption())}
                      >
                        Write with AI
                      </button>
                      <button
                        className="cx-link"
                        disabled={!!busy || !state.aiConnected || !b.caption}
                        onClick={() =>
                          act("Shortening caption", () => caption("shorter"))
                        }
                      >
                        Shorter
                      </button>
                      <button
                        className="cx-link"
                        disabled={!!busy || !state.aiConnected || !b.caption}
                        onClick={() =>
                          act("Refining caption", () => caption("inviting"))
                        }
                      >
                        More inviting
                      </button>
                    </div>
                    {!state.aiConnected && (
                      <p className="mm-muted">
                        AI writing is currently unavailable. Your editable
                        factual caption is ready.
                      </p>
                    )}
                    <button
                      className="cx-link mm-divider"
                      onClick={() =>
                        update({
                          caption: postCaption(b, state.restaurant),
                          captionMode: "auto",
                        })
                      }
                    >
                      Restore factual caption
                    </button>
                  </>
                )}
              </WorkspaceTabs>
              <details className="mm-divider">
                <summary>Export formats</summary>
                {availableChannels.map((c) => (
                  <label key={c} className="cx-check">
                    <input
                      type="checkbox"
                      checked={b.channels.includes(c)}
                      onChange={(e) =>
                        update({
                          channels: e.target.checked
                            ? [...b.channels, c]
                            : b.channels.filter((v: string) => v !== c),
                        })
                      }
                    />
                    {c === "feed"
                      ? "Post"
                      : c === "story"
                        ? "Story"
                        : "Carousel"}
                  </label>
                ))}
              </details>
            </WorkspaceControls>
          </div>
        </>
      )}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent
          className="cx-app mm-dialog mm-photo-picker"
          aria-describedby={undefined}
        >
          <DialogTitle>Choose a dish photo</DialogTitle>
          <input
            type="search"
            aria-label="Search approved dishes"
            placeholder="Find a dish…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mm-picker-grid">
            {approved
              .filter((d) =>
                `${d.name} ${d.category}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((d) => {
                const options = photoChoices(d);
                const photo =
                  options.find((a) => a.id === versions[d.id]) || d.photo;
                return (
                  <div key={d.id}>
                    <button onClick={() => choose(d)}>
                      <img src={`/api/assets/${photo.id}`} alt={d.name} />
                      <strong>{d.name}</strong>
                    </button>
                    {options.length > 1 && (
                      <select
                        aria-label={`Photo version for ${d.name}`}
                        value={photo.id}
                        onChange={(e) =>
                          setVersions({ ...versions, [d.id]: e.target.value })
                        }
                      >
                        {options.map((a, n) => (
                          <option key={a.id} value={a.id}>
                            {a.id === d.preferred_photo_id
                              ? "Main photo"
                              : a.kind === "source"
                                ? "Original"
                                : `Approved version ${n + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
          </div>
          {!approved.length && (
            <>
              <p className="mm-muted">
                Approve a dish photo in My Dishes or Photo Studio to use it
                here.
              </p>
              <button
                className="cx-btn"
                onClick={() => {
                  setPicker(false);
                  onPhoto();
                }}
              >
                Open Photo Studio
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={exporting} onOpenChange={setExporting}>
        <DialogContent
          className="cx-app mm-dialog mm-export-post"
          aria-describedby={undefined}
        >
          <DialogTitle>Ready to share</DialogTitle>
          <div className="mm-proof-strip">
            {b.channels.flatMap((c: string) =>
              Array.from({ length: postSlideCount(b, c) }, (_, n) => (
                <div key={c + n}>
                  <PostCanvas
                    draft={b}
                    restaurant={state.restaurant}
                    channel={c}
                    slide={n}
                    scale={0.4}
                  />
                  <small>
                    {c === "feed"
                      ? "Post"
                      : c === "story"
                        ? "Story"
                        : `Slide ${n + 1}`}
                  </small>
                </div>
              )),
            )}
          </div>
          {proofIssues.length > 0 && (
            <div className="mm-output-notes">
              {proofIssues.map((i) => (
                <p key={i}>{i}</p>
              ))}
            </div>
          )}
          <Field label="Caption">
            <textarea
              value={b.caption || ""}
              rows={3}
              maxLength={2200}
              onChange={(e) => update({ caption: e.target.value })}
            />
          </Field>
          <div
            className={`mm-post-checks ${postChecks.length ? "has-blocking" : proofIssues.length ? "has-notes" : "is-clear"}`}
            role="status"
          >
            {postChecks.length ? (
              <>
                <strong>Fix before sharing</strong>
                {postChecks.map((check) => (
                  <p key={check}>{check}</p>
                ))}
                {namePlaceholder && (
                  <form
                    className="mm-inline"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act("Saving your restaurant name", async () => {
                        if (isPlaceholderRestaurantName(restaurantName))
                          throw Error("Enter your restaurant’s real name.");
                        await api("restaurant/name", {
                          name: restaurantName.trim(),
                        });
                        await refresh?.();
                      });
                    }}
                  >
                    <input
                      aria-label="Restaurant name"
                      value={restaurantName}
                      maxLength={100}
                      placeholder="Corner House Kitchen"
                      onChange={(e) => setRestaurantName(e.target.value)}
                    />
                    <button className="cx-btn cx-secondary" disabled={!!busy}>
                      Save name
                    </button>
                  </form>
                )}
              </>
            ) : proofIssues.length ? (
              <strong>Ready to share. The note above is optional.</strong>
            ) : (
              <strong>
                <Check size={16} aria-hidden="true" /> Automatic checks passed
              </strong>
            )}
          </div>
          <PostSharing
            draft={{ ...b, reviewed: postReady }}
            restaurant={state.restaurant}
            busy={!!busy}
            notice={action.setNotice}
            draftId={store.id}
          />
          <button
            className="cx-link"
            disabled={!postReady || !!busy}
            onClick={() =>
              act("Preparing downloads", async () => {
                await save();
                downloadBlob(
                  await campaignZip(b, state.restaurant),
                  `${state.restaurant.slug}-post-pack.zip`,
                );
                action.setNotice("Your post pack download has started.");
              })
            }
          >
            Download all formats & caption
          </button>
          <p className="mm-muted">
            Design saved automatically. You choose when to publish in your
            social app.
          </p>
          <Feedback {...action} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

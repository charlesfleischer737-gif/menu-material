"use client";
import { workspacePreferenceKey } from "@/lib/workspace-navigation";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  ImagePlus,
  Sparkles,
  Plus,
  ArrowRight,
  Megaphone,
  CalendarDays,
  UtensilsCrossed,
  PartyPopper,
} from "lucide-react";
import { api, downloadBlob, money, type Row } from "@/lib/client";
import { campaignZip } from "@/lib/creation-export";
import {
  postPage,
  postCaption,
  updatePost,
  postDetailError,
  postFromPhoto,
} from "@/lib/post-flow";
import { emptyAdjustments } from "@/lib/studio";
import PostSharing from "./post-sharing";
import { PostCanvas } from "./post-canvas";
export { PostCanvas } from "./post-canvas";
import { brandPostFields, brandTypefaces } from "@/lib/restaurant-look";
import {
  postTemplates,
  postTemplateGroups,
  getPostTemplate,
  applyPostTemplate,
  postTemplateExample,
} from "@/lib/post-templates";
import {
  CropControls,
  Feedback,
  Field,
  Footer,
  ToolHeader,
  DraftRecovery,
  SavedDrafts,
  Steps,
  track,
  useAction,
  useCreationDraft,
  useStepFocus,
} from "./creation-shared";
function initial(restaurant: Row) {
  return {
    step: 1,
    items: [],
    occasion: "showcase",
    title: "",
    description: "",
    price: "",
    showPrice: false,
    validity: "",
    template: "editorial",
    kicker: "",
    cta: "",
    accent: "#f5eee0",
    color: restaurant.style?.primary || "#235b48",
    textY: 0,
    channels: ["feed", "story"],
    layouts: {
      feed: { ...emptyAdjustments, fit: false },
      story: { ...emptyAdjustments, fit: false },
      carousel: { ...emptyAdjustments, fit: false },
    },
    caption: "",
    captionMode: "",
    reviewed: false,
    ...(restaurant.style?.autoApply ? brandPostFields(restaurant.style) : {}),
  };
}
export default function PostMaker({
  state,
  seed,
  onSeedUsed,
  onPhoto,
}: {
  state: Row;
  seed: Row | null;
  onSeedUsed: () => void;
  onPhoto: () => void;
}) {
  const store = useCreationDraft(
      "post",
      initial(state.restaurant),
      workspacePreferenceKey(state.user.id, state.restaurant.id),
    ),
    { draft: b, change, save, start, ready, status } = store,
    action = useAction(),
    { act, busy, setNotice } = action;
  const page = postPage(b.step);
  const root = useStepFocus(page, ready);
  const [showPicker, setShowPicker] = useState(false);
  const [useExamples, setUseExamples] = useState(true);
  const [templateGroup, setTemplateGroup] = useState("All designs"),
    [designChannel, setDesignChannel] = useState("feed");
  const [channel, setChannel] = useState("feed"),
    [slide, setSlide] = useState(0),
    seedHandled = useRef("");
  const approved = state.dishes
      .map((d: Row) => ({
        ...d,
        photo: state.assets.find(
          (a: Row) => a.dish_id === d.id && a.approved_at,
        ),
      }))
      .filter((d: Row) => d.photo),
    items: Row[] = b.items || [];
  function update(p: Row) {
    const customized =
      !p.brandMode && ("color" in p || "accent" in p || "typography" in p);
    change(
      updatePost(
        b,
        { ...(customized ? { brandMode: "custom" } : {}), ...p },
        state.restaurant,
      ),
    );
  }
  function selectTemplate(id: string) {
    update(applyPostTemplate(b, id));
    if (window.matchMedia("(max-width: 760px)").matches)
      requestAnimationFrame(() =>
        document.querySelector(".cx-selected-design")?.scrollIntoView({
          block: "start",
          behavior: "instant",
        }),
      );
  }
  useEffect(() => {
    if (
      !b.channels.includes(channel) ||
      (channel === "carousel" && items.length < 2)
    ) {
      setChannel(
        b.channels.find((c: string) => c !== "carousel" || items.length > 1) ||
          "feed",
      );
      setSlide(0);
    } else if (slide >= items.length) setSlide(0);
  }, [b.channels, items.length, channel, slide]);
  function choose(d: Row, photoId?: string) {
    if (
      b.occasion === "combo" &&
      items.length >= 4 &&
      !items.some((i) => i.dishId === d.id)
    ) {
      action.setError(
        "Choose up to four dishes for one design. Remove a dish to add another.",
      );
      return;
    }
    const item = {
      dishId: d.id,
      photoId: photoId || d.photo.id,
      name: d.name,
      quantity: 1,
    };
    update({
      items:
        b.occasion === "combo"
          ? [...items.filter((i) => i.dishId !== d.id), item]
          : [item],
      title: !b.title || b.title === items[0]?.name ? d.name : b.title,
    });
    setShowPicker(false);
  }
  useEffect(() => {
    if (!ready || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
    void act("Opening your post", async () => {
      if (seed.draftId) {
        await store.resume(seed.draftId);
        setShowPicker(false);
        onSeedUsed();
        return;
      }
      const d = state.dishes.find((d: Row) => d.id === seed.dishId),
        a = state.assets.find(
          (a: Row) => a.id === seed.photoId && a.approved_at,
        );
      if (d && a) {
        await start(
          postFromPhoto(
            initial(state.restaurant),
            d,
            a,
            state.restaurant,
            !!seed.quick,
          ),
        );
        if (seed.quick)
          track("photo_reused", a.id, { dishId: d.id, destination: "post" });
      }
      onSeedUsed();
    });
  }, [ready, seed]);
  function captionStarter(short = false) {
    return postCaption(b, state.restaurant, short);
  }
  async function continueStep() {
    const error = postDetailError(b, state.assets);
    if (error) throw Error(error);
    if (page === 3 && !b.channels.length)
      throw Error("Choose at least one format for your post.");
    change({
      step: page === 1 ? 3 : page === 2 ? 4 : 6,
      ...(!b.caption ? { caption: captionStarter(), captionMode: "auto" } : {}),
    });
    await save();
  }
  if (!ready) return <DraftRecovery store={store} />;
  return (
    <section className="cx-tool cx-feature-page" ref={root}>
      <ToolHeader title="Post Maker" status={status}>
        <div className="cx-button-row">
          <SavedDrafts kind="post" store={store} disabled={!!busy} />
          <button
            className="cx-link"
            onClick={() =>
              act("Starting a new post", () => start(initial(state.restaurant)))
            }
          >
            <Plus size={16} />
            New post
          </button>
        </div>
      </ToolHeader>
      <DraftRecovery store={store} />
      {!b.quickStart && (
        <Steps
          labels={[
            "Dish & details",
            "Design",
            "Formats & caption",
            "Save & share",
          ]}
          step={page}
          onBack={(n) => change({ step: [1, 3, 4, 6][n - 1] })}
        />
      )}
      <Feedback {...action} />
      {page === 1 && (
        <>
          <div className="cx-section-line cx-post-picker-title">
            <h2>{items.length ? "Your selected photo" : "Choose a dish"}</h2>
            {items.length > 0 && (
              <button
                className="cx-link"
                onClick={() => setShowPicker((v) => !v)}
              >
                {showPicker ? "Done choosing" : "Change photo"}
              </button>
            )}
          </div>
          {items.length > 0 && !showPicker && (
            <div className="cx-selected-photos">
              {items.map((i) => (
                <div key={i.dishId}>
                  <img src={`/api/assets/${i.photoId}`} alt={i.name} />
                  <span>
                    <b>{i.name}</b>
                    <small>
                      <Check size={13} />
                      Approved photo
                    </small>
                  </span>
                </div>
              ))}
            </div>
          )}
          {(!items.length || showPicker) && (
            <div className="cx-dish-grid cx-post-picker">
              {approved.map((d: Row) => (
                <button
                  key={d.id}
                  className="cx-dish-card"
                  aria-pressed={items.some((i) => i.dishId === d.id)}
                  onClick={() => choose(d)}
                >
                  <img src={`/api/assets/${d.photo.id}`} alt={d.name} />
                  <div>
                    <b>{d.name}</b>
                    <small>
                      <Check size={13} />
                      Approved photo
                    </small>
                  </div>
                  {items.some((i) => i.dishId === d.id) && (
                    <i>
                      <Check size={16} />
                    </i>
                  )}
                </button>
              ))}
              <button className="cx-add-dish" onClick={onPhoto}>
                <ImagePlus size={30} />
                <b>Start with a new photo</b>
                <span>We’ll guide you through Photo Studio.</span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
      {page === 1 && items.length > 0 && (
        <>
          <div className="cx-occasion-grid">
            {[
              [
                "showcase",
                "Show off a dish",
                "Let the food do the talking.",
                UtensilsCrossed,
              ],
              [
                "special",
                "Tonight’s special",
                "A reason to visit today.",
                Sparkles,
              ],
              [
                "combo",
                "Combo / meal deal",
                "Bring a few favorites together.",
                Megaphone,
              ],
              [
                "event",
                "Event",
                "Put something on their calendar.",
                PartyPopper,
              ],
            ].map(([id, title, desc, Icon]) => {
              const I = Icon as typeof Camera;
              return (
                <button
                  key={String(id)}
                  aria-pressed={b.occasion === id}
                  onClick={() =>
                    update({
                      occasion: id,
                      ...(id === "showcase"
                        ? { description: "", validity: "" }
                        : {}),
                      showPrice: id === "special" || id === "combo",
                      ...applyPostTemplate(
                        b,
                        id === "special"
                          ? "special"
                          : id === "combo"
                            ? "combo"
                            : id === "event"
                              ? "event"
                              : "editorial",
                      ),
                      items: id === "combo" ? items : items.slice(0, 1),
                      channels:
                        id === "combo"
                          ? b.channels
                          : b.channels.filter((c: string) => c !== "carousel"),
                    })
                  }
                >
                  <I size={22} />
                  <b>{String(title)}</b>
                  <small>{String(desc)}</small>
                </button>
              );
            })}
          </div>
          <div className="cx-studio-grid">
            <div className="cx-panel">
              <Field label={b.occasion === "event" ? "Event name" : "Headline"}>
                <input
                  value={b.title}
                  maxLength={90}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder={items[0]?.name || "Your headline"}
                />
              </Field>
              {b.occasion !== "showcase" && (
                <Field label="A little more detail (optional)">
                  <textarea
                    value={b.description}
                    maxLength={250}
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="Only include details you have confirmed."
                  />
                </Field>
              )}
              {["special", "combo"].includes(b.occasion) && (
                <>
                  <label className="cx-check">
                    <input
                      type="checkbox"
                      checked={b.showPrice}
                      onChange={(e) => update({ showPrice: e.target.checked })}
                    />
                    Show price
                  </label>
                  {b.showPrice && (
                    <Field label={`Price (${state.restaurant.currency})`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={b.price}
                        onChange={(e) => update({ price: e.target.value })}
                        placeholder="18.50"
                      />
                    </Field>
                  )}
                </>
              )}
              {b.occasion !== "showcase" && (
                <Field
                  label={
                    b.occasion === "event"
                      ? "When is it happening?"
                      : "Available when? (optional)"
                  }
                >
                  <input
                    value={b.validity}
                    maxLength={100}
                    onChange={(e) => update({ validity: e.target.value })}
                    placeholder="Friday, September 18 · 6–9 pm"
                  />
                </Field>
              )}
              {b.occasion === "combo" && (
                <>
                  <h3>What’s included?</h3>
                  {items.map((i) => (
                    <div className="cx-combo-row" key={i.dishId}>
                      <span>{i.name}</span>
                      <Field label="Quantity">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={i.quantity}
                          onChange={(e) =>
                            update({
                              items: items.map((x) =>
                                x.dishId === i.dishId
                                  ? { ...x, quantity: Number(e.target.value) }
                                  : x,
                              ),
                            })
                          }
                        />
                      </Field>
                      <button
                        className="cx-link"
                        onClick={() =>
                          update({
                            items: items.filter((x) => x.dishId !== i.dishId),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <Field label="Add another approved dish">
                    <select
                      value=""
                      disabled={items.length >= 6}
                      onChange={(e) => {
                        const d = approved.find(
                          (d: Row) => d.id === e.target.value,
                        );
                        if (d) choose(d);
                      }}
                    >
                      <option value="">Choose a dish</option>
                      {approved
                        .filter(
                          (d: Row) => !items.some((i) => i.dishId === d.id),
                        )
                        .map((d: Row) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="cx-post-side">
              <PostCanvas draft={b} restaurant={state.restaurant} />
              <p>Live design preview · your approved photo</p>
            </div>
          </div>
          <Footer
            label="Choose a design"
            next={() => act("Saving your post details", continueStep)}
            disabled={!items.length || !b.title.trim()}
            busy={!!busy}
          />
        </>
      )}
      {page === 2 && (
        <>
          <div className="cx-template-toolbar">
            <div
              className="cx-template-filters"
              role="group"
              aria-label="Instagram design categories"
            >
              {postTemplateGroups.map((group) => (
                <button
                  key={group}
                  aria-pressed={templateGroup === group}
                  onClick={() => setTemplateGroup(group)}
                >
                  {group}
                </button>
              ))}
            </div>
            <div className="cx-preview-switches">
              <div className="cx-segment" aria-label="Design preview format">
                {[
                  ["story", "Story 9:16"],
                  ["feed", "Post 4:5"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    aria-pressed={designChannel === id}
                    onClick={() => setDesignChannel(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="cx-segment" aria-label="Preview photos">
                <button
                  aria-pressed={useExamples}
                  onClick={() => setUseExamples(true)}
                >
                  Examples
                </button>
                <button
                  aria-pressed={!useExamples}
                  onClick={() => setUseExamples(false)}
                >
                  My photo
                </button>
              </div>
            </div>
          </div>
          <div className="cx-gallery-mode">
            <span>
              {useExamples
                ? "Example designs · each uses a different dish"
                : "See every design with your approved photo"}
            </span>
          </div>
          <div className="cx-template-workbench">
            <div className="cx-instagram-gallery">
              {postTemplates
                .filter(
                  (t) =>
                    templateGroup === "All designs" ||
                    t.group === templateGroup,
                )
                .map((t) => (
                  <button
                    className="cx-instagram-template"
                    key={t.id}
                    aria-pressed={getPostTemplate(b.template).id === t.id}
                    onClick={() => selectTemplate(t.id)}
                  >
                    <PostCanvas
                      draft={
                        useExamples
                          ? postTemplateExample(t.id)
                          : { ...b, ...applyPostTemplate(b, t.id) }
                      }
                      restaurant={
                        useExamples
                          ? {
                              name: postTemplateExample(t.id).restaurantName,
                              currency: "USD",
                            }
                          : state.restaurant
                      }
                      channel={designChannel}
                      example={useExamples}
                    />
                    <div>
                      <span>
                        <b>{t.name}</b>
                        <small>{t.group}</small>
                      </span>
                      {getPostTemplate(b.template).id === t.id && (
                        <Check size={18} />
                      )}
                    </div>
                  </button>
                ))}
            </div>
            <aside className="cx-selected-design">
              <div className="cx-section-line">
                <span className="cx-eyebrow">YOUR DESIGN</span>
                <button
                  className="cx-link cx-back-to-designs"
                  onClick={() =>
                    document
                      .querySelector(".cx-template-toolbar")
                      ?.scrollIntoView({ block: "start", behavior: "instant" })
                  }
                >
                  Back to designs
                </button>
                <span className="cx-pill">
                  {designChannel === "story"
                    ? "Instagram Story"
                    : "Instagram post"}
                </span>
              </div>
              <PostCanvas
                draft={b}
                restaurant={state.restaurant}
                channel={designChannel}
              />
              <h2>{getPostTemplate(b.template).name}</h2>
              <p>{getPostTemplate(b.template).description}</p>
              <div className="cx-post-treatment">
                <span className="cx-control-label">Text on your photo</span>
                <div className="cx-segment" aria-label="Amount of text">
                  {[
                    ["photo", "Photo only"],
                    ["minimal", "A few words"],
                    ["full", "All details"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={
                        (b.textMode || getPostTemplate(b.template).textMode) ===
                        id
                      }
                      onClick={() => update({ textMode: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="cx-brand-toggle">
                  <input
                    type="checkbox"
                    checked={
                      b.showBrand ?? getPostTemplate(b.template).showBrand
                    }
                    onChange={(e) => update({ showBrand: e.target.checked })}
                  />{" "}
                  Add my restaurant name & logo
                </label>
                {(b.textMode || getPostTemplate(b.template).textMode) ===
                  "photo" && (
                  <p className="cx-hint">
                    Your headline, price, and details stay in the caption. The
                    image stays clear.
                  </p>
                )}
              </div>
              {(b.textMode || getPostTemplate(b.template).textMode) !==
                "photo" && (
                <div className="cx-design-copy">
                  <Field label="Small heading (optional)">
                    <input
                      value={b.kicker ?? getPostTemplate(b.template).kicker}
                      maxLength={50}
                      onChange={(e) => update({ kicker: e.target.value })}
                    />
                  </Field>
                  <Field label="Headline">
                    <textarea
                      value={b.title}
                      rows={2}
                      maxLength={90}
                      onChange={(e) => update({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="Call to action (optional)">
                    <input
                      value={b.cta ?? getPostTemplate(b.template).cta}
                      maxLength={60}
                      onChange={(e) => update({ cta: e.target.value })}
                    />
                  </Field>
                  <div className="cx-design-colors">
                    <Field label="Lettering color">
                      <input
                        type="color"
                        value={b.accent || getPostTemplate(b.template).accent}
                        onChange={(e) => update({ accent: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Typography">
                    <select
                      value={b.typography || "template"}
                      onChange={(e) => update({ typography: e.target.value })}
                    >
                      <option value="template">This design’s typography</option>
                      {brandTypefaces.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className="cx-link"
                    onClick={() =>
                      update(brandPostFields(state.restaurant.style))
                    }
                  >
                    {b.brandMode === "restaurant"
                      ? "Restaurant look applied · refresh"
                      : "Use my restaurant look"}
                  </button>
                </div>
              )}
              <p className="cx-hint">
                Every design adapts to posts and stories. Next, adjust the photo
                and finish your caption.
              </p>
            </aside>
          </div>
          <Footer
            back={() => change({ step: 1 })}
            label="Finish your post"
            next={() => act("Saving your design", continueStep)}
            busy={!!busy}
            note="Your original photo stays unchanged"
          />
        </>
      )}
      {page === 3 && (
        <>
          <div className="cx-channel-options">
            {[
              ["feed", "Feed post", "1080 × 1350"],
              ["story", "Story", "1080 × 1920"],
              ["carousel", "Simple carousel", "One approved dish per slide"],
            ].map(([id, label, desc]) => (
              <label
                key={id}
                className={
                  "cx-channel " + (b.channels.includes(id) ? "selected" : "")
                }
              >
                <input
                  type="checkbox"
                  checked={b.channels.includes(id)}
                  disabled={id === "carousel" && items.length < 2}
                  onChange={(e) => {
                    update({
                      channels: e.target.checked
                        ? [...b.channels, id]
                        : b.channels.filter((c: string) => c !== id),
                    });
                    setChannel(
                      e.target.checked
                        ? id
                        : b.channels.find((c: string) => c !== id) || "feed",
                    );
                    setSlide(0);
                  }}
                />
                <span>
                  <b>{label}</b>
                  <small>{desc}</small>
                </span>
              </label>
            ))}
          </div>
          {items.length < 2 && (
            <p className="cx-hint">
              Choose Combo / meal deal with two or more dishes to make a
              carousel.
            </p>
          )}
          <div className="cx-studio-grid">
            <div className="cx-post-side">
              <div className="cx-segment">
                {b.channels.map((c: string) => (
                  <button
                    key={c}
                    aria-pressed={channel === c}
                    onClick={() => {
                      setChannel(c);
                      setSlide(0);
                    }}
                  >
                    {c === "feed"
                      ? "Feed"
                      : c === "story"
                        ? "Story"
                        : "Carousel"}
                  </button>
                ))}
              </div>
              <PostCanvas
                draft={b}
                restaurant={state.restaurant}
                channel={channel}
                slide={slide}
              />
              {channel === "carousel" && (
                <div className="cx-chips">
                  {items.map((i, n) => (
                    <button
                      key={i.dishId}
                      aria-pressed={slide === n}
                      onClick={() => setSlide(n)}
                    >
                      Slide {n + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <aside className="cx-panel">
              <h2>
                {channel === "story"
                  ? "Story"
                  : channel === "carousel"
                    ? "Carousel"
                    : "Feed"}{" "}
                framing
              </h2>
              <p>
                Move the photo within your design. Use Fit whole dish to keep
                the entire serving visible, or Fill frame for a full-bleed look.
              </p>
              <CropControls
                value={b.layouts[channel] || emptyAdjustments}
                onChange={(edits) =>
                  update({ layouts: { ...b.layouts, [channel]: edits } })
                }
              />
              <p className="cx-hint">
                Each format keeps its own framing. Story text stays clear of the
                top and bottom areas used by Instagram’s controls.
              </p>
            </aside>
          </div>
          <div className="cx-panel cx-caption-editor">
            <span className="cx-pill">A starting point from your details</span>
            <h2>The words to match.</h2>
            {b.captionNeedsReview && (
              <p className="cx-hint" role="status">
                Your details changed. Check prices and dates in your caption, or
                use a fresh starter.
              </p>
            )}
            <Field label="Your caption">
              <textarea
                className="cx-caption"
                value={b.caption}
                maxLength={2200}
                onChange={(e) => update({ caption: e.target.value })}
              />
            </Field>
            <span className="cx-counter">
              {b.caption.length} / 2,200 characters
            </span>
            <div className="cx-button-row">
              <button
                className="cx-link"
                onClick={() =>
                  update({ caption: captionStarter(), captionMode: "auto" })
                }
              >
                Use current details
              </button>
              <button
                className="cx-btn cx-secondary"
                onClick={() => update({ caption: captionStarter(true) })}
              >
                Use a shorter version
              </button>
              <button
                className="cx-link"
                disabled={!!busy || !state.aiConnected}
                onClick={() =>
                  act("Writing from your confirmed details", async () => {
                    const result = await api("post-caption", {
                      dishIds: items.map((i) => i.dishId),
                      title: b.title,
                      description: b.description,
                      price: b.showPrice ? b.price : null,
                      validity: b.validity,
                      occasion: b.occasion,
                    });
                    update({ caption: result.body });
                  })
                }
              >
                <Sparkles size={16} />
                Try an AI caption
              </button>
            </div>
            <p className="cx-hint">
              Only confirmed facts belong in your post. Check prices, dates and
              any claims before sharing.
            </p>
          </div>
          <Footer
            back={() => change({ step: 3 })}
            label="Review & share"
            next={() => act("Saving your channels", continueStep)}
            disabled={!b.channels.length}
            busy={!!busy}
          />
        </>
      )}
      {page === 4 && (
        <>
          {b.quickStart && (
            <div className="cx-quick-post-details">
              <h2>Your photo. A matching post and Story.</h2>
              <p>
                Your approved photo is ready in both formats. Add an offer if
                you want, then review both previews and your caption.
              </p>
              <div className="cx-quick-post-fields">
                <Field label="Headline">
                  <input
                    value={b.title}
                    maxLength={90}
                    onChange={(e) => update({ title: e.target.value })}
                  />
                </Field>
                <div>
                  <label className="cx-check">
                    <input
                      type="checkbox"
                      checked={b.showPrice}
                      onChange={(e) => update({ showPrice: e.target.checked })}
                    />
                    Include a price
                  </label>
                  {b.showPrice && (
                    <Field label={`Price (${state.restaurant.currency})`}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={b.price}
                        onChange={(e) => update({ price: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
                <Field label="Offer dates or hours (optional)">
                  <input
                    value={b.validity}
                    maxLength={100}
                    placeholder="Friday · 5–9 pm"
                    onChange={(e) => update({ validity: e.target.value })}
                  />
                </Field>
              </div>
              <div className="cx-button-row">
                <button
                  className="cx-link"
                  onClick={() => change({ quickStart: false, step: 3 })}
                >
                  Customize the design
                </button>
                <button
                  className="cx-link"
                  onClick={() => change({ quickStart: false, step: 1 })}
                >
                  Change dish or promotion type
                </button>
              </div>
            </div>
          )}
          <div className="cx-share-layout">
            <div>
              <div className="cx-channel-previews">
                {b.channels.map((c: string) => (
                  <div key={c}>
                    <PostCanvas
                      draft={b}
                      restaurant={state.restaurant}
                      channel={c}
                    />
                    <b>
                      {c === "feed"
                        ? "Feed post"
                        : c === "story"
                          ? "Story"
                          : `Carousel · ${items.length} slides`}
                    </b>
                  </div>
                ))}
              </div>
              <div className="cx-caption-preview">
                <h3>Your caption</h3>
                {b.captionNeedsReview && (
                  <p className="cx-feedback" role="status">
                    Your offer details changed. Check that your custom caption
                    still matches the price and dates before sharing.
                  </p>
                )}
                <p>{b.caption}</p>
                <button className="cx-link" onClick={() => change({ step: 4 })}>
                  Edit caption
                </button>
              </div>
            </div>
            <aside className="cx-panel">
              <span className="cx-pill">Saved in your workspace</span>
              <h2>Your next post is ready.</h2>
              <label className="cx-check">
                <input
                  type="checkbox"
                  checked={b.reviewed}
                  disabled={
                    !!postDetailError(b, state.assets) || !b.channels.length
                  }
                  onChange={(e) =>
                    change({
                      reviewed: e.target.checked,
                      captionNeedsReview: false,
                    })
                  }
                />
                I’ve checked the images, text, prices and dates.
              </label>
              {postDetailError(b, state.assets) && (
                <p className="cx-feedback" role="alert">
                  {postDetailError(b, state.assets)}
                </p>
              )}
              <PostSharing
                draft={b}
                restaurant={state.restaurant}
                busy={!!busy}
                notice={setNotice}
              />
              <button
                className="cx-btn cx-secondary cx-full"
                disabled={
                  !b.reviewed || !!busy || !!postDetailError(b, state.assets)
                }
                onClick={() =>
                  act("Preparing your campaign files", async () => {
                    await save();
                    const error = postDetailError(b, state.assets);
                    if (error) throw Error(error);
                    const blob = await campaignZip(b, state.restaurant);
                    downloadBlob(blob, `${state.restaurant.slug}-campaign.zip`);
                    track("export_complete", undefined, {
                      format: "campaign-zip",
                    });
                    setNotice(
                      "Your images and caption are downloaded together, ready to upload.",
                    );
                  })
                }
              >
                <Download size={17} />
                {b.channels.includes("feed") && b.channels.includes("story")
                  ? "Download post, Story & caption"
                  : "Download selected images & caption"}
              </button>
              <p className="cx-hint">
                Saving or sharing opens your files or apps. It does not
                automatically publish a social post.
              </p>
            </aside>
          </div>
          <Footer
            back={() => change({ step: 4 })}
            label="Save this post"
            next={() =>
              act("Saving your post", async () => {
                await save();
                track("post_saved", store.id);
                setNotice(
                  "Your post is saved. Find it anytime under Saved posts.",
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

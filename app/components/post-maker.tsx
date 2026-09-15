"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Download,
  Copy,
  Share2,
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
import { campaignZip, canvasBlob, renderPost } from "@/lib/creation-export";
import { emptyAdjustments } from "@/lib/studio";
import {
  CropControls,
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
    template: "photo",
    color: restaurant.style?.primary || "#235b48",
    textY: 0,
    channels: ["feed", "story"],
    layouts: {
      feed: { ...emptyAdjustments },
      story: { ...emptyAdjustments },
      carousel: { ...emptyAdjustments },
    },
    caption: "",
    reviewed: false,
  };
}
export function PostCanvas({
  draft,
  restaurant,
  channel = "feed",
  slide = 0,
}: {
  draft: Row;
  restaurant: Row;
  channel?: string;
  slide?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setError("");
    setLoading(true);
    const temp = document.createElement("canvas");
    renderPost(temp, draft, restaurant, channel, slide)
      .then(() => {
        if (live && ref.current) {
          ref.current.width = temp.width;
          ref.current.height = temp.height;
          ref.current.getContext("2d")!.drawImage(temp, 0, 0);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [draft, restaurant, channel, slide]);
  return (
    <div
      className="cx-post-canvas"
      style={{ aspectRatio: channel === "story" ? 9 / 16 : 4 / 5 }}
    >
      <canvas
        ref={ref}
        role="img"
        aria-label={`${channel} design preview using your approved photo`}
      />
      {loading && <span className="cx-canvas-status">Preparing preview…</span>}
      {error && (
        <p role="alert" className="cx-canvas-status">
          {error}
        </p>
      )}
    </div>
  );
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
  const store = useCreationDraft("post", initial(state.restaurant)),
    { draft: b, change, save, start, ready, status } = store,
    action = useAction(),
    { act, busy, setNotice } = action;
  const root = useStepFocus(b.step, ready);
  const [channel, setChannel] = useState("feed"),
    [slide, setSlide] = useState(0),
    [saved, setSaved] = useState<Row[]>([]),
    [showSaved, setShowSaved] = useState(false),
    [canShare, setCanShare] = useState(false),
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
    change({ ...p, reviewed: false });
  }
  function choose(d: Row, photoId?: string) {
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
      title: items.length ? b.title : d.name,
    });
  }
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (!ready || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
    void act("Opening your post", async () => {
      const d = state.dishes.find((d: Row) => d.id === seed.dishId),
        a = state.assets.find(
          (a: Row) => a.id === seed.photoId && a.approved_at,
        );
      if (d && a)
        await start({
          ...initial(state.restaurant),
          items: [{ dishId: d.id, photoId: a.id, name: d.name, quantity: 1 }],
          title: d.name,
          step: 2,
        });
      onSeedUsed();
    });
  }, [ready, seed]);
  function captionStarter(short = false) {
    const names = items
      .map((i) =>
        b.occasion === "combo" ? `${i.quantity} × ${i.name}` : i.name,
      )
      .join(" + ");
    return [
      b.title || names,
      !short ? b.description : "",
      b.showPrice && b.price !== ""
        ? money(Math.round(Number(b.price) * 100), state.restaurant.currency)
        : "",
      b.validity,
      state.restaurant.name,
    ]
      .filter(Boolean)
      .join("\n");
  }
  async function exportOne(format: string, index = 0) {
    const c = document.createElement("canvas");
    await renderPost(c, b, state.restaurant, format, index);
    const blob = await canvasBlob(c, "image/png");
    const filename = `${state.restaurant.slug}-${format}${format === "carousel" ? "-" + (index + 1) : ""}.png`;
    downloadBlob(blob, filename);
    track("export_complete", undefined, { format: "post-" + format });
    setNotice("Image saved. You can upload it to your social account.");
    return { blob, filename };
  }
  async function continueStep() {
    if (b.step === 2) {
      if (
        items.some(
          (i) =>
            !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 100,
        )
      )
        throw Error("Choose a whole quantity from 1 to 100 for each dish.");
      if (!b.title.trim()) throw Error("Add a headline for this post.");
      if (
        b.showPrice &&
        (b.price === "" ||
          !Number.isFinite(Number(b.price)) ||
          Number(b.price) < 0)
      )
        throw Error("Enter the price, or turn off Show price.");
      if (b.occasion === "event" && !b.validity.trim())
        throw Error("Add the event date and time.");
    }
    if (b.step === 4 && !b.caption) change({ caption: captionStarter() });
    change({ step: b.step + 1 });
    await save();
  }
  if (!ready)
    return (
      <p role="status" className="cx-feedback">
        {status}
      </p>
    );
  const titles = [
    "What’s looking good today?",
    "Give your post a purpose.",
    "Make it unmistakably yours.",
    "A good fit for every feed.",
    "Find the words to match.",
    "Ready to make people hungry.",
  ];
  return (
    <section className="cx-tool" ref={root}>
      <div className="cx-tool-top">
        <span className="cx-save">{status}</span>
        <div className="cx-button-row">
          <button
            className="cx-link"
            onClick={() =>
              act("Opening saved posts", async () => {
                const data = await api("creation-drafts");
                setSaved(data.drafts.filter((d: Row) => d.kind === "post"));
                setShowSaved((v) => !v);
              })
            }
          >
            Saved posts
          </button>
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
      </div>
      {showSaved && (
        <div className="cx-panel cx-saved-posts">
          {saved.map((d) => (
            <button
              className="cx-btn cx-secondary"
              key={d.id}
              onClick={() =>
                act("Opening your saved post", async () => {
                  await start({ ...initial(state.restaurant), ...d.draft }, d);
                  setShowSaved(false);
                })
              }
            >
              {d.draft.title || "Untitled post"}
            </button>
          ))}
        </div>
      )}
      <Steps
        labels={[
          "Choose dish",
          "Occasion",
          "Design",
          "Channels",
          "Caption",
          "Share",
        ]}
        step={b.step}
        onBack={(n) => change({ step: n })}
      />
      <Heading eyebrow="POST MAKER" title={titles[b.step - 1]}>
        {b.step === 1
          ? "Start with an approved photo from My Dishes, or improve a new one."
          : b.step === 2
            ? "A beautiful dish needs no special offer. Add just the details your guests need."
            : b.step === 3
              ? "Real food, your colors, editable words. Design changes are instant."
              : b.step === 4
                ? "Each channel gets its own layout and crop. Keep your dish fully in view."
                : b.step === 5
                  ? "Start with your confirmed details. Make the caption sound like you."
                  : "Save your images, copy your caption, and share through your own social accounts."}
      </Heading>
      <Feedback {...action} />
      {b.step === 1 && (
        <>
          <div className="cx-dish-grid">
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
          <Footer
            label="Choose the occasion"
            next={() => act("Saving your dish", continueStep)}
            disabled={!items.length}
            busy={!!busy}
          />
        </>
      )}
      {b.step === 2 && (
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
                      showPrice: id === "special" || id === "combo",
                      template:
                        id === "special" || id === "combo" ? "price" : "photo",
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
            back={() => change({ step: 1 })}
            label="Pick a design"
            next={() => act("Saving your post details", continueStep)}
            disabled={!items.length || !b.title.trim()}
            busy={!!busy}
          />
        </>
      )}
      {b.step === 3 && (
        <>
          <div className="cx-post-templates">
            {[
              ["photo", "Photo first", "Let your food shine."],
              ["price", "Price spotlight", "Make the offer easy to see."],
              ["story", "Restaurant story", "Room for a little more detail."],
            ].map(([id, title, desc]) => (
              <button
                className="cx-template-card"
                key={id}
                aria-pressed={b.template === id}
                onClick={() => update({ template: id })}
              >
                <PostCanvas
                  draft={{ ...b, template: id }}
                  restaurant={state.restaurant}
                />
                <div>
                  <b>{title}</b>
                  <small>{desc}</small>
                  {b.template === id && <Check size={18} />}
                </div>
              </button>
            ))}
          </div>
          <div className="cx-panel cx-design-settings">
            <Field label="Background color">
              <input
                type="color"
                value={b.color}
                onChange={(e) => update({ color: e.target.value })}
              />
            </Field>
            <Field label="Headline">
              <input
                value={b.title}
                maxLength={90}
                onChange={(e) => update({ title: e.target.value })}
              />
            </Field>
            <Field label="Text position">
              <input
                type="range"
                min="-10"
                max="10"
                value={b.textY}
                onChange={(e) => update({ textY: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Footer
            back={() => change({ step: 2 })}
            label="Choose channels"
            next={() => act("Saving your design", continueStep)}
            busy={!!busy}
            note="Your original photo stays unchanged"
          />
        </>
      )}
      {b.step === 4 && (
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
                Fit the whole dish on your brand color, or fill the photo area
                and adjust its position.
              </p>
              <CropControls
                value={b.layouts[channel] || emptyAdjustments}
                onChange={(edits) =>
                  update({ layouts: { ...b.layouts, [channel]: edits } })
                }
              />
              <p className="cx-hint">
                Each channel remembers its own framing. Fit whole dish keeps
                food from being cropped away.
              </p>
            </aside>
          </div>
          <Footer
            back={() => change({ step: 3 })}
            label="Finish the caption"
            next={() => act("Saving your channels", continueStep)}
            disabled={!b.channels.length}
            busy={!!busy}
          />
        </>
      )}
      {b.step === 5 && (
        <>
          <div className="cx-studio-grid">
            <div className="cx-post-side">
              <PostCanvas
                draft={b}
                restaurant={state.restaurant}
                channel={b.channels[0]}
              />
            </div>
            <div className="cx-panel">
              <span className="cx-pill">
                A starting point from your details
              </span>
              <h2>Say it your way.</h2>
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
                Only confirmed facts belong in your post. Check prices, dates
                and any claims before sharing.
              </p>
            </div>
          </div>
          <Footer
            back={() => change({ step: 4 })}
            label="Review & share"
            next={() => act("Saving your caption", continueStep)}
            busy={!!busy}
          />
        </>
      )}
      {b.step === 6 && (
        <>
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
                <p>{b.caption}</p>
                <button className="cx-link" onClick={() => change({ step: 5 })}>
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
                  onChange={(e) => change({ reviewed: e.target.checked })}
                />
                I’ve checked the images, text, prices and dates.
              </label>
              {b.channels.map((c: string) =>
                c === "carousel" ? (
                  items.map((i, n) => (
                    <button
                      className="cx-btn cx-secondary cx-full"
                      key={i.dishId}
                      disabled={!b.reviewed || !!busy}
                      onClick={() =>
                        act("Saving your slide", async () => {
                          await exportOne(c, n);
                        })
                      }
                    >
                      <Download size={17} />
                      Save carousel slide {n + 1}
                    </button>
                  ))
                ) : (
                  <button
                    className="cx-btn cx-secondary cx-full"
                    key={c}
                    disabled={!b.reviewed || !!busy}
                    onClick={() =>
                      act("Saving your image", async () => {
                        await exportOne(c);
                      })
                    }
                  >
                    <Download size={17} />
                    Save {c === "feed" ? "feed image" : "story image"}
                  </button>
                ),
              )}
              <button
                className="cx-btn cx-secondary cx-full"
                disabled={!b.reviewed || !!busy}
                onClick={() =>
                  act("Copying your caption", async () => {
                    await navigator.clipboard.writeText(b.caption);
                    setNotice(
                      "Caption copied. Paste it into your social post.",
                    );
                  })
                }
              >
                <Copy size={17} />
                Copy caption
              </button>
              <button
                className="cx-btn cx-full"
                disabled={!b.reviewed || !!busy}
                onClick={() =>
                  act("Preparing your campaign files", async () => {
                    await save();
                    const blob = await campaignZip(b, state.restaurant);
                    downloadBlob(blob, `${state.restaurant.slug}-campaign.zip`);
                    track("export_complete", undefined, {
                      format: "campaign-zip",
                    });
                    setNotice(
                      "Campaign saved with your images and caption text file.",
                    );
                  })
                }
              >
                <Download size={17} />
                Download campaign ZIP
              </button>
              {canShare && (
                <button
                  className="cx-btn cx-secondary cx-full"
                  disabled={!b.reviewed || !!busy}
                  onClick={() =>
                    act("Opening your share sheet", async () => {
                      const c = document.createElement("canvas");
                      await renderPost(c, b, state.restaurant, b.channels[0]);
                      const file = new File(
                        [await canvasBlob(c, "image/png")],
                        `${state.restaurant.slug}-post.png`,
                        { type: "image/png" },
                      );
                      if (navigator.canShare?.({ files: [file] }))
                        await navigator.share({
                          files: [file],
                          text: b.caption,
                        });
                      else
                        throw Error(
                          "Sharing images isn’t supported here. Save the image and copy the caption instead.",
                        );
                    })
                  }
                >
                  <Share2 size={17} />
                  Share image & caption
                </button>
              )}
              <p className="cx-hint">
                Saving or sharing opens your files or apps. It does not
                automatically publish a social post.
              </p>
            </aside>
          </div>
          <Footer
            back={() => change({ step: 5 })}
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

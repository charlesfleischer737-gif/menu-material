"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  SlidersHorizontal,
  ArrowRight,
  ImagePlus,
  BookOpen,
  Megaphone,
  Truck,
  Printer,
  Download,
  History,
  Expand,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, downloadBlob, normalizePhoto, type Row } from "@/lib/client";
import {
  looks,
  formats,
  foodFamilies,
  photoBrief,
  styleFor,
  emptyAdjustments,
  deliveryProfiles,
  type PhotoFormat,
} from "@/lib/studio";
import {
  canvasBlob,
  drawPhoto,
  imageBitmap,
  photoExport,
} from "@/lib/creation-export";
import { photoAdvice } from "@/lib/photo-advice";
import {
  CropControls,
  Feedback,
  Field,
  Footer,
  Heading,
  PhotoFrame,
  Steps,
  track,
  useAction,
  useCreationDraft,
  useStepFocus,
} from "./creation-shared";
export default function PhotoStudio({
  state,
  refresh,
  seed,
  onSeedUsed,
  onDestination,
}: {
  state: Row;
  refresh: () => Promise<void>;
  seed: Row | null;
  onSeedUsed: () => void;
  onDestination: (
    where: string,
    dishId: string,
    photoId: string,
    extra?: Row,
  ) => void;
}) {
  const draftStore = useCreationDraft("studio", {
      ...photoBrief(),
      look: state.assets.some((a: Row) => a.approved_at)
        ? "restaurant"
        : "cafe",
    }),
    { draft: b, change, save, start, ready, status } = draftStore;
  const root = useStepFocus(b.step, ready);
  const action = useAction(),
    { act, busy, setNotice, setError } = action;
  const [advice, setAdvice] = useState(""),
    [more, setMore] = useState(false),
    [filter, setFilter] = useState("All"),
    [fine, setFine] = useState(false),
    [before, setBefore] = useState(false),
    [adjust, setAdjust] = useState(""),
    [aiChanges, setAiChanges] = useState(""),
    [accurate, setAccurate] = useState(false),
    [zoom, setZoom] = useState(false),
    [download, setDownload] = useState(false),
    [fullDish, setFullDish] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    seedHandled = useRef(""),
    editKey = useRef(""),
    analysisSource = useRef("");
  const selected = looks.find((l) => l.id === b.look) || looks[2],
    source =
      b.mode === "photo" && b.sourceId ? `/api/assets/${b.sourceId}` : "",
    job = state.jobs.find((j: Row) => j.id === b.jobId),
    output = state.outputs.find(
      (o: Row) => o.job_id === b.jobId && o.status === "completed",
    ),
    resultId = b.resultId || output?.asset_id,
    asset = state.assets.find((a: Row) => a.id === resultId);
  const running = job && ["queued", "processing"].includes(job.status),
    format = formats[b.format as PhotoFormat] || formats.menu,
    delivery = ["doordash", "uber"].includes(b.format);
  const recommendedLooks =
    b.family === "Drinks" || b.family === "Desserts"
      ? [looks[1], looks[6], looks[2], looks[3], looks[4], looks[5]]
      : b.family === "Takeout"
        ? [looks[0], looks[1], looks[6], looks[2], looks[3], looks[5]]
        : looks.slice(0, 6);
  const styleImage =
    b.look === "keep" && source
      ? source
      : b.look === "reference" && b.referenceId
        ? `/api/assets/${b.referenceId}`
        : b.look === "restaurant" && state.restaurant.style?.referenceIds?.[0]
          ? `/api/assets/${state.restaurant.style.referenceIds[0]}`
          : selected.image;
  useEffect(() => {
    if (!ready || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
    analysisSource.current = "";
    void act("Opening your photo", async () => {
      if (seed.draftId) {
        await draftStore.resume(seed.draftId);
        setAccurate(false);
        setAdjust("");
        onSeedUsed();
        return;
      }
      const d = state.dishes.find((d: Row) => d.id === seed.dishId);
      const original = state.assets.find(
        (a: Row) => a.dish_id === seed.dishId && a.kind === "source",
      );
      const prior =
        state.jobs.find((j: Row) =>
          state.outputs.some(
            (o: Row) => o.job_id === j.id && o.asset_id === seed.photoId,
          ),
        ) || state.jobs.find((j: Row) => j.dish_id === seed.dishId);
      const lineage = state.assetEdits?.find(
        (e: Row) => e.asset_id === seed.photoId,
      );
      let details: Row = {};
      try {
        details = JSON.parse(prior?.details || "{}");
      } catch {}
      await start({
        ...photoBrief(seed.destination || "menu"),
        ...seed,
        name: d?.name === "Untitled dish" ? "" : d?.name || "",
        description: d?.description || "",
        dishId: d?.id || "",
        sourceId: lineage?.source_id || prior?.source_id || original?.id || "",
        mode:
          prior?.input_method === "description" && !original
            ? "description"
            : "photo",
        resultId: seed.photoId || "",
        jobId: seed.photoId ? "" : prior?.id || "",
        step:
          seed.photoId ||
          prior?.status === "processing" ||
          prior?.status === "queued"
            ? 4
            : 1,
        look:
          details.style?.photoStyle === state.restaurant.style?.photoStyle
            ? "restaurant"
            : state.assets.some((a: Row) => a.approved_at)
              ? "restaurant"
              : "cafe",
      });
      setAccurate(false);
      setAdjust("");
      onSeedUsed();
    });
  }, [seed, ready]);
  useEffect(() => {
    if (b.jobId && output?.asset_id && !b.resultId) {
      change({ resultId: output.asset_id, step: 4 });
      setAccurate(false);
    }
  }, [output?.asset_id, b.jobId]);
  function update(patch: Row) {
    change({ ...patch, requestKey: "" });
  }
  async function ensureDish() {
    const prior = state.dishes.find((d: Row) => d.id === b.dishId);
    const payload = {
      ...prior,
      name: b.name.trim() || "Untitled dish",
      description: b.description || "",
      category: prior?.category || "Dishes",
      price: (prior?.price || 0) / 100,
      available: prior ? !!prior.available : true,
      confirmed: true,
      setting: styleFor(b, state.restaurant).photoStyle,
    };
    const data = await api(
      "dishes" + (b.dishId ? "/" + b.dishId : ""),
      payload,
    );
    if (!b.dishId) change({ dishId: data.id });
    return data.id;
  }
  async function uploadPhoto(file: File) {
    if (file.type === "application/pdf") {
      await act("Saving your menu file", async () => {
        const form = new FormData();
        form.set("file", file);
        const imported = await api("imports", form);
        await refresh();
        onDestination("menu", "", "", { importId: imported.id });
      });
      return;
    }
    await act("Preparing your photo", async () => {
      const normalized = await normalizePhoto(file);
      const did = await ensureDish();
      const fd = new FormData();
      fd.set("file", file);
      fd.set("normalized", normalized, "working.jpg");
      fd.set("dishId", did);
      const a = await api("assets", fd);
      update({
        sourceId: a.id,
        menuDocument: false,
        analysisAdvice: "",
        resultId: "",
        jobId: "",
        mode: "photo",
        step: 1,
      });
      setAdvice(
        await photoAdvice(
          new File([normalized], "photo.jpg", { type: "image/jpeg" }),
        ),
      );
      await save();
      await refresh();
      track("upload_complete", a.id);
      analysisSource.current = a.id;
      if (state.aiConnected)
        void api("photo-analysis", { sourceId: a.id })
          .then((result) => {
            if (analysisSource.current !== a.id) return;
            change({
              family: result.family,
              menuDocument: result.menuDocument,
              analysisAdvice: result.advice,
            });
          })
          .catch(() => {});
    });
  }
  async function generate(parentId?: string) {
    if (!state.aiConnected)
      throw Error(
        "Image creation is not connected yet. Your photo and choices are saved. You can use your original photo while the connection is set up.",
      );
    if (b.mode === "photo" && !b.sourceId)
      throw Error("Add your dish photo first.");
    if (b.mode === "description" && (!b.name.trim() || !b.description.trim()))
      throw Error("Add a dish name and a short description first.");
    if (b.look === "reference" && !b.referenceId)
      throw Error("Add a style reference, or choose one of our looks.");
    const did = await ensureDish();
    const key = b.requestKey || crypto.randomUUID();
    change({ requestKey: key });
    await save();
    track("generation_submission", did, { format: b.format, look: b.look });
    const j = await api("jobs", {
      dishId: did,
      sourceId: b.mode === "photo" ? b.sourceId : null,
      parentId: parentId || null,
      revision: parentId ? aiChanges : b.note,
      requestKey: key,
      candidateCount: 1,
      style: styleFor(b, state.restaurant),
      editMode: "preserve",
      controls: {
        format: b.format,
        surface: b.surface,
        lighting: b.lighting,
        plate: b.plate,
        angle: b.angle,
        composition: b.composition,
        cropX: b.adjustments.x,
        cropY: b.adjustments.y,
        zoom: b.adjustments.zoom,
      },
    });
    change({
      jobId: j.id,
      resultId: "",
      step: 4,
      requestKey: "",
      adjustments: { ...emptyAdjustments },
    });
    setAdjust("");
    setAccurate(false);
    await save();
    await refresh();
    void api("jobs/tick", {})
      .then(refresh)
      .catch(() => {});
  }
  async function approve() {
    if (!b.name.trim())
      throw Error("Give this dish a name so you can find it again.");
    if (!accurate)
      throw Error("Check that the photo represents the dish you serve.");
    await ensureDish();
    await api(`assets/${resultId}/approve`, { accurate: true });
    change({ step: 5 });
    await save();
    await refresh();
  }
  async function quickSave() {
    const im = await imageBitmap(`/api/assets/${resultId}`);
    const c = document.createElement("canvas");
    try {
      const width = Math.min(2048, im.width),
        height = Math.round(width / format.ratio);
      drawPhoto(c, im, width, height, b.adjustments);
    } finally {
      im.close();
    }
    const fd = new FormData();
    fd.set("file", await canvasBlob(c), "adjusted.jpg");
    fd.set("parentId", resultId);
    editKey.current ||= crypto.randomUUID();
    fd.set("requestKey", editKey.current);
    fd.set("edits", JSON.stringify({ format: b.format, ...b.adjustments }));
    const data = await api("photo-edits", fd);
    editKey.current = "";
    change({
      resultId: data.id,
      adjustments: { ...emptyAdjustments },
      step: 4,
    });
    setAccurate(false);
    setAdjust("");
    await save();
    await refresh();
    setNotice(
      "Saved as a new version. Your original and earlier photos are still here.",
    );
  }
  async function saveLook() {
    const im = await fetch(`/api/assets/${resultId}`);
    if (!im.ok) throw Error("This photo could not be opened.");
    const file = new File([await im.blob()], "restaurant-look.png", {
      type: "image/png",
    });
    const normalized = await normalizePhoto(file);
    const form = new FormData();
    form.set("file", file);
    form.set("normalized", normalized, "look.jpg");
    form.set("kind", "reference");
    const ref = await api("assets", form);
    await api("restaurant", {
      name: state.restaurant.name,
      cuisine: state.restaurant.cuisine,
      brand: state.restaurant.brand,
      currency: state.restaurant.currency,
      style: { ...styleFor(b, state.restaurant), referenceIds: [ref.id] },
    });
    change({ savedLook: true });
    await save();
    await refresh();
    setNotice("Your restaurant look is saved for your next dish.");
  }
  if (!ready)
    return (
      <p role="status" className="cx-feedback">
        {status}
      </p>
    );
  return (
    <section className="cx-tool" ref={root}>
      <div className="cx-tool-top">
        <span className="cx-save">{status}</span>
        <button
          className="cx-link"
          disabled={!!busy}
          onClick={() =>
            act("Starting a new photo", async () => {
              analysisSource.current = "";
              await start({
                ...photoBrief(b.destination),
                look: state.assets.some((a: Row) => a.approved_at)
                  ? "restaurant"
                  : "cafe",
              });
              setAdjust("");
              setAccurate(false);
              setAdvice("");
            })
          }
        >
          <ImagePlus size={16} />
          New photo
        </button>
      </div>
      <Steps
        labels={[
          "Your photo",
          "Choose a look",
          "Create",
          "Review",
          "Use your photo",
        ]}
        step={b.step}
        onBack={running ? undefined : (n) => update({ step: n })}
      />
      <Feedback {...action} />
      {b.step === 1 && (
        <>
          <Heading eyebrow="PHOTO STUDIO" title="Let’s make your dish shine.">
            Start with a photo of the food you actually serve. We’ll take it
            from here.
          </Heading>
          <div className="cx-studio-grid">
            <div>
              <div
                className={"cx-upload " + (source ? "has-photo" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) void uploadPhoto(f);
                }}
              >
                {source && b.mode === "photo" ? (
                  <>
                    <img src={source} alt="Your original dish photo" />
                    <span className="cx-image-label">
                      Your original · safely saved
                    </span>
                    <button
                      className="cx-btn cx-secondary cx-replace"
                      disabled={!!busy}
                      onClick={() => input.current?.click()}
                    >
                      Replace photo
                    </button>
                  </>
                ) : (
                  <>
                    <div className="cx-upload-icon">
                      <Camera size={30} />
                    </div>
                    <h2>A great photo starts with your food.</h2>
                    <p>Drop your photo here, or choose one from your phone.</p>
                    <button
                      className="cx-btn"
                      disabled={!!busy}
                      onClick={() => input.current?.click()}
                    >
                      <Upload size={18} />
                      Choose a photo
                    </button>
                    <small>JPG, PNG or HEIC · up to 20 MB</small>
                    <label className="cx-link cx-camera">
                      <Camera size={15} />
                      Take a photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        disabled={!!busy}
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            void uploadPhoto(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </>
                )}
                <input
                  ref={input}
                  type="file"
                  accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
                  hidden
                  onChange={(e) => {
                    if (e.target.files?.[0])
                      void uploadPhoto(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
              {source && (
                <>
                  <p className="cx-hint">{b.analysisAdvice || advice}</p>
                  {b.menuDocument && (
                    <div className="cx-panel">
                      <h3>Create a menu from this?</h3>
                      <p>
                        This looks like a menu page. Bring its dishes and prices
                        into Menu Builder.
                      </p>
                      <button
                        className="cx-btn cx-secondary"
                        disabled={!!busy}
                        onClick={() =>
                          act("Opening your menu", async () => {
                            const photo = await fetch(source);
                            if (!photo.ok)
                              throw Error("Your saved photo is unavailable.");
                            const form = new FormData();
                            form.set("file", await photo.blob(), "menu.jpg");
                            const imported = await api("imports", form);
                            await refresh();
                            onDestination("menu", "", "", {
                              importId: imported.id,
                            });
                          })
                        }
                      >
                        Create a menu from this
                      </button>
                    </div>
                  )}
                  <Field label="Food family (change if needed)">
                    <select
                      value={b.family}
                      onChange={(e) => {
                        analysisSource.current = "";
                        update({ family: e.target.value });
                      }}
                    >
                      {foodFamilies.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
              <button
                className="cx-link cx-no-photo"
                onClick={() =>
                  update({
                    mode: b.mode === "description" ? "photo" : "description",
                  })
                }
              >
                {b.mode === "description"
                  ? "Use my own photo instead"
                  : "I don’t have a photo"}
              </button>
              {b.mode === "description" && (
                <div className="cx-panel">
                  <h3>Create an illustration</h3>
                  <p>
                    Describe your real dish, then review the image carefully
                    before using it.
                  </p>
                  <Field label="Dish name">
                    <input
                      value={b.name}
                      maxLength={100}
                      onChange={(e) => update({ name: e.target.value })}
                      placeholder="Roasted tomato pasta"
                    />
                  </Field>
                  <Field label="What’s in it, and how is it served?">
                    <textarea
                      value={b.description}
                      maxLength={2000}
                      onChange={(e) => update({ description: e.target.value })}
                      placeholder="Pappardelle, tomato sauce and basil, one generous portion on an ivory plate."
                    />
                  </Field>
                </div>
              )}
            </div>
            <aside className="cx-panel cx-purpose">
              <p className="cx-eyebrow">MADE FOR YOUR NEXT MOVE</p>
              <h2>Where will you use it?</h2>
              <p>We’ll get the shape and setting ready for you.</p>
              <div className="cx-purpose-list">
                {[
                  [
                    "menu",
                    "Menu & website",
                    "Fresh photos for your bestsellers",
                    BookOpen,
                  ],
                  [
                    "social",
                    "Social post",
                    "Give people a reason to stop scrolling",
                    Megaphone,
                  ],
                  [
                    "delivery",
                    "Delivery app",
                    "A clear view of the dish they’ll order",
                    Truck,
                  ],
                  [
                    "print",
                    "Print",
                    "Make your menu or flyer stand out",
                    Printer,
                  ],
                ].map(([id, title, desc, Icon]) => {
                  const I = Icon as typeof Camera;
                  return (
                    <button
                      key={String(id)}
                      aria-pressed={b.destination === id}
                      onClick={() =>
                        update({
                          destination: id,
                          format:
                            id === "social"
                              ? "feed"
                              : id === "delivery"
                                ? "doordash"
                                : id === "print"
                                  ? "print"
                                  : "menu",
                          look: id === "delivery" ? "keep" : b.look,
                        })
                      }
                    >
                      <I size={20} />
                      <span>
                        <b>{String(title)}</b>
                        <small>{String(desc)}</small>
                      </span>
                      <span className="cx-radio">
                        {b.destination === id && <Check size={12} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="cx-trust">
                <Check size={15} />
                Your original always stays safe.
              </p>
              <button
                className="cx-link"
                onClick={() => onDestination("menu", "", "")}
              >
                Uploading a menu instead? <ArrowRight size={15} />
              </button>
            </aside>
          </div>
          {b.mode === "photo" && b.sourceId && (
            <div className="cx-quick-start">
              <div>
                <b>Just need a small touch-up?</b>
                <p>
                  Crop, rotate, brighten or warm your photo. No image allowance
                  needed.
                </p>
              </div>
              <button
                className="cx-btn cx-secondary"
                disabled={!!busy}
                onClick={() =>
                  act("Opening quick edits", async () => {
                    update({ resultId: b.sourceId, jobId: "", step: 4 });
                    setAdjust("quick");
                    setAccurate(false);
                    await save();
                  })
                }
              >
                <SlidersHorizontal size={17} />
                Quick edits
              </button>
            </div>
          )}
          <Footer
            label="Choose a look"
            next={() =>
              act("Saving your photo", async () => {
                await ensureDish();
                update({ step: 2 });
                await save();
                await refresh();
              })
            }
            disabled={
              b.mode === "photo"
                ? !b.sourceId
                : !b.name.trim() || !b.description.trim()
            }
            busy={!!busy}
            note="Choose a look, then make it yours"
          />
        </>
      )}
      {b.step === 2 && (
        <>
          <Heading eyebrow="YOUR FOOD. YOUR FEEL." title="How should it feel?">
            Choose the lighting and setting you love. Your dish stays the star.
          </Heading>
          <div className="cx-looks-layout">
            <div>
              <div className="cx-section-line">
                <span>
                  {b.destination === "delivery"
                    ? "Simple settings work best for delivery"
                    : "Recommended looks"}
                </span>
                <button className="cx-link" onClick={() => setMore((v) => !v)}>
                  {more ? "Show fewer" : "More looks"} <ArrowRight size={15} />
                </button>
              </div>
              {more && (
                <div className="cx-chips">
                  {["All", "My looks", "Studio", "Restaurant", "Outdoor"].map(
                    (f) => (
                      <button
                        aria-pressed={filter === f}
                        key={f}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ),
                  )}
                </div>
              )}
              <div className="cx-look-grid">
                {(more
                  ? looks.filter((l) => filter === "All" || l.group === filter)
                  : state.assets.some((a: Row) => a.approved_at)
                    ? [looks[7], ...recommendedLooks.slice(0, 5)]
                    : recommendedLooks
                ).map((l) => (
                  <button
                    key={l.id}
                    aria-pressed={b.look === l.id}
                    className="cx-look"
                    onClick={() => {
                      update({ look: l.id });
                      track("style_selected", b.dishId, { look: l.id });
                    }}
                  >
                    <img
                      src={
                        l.id === "keep" && source
                          ? source
                          : l.id === "restaurant" &&
                              state.restaurant.style.referenceIds[0]
                            ? `/api/assets/${state.restaurant.style.referenceIds[0]}`
                            : l.image
                      }
                      alt={`${l.name} style example`}
                    />
                    <span>
                      <b>{l.name}</b>
                      <small>{l.cue}</small>
                    </span>
                    {b.look === l.id && (
                      <i>
                        <Check size={16} />
                      </i>
                    )}
                  </button>
                ))}
              </div>
              <div className="cx-section-line">
                <span>
                  Examples show plated pasta. Your photo supplies the food.
                </span>
                <button className="cx-link" onClick={() => setFine((v) => !v)}>
                  <SlidersHorizontal size={16} />
                  Fine-tune
                </button>
              </div>
              {fine && (
                <div className="cx-panel cx-fine">
                  <Field label="Food family">
                    <select
                      value={b.family}
                      onChange={(e) => update({ family: e.target.value })}
                    >
                      {foodFamilies.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Surface">
                    <select
                      value={b.surface}
                      onChange={(e) => update({ surface: e.target.value })}
                    >
                      {[
                        "As shown",
                        "Warm wood",
                        "Pale stone",
                        "White seamless",
                      ].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </Field>
                  <fieldset>
                    <legend>Lighting</legend>
                    <div className="cx-lighting">
                      {[
                        ["As shown", "daylight-cafe"],
                        ["Soft daylight", "clean-white"],
                        ["Warm & cozy", "rustic-table"],
                      ].map(([l, img]) => (
                        <button
                          key={l}
                          aria-pressed={b.lighting === l}
                          onClick={() => update({ lighting: l })}
                        >
                          <img src={`/studio/${img}.webp`} alt="" />
                          {l}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <Field label="Plate">
                    <select
                      value={b.plate}
                      onChange={(e) => update({ plate: e.target.value })}
                    >
                      <option value="keep">Keep my plate</option>
                      <option value="white">
                        Change to a simple white plate
                      </option>
                    </select>
                  </Field>
                  <Field
                    label="Camera angle"
                    hint={
                      b.angle !== "keep"
                        ? "Changing angle asks AI to reconstruct unseen parts of the food. Review the result carefully."
                        : undefined
                    }
                  >
                    <select
                      value={b.angle}
                      onChange={(e) => update({ angle: e.target.value })}
                    >
                      <option value="keep">Keep my angle</option>
                      <option value="overhead">Look straight down</option>
                      <option value="three-quarter">View from the side</option>
                    </select>
                  </Field>
                  <Field label="Composition">
                    <select
                      value={b.composition}
                      onChange={(e) => update({ composition: e.target.value })}
                    >
                      <option>Full dish</option>
                      <option>Room around the plate</option>
                      <option>Space above for a headline</option>
                    </select>
                  </Field>
                  <Field label="Anything else? (optional)">
                    <textarea
                      value={b.note}
                      maxLength={1000}
                      onChange={(e) => update({ note: e.target.value })}
                      placeholder="Remove the distracting napkin in the background."
                    />
                  </Field>
                </div>
              )}
            </div>
            <aside className="cx-look-preview">
              <img
                src={styleImage}
                alt={`${selected.name} reference example`}
              />
              <div>
                <span className="cx-pill">
                  {b.look === "keep"
                    ? "Your setting · reference"
                    : "Style example"}
                </span>
                <h2>{selected.name}</h2>
                <p>{selected.cue}</p>
                <small>
                  This is a reference for the look. Your result is created after
                  you choose Create.
                </small>
              </div>
              {b.look === "reference" && (
                <label className="cx-btn cx-secondary">
                  <Upload size={16} />
                  {b.referenceId ? "Replace reference" : "Add reference photo"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={!!busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        void act("Saving your reference", async () => {
                          const form = new FormData();
                          form.set("file", f);
                          form.set(
                            "normalized",
                            await normalizePhoto(f),
                            "reference.jpg",
                          );
                          form.set("kind", "reference");
                          const a = await api("assets", form);
                          update({ referenceId: a.id });
                          await save();
                          await refresh();
                        });
                    }}
                  />
                </label>
              )}
              <div className="cx-preserve">
                <Check size={17} />
                <p>
                  <b>Keep what makes it your dish.</b>
                  <br />
                  Ingredients, portion and identity stay the same. Check the
                  result before using it.
                </p>
              </div>
              {delivery && ["dark", "terrace", "color"].includes(b.look) && (
                <div className="cx-hint">
                  This scene may work better for social. A simple natural
                  setting is a safer choice for delivery.
                  <button
                    className="cx-link"
                    onClick={() => update({ look: "keep" })}
                  >
                    Use my natural setting
                  </button>
                </div>
              )}
            </aside>
          </div>
          <Footer
            back={() => update({ step: 1 })}
            label="Preview & create"
            next={() =>
              act("Saving your look", async () => {
                update({ step: 3 });
                await save();
              })
            }
            busy={!!busy}
            disabled={b.look === "reference" && !b.referenceId}
            note="Browsing looks uses no images"
          />
        </>
      )}
      {b.step === 3 && (
        <>
          <Heading eyebrow="ONE LAST LOOK" title="Ready to create?">
            Check the framing. We’ll make one beautiful photo using your
            choices.
          </Heading>
          <div className="cx-studio-grid">
            <div>
              {source && b.mode === "photo" ? (
                <PhotoFrame
                  src={source}
                  ratio={format.ratio}
                  edits={b.adjustments}
                  onChange={(adjustments) => update({ adjustments })}
                  label="Your original · framing preview"
                />
              ) : (
                <div className="cx-illustration">
                  <Sparkles size={32} />
                  <h2>{b.name}</h2>
                  <p>{b.description}</p>
                  <span>Illustration from your description</span>
                </div>
              )}
              <p className="cx-hint">
                Keep the full plate in view. This shows framing only; lighting
                and setting change when you create.
              </p>
            </div>
            <aside className="cx-panel">
              <Field label="Photo format">
                <select
                  value={b.format}
                  onChange={(e) => update({ format: e.target.value })}
                >
                  {Object.entries(formats).map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              {source && (
                <CropControls
                  value={b.adjustments}
                  onChange={(adjustments) => update({ adjustments })}
                />
              )}
              <div className="cx-reference-small">
                <img src={styleImage} alt="Selected style reference" />
                <div>
                  <span>Style example</span>
                  <b>{selected.name}</b>
                  <button
                    className="cx-link"
                    onClick={() => update({ step: 2 })}
                  >
                    Change look
                  </button>
                </div>
              </div>
              <div className="cx-summary">
                <Check size={16} />
                <p>
                  {selected.name} ·{" "}
                  {b.plate === "keep" ? "keep your plate" : "white plate"} ·
                  keep your food · {format.short.toLowerCase()}
                </p>
              </div>
              <p className="cx-hint">
                Prices, logos and headlines can be added in Post Maker after
                your photo is ready.
              </p>
              {!state.aiConnected && (
                <p className="cx-feedback">
                  Image creation is awaiting its service connection. Your photo
                  and choices will stay saved.
                </p>
              )}
            </aside>
          </div>
          <Footer
            back={() => update({ step: 2 })}
            label="Create my photo"
            next={() => act("Creating your photo", () => generate())}
            busy={!!busy}
            disabled={state.remaining < 1 || !state.aiConnected}
            note={`1 image from your free pilot · ${state.remaining} remaining`}
          />
          {source && !state.aiConnected && (
            <button
              className="cx-link"
              onClick={() => {
                change({ resultId: b.sourceId, step: 4 });
                setAccurate(false);
              }}
            >
              Continue with my original photo <ArrowRight size={16} />
            </button>
          )}
        </>
      )}
      {b.step === 4 && (
        <>
          <Heading
            eyebrow={resultId ? "MADE FOR YOUR DISH" : "PHOTO STUDIO"}
            title={
              resultId
                ? "Your photo is ready."
                : running
                  ? "A little studio magic, coming up."
                  : "Your photo is saved."
            }
          >
            {resultId
              ? "Does this look like the dish you serve? Compare the food, then make it yours."
              : running
                ? "You can leave this screen. Your photo will be waiting here when it’s ready."
                : "You can retry a failed request or return to your choices."}
          </Heading>
          {!resultId ? (
            <div className="cx-generating">
              {source && <img src={source} alt="Your saved original" />}
              <div>
                {running ? (
                  <Sparkles className="cx-spin" size={28} />
                ) : (
                  <Camera size={28} />
                )}
                <h2>
                  {running
                    ? "Creating one photo"
                    : "Image creation needs attention"}
                </h2>
                <p>
                  {state.outputs.find((o: Row) => o.job_id === b.jobId)
                    ?.error || "Your original and selections are safe."}
                </p>
                {!running && (
                  <button
                    className="cx-btn"
                    onClick={() => update({ step: 3, requestKey: "" })}
                  >
                    Review & try again
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="cx-review-layout">
                <div>
                  <div className="cx-section-line">
                    <div className="cx-segment">
                      <button
                        aria-pressed={!before}
                        onClick={() => setBefore(false)}
                      >
                        Your result
                      </button>
                      {source && (
                        <button
                          aria-pressed={before}
                          onClick={() => setBefore(true)}
                        >
                          Before
                        </button>
                      )}
                    </div>
                    <button className="cx-link" onClick={() => setZoom(true)}>
                      <Expand size={16} />
                      Zoom
                    </button>
                  </div>
                  <PhotoFrame
                    src={before && source ? source : `/api/assets/${resultId}`}
                    ratio={format.ratio}
                    edits={
                      adjust === "quick" && !before
                        ? b.adjustments
                        : emptyAdjustments
                    }
                    onChange={
                      adjust === "quick" && !before
                        ? (adjustments) => change({ adjustments })
                        : undefined
                    }
                    label={
                      before
                        ? "Original photo"
                        : asset?.kind === "source"
                          ? "Your original photo"
                          : b.mode === "description"
                            ? "Generated illustration · review against your real dish"
                            : asset?.kind === "edited"
                              ? "Quick adjustment · saved version"
                              : "Generated result"
                    }
                  />
                  <details className="cx-history">
                    <summary>
                      <History size={16} />
                      Original & saved versions
                    </summary>
                    <div>
                      {state.assets
                        .filter(
                          (a: Row) =>
                            a.dish_id === b.dishId &&
                            ["source", "generated", "edited"].includes(a.kind),
                        )
                        .map((a: Row) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              change({
                                resultId: a.id,
                                adjustments: { ...emptyAdjustments },
                              });
                              setBefore(false);
                              setAccurate(false);
                              setAdjust("");
                            }}
                          >
                            <img
                              src={`/api/assets/${a.id}`}
                              alt={`${a.kind === "source" ? "Original" : "Saved version"} of ${b.name || "your dish"}`}
                            />
                            <span>
                              {a.kind === "source"
                                ? "Original"
                                : a.approved_at
                                  ? "Approved"
                                  : "Review photo"}
                            </span>
                          </button>
                        ))}
                    </div>
                  </details>
                </div>
                <aside className="cx-panel">
                  <span className="cx-pill">
                    {asset?.approved_at ? "Approved photo" : "A quick check"}
                  </span>
                  <h2>Still your delicious dish?</h2>
                  <p>
                    Check the ingredients, portion, plate and any packaging.
                  </p>
                  <Field label="Save this dish as">
                    <input
                      value={b.name}
                      maxLength={100}
                      placeholder="Give your dish a name"
                      onChange={(e) => change({ name: e.target.value })}
                    />
                  </Field>
                  <label className="cx-check">
                    <input
                      type="checkbox"
                      checked={accurate}
                      onChange={(e) => setAccurate(e.target.checked)}
                    />
                    This looks like the dish I serve.
                  </label>
                  <button
                    className="cx-btn cx-full"
                    disabled={!!busy || !accurate || !b.name.trim()}
                    onClick={() => act("Saving your approved photo", approve)}
                  >
                    <Check size={18} />
                    Use this photo
                  </button>
                  <div className="cx-rule" />
                  <button
                    className="cx-btn cx-secondary cx-full"
                    onClick={() => {
                      setAdjust(adjust === "quick" ? "" : "quick");
                      setBefore(false);
                    }}
                  >
                    <SlidersHorizontal size={17} />
                    Quick adjustments
                  </button>
                  <button
                    className="cx-link"
                    onClick={() => setAdjust(adjust === "ai" ? "" : "ai")}
                  >
                    <Sparkles size={16} />
                    Change the setting with AI
                  </button>
                  <details className="cx-food-issue">
                    <summary>Something changed in my food</summary>
                    <p>
                      Tell us what changed. We’ll keep the original as the food
                      reference.
                    </p>
                    {[
                      ["ingredients", "Ingredients"],
                      ["portion", "Portion or quantity"],
                      ["plating", "Plate or packaging"],
                      ["artificial", "Looks artificial"],
                    ].map(([id, label]) => (
                      <button
                        className="cx-link"
                        key={id}
                        onClick={() =>
                          act("Saving your feedback", async () => {
                            await api(`assets/${resultId}/reject`, {
                              reason: id,
                            });
                            setAiChanges(
                              `Restore the original ${label.toLowerCase()}. Match my original dish faithfully. `,
                            );
                            setAdjust("ai");
                            setNotice(
                              "Feedback saved. Review your requested changes before applying them.",
                            );
                          })
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </details>
                </aside>
              </div>
              {adjust === "quick" && (
                <div className="cx-panel cx-adjust">
                  <h2>Quick adjustments</h2>
                  <p>
                    Instant edits. No image allowance used. Saved as a new
                    version.
                  </p>
                  <Field label="Crop format">
                    <select
                      value={b.format}
                      onChange={(e) => change({ format: e.target.value })}
                    >
                      {Object.entries(formats).map(([id, f]) => (
                        <option key={id} value={id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <CropControls
                    value={b.adjustments}
                    onChange={(adjustments) => change({ adjustments })}
                    quick
                  />
                  <button
                    className="cx-btn"
                    disabled={!!busy}
                    onClick={() => act("Saving your adjustment", quickSave)}
                  >
                    Save this version
                  </button>
                </div>
              )}
              {adjust === "ai" && (
                <div className="cx-panel cx-adjust">
                  <h2>What would you like to change?</h2>
                  <p>
                    Combine your changes in one request. We’ll use your original
                    food and this version as references.
                  </p>
                  <div className="cx-chips">
                    {[
                      "Remove a distracting object",
                      "Simplify the background",
                      "Bring back my original food",
                    ].map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          setAiChanges((v) => v + (v ? "\n" : "") + t + ". ")
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Field label="Changes to make">
                    <textarea
                      value={aiChanges}
                      maxLength={1000}
                      onChange={(e) => setAiChanges(e.target.value)}
                      placeholder="Remove the napkin and use softer window light."
                    />
                  </Field>
                  <button
                    className="cx-btn"
                    disabled={
                      !!busy ||
                      !aiChanges.trim() ||
                      !state.aiConnected ||
                      state.remaining < 1
                    }
                    onClick={() =>
                      act("Applying your changes", () => generate(resultId))
                    }
                  >
                    <Sparkles size={17} />
                    Apply changes · 1 image
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {b.step === 5 && resultId && (
        <>
          <Heading eyebrow="LOOKING GOOD" title="Where should it go?">
            Your approved photo is saved in My Dishes. Put it to work without
            starting over.
          </Heading>
          <div className="cx-success">
            <img src={`/api/assets/${resultId}`} alt={b.name} />
            <div>
              <span className="cx-pill">
                <Check size={14} />
                Approved & saved
              </span>
              <h2>{b.name}</h2>
              <p>A keeper, ready for your next menu or post.</p>
              {!b.savedLook && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => act("Saving your restaurant look", saveLook)}
                >
                  <Sparkles size={16} />
                  Use this look for my restaurant
                </button>
              )}
            </div>
          </div>
          <div className="cx-destinations">
            {[
              [
                "menu",
                "Add to menu",
                "Make your bestsellers look their best.",
                BookOpen,
              ],
              [
                "post",
                "Make a post",
                "Turn this dish into your next great post.",
                Megaphone,
              ],
              [
                "delivery",
                "Delivery download",
                "Clean, correctly shaped item photos.",
                Truck,
              ],
              ["print", "Print", "A beautiful menu, ready for paper.", Printer],
            ].map(([where, title, desc, Icon]) => {
              const I = Icon as typeof Camera;
              return (
                <button
                  className={
                    (
                      b.destination === "social"
                        ? where === "post"
                        : b.destination === where
                    )
                      ? "recommended"
                      : ""
                  }
                  key={String(where)}
                  onClick={() => {
                    track("destination_selected", b.dishId, {
                      destination: String(where),
                    });
                    if (where === "delivery") {
                      setDownload(true);
                      setFullDish(false);
                      change({
                        format: "doordash",
                        adjustments: { ...emptyAdjustments, fit: false },
                      });
                    } else onDestination(String(where), b.dishId, resultId);
                  }}
                >
                  <I size={24} />
                  <b>{String(title)}</b>
                  <p>{String(desc)}</p>
                  <ArrowRight size={18} />
                </button>
              );
            })}
          </div>
          <button className="cx-link" onClick={() => change({ step: 4 })}>
            Review or adjust this photo
          </button>
        </>
      )}
      {download && (
        <div className="cx-panel cx-download-panel">
          <div className="cx-section-line">
            <h2>Download for delivery</h2>
            <button
              aria-label="Close delivery downloads"
              className="cx-icon"
              onClick={() => setDownload(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="cx-studio-grid">
            <div>
              <PhotoFrame
                src={`/api/assets/${resultId}`}
                ratio={format.ratio}
                edits={{ ...b.adjustments, fit: false }}
                onChange={(adjustments) =>
                  change({ adjustments: { ...adjustments, fit: false } })
                }
                label="Your approved photo · delivery crop"
              />
            </div>
            <div>
              <Field label="Delivery app">
                <select
                  value={b.format}
                  onChange={(e) => {
                    change({ format: e.target.value });
                    setFullDish(false);
                  }}
                >
                  <option value="doordash">DoorDash</option>
                  <option value="uber">Uber Eats</option>
                </select>
              </Field>
              <CropControls
                value={b.adjustments}
                onChange={(adjustments) => {
                  change({ adjustments });
                  setFullDish(false);
                }}
                allowFit={false}
              />
              <label className="cx-check">
                <input
                  type="checkbox"
                  checked={fullDish}
                  onChange={(e) => setFullDish(e.target.checked)}
                />
                The full dish is visible and accurately represents what I serve.
              </label>
              <button
                className="cx-btn"
                disabled={!fullDish || !!busy || b.mode === "description"}
                onClick={() =>
                  act("Preparing your delivery photo", async () => {
                    const output = await photoExport(
                      resultId,
                      b.format,
                      b.adjustments,
                    );
                    downloadBlob(
                      output.blob,
                      `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${b.format}.jpg`,
                    );
                    track("export_complete", resultId, {
                      format: b.format,
                      width: output.width,
                      height: output.height,
                    });
                    setNotice(
                      "Photo downloaded. Upload it in your delivery app’s merchant portal.",
                    );
                  })
                }
              >
                <Download size={17} />
                Download for {b.format === "uber" ? "Uber Eats" : "DoorDash"}
              </button>
              {b.mode === "description" && (
                <p className="cx-hint">
                  Use a photograph of the actual dish for delivery listings.
                  This image was created from a description.
                </p>
              )}
              <p className="cx-hint">
                We check size and format. The delivery app reviews photo
                acceptance. No text or logo is added.
              </p>
              <a
                className="cx-link"
                target="_blank"
                rel="noreferrer"
                href={
                  deliveryProfiles[b.format === "uber" ? "uber" : "doordash"]
                    .source
                }
              >
                Photo requirements & upload guidance <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="cx-zoom-dialog">
          <DialogTitle>{b.name || "Your photo"} · full view</DialogTitle>
          <img
            src={before && source ? source : `/api/assets/${resultId}`}
            alt={before ? "Original photo" : "Photo under review"}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

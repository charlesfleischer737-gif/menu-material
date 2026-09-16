"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
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
  photoStyles,
  formats,
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
import { restaurantPhotoDefaults } from "@/lib/restaurant-look";
import { photoAnalysisRecommendation } from "@/lib/studio-onboarding";
import { PhotoComparison, StudioCreating } from "./studio-onboarding";
import { StudioWorkbench } from "./studio-workbench";
import {
  CropControls,
  Feedback,
  Field,
  ToolHeader,
  PhotoFrame,
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
      ...restaurantPhotoDefaults(state.restaurant),
    }),
    { draft: b, change, save, start, ready, status, read } = draftStore;
  const root = useStepFocus(b.step <= 3 ? 1 : b.step, ready);
  const action = useAction(),
    { act, busy, setNotice, setError } = action;
  const [advice, setAdvice] = useState(""),
    [before, setBefore] = useState(false),
    [compare, setCompare] = useState(true),
    [adjust, setAdjust] = useState(""),
    [aiChanges, setAiChanges] = useState(""),
    [accurate, setAccurate] = useState(false),
    [zoom, setZoom] = useState(false),
    [download, setDownload] = useState(false),
    [fullDish, setFullDish] = useState(false);
  const seedHandled = useRef(""),
    editKey = useRef("");
  const selected =
      looks.find((l) => l.id === b.look) ||
      photoStyles.find((l) => l.id === "menu-stone")!,
    source =
      b.mode === "photo" && b.sourceId ? `/api/assets/${b.sourceId}` : "",
    job = state.jobs.find((j: Row) => j.id === b.jobId),
    output = state.outputs.find(
      (o: Row) => o.job_id === b.jobId && o.status === "completed",
    ),
    resultId = b.resultId || output?.asset_id,
    asset = state.assets.find((a: Row) => a.id === resultId);
  const running = job && ["queued", "processing"].includes(job.status),
    creating =
      !!running ||
      ["Creating your photo", "Applying your changes"].includes(busy),
    format = formats[b.format as PhotoFormat] || formats.menu,
    delivery = ["doordash", "uber"].includes(b.format);
  const restaurantLook = {
    ...looks.find((l) => l.id === "restaurant")!,
    image: state.restaurant.style?.referenceIds?.[0]
      ? `/api/assets/${state.restaurant.style.referenceIds[0]}`
      : photoStyles.find((l) => l.id === state.restaurant.style?.photoPreset)
          ?.image || "/studio/styles/menu-wood.webp",
    cue: "Your saved lighting, setting and photographic style",
    group: "SAVED FOR YOUR RESTAURANT",
  };
  const firstImage = !state.assets.some(
    (a: Row) => a.kind === "generated" && a.approved_at,
  );
  const canCompare = !!source && !!resultId && resultId !== b.sourceId;
  const comparing = canCompare && compare && !before && adjust !== "quick";
  function chooseLook(id: string) {
    if (busy) return;
    const preset = looks.find((l) => l.id === id)!;
    update({
      look: id,
      styleChosen: true,
      ...(preset.category ? { lookCategory: preset.category } : {}),
      surface: "As shown",
      lighting: "As shown",
      plate: id === "keep" ? "keep" : "style",
      angle: preset.angle || "keep",
      composition: "Full dish",
      ...(id === "restaurant"
        ? {
            ...restaurantPhotoDefaults({
              style: { ...state.restaurant.style, autoApply: true },
            }),
          }
        : {}),
    });
    track("style_selected", b.dishId, { look: id, category: preset.category });
  }
  const styleImage =
    b.look === "keep" && source
      ? source
      : b.look === "reference" && b.referenceId
        ? `/api/assets/${b.referenceId}`
        : b.look === "restaurant"
          ? restaurantLook.image
          : selected.image;
  useEffect(() => {
    if (!ready || !seed || seedHandled.current === seed.token) return;
    seedHandled.current = seed.token;
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
          details.style?.photoStyle &&
          details.style.photoStyle === state.restaurant.style?.photoStyle
            ? "restaurant"
            : "menu-stone",
        ...(!prior ? restaurantPhotoDefaults(state.restaurant) : {}),
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
  useEffect(() => {
    if (!ready || !b.sourceId || b.mode !== "photo" || b.step > 3) return;
    const sourceId = b.sourceId;
    const current = read();
    if (
      current.analysisSourceId === sourceId &&
      ["ready", "manual", "uncertain", "unavailable"].includes(
        current.analysisStatus,
      )
    )
      return;
    if (!state.aiConnected) {
      change({
        analysisSourceId: sourceId,
        analysisStatus: "unavailable",
        recommendationFamily: "",
      });
      return;
    }
    let cancelled = false;
    change({
      analysisSourceId: sourceId,
      analysisStatus: "analyzing",
      recommendationFamily: "",
    });
    void api("photo-analysis", { sourceId })
      .then((result) => {
        if (cancelled) return;
        const patch = photoAnalysisRecommendation(read(), result, sourceId);
        if (Object.keys(patch).length) change(patch);
      })
      .catch(() => {
        if (
          cancelled ||
          read().sourceId !== sourceId ||
          read().analysisStatus === "manual"
        )
          return;
        change({
          analysisSourceId: sourceId,
          analysisStatus: "unavailable",
          recommendationFamily: "",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, b.sourceId, b.mode, b.step <= 3, state.aiConnected]);
  function update(patch: Row) {
    const adjusted = [
      "surface",
      "lighting",
      "plate",
      "angle",
      "composition",
      "note",
      "adjustments",
    ].some((key) => key in patch);
    change({
      ...(adjusted ? { styleChosen: true } : {}),
      ...patch,
      requestKey: "",
    });
  }
  async function openQuickEdits() {
    update({ resultId: b.sourceId, jobId: "", step: 4 });
    setAdjust("quick");
    setAccurate(false);
    await save();
  }
  async function openPhotoAsMenu() {
    const photo = await fetch(source);
    if (!photo.ok) throw Error("Your saved photo is unavailable.");
    const form = new FormData();
    form.set("file", await photo.blob(), "menu.jpg");
    const imported = await api("imports", form);
    await refresh();
    onDestination("menu", "", "", { importId: imported.id });
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
        analysisSourceId: "",
        analysisStatus: "none",
        analysisSubject: "",
        recommendationFamily: "",
        recommendationDrink: "other",
        resultId: "",
        jobId: "",
        mode: "photo",
        step: 1,
      });
      setBefore(false);
      setAdvice(
        await photoAdvice(
          new File([normalized], "photo.jpg", { type: "image/jpeg" }),
        ),
      );
      await save();
      await refresh();
      track("upload_complete", a.id);
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
    // Once Create is pressed, late photo analysis must not change the chosen look.
    change({ styleChosen: true, generationStartedAt: Date.now() });
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
    setBefore(false);
    setCompare(true);
    await save();
    await refresh();
    void api("jobs/tick", {})
      .then(refresh)
      .catch(() => {});
  }
  async function approve() {
    if (adjust === "quick")
      throw Error("Save your adjustments as a new version before downloading.");
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
  async function downloadPhoto() {
    if (delivery) {
      setDownload(true);
      setFullDish(false);
      change({ adjustments: { ...emptyAdjustments, fit: false } });
      return;
    }
    const file = await photoExport(resultId, b.format, emptyAdjustments);
    downloadBlob(
      file.blob,
      `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${b.format}.jpg`,
    );
    track("export_complete", resultId, {
      format: b.format,
      width: file.width,
      height: file.height,
    });
    setNotice("Downloaded. Your photo is also saved in My Dishes.");
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
      style: {
        ...styleFor(b, state.restaurant),
        referenceIds: [ref.id],
        autoApply: true,
        photoPreset: photoStyles.some((s) => s.id === b.look)
          ? b.look
          : state.restaurant.style?.photoPreset || "",
        photoDefaults: {
          surface: b.surface,
          lighting: b.lighting,
          plate: b.plate,
          angle: b.angle,
          composition: b.composition,
        },
      },
    });
    change({ savedLook: true });
    await save();
    await refresh();
    setNotice(
      "Your restaurant look is saved and will be used automatically for new photos and posts. Adjust colors and typography in Your restaurant.",
    );
  }
  if (!ready)
    return (
      <p role="status" className="cx-feedback">
        {status}
      </p>
    );
  return (
    <section className="cx-tool cx-feature-page cx-guided-studio" ref={root}>
      <ToolHeader title="Photo Studio" status={status}>
        <div className="cx-button-row">
          {(b.step >= 4 || resultId) && (
            <button
              className="cx-link"
              disabled={!!busy || creating}
              onClick={() => {
                update({ step: b.step >= 4 ? 1 : 4 });
                setAdjust("");
              }}
            >
              {b.step >= 4 ? "Browse styles" : "Back to my result"}
            </button>
          )}
          <button
            className="cx-link"
            disabled={!!busy || creating}
            onClick={() =>
              act("Starting a new photo", async () => {
                await start({
                  ...photoBrief(b.destination),
                  ...restaurantPhotoDefaults(state.restaurant),
                });
                setAdjust("");
                setAccurate(false);
                setAdvice("");
                setBefore(false);
              })
            }
          >
            <ImagePlus size={16} />
            New photo
          </button>
        </div>
      </ToolHeader>
      <Feedback {...action} />
      {b.step <= 3 && (
        <>
          <StudioWorkbench
            draft={b}
            state={state}
            selected={selected}
            styleImage={styleImage}
            source={source}
            busy={busy}
            advice={advice}
            update={update}
            chooseLook={chooseLook}
            uploadPhoto={(file) => void uploadPhoto(file)}
            uploadReference={(file) =>
              void act("Saving your reference", async () => {
                const form = new FormData();
                form.set("file", file);
                form.set(
                  "normalized",
                  await normalizePhoto(file),
                  "reference.jpg",
                );
                form.set("kind", "reference");
                const a = await api("assets", form);
                update({ referenceId: a.id });
                await save();
                await refresh();
              })
            }
            create={() => void act("Creating your photo", () => generate())}
            quickEdit={() => void act("Opening quick edits", openQuickEdits)}
            openMenu={() => void act("Opening your menu", openPhotoAsMenu)}
          />
        </>
      )}
      {b.step === 4 && (
        <>
          {!resultId ? (
            creating ? (
              <StudioCreating
                source={source}
                style={{ ...selected, image: styleImage }}
                queued={!job || job.status === "queued"}
                startedAt={job?.created_at || b.generationStartedAt}
                jobId={b.jobId}
              />
            ) : (
              <div className="cx-generating">
                {source && <img src={source} alt="Your saved original" />}
                <div>
                  <Camera size={28} />
                  <h2>Image creation needs attention</h2>
                  <p>
                    {state.outputs.find((o: Row) => o.job_id === b.jobId)
                      ?.error ||
                      "You don’t need to do anything else. Your original and choices are saved."}
                  </p>
                  <button
                    className="cx-btn"
                    onClick={() => update({ step: 2, requestKey: "" })}
                  >
                    Back to my styles
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="cx-review-layout">
                <div>
                  <div className="cx-section-line">
                    <div className="cx-segment">
                      <button
                        aria-pressed={!before && !comparing}
                        onClick={() => {
                          setBefore(false);
                          setCompare(false);
                        }}
                      >
                        Your result
                      </button>
                      {canCompare && adjust !== "quick" && (
                        <button
                          aria-pressed={comparing}
                          onClick={() => {
                            setBefore(false);
                            setCompare(true);
                          }}
                        >
                          Compare
                        </button>
                      )}
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
                  {comparing ? (
                    <PhotoComparison
                      key={resultId}
                      original={source}
                      result={`/api/assets/${resultId}`}
                      ratio={format.ratio}
                    />
                  ) : (
                    <PhotoFrame
                      src={
                        before && source ? source : `/api/assets/${resultId}`
                      }
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
                  )}
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
                  <h2>
                    {firstImage
                      ? "A quick check, then it’s yours."
                      : "Still your delicious dish?"}
                  </h2>
                  <p>
                    Check the ingredients and portion against your original,
                    then give your dish a name.
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
                    disabled={
                      !!busy ||
                      !accurate ||
                      !b.name.trim() ||
                      adjust === "quick"
                    }
                    onClick={() =>
                      act("Saving your photo", async () => {
                        await approve();
                        await downloadPhoto();
                      })
                    }
                  >
                    <Download size={18} />
                    {delivery
                      ? "Save & check delivery crop"
                      : "Save & download"}
                  </button>
                  <p className="cx-review-save-note">
                    {adjust === "quick"
                      ? "Save your adjustments below, then download your finished photo."
                      : "Also saved in My Dishes for your next menu or post."}
                  </p>
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
          <div className="cx-success">
            <img src={`/api/assets/${resultId}`} alt={b.name} />
            <div>
              <span className="cx-pill">
                <Check size={14} />
                Approved & saved
              </span>
              <h2>{b.name}</h2>
              <p>A keeper, ready for your next menu or post.</p>
              <button
                className="cx-btn cx-success-download"
                disabled={!!busy}
                onClick={() => act("Preparing your photo", downloadPhoto)}
              >
                <Download size={18} />{" "}
                {delivery ? "Prepare delivery download" : "Download my photo"}
              </button>

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

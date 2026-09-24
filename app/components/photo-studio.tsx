"use client";
import { workspacePreferenceKey } from "@/lib/workspace-navigation";
import { draftStatus } from "@/lib/workspace-status";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Expand,
  History,
  Images,
  Plus,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api, normalizePhoto, type Row } from "@/lib/client";
import {
  looks,
  photoStyles,
  formats,
  photoBrief,
  styleFor,
  resolvePhotoLook,
  unavailablePhotoLook,
  emptyAdjustments,
  samplePhoto,
  type PhotoFormat,
} from "@/lib/studio";
import { canvasBlob, drawPhoto, imageBitmap } from "@/lib/photo-export";
import { PhotoFinishSheet } from "./photo-finish-sheet";
import WorkspaceActionBar from "./workspace-action-bar";
import {
  PhotoAdjustmentSheet,
  type PhotoAdjustmentSession,
  type PhotoAdjustmentValues,
} from "./photo-adjustment-sheet";
import { PhotoCorrectionSheet } from "./photo-correction-sheet";
import { PhotoBatchSheet } from "./photo-batch-sheet";
import { SavePhotoLookSheet } from "./save-photo-look-sheet";
import { useStudioNavigation } from "./use-studio-navigation";
import { useStudioTiming } from "./use-studio-timing";
import { recipeFromDraft } from "@/lib/studio-library";
import { occasionName } from "@/lib/studio-occasions";
import { capturedPhotoRecipe, photoLookContext } from "@/lib/photo-recipe";
import { photoAdvice } from "@/lib/photo-advice";
import { restaurantPhotoDefaults } from "@/lib/restaurant-look";
import { photoAnalysisRecommendation } from "@/lib/studio-onboarding";
import { exploreStyleSelection, studioLookPatch } from "@/lib/studio-discovery";
import {
  activeInspirationIds,
  inspirationPatch,
  inspirationStatusMessage,
} from "@/lib/studio-reference";
import { useInspirationAvailability } from "./use-inspiration-availability";
import { PhotoComparison, StudioCreating } from "./studio-onboarding";
import { StudioWorkbench } from "./studio-workbench";
import { radioKeys, radioTab } from "./radio-keys";
import {
  Feedback,
  DraftRecovery,
  SavedDrafts,
  track,
  useAction,
  useCreationDraft,
  useStepFocus,
} from "./creation-shared";
export default function PhotoStudio({
  active = true,
  state,
  refresh,
  seed,
  onSeedUsed,
  onDestination,
}: {
  active?: boolean;
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
  const draftStore = useCreationDraft(
      "studio",
      {
        ...photoBrief(),
        ...restaurantPhotoDefaults(state.restaurant),
      },
      workspacePreferenceKey(state.user.id, state.restaurant.id),
    ),
    { draft: b, change, save, start, ready, status, read } = draftStore;
  const root = useStepFocus(b.step <= 3 ? 1 : b.step, ready);
  const action = useAction(),
    { act, busy, setNotice, setError } = action;
  const [advice, setAdvice] = useState(""),
    [before, setBefore] = useState(false),
    [compare, setCompare] = useState(false),
    [adjust, setAdjust] = useState(""),
    [aiChanges, setAiChanges] = useState(""),
    [accurate, setAccurate] = useState(false),
    [zoom, setZoom] = useState(false),
    [finishOpen, setFinishOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false),
    [saveLookOpen, setSaveLookOpen] = useState(false);
  const [resultRecipe, setResultRecipe] = useState<Row | null>(null);
  const [resultHasGeneration, setResultHasGeneration] = useState(false);
  const resultAction = useRef<HTMLButtonElement>(null);
  const [quickSession, setQuickSession] =
    useState<PhotoAdjustmentSession | null>(null);
  const quickActive = useRef<string | null>(null),
    quickTrigger = useRef<HTMLElement | null>(null);
  function setQuickOpen(open: boolean) {
    quickActive.current = open ? quickSession?.id || null : null;
    setAdjust((current) =>
      open ? "quick" : current === "quick" ? "" : current,
    );
  }
  function returnFromAdjustments(event: Event) {
    event.preventDefault();
    requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      const trigger = quickTrigger.current;
      (trigger?.isConnected && trigger.getClientRects().length
        ? trigger
        : resultAction.current
      )?.focus({ preventScroll: true });
    });
  }
  function returnToResult(event: Event) {
    event.preventDefault();
    requestAnimationFrame(() => {
      if (!document.querySelector('[role="dialog"][data-state="open"]'))
        resultAction.current?.focus({ preventScroll: true });
    });
  }
  useStudioNavigation(
    [
      ...(finishOpen ? ["finish"] : []),
      ...(correctionOpen ? ["correction"] : []),
      ...(batchOpen ? ["batch"] : []),
      ...(saveLookOpen ? ["save-look"] : []),
      ...(zoom ? ["zoom"] : []),
      ...(adjust === "quick" ? ["quick"] : []),
    ],
    (stack) => {
      setFinishOpen(stack.includes("finish"));
      setCorrectionOpen(stack.includes("correction"));
      setBatchOpen(stack.includes("batch"));
      setSaveLookOpen(stack.includes("save-look"));
      setZoom(stack.includes("zoom"));
      setQuickOpen(stack.includes("quick") && !!quickSession);
    },
  );
  const seedHandled = useRef("");
  const selected = resolvePhotoLook(b) || unavailablePhotoLook,
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
    format = formats[b.format as PhotoFormat] || formats.menu;
  const inspirationIds = activeInspirationIds(b, state.restaurant);
  const inspirationId = inspirationIds[0] || "";
  const inspirationAvailability = useInspirationAvailability(
    state.restaurant.id,
    inspirationIds,
    ready && active && b.step <= 3,
  );
  useStudioTiming(
    ready && active ? draftStore.id : "",
    b.sourceId || "",
    exporting
      ? "export"
      : busy === "Preparing your photo" || referenceBusy
        ? "upload"
        : creating
          ? job?.status === "queued"
            ? "queue"
            : "generation"
          : busy ||
              inspirationAvailability.status === "checking" ||
              state.studioAvailability?.creationEnabled === false
            ? null
            : "decision",
  );
  const restaurantLook = {
    ...looks.find((l) => l.id === "restaurant")!,
    image: state.restaurant.style?.referenceIds?.[0]
      ? `/api/assets/${state.restaurant.style.referenceIds[0]}`
      : photoStyles.find((l) => l.id === state.restaurant.style?.photoPreset)
          ?.image || "/studio/styles/menu-wood.webp",
    cue: "Your saved lighting, setting and photographic style",
    group: "SAVED FOR YOUR RESTAURANT",
  };
  useEffect(() => {
    if (b.step === 5 && resultId && !seed?.styleId) setFinishOpen(true);
  }, [b.step, resultId, seed?.styleId]);
  const canCompare = !!source && !!resultId && resultId !== b.sourceId;
  useEffect(() => {
    if (!ready || !draftStore.id) return;
    let session = "";
    try {
      session =
        sessionStorage.getItem("menu-material:studio-session") ||
        crypto.randomUUID();
      sessionStorage.setItem("menu-material:studio-session", session);
    } catch {
      session = crypto.randomUUID();
    }
    const draftId = draftStore.id;
    void save()
      .then(() =>
        track(
          "studio_opened",
          undefined,
          { draftId, guest: false },
          `${session}:${draftId}`,
        ),
      )
      .catch(() => {});
  }, [ready, draftStore.id]);
  useEffect(() => {
    let active = true;
    setResultRecipe(null);
    setResultHasGeneration(asset?.kind === "generated");
    if (resultId)
      void api(`assets/${resultId}/context`)
        .then((context) => {
          if (active) {
            setResultHasGeneration(!!context.jobId);
            const captured = capturedPhotoRecipe(context);
            const usable = state.assets.find(
              (entry: Row) => entry.id === resultId,
            );
            setResultRecipe({
              ...captured,
              ...(usable?.approved_at &&
              !usable.needs_correction &&
              ["generated", "edited"].includes(usable.kind)
                ? { photoReferenceIds: [resultId], referenceId: resultId }
                : {}),
            });
          }
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [resultId, asset?.approved_at, asset?.needs_correction]);
  const comparing = canCompare && compare && !before && adjust !== "quick";
  function chooseLook(id: string) {
    if (busy) return;
    const preset = looks.find((l) => l.id === id);
    if (!preset) return;
    update(studioLookPatch(read(), id, state.restaurant));
  }
  const styleImage =
    b.look === "keep" && source
      ? source
      : b.look === "reference"
        ? inspirationId
          ? `/api/assets/${inspirationId}`
          : ""
        : b.look === "restaurant"
          ? restaurantLook.image
          : selected.image;
  useEffect(() => {
    if (
      !ready ||
      !active ||
      busy ||
      referenceBusy ||
      !seed ||
      seedHandled.current === seed.token
    )
      return;
    seedHandled.current = seed.token;
    void act("Opening your photo", async () => {
      if (seed.styleId) {
        const style = photoStyles.find((entry) => entry.id === seed.styleId);
        if (
          !style ||
          state.studioAvailability?.disabledStyleIds?.includes(style.id)
        ) {
          onSeedUsed();
          throw Error(
            "This style is temporarily unavailable. Choose another style in Explore.",
          );
        }
        const current = read();
        const selection = exploreStyleSelection(
          current,
          style.id,
          state.restaurant,
        )!;
        // Save completed/queued work separately before trying another look.
        // An unfinished photo stays in place, with its deliberate adjustments.
        if (selection.startNew) {
          await start(selection.draft);
        } else {
          change(selection.draft);
          await save();
        }
        setAccurate(false);
        setAdjust("");
        setBefore(false);
        setCompare(false);
        setFinishOpen(false);
        setNotice(
          `${style.name} selected. ${current.sourceId ? "Your photo is ready." : "Add your dish photo to get started."}`,
        );
        onSeedUsed();
        return;
      }
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
      const context = seed.photoId
        ? await api(`assets/${seed.photoId}/context`)
        : null;
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
        ...(context ? capturedPhotoRecipe(context) : {}),
        ...(context
          ? { resultId: seed.photoId, jobId: context.jobId || "", step: 4 }
          : {}),
      });
      setAccurate(false);
      setAdjust("");
      onSeedUsed();
    });
  }, [seed, ready, active, busy, referenceBusy]);
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
  function openQuickEdits(assetId = b.sourceId) {
    const session = {
      id: crypto.randomUUID(),
      assetId,
      format: (b.format in formats ? b.format : "menu") as PhotoFormat,
      adjustments: { ...emptyAdjustments },
    };
    quickTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    quickActive.current = session.id;
    setQuickSession(session);
    setAdjust("quick");
    setError("");
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
  // `fresh` starts a new dish, so a sample and a real photo never share one.
  async function ensureDish(fresh?: { name: string; sample?: boolean }) {
    const dishId = fresh ? "" : b.dishId;
    const prior = state.dishes.find((d: Row) => d.id === dishId);
    const payload = {
      ...prior,
      name: (fresh ? fresh.name : b.name).trim() || "Untitled dish",
      description: fresh ? "" : b.description || "",
      category: prior?.category || "Dishes",
      price: (prior?.price || 0) / 100,
      available: prior ? !!prior.available : true,
      confirmed: true,
      // Sample dishes stay out of guest menus.
      ...(fresh?.sample ? { sample: true } : {}),
      setting: resolvePhotoLook(b)
        ? styleFor(b, state.restaurant).photoStyle
        : prior?.setting || "",
    };
    const data = await api("dishes" + (dishId ? "/" + dishId : ""), payload);
    if (!dishId) change({ dishId: data.id });
    return data.id;
  }
  async function uploadPhoto(file: File, options: { sample?: boolean } = {}) {
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
      const fresh =
        options.sample || b.sample
          ? {
              name: options.sample ? samplePhoto.name : "",
              sample: !!options.sample,
            }
          : undefined;
      const did = await ensureDish(fresh);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("normalized", normalized, "working.jpg");
      fd.set("dishId", did);
      const a = await api("assets", fd);
      update({
        ...(fresh ? { name: fresh.name, description: "" } : {}),
        sample: !!options.sample,
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
        adjustments: { ...emptyAdjustments },
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
    if (b.look === "reference" && !inspirationId)
      throw Error("Add a style reference, or choose one of our looks.");
    if (inspirationAvailability.status !== "ready")
      throw Error(inspirationStatusMessage(inspirationAvailability.status));
    // Once Create is pressed, late photo analysis must not change the chosen look.
    change({ styleChosen: true, generationStartedAt: Date.now() });
    const did = await ensureDish();
    const key = b.requestKey || crypto.randomUUID();
    change({ requestKey: key });
    await save();
    track("generation_submission", did, { format: b.format, look: b.look });
    const j = await api("jobs", {
      studioDraftId: draftStore.id,
      dishId: did,
      sourceId: b.mode === "photo" ? b.sourceId : null,
      parentId: parentId || null,
      revision: parentId ? aiChanges : b.note,
      requestKey: key,
      candidateCount: 1,
      style: styleFor(b, state.restaurant),
      lookContext: photoLookContext(b),
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
    }).catch((error) => {
      if (inspirationIds.length) inspirationAvailability.retry();
      throw error;
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
    setCompare(false);
    await save();
    await refresh();
    if (j.reused)
      setNotice(
        "This matching photo was already saved. No additional image was used.",
      );
    void api("jobs/tick", {})
      .then(refresh)
      .catch(() => {});
  }
  async function approve(confirmed = accurate) {
    if (adjust === "quick")
      throw Error("Save your adjustments as a new version before downloading.");
    if (!confirmed && !asset?.approved_at)
      throw Error("Check that the photo represents the dish you serve.");
    await ensureDish();
    await api(`assets/${resultId}/approve`, { accurate: true });
    change({ step: 4 });
    await save();
    await refresh();
  }
  async function quickSave(
    session: PhotoAdjustmentSession,
    values: PhotoAdjustmentValues,
    requestKey: string,
  ) {
    const im = await imageBitmap(`/api/assets/${session.assetId}`);
    const c = document.createElement("canvas");
    try {
      const width = Math.min(2048, im.width),
        height = Math.round(width / formats[values.format].ratio);
      drawPhoto(c, im, width, height, values.adjustments);
    } finally {
      im.close();
    }
    const fd = new FormData();
    fd.set("file", await canvasBlob(c), "adjusted.jpg");
    fd.set("parentId", session.assetId);
    fd.set("requestKey", requestKey);
    fd.set(
      "edits",
      JSON.stringify({ format: values.format, ...values.adjustments }),
    );
    const data = await api("photo-edits", fd);
    // Back can dismiss an in-flight save. Retain its completed version in history
    // without replacing the photo the owner has since opened.
    const stillOpen = quickActive.current === session.id;
    if (stillOpen) {
      change({
        resultId: data.id,
        format: values.format,
        ...(session.assetId === b.sourceId ? { jobId: "" } : {}),
        adjustments: { ...emptyAdjustments },
        step: 4,
      });
      setAccurate(false);
      setBefore(false);
      setCompare(false);
      setQuickOpen(false);
    }
    const updates = await Promise.allSettled([
      ...(stillOpen ? [save()] : []),
      refresh(),
    ]);
    setNotice(
      updates.some((update) => update.status === "rejected")
        ? "Your new version is saved. Some page details couldn’t refresh; reopen this dish to see its saved versions."
        : stillOpen
          ? "Saved as a new version. Your original and earlier photos are still here."
          : "Your new version is saved in this dish’s history.",
    );
  }
  async function nextPhoto(reuse = false) {
    if (reuse && !resultRecipe)
      throw Error(
        "The saved photo settings are still loading. Try again in a moment.",
      );
    const recipe = reuse
      ? recipeFromDraft({ ...b, ...resultRecipe }, state.restaurant)
      : {};
    setFinishOpen(false);
    await start({
      ...photoBrief(b.destination),
      ...(!reuse ? restaurantPhotoDefaults(state.restaurant) : {}),
      ...recipe,
      ...(reuse
        ? {
            format: b.format,
            referenceId: resultRecipe?.referenceId,
            savedLookId: resultRecipe?.savedLookId,
            savedLookName: resultRecipe?.savedLookName,
            styleIntent: true,
            studioDefaultResolved: true,
          }
        : {}),
    });
    setAdjust("");
    setBefore(false);
    setCompare(false);
    setAccurate(false);
  }
  if (!ready) return <DraftRecovery store={draftStore} title="Photo Studio" />;
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  const shown = before && source ? source : `/api/assets/${resultId}`;
  const shownLabel = before
    ? "Your original"
    : asset?.kind === "source"
      ? "Your original"
      : b.mode === "description"
        ? "Illustration · check it against your dish"
        : asset?.kind === "edited"
          ? "Adjusted version"
          : "Your result";
  const views = [
    { id: "result", label: "Result", show: true },
    { id: "compare", label: "Compare", show: canCompare && adjust !== "quick" },
    { id: "before", label: "Original", show: !!source },
  ].filter((view) => view.show);
  const view = before ? "before" : comparing ? "compare" : "result";
  const versions = state.assets.filter(
    (a: Row) =>
      a.dish_id === b.dishId &&
      ["source", "generated", "edited"].includes(a.kind),
  );
  return (
    <section
      className="cx-tool cx-feature-page cx-guided-studio st-page"
      ref={root}
      data-action-layout
    >
      <header className="st-header">
        <div className="st-header-copy">
          <h1 tabIndex={-1}>Photo Studio</h1>
          <p>{greeting}. What’s on the menu?</p>
        </div>
        <div className="st-header-tools">
          <span
            className="st-save-status"
            role="status"
            aria-live="polite"
            data-error={status === draftStatus.failed || undefined}
          >
            {status}
          </span>
          <SavedDrafts
            kind="studio"
            store={draftStore}
            disabled={!!busy || creating}
            onResume={() => {
              setAccurate(false);
              setAdjust("");
              setAdvice("");
              setBefore(false);
            }}
          />
          {(b.step >= 4 || resultId) && (
            <button
              className="st-text-button"
              disabled={!!busy || creating}
              onClick={() => {
                update({ step: b.step >= 4 ? 1 : 4 });
                setAdjust("");
              }}
            >
              {b.step >= 4 ? "Try another style" : "Back to result"}
            </button>
          )}
          <button
            className="st-pill st-new-photo"
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
            <Plus size={16} />
            New photo
          </button>
        </div>
      </header>
      <DraftRecovery store={draftStore} />
      <Feedback {...action} />
      {b.step <= 3 && (
        <StudioWorkbench
          draft={b}
          state={{ ...state, studioDraftId: draftStore.id }}
          selected={selected}
          styleImage={styleImage}
          source={source}
          busy={busy || (referenceBusy ? "Preparing inspiration" : "")}
          advice={advice}
          update={update}
          chooseLook={chooseLook}
          uploadPhoto={(file, options) => void uploadPhoto(file, options)}
          retryAnalysis={() =>
            void act("Checking your photo", async () => {
              const sourceId = read().sourceId;
              const result = await api("photo-analysis", { sourceId });
              if (read().sourceId === sourceId)
                change(photoAnalysisRecommendation(read(), result, sourceId));
            })
          }
          referencePhoto={
            inspirationId
              ? { id: inspirationId, url: `/api/assets/${inspirationId}` }
              : null
          }
          onReferenceBusyChange={setReferenceBusy}
          inspirationStatus={inspirationAvailability.status}
          retryInspiration={inspirationAvailability.retry}
          applyInspiration={async (selection, base, signal) => {
            let referenceId =
              selection?.kind === "existing" ? selection.photo.id : null;
            if (selection?.kind === "file") {
              const form = new FormData();
              form.set("file", selection.file);
              form.set("normalized", selection.normalized, "reference.jpg");
              form.set("kind", "reference");
              form.set("requestKey", selection.requestKey);
              const a = await api("assets", form);
              referenceId = a.id;
            }
            if (signal.aborted) return;
            update(
              inspirationPatch(
                base,
                referenceId,
                selection?.kind === "existing",
              ),
            );
            await save();
            // The draft is saved; a background refresh failure must not
            // turn a successful application into a second upload attempt.
            void refresh().catch(() => {});
          }}
          create={() => void act("Creating your photo", () => generate())}
          quickEdit={() => openQuickEdits()}
          openMenu={() => void act("Opening your menu", openPhotoAsMenu)}
          refreshAvailability={() => void act("Checking availability", refresh)}
        />
      )}
      {b.step >= 4 &&
        (!resultId ? (
          creating ? (
            <StudioCreating
              source={source}
              style={{ ...selected, image: styleImage }}
              queued={!job || job.status === "queued"}
              startedAt={job?.created_at || b.generationStartedAt}
              jobId={b.jobId}
            >
              {state.outputs
                .filter((o: Row) => o.job_id === b.jobId && o.error)
                .map((o: Row) => (
                  <p className="st-alert" role="status" key={o.id}>
                    {o.error}
                  </p>
                ))}
              {job?.status === "queued" && (
                <button
                  className="st-text-button"
                  disabled={!!busy}
                  onClick={() =>
                    void act("Cancelling queued image", async () => {
                      await api(`jobs/${job.id}/cancel`, {});
                      await refresh();
                    })
                  }
                >
                  Cancel queued image
                </button>
              )}
            </StudioCreating>
          ) : (
            <div className="st-studio st-attention">
              <section className="st-stage" aria-label="Your photo">
                <div className="st-canvas has-photo">
                  {source ? (
                    <>
                      <img
                        className="st-photo"
                        src={source}
                        alt="Your saved original"
                      />
                      <span className="st-canvas-label">Your original</span>
                    </>
                  ) : (
                    <Camera size={32} aria-hidden="true" />
                  )}
                </div>
              </section>
              <aside className="st-inspector" aria-label="Image creation">
                <div className="st-section">
                  <span className="st-badge st-badge-warning">
                    Needs attention
                  </span>
                  <h2 className="st-result-title">
                    This photo couldn’t be created.
                  </h2>
                  <p className="st-result-copy">
                    {state.outputs.find((o: Row) => o.job_id === b.jobId)
                      ?.error ||
                      "You don’t need to do anything else. Your original and choices are saved."}
                  </p>
                </div>
                <div className="st-action st-action-inline">
                  <button
                    className="st-create"
                    onClick={() => update({ step: 2, requestKey: "" })}
                  >
                    Back to my styles
                  </button>
                </div>
              </aside>
            </div>
          )
        ) : (
          <div className="st-studio st-review">
            <section className="st-stage" aria-label="Your photo">
              <div className="st-stage-bar">
                <div
                  className="st-segmented st-view"
                  role="radiogroup"
                  aria-label="Show"
                  onKeyDown={radioKeys}
                  style={{ "--segments": views.length } as CSSProperties}
                >
                  {views.map((entry, index) => (
                    <button
                      key={entry.id}
                      role="radio"
                      aria-checked={view === entry.id}
                      tabIndex={radioTab(
                        index,
                        views.findIndex((item) => item.id === view),
                      )}
                      onClick={() => {
                        setBefore(entry.id === "before");
                        setCompare(entry.id === "compare");
                      }}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
                <button
                  className="st-text-button"
                  onClick={() => setZoom(true)}
                >
                  <Expand size={15} />
                  Zoom
                </button>
              </div>
              <div
                className={`st-canvas has-photo st-result${comparing ? " is-comparing" : ""}`}
                style={{ "--st-ratio": format.ratio } as CSSProperties}
              >
                {comparing ? (
                  <PhotoComparison
                    key={resultId}
                    original={source}
                    result={`/api/assets/${resultId}`}
                    ratio={format.ratio}
                  />
                ) : (
                  <>
                    <img
                      key={shown}
                      className="st-photo"
                      src={shown}
                      alt={
                        before
                          ? "Original photo"
                          : `${shownLabel} of ${b.name || "your dish"}`
                      }
                    />
                    <span className="st-canvas-label">{shownLabel}</span>
                  </>
                )}
              </div>
              {versions.length > 1 && (
                <details className="st-versions">
                  <summary>
                    <History size={15} aria-hidden="true" />
                    Original and saved versions
                    <span>{versions.length}</span>
                  </summary>
                  <div>
                    {versions.map((a: Row) => (
                      <button
                        key={a.id}
                        aria-current={a.id === resultId ? "true" : undefined}
                        onClick={() =>
                          void act("Opening this version", async () => {
                            const context = await api(`assets/${a.id}/context`);
                            change({
                              ...capturedPhotoRecipe(context),
                              resultId: a.id,
                              jobId: context.jobId || "",
                              step: 4,
                              adjustments: { ...emptyAdjustments },
                            });
                            setBefore(false);
                            setAccurate(false);
                            setAdjust("");
                          })
                        }
                      >
                        <img
                          src={`/api/assets/${a.id}`}
                          alt={`${a.kind === "source" ? "Original" : "Saved version"} of ${b.name || "your dish"}`}
                          loading="lazy"
                        />
                        <span>
                          {a.needs_correction
                            ? "Needs correction"
                            : a.kind === "source"
                              ? "Original"
                              : a.approved_at
                                ? "Approved"
                                : "To review"}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <aside className="st-inspector" aria-label="Use your photo">
              <div className="st-section">
                <span className="st-badge">
                  {asset?.approved_at ? (
                    <>
                      <Check size={12} aria-hidden="true" />
                      Approved
                    </>
                  ) : (
                    "Ready for a quick check"
                  )}
                </span>
                <h2 className="st-result-title">
                  Your food. Beautifully presented.
                </h2>
                <p className="st-result-copy">
                  Take a close look at your dish. When it feels right, save a
                  size made for where you’ll use it.
                </p>
              </div>
              <div
                className="st-rows"
                role="group"
                aria-label="More for this photo"
              >
                <button
                  className="st-row"
                  onClick={() => openQuickEdits(resultId)}
                >
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  <span>
                    <b>Quick adjustments</b>
                    <small>Crop, light and warmth · No image used</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button
                  className="st-row"
                  aria-expanded={adjust === "ai"}
                  aria-controls="st-ai-change"
                  onClick={() => setAdjust(adjust === "ai" ? "" : "ai")}
                >
                  <Sparkles size={18} aria-hidden="true" />
                  <span>
                    <b>Change the setting with AI</b>
                    <small>Describe it in your words · Uses 1 image</small>
                  </span>
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
                {adjust === "ai" && (
                  <div className="st-ai" id="st-ai-change">
                    <p>
                      Combine your changes in one request. Your original food
                      and this version stay the reference.
                    </p>
                    <div className="st-ai-chips">
                      {[
                        "Remove a distracting object",
                        "Simplify the background",
                        "Use a cooler background",
                      ].map((t) => (
                        <button
                          key={t}
                          className="st-chip st-chip-quiet"
                          onClick={() =>
                            setAiChanges((v) => v + (v ? "\n" : "") + t + ". ")
                          }
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="st-input"
                      aria-label="Changes to make"
                      value={aiChanges}
                      maxLength={1000}
                      rows={3}
                      onChange={(e) => setAiChanges(e.target.value)}
                      placeholder="Remove the napkin and use softer window light."
                    />
                    <button
                      className="st-pill st-pill-primary st-pill-wide"
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
                      <Sparkles size={16} />
                      Apply changes · 1 image
                    </button>
                  </div>
                )}
                {(resultHasGeneration || !!asset?.needs_correction) && (
                  <button
                    className="st-row"
                    onClick={() => setCorrectionOpen(true)}
                  >
                    <CircleAlert size={18} aria-hidden="true" />
                    <span>
                      <b>
                        {asset?.needs_correction
                          ? "View food correction report"
                          : "Something changed in my food"}
                      </b>
                      <small>
                        {asset?.needs_correction
                          ? "Kept in history, left out of automatic choices"
                          : "Tell us what’s different"}
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
                {b.photoBatchId && (
                  <button className="st-row" onClick={() => setBatchOpen(true)}>
                    <Images size={18} aria-hidden="true" />
                    <span>
                      <b>Return to photo set</b>
                      <small>Continue with your other dishes</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
              <WorkspaceActionBar className="st-action">
                <button
                  ref={resultAction}
                  className="st-create"
                  disabled={!!busy || adjust === "quick"}
                  onClick={() => setFinishOpen(true)}
                >
                  <Download size={18} />
                  Use photo
                </button>
                <p className="st-action-note">
                  {adjust === "quick"
                    ? "Save this version before using your adjusted photo."
                    : "Choose a size and download · No image used"}
                </p>
              </WorkspaceActionBar>
            </aside>
          </div>
        ))}
      {saveLookOpen && resultId && asset?.approved_at && (
        <SavePhotoLookSheet
          onCloseAutoFocus={returnToResult}
          state={state}
          draft={{ ...b, ...resultRecipe }}
          assetId={resultId}
          onClose={() => setSaveLookOpen(false)}
        />
      )}
      {batchOpen && (
        <PhotoBatchSheet
          onCloseAutoFocus={returnToResult}
          state={state}
          draft={{ ...b, ...resultRecipe }}
          onClose={() => setBatchOpen(false)}
          refresh={refresh}
          remember={async (id) => {
            change({ photoBatchId: id });
            await save();
          }}
          onReview={(item, jobId, photoId) => {
            const dish = state.dishes.find(
              (entry: Row) => entry.id === item.dishId,
            );
            change({
              dishId: item.dishId,
              sourceId: item.sourceId,
              name: dish?.name || "",
              description: dish?.description || "",
              jobId,
              resultId: photoId,
              mode: "photo",
              step: 4,
              adjustments: { ...emptyAdjustments },
            });
            setBatchOpen(false);
            setBefore(false);
            setCompare(false);
            setAdjust("");
          }}
        />
      )}
      {correctionOpen && resultId && (
        <PhotoCorrectionSheet
          onCloseAutoFocus={returnToResult}
          assetId={resultId}
          onClose={() => setCorrectionOpen(false)}
          refresh={refresh}
          onOpenCorrection={(jobId, photoId) => {
            change({
              jobId,
              resultId: photoId || "",
              step: 4,
              adjustments: { ...emptyAdjustments },
            });
            setCompare(false);
            setBefore(false);
            setAdjust("");
            setCorrectionOpen(false);
          }}
        />
      )}
      {quickSession && (
        <PhotoAdjustmentSheet
          key={quickSession.id}
          session={quickSession}
          open={adjust === "quick"}
          onOpenChange={setQuickOpen}
          onSave={(values, requestKey) =>
            quickSave(quickSession, values, requestKey)
          }
          onCloseAutoFocus={returnFromAdjustments}
        />
      )}
      {resultId && (
        <PhotoFinishSheet
          measurementContext={{
            draftId: draftStore.id,
            ...(b.sourceId ? { sourceId: b.sourceId } : {}),
          }}
          onBusyChange={setExporting}
          onCloseAutoFocus={returnToResult}
          key={resultId}
          open={finishOpen}
          onOpenChange={setFinishOpen}
          assetId={resultId}
          dishId={b.dishId}
          name={b.name || ""}
          fromPhoto={b.mode === "photo"}
          approved={!!asset?.approved_at}
          initialFormat={b.format}
          preferenceKey={workspacePreferenceKey(
            state.user.id,
            state.restaurant.id,
          )}
          checks={b.exportChecks || {}}
          rememberCheck={(key) =>
            change({
              exportChecks: { ...(read().exportChecks || {}), [key]: true },
            })
          }
          onApprove={() => approve(true)}
          onNew={() => void act("Starting a new photo", () => nextPhoto())}
          onReuse={() => void act("Reusing your look", () => nextPhoto(true))}
          onBatch={() => {
            if (!resultRecipe) {
              setError(
                "The saved photo settings are still loading. Try again.",
              );
              return;
            }
            setFinishOpen(false);
            setBatchOpen(true);
          }}
          onSaveLook={() => {
            if (!resultRecipe) {
              setError(
                "The saved photo settings are still loading. Try again.",
              );
              return;
            }
            setFinishOpen(false);
            setSaveLookOpen(true);
          }}
          onDestination={(target) => {
            setFinishOpen(false);
            track("handoff_started", resultId, {
              destination: target,
              draftId: draftStore.id,
              ...(b.sourceId ? { sourceId: b.sourceId } : {}),
            });
            onDestination(
              target,
              b.dishId,
              resultId,
              target === "post"
                ? { quick: true, occasion: occasionName(b.occasionId) }
                : undefined,
            );
          }}
        />
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="cx-workspace-popover cx-zoom-dialog">
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

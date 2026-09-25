"use client";
import {
  hasSavedContent,
  workspacePreferenceKey,
} from "@/lib/workspace-navigation";
import { draftStatus } from "@/lib/workspace-status";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Ellipsis,
  Expand,
  History,
  Images,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  studioDishRequest,
  adjustedPhotoSize,
  formatNames,
  formatShapes,
  withoutRemovedPhotos,
  type PhotoFormat,
} from "@/lib/studio";
import {
  canvasBlob,
  drawPhoto,
  imageBitmap,
  rotatedSize,
} from "@/lib/photo-export";
import { statePhotoHistory } from "@/lib/photo-destinations";
import { lookProfile } from "@/lib/photo-pack";
import { PhotoFinishSheet } from "./photo-finish-sheet";
import { PhotoPackSheet } from "./photo-pack-sheet";
import { PhotoHubActions, type PhotoAction } from "./photo-hub-actions";
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
import {
  capturedPhotoRecipe,
  failedImageRequest,
  isCorrection,
  jobDetails,
  photoLookContext,
} from "@/lib/photo-recipe";
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
import { cancelledError, heldImageMessage } from "@/lib/creation-progress";
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
    [finishOpen, setFinishOpen] = useState(false),
    [packOpen, setPackOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false),
    [saveLookOpen, setSaveLookOpen] = useState(false);
  const [resultRecipe, setResultRecipe] = useState<Row | null>(null);
  const [resultHasGeneration, setResultHasGeneration] = useState(false);
  const resultAction = useRef<HTMLButtonElement>(null),
    resultHeading = useRef<HTMLHeadingElement>(null),
    failureHeading = useRef<HTMLHeadingElement>(null),
    announcer = useRef<HTMLParagraphElement>(null);
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
      ...(packOpen ? ["pack"] : []),
      ...(correctionOpen ? ["correction"] : []),
      ...(batchOpen ? ["batch"] : []),
      ...(saveLookOpen ? ["save-look"] : []),
      ...(zoom ? ["zoom"] : []),
      ...(adjust === "quick" ? ["quick"] : []),
    ],
    (stack) => {
      setFinishOpen(stack.includes("finish"));
      setPackOpen(stack.includes("pack"));
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
    failedJob: Row | undefined = job?.status === "failed" ? job : undefined,
    // A complimentary food correction: never retried as a paid image.
    failedCorrection = isCorrection(failedJob),
    // A failed AI change or correction keeps the photo it started from.
    startedFrom: string = failedCorrection
      ? state.outputs.find(
          (o: Row) =>
            o.job_id === jobDetails(failedJob).correctionFor &&
            o.status === "completed",
        )?.asset_id || ""
      : failedJob?.parent_id || "",
    keptPhoto =
      startedFrom && state.assets.some((a: Row) => a.id === startedFrom)
        ? startedFrom
        : "",
    resultId = b.resultId || output?.asset_id || keptPhoto,
    asset = state.assets.find((a: Row) => a.id === resultId),
    // Shown with that photo until the owner moves on.
    failedChange = !b.resultId && !output && keptPhoto ? failedJob : undefined;
  // My Dishes owns a saved dish's name; the studio only shows it.
  const dish = state.dishes.find((d: Row) => d.id === b.dishId),
    dishName: string = dish
      ? dish.name === "Untitled dish"
        ? ""
        : dish.name
      : b.name || "";
  // The shown photo's own history, never the editable draft, decides its size
  // and whether it can go to delivery apps and Google (illustrations can't).
  // Only a version saved a moment ago, before the page reloads, borrows the
  // draft's size for its frame.
  const history = asset ? statePhotoHistory(state, asset) : null,
    resultFormat: PhotoFormat =
      history?.format || (b.format in formats ? b.format : "menu"),
    illustrated = !!history && !history.fromPhoto;
  const running = job && ["queued", "processing"].includes(job.status),
    sentTimes: number[] = state.outputs
      .filter(
        (o: Row) =>
          o.job_id === b.jobId &&
          o.submitted_at &&
          !["completed", "failed"].includes(o.status),
      )
      .map((o: Row) => Number(o.submitted_at)),
    creating =
      !!running ||
      ["Creating your photo", "Applying your changes"].includes(busy),
    format = formats[resultFormat];
  const inspirationIds = activeInspirationIds(b, state.restaurant);
  const inspirationId = inspirationIds[0] || "";
  const inspirationAvailability = useInspirationAvailability(
    state.restaurant.id,
    inspirationIds,
    ready && active && b.step <= 3,
  );
  // Activity is recorded against a draft only once it exists on the server:
  // an unsaved draft's id is "unavailable work" there.
  const measuredDraft = draftStore.storedId
    ? { draftId: draftStore.storedId }
    : {};
  useStudioTiming(
    ready && active ? draftStore.storedId : "",
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
          // A new, empty draft isn't saved yet: the open still counts.
          draftStore.stored() ? { draftId, guest: false } : { guest: false },
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
    // Saved photos are titled with the dish’s current name.
    if (ready && dish && b.name !== dishName) change({ name: dishName });
  }, [ready, dish, dishName, b.name, change]);
  useEffect(() => {
    if (b.jobId && output?.asset_id && !b.resultId) {
      change({ resultId: output.asset_id, step: 4 });
      setAccurate(false);
    }
  }, [output?.asset_id, b.jobId]);
  // A photo removed in My Dishes can't be opened, downloaded or restyled.
  // Once the server confirms it is gone (a new upload or version can arrive
  // a moment before the page reloads), take it out of the draft and say so.
  const missingPhotos = [b.mode === "photo" ? b.sourceId : "", b.resultId]
    .filter((id) => id && !state.assets.some((a: Row) => a.id === id))
    .join();
  useEffect(() => {
    if (!ready || !active || !missingPhotos) return;
    let current = true;
    void Promise.all(
      missingPhotos.split(",").map((id) =>
        api(`assets/${id}/context`).then(
          () => "",
          (error) => ((error as { status?: number }).status === 404 ? id : ""),
        ),
      ),
    ).then((gone) => {
      const draft = read();
      const removed = withoutRemovedPhotos(
        {
          sourceId: draft.mode === "photo" ? draft.sourceId : "",
          resultId: draft.resultId,
        },
        gone.filter(Boolean),
      );
      if (!current || !removed) return;
      change(removed.patch);
      setAdjust("");
      setBefore(false);
      setCompare(false);
      setNotice(removed.notice);
    });
    return () => {
      current = false;
    };
  }, [ready, active, missingPhotos]);
  // When the photo being made is ready or stops, say so to screen readers
  // and move focus to what replaced the waiting screen.
  const watchedJob = useRef({ id: "", running: false });
  useEffect(() => {
    const was = watchedJob.current;
    watchedJob.current = { id: b.jobId, running: !!running };
    if (!ready || !job || running || was.id !== b.jobId || !was.running) return;
    const reason: string =
      state.outputs.find((o: Row) => o.job_id === job.id && o.error)?.error ||
      "";
    const message = ["completed", "partial"].includes(job.status)
      ? "Your photo is ready."
      : cancelledError(reason)
        ? "Image cancelled. No images were used."
        : `Your photo couldn’t be created. ${reason}`.trim();
    const region = announcer.current;
    if (region) {
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    }
    requestAnimationFrame(() => {
      const current = document.activeElement;
      // Never take focus from somewhere else the owner has moved to.
      if (
        !active ||
        (current &&
          current !== document.body &&
          !root.current?.contains(current))
      )
        return;
      (
        resultHeading.current ||
        failureHeading.current ||
        resultAction.current
      )?.focus({ preventScroll: true });
    });
  }, [ready, job, running, b.jobId, state.outputs, active, root]);
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
      // A saved photo is adjusted from its own size; an original from the
      // size chosen for it.
      format:
        assetId === resultId
          ? resultFormat
          : ((b.format in formats ? b.format : "menu") as PhotoFormat),
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
  // An existing dish is only read: its name and description are My Dishes’.
  async function ensureDish(fresh?: { name: string; sample?: boolean }) {
    const request = studioDishRequest(b, state.restaurant, fresh);
    if (!request) return b.dishId as string;
    const data = await api("dishes", request);
    change({ dishId: data.id });
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
  function requireCreation() {
    if (!state.aiConnected)
      throw Error(
        "Image creation is not connected yet. Your photo and choices are saved. You can use your original photo while the connection is set up.",
      );
  }
  async function generate(parentId?: string) {
    requireCreation();
    if (b.mode === "photo" && !b.sourceId)
      throw Error("Add your dish photo first.");
    // An illustration of a saved dish follows its My Dishes description.
    if (b.mode === "description" && dish && !dish.description?.trim())
      throw Error("Add a description to this dish in My Dishes first.");
    if (
      b.mode === "description" &&
      !dish &&
      (!b.name.trim() || !b.description.trim())
    )
      throw Error("Add a dish name and a short description first.");
    if (b.look === "reference" && !inspirationId)
      throw Error("Add a style reference, or choose one of our looks.");
    if (inspirationAvailability.status !== "ready")
      throw Error(inspirationStatusMessage(inspirationAvailability.status));
    // Once Create is pressed, late photo analysis must not change the chosen look.
    change({ styleChosen: true, generationStartedAt: Date.now() });
    const did = await ensureDish();
    await submit({
      dishId: did,
      sourceId: b.mode === "photo" ? b.sourceId : null,
      parentId: parentId || null,
      revision: parentId ? aiChanges : b.note,
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
    });
  }
  async function submit(request: Row) {
    const key = read().requestKey || crypto.randomUUID();
    change({ requestKey: key });
    await save();
    const look = request.lookContext?.presetId;
    track("generation_submission", request.dishId, {
      format: request.controls?.format || "menu",
      ...(looks.some((entry) => entry.id === look) ? { look } : {}),
    });
    const j = await api("jobs", {
      studioDraftId: draftStore.id,
      ...request,
      requestKey: key,
    }).catch((error) => {
      if (inspirationIds.length) inspirationAvailability.retry();
      throw error;
    });
    // Start the image now; saving the draft and reloading run alongside it.
    void api("jobs/tick", {})
      .then(refresh)
      .catch(() => {});
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
  }
  async function approve(confirmed = accurate) {
    if (adjust === "quick")
      throw Error("Save your adjustments as a new version before downloading.");
    if (!confirmed && !asset?.approved_at)
      throw Error("Check that the photo represents the dish you serve.");
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
      // Only the crop's real pixels: an enlarged version would pass
      // delivery-app minimums that its detail can't meet.
      const { width, height } = adjustedPhotoSize(
        values.format,
        rotatedSize(im, values.adjustments.rotate),
        values.adjustments,
      );
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
            format: resultFormat,
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
  // Try again resends the failed request itself (its photo, requested change,
  // style and controls), whatever the draft has moved on to. It is a new
  // request, and failed images never use the allowance. A complimentary food
  // correction is never resent as a paid image: its report says what's next.
  async function retry() {
    const failed = state.jobs.find((j: Row) => j.id === b.jobId);
    if (!failed) return generate();
    const request = failedImageRequest(failed);
    if (!request)
      throw Error(
        "A food correction can’t be sent again as a new image. Open its food correction report to see what happens next.",
      );
    requireCreation();
    // The saved draft follows the request again, as the server expects.
    change({
      ...capturedPhotoRecipe({
        jobId: failed.id,
        sourceId: failed.source_id,
        inputMethod: failed.input_method,
        details: jobDetails(failed),
      }),
      dishId: failed.dish_id,
      generationStartedAt: Date.now(),
      ...(read().requestKey === failed.request_key ? { requestKey: "" } : {}),
    });
    await submit(request);
  }
  function handoff(target: string) {
    setFinishOpen(false);
    setPackOpen(false);
    track("handoff_started", resultId, {
      destination: target,
      ...measuredDraft,
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
  }
  function openPhotoAction(action: PhotoAction) {
    if (action === "download") setFinishOpen(true);
    else if (action === "pack") setPackOpen(true);
    else handoff(action);
  }
  function needRecipe() {
    if (resultRecipe) return true;
    setError("The saved photo settings are still loading. Try again.");
    return false;
  }
  if (!ready) return <DraftRecovery store={draftStore} title="Photo Studio" />;
  const resultStyle = lookProfile(
    history?.lookId || b.look,
    state.restaurant.style,
  );
  // Description-only illustrations stay out of delivery apps and Google.
  const resultFromPhoto = !!history?.fromPhoto;
  const failedRetry = !state.aiConnected
    ? "Photo creation is temporarily unavailable. Your work is saved."
    : state.remaining < 1
      ? "You’ve used your available images."
      : "";
  // Why the latest image stopped: cancelled by the owner while it waited, or
  // it couldn't be created.
  const failureText: string =
    state.outputs.find((o: Row) => o.job_id === b.jobId)?.error || "";
  const cancelled = cancelledError(failureText);
  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  // The result can be the untouched original, for example a dish opened from
  // My Dishes before it has a finished photo.
  const resultIsOriginal = asset?.kind === "source";
  const shown = before && source ? source : `/api/assets/${resultId}`;
  const illustration = "Illustration · check it against your dish";
  const shownLabel =
    before || resultIsOriginal
      ? "Your original"
      : illustrated
        ? illustration
        : asset?.kind === "edited"
          ? "Adjusted version"
          : "Your result";
  const views = [
    { id: "result", label: "Result", show: true },
    { id: "compare", label: "Compare", show: canCompare && adjust !== "quick" },
    { id: "before", label: "Original", show: !!source && !resultIsOriginal },
  ].filter((view) => view.show);
  const view = before ? "before" : comparing ? "compare" : "result";
  // Result, Compare and Original already name the photo on the canvas, so it
  // is labeled only when the view choice can't say what it is.
  const canvasLabel = comparing
    ? ""
    : resultIsOriginal
      ? "Your original"
      : illustrated
        ? illustration
        : "";
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
          {/* A quiet label: routine autosaves aren't announced (a failed
              save is, by DraftRecovery), and an empty studio has nothing
              saved to report. */}
          <span
            className="st-save-status"
            data-error={status === draftStatus.failed || undefined}
          >
            {hasSavedContent({ kind: "studio", draft: b }) ||
            b.name?.trim() ||
            b.note?.trim() ||
            status === draftStatus.failed
              ? status
              : ""}
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
      {/* Filled when the photo being made is ready or stops. */}
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        ref={announcer}
      />
      <Feedback {...action} />
      {b.step <= 3 && (
        <StudioWorkbench
          draft={b}
          state={{
            ...state,
            studioDraftId: draftStore.id,
            studioSavedDraftId: draftStore.storedId,
          }}
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
              key={b.jobId}
              source={source}
              style={{ ...selected, image: styleImage }}
              queued={!job || job.status === "queued"}
              requestedAt={b.generationStartedAt}
              createdAt={job?.created_at}
              sentAt={sentTimes.length ? Math.min(...sentTimes) : undefined}
              typicalMs={job?.estimate_ms}
              jobId={b.jobId}
              held={heldImageMessage(
                state.outputs.filter((o: Row) => o.job_id === b.jobId),
              )}
            >
              {state.outputs
                .filter(
                  (o: Row) =>
                    o.job_id === b.jobId && o.error && o.status !== "queued",
                )
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
                  <span
                    className={
                      cancelled ? "st-badge" : "st-badge st-badge-warning"
                    }
                  >
                    {cancelled ? "Cancelled" : "Needs attention"}
                  </span>
                  <h2
                    className="st-result-title"
                    ref={failureHeading}
                    tabIndex={-1}
                  >
                    {cancelled
                      ? "You cancelled this image."
                      : "This photo couldn’t be created."}
                  </h2>
                  <p className="st-result-copy">
                    {cancelled
                      ? "No images were used. Your photo and choices are saved."
                      : failureText ||
                        "You don’t need to do anything else. Your original and choices are saved."}
                  </p>
                </div>
                <div className="st-action st-action-inline">
                  {!failedCorrection && (
                    <button
                      className="st-create"
                      disabled={!!busy || !!failedRetry}
                      onClick={() => void act("Creating your photo", retry)}
                    >
                      {cancelled ? (
                        <Sparkles size={18} aria-hidden="true" />
                      ) : (
                        <RotateCcw size={18} aria-hidden="true" />
                      )}
                      {cancelled ? "Create photo" : "Try again"}
                    </button>
                  )}
                  <button
                    className="st-pill st-pill-quiet st-pill-wide"
                    disabled={!!busy}
                    onClick={() => update({ step: 2, requestKey: "" })}
                  >
                    Back to my styles
                  </button>
                  <p className="st-action-note">
                    {failedCorrection
                      ? "Complimentary corrections aren’t sent again as new images. Open the photo from My Dishes to see its correction report."
                      : failedRetry ||
                        "Same photo and choices · Uses 1 image only if it works"}
                  </p>
                </div>
              </aside>
            </div>
          )
        ) : (
          <div className="st-studio st-review">
            <section className="st-stage" aria-label="Your photo">
              <div className="st-stage-bar">
                {views.length > 1 && (
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
                )}
                <button
                  className="st-text-button"
                  onClick={() => setZoom(true)}
                >
                  <Expand size={15} />
                  Zoom
                </button>
              </div>
              <div
                className={`st-canvas has-photo st-result${canvasLabel ? " has-label" : ""}`}
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
                          : `${shownLabel} of ${dishName || "your dish"}`
                      }
                    />
                    {canvasLabel && (
                      <span className="st-canvas-label">{canvasLabel}</span>
                    )}
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
                              // A saved crop keeps its own size, not the
                              // size of the request it was cropped from.
                              ...(context.jobId
                                ? { format: statePhotoHistory(state, a).format }
                                : {}),
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
                          alt={`${a.kind === "source" ? "Original" : "Saved version"} of ${dishName || "your dish"}`}
                          loading="lazy"
                        />
                        <span>
                          {a.needs_correction
                            ? "Needs correction"
                            : a.kind === "source"
                              ? "Original"
                              : a.approved_at
                                ? "Approved"
                                : "Needs review"}
                        </span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>
            <aside className="st-inspector" aria-label="Use your photo">
              <div className="st-section">
                <div className="st-result-head">
                  <span className="st-badge">
                    {asset?.approved_at ? (
                      <>
                        <Check size={12} aria-hidden="true" />
                        Approved
                      </>
                    ) : (
                      "Needs review"
                    )}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="st-icon-button st-result-more"
                        aria-label="More photo actions"
                        disabled={!!busy}
                      >
                        <Ellipsis size={18} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="cx-workspace-popover ps2-finish-menu"
                      align="end"
                      sideOffset={6}
                      collisionPadding={16}
                    >
                      <DropdownMenuItem
                        onSelect={() =>
                          void act("Starting a new photo", () => nextPhoto())
                        }
                      >
                        Add another photo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          void act("Reusing your look", () => nextPhoto(true))
                        }
                      >
                        Use this look again
                      </DropdownMenuItem>
                      {asset?.approved_at && (
                        <DropdownMenuItem
                          onSelect={() => needRecipe() && setSaveLookOpen(true)}
                        >
                          Save this look
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() => needRecipe() && setBatchOpen(true)}
                      >
                        Apply to more dishes
                      </DropdownMenuItem>
                      {asset?.approved_at && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => handoff("print")}>
                            Create a print menu
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h2
                  className="st-result-title"
                  ref={resultHeading}
                  tabIndex={-1}
                >
                  Your food. Beautifully presented.
                </h2>
                <p className="st-result-copy">
                  Take a close look at your dish. When it feels right, save a
                  size made for where you’ll use it.
                </p>
                {failedChange && (
                  <div className="st-alert">
                    <p>
                      <b>
                        {cancelled
                          ? "You cancelled these changes."
                          : failedCorrection
                            ? "Your food correction couldn’t be created."
                            : "Your changes couldn’t be applied."}
                      </b>{" "}
                      {cancelled
                        ? "No images were used."
                        : failedCorrection
                          ? "See the food correction report for what happens next."
                          : failureText}{" "}
                      This photo is unchanged.
                    </p>
                    <div>
                      {failedCorrection ? (
                        <button
                          className="st-text-button"
                          disabled={!!busy}
                          onClick={() => setCorrectionOpen(true)}
                        >
                          View food correction report
                        </button>
                      ) : (
                        <>
                          <button
                            className="st-text-button"
                            disabled={!!busy || !!failedRetry}
                            onClick={() =>
                              void act("Applying your changes", retry)
                            }
                          >
                            Try again · Uses 1 image only if it works
                          </button>
                          <button
                            className="st-text-button"
                            disabled={!!busy}
                            onClick={() => {
                              setAiChanges(failedChange.prompt || "");
                              setAdjust("ai");
                            }}
                          >
                            Edit my changes
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
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
              <PhotoHubActions
                key={resultId}
                downloadRef={resultAction}
                approved={!!asset?.approved_at}
                disabled={!!busy || adjust === "quick"}
                note={
                  adjust === "quick"
                    ? "Save this version before using your adjusted photo."
                    : asset?.approved_at
                      ? `${formatNames[resultFormat]} · ${formatShapes[resultFormat]} · No image used`
                      : "You’ll confirm the photo once · No image used"
                }
                onApprove={() => approve(true)}
                onAction={openPhotoAction}
              />
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
          draft={{ ...b, ...resultRecipe, format: resultFormat }}
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
            ...measuredDraft,
            ...(b.sourceId ? { sourceId: b.sourceId } : {}),
          }}
          onBusyChange={setExporting}
          onCloseAutoFocus={returnToResult}
          key={resultId}
          open={finishOpen}
          onOpenChange={setFinishOpen}
          assetId={resultId}
          dishId={b.dishId}
          name={dishName}
          fromPhoto={resultFromPhoto}
          approved={!!asset?.approved_at}
          initialFormat={resultFormat}
          style={resultStyle}
          onApprove={() => approve(true)}
          onPack={() => {
            setFinishOpen(false);
            setPackOpen(true);
          }}
        />
      )}
      {resultId && asset?.approved_at && (
        <PhotoPackSheet
          key={`pack-${resultId}`}
          measurementContext={{
            ...measuredDraft,
            ...(b.sourceId ? { sourceId: b.sourceId } : {}),
          }}
          onCloseAutoFocus={returnToResult}
          open={packOpen}
          onOpenChange={setPackOpen}
          assetId={resultId}
          name={dishName}
          fromPhoto={resultFromPhoto}
          style={resultStyle}
        />
      )}
      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="cx-workspace-popover cx-zoom-dialog">
          <DialogTitle>{dishName || "Your photo"} · full view</DialogTitle>
          <img
            src={before && source ? source : `/api/assets/${resultId}`}
            alt={before ? "Original photo" : "Photo under review"}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Upload,
  X,
  Heart,
  BookmarkPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  emptyAdjustments,
  photoStyles,
  styleCategories,
  formats,
  foodFamilies,
  type PhotoFormat,
} from "@/lib/studio";
import { recommendationsForPhoto, drinkKinds } from "@/lib/studio-onboarding";
import {
  lookControls,
  lookMoods,
  lookSummary,
  lookExpectations,
  startingLooks,
  studioLookPatch,
  studioCreationBlock,
  searchIntent,
} from "@/lib/studio-discovery";
import {
  searchStyles,
  styleSearchShortcut,
  maximumStyleQueryLength,
} from "@/lib/studio-search";
import type { PhotoStyle } from "@/lib/photo-styles";
import type { Row } from "@/lib/client";
import { CropControls, Field, PhotoFrame, track } from "./creation-shared";
import { useStudioLibrary } from "./use-studio-library";
import { StudioSavedLooks } from "./studio-saved-looks";
import { StudioOccasions } from "./studio-occasions";
import { PhotoInspirationSheet } from "./photo-inspiration-sheet";
import WorkspaceActionBar from "./workspace-action-bar";
import type {
  InspirationPhoto,
  InspirationSelection,
  InspirationStatus,
} from "@/lib/studio-reference";
import { inspirationStatusMessage } from "@/lib/studio-reference";
import { looks, resolvePhotoLook } from "@/lib/studio";
import { occasionName } from "@/lib/studio-occasions";
import { useStudioNavigation } from "./use-studio-navigation";
import {
  applySavedLook,
  recipeFromDraft,
  type SavedLook,
} from "@/lib/studio-library";

const surfaces = [
  { value: "As shown", title: "Follow this look", image: "menu-stone" },
  { value: "Warm wood", title: "Warm wood", image: "menu-wood" },
  { value: "Pale stone", title: "Pale stone", image: "menu-stone" },
  { value: "White seamless", title: "Clean white", image: "delivery-white" },
];
const lights = [
  { value: "As shown", title: "Follow this look", image: "fine-linen" },
  {
    value: "Soft daylight",
    title: "Soft daylight",
    image: "delivery-daylight",
  },
  { value: "Warm & cozy", title: "Warm & cozy", image: "bar-speakeasy" },
];
const imageFor = (id: string) =>
  photoStyles.find((s) => s.id === id)?.image || photoStyles[0].image;

export function StudioWorkbench({
  draft: b,
  state,
  selected,
  styleImage,
  source,
  busy,
  advice,
  update,
  chooseLook,
  uploadPhoto,
  referencePhoto,
  applyInspiration,
  onReferenceBusyChange,
  inspirationStatus = "ready",
  retryInspiration,
  create,
  quickEdit,
  openMenu,
  refreshAvailability,
}: {
  draft: Row;
  state: Row;
  selected: PhotoStyle;
  styleImage: string;
  source: string;
  busy: string;
  advice: string;
  update: (patch: Row) => void;
  chooseLook: (id: string) => void;
  matchRestaurant: (enabled: boolean) => void;
  uploadPhoto: (file: File) => void;
  referencePhoto: InspirationPhoto | null;
  applyInspiration: (
    selection: InspirationSelection | null,
    base: Row,
    signal: AbortSignal,
  ) => Promise<void>;
  onReferenceBusyChange?: (busy: boolean) => void;
  inspirationStatus?: InspirationStatus;
  retryInspiration?: () => void;
  create: () => void;
  quickEdit: () => void;
  openMenu: () => void;
  refreshAvailability?: () => void;
}) {
  const saved = useStudioLibrary(
    state.guest ? undefined : state.restaurant?.id,
  );
  const [browseTab, setBrowseTab] = useState("all"),
    [filtersOpen, setFiltersOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [saveName, setSaveName] = useState(""),
    [saveError, setSaveError] = useState("");
  const [occasion, setOccasion] = useState(""),
    [detailOccasion, setDetailOccasion] = useState("");
  const saveTrigger = useRef<HTMLButtonElement>(null);
  const lookName = b.savedLookName || selected.name;
  const disabledStyles: string[] =
    state.studioAvailability?.disabledStyleIds || [];
  const creationBlock = studioCreationBlock(b, state.studioAvailability);
  const creationPaused = state.studioAvailability?.creationEnabled === false;
  const measurementContext = {
    ...(state.studioDraftId ? { draftId: state.studioDraftId } : {}),
    ...(b.sourceId ? { sourceId: b.sourceId } : {}),
  };
  useEffect(() => {
    if (
      !saved.ready ||
      !resolvePhotoLook(b) ||
      state.guest ||
      b.studioDefaultResolved ||
      b.sourceId ||
      b.dishId ||
      b.styleIntent
    )
      return;
    const defaultLook = saved.library.looks.find(
      (look) => look.id === saved.library.defaultLookId && !look.archived,
    );
    update({
      ...(defaultLook ? applySavedLook(defaultLook) : {}),
      studioDefaultResolved: true,
      selectionOrigin: "default",
    });
  }, [saved.ready, b.studioDefaultResolved]);
  const [browserOpen, setBrowserOpen] = useState(false),
    [customOpen, setCustomOpen] = useState(false),
    [libraryOpen, setLibraryOpen] = useState(false),
    [inspirationOpen, setInspirationOpen] = useState(false);
  const inspirationSession = useRef<{
    base: Row;
    origin: "browse" | "custom" | "main";
    trigger: HTMLButtonElement | null;
  }>({ base: b, origin: "main", trigger: null });
  const [query, setQuery] = useState(""),
    [mood, setMood] = useState("All"),
    [category, setCategory] = useState("all"),
    [scopedResultCount, setScopedResultCount] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null),
    customDialog = useRef<HTMLDivElement>(null),
    shortcutSection = useRef("");
  const [detail, setDetail] = useState<PhotoStyle | null>(null),
    [dragging, setDragging] = useState(false);
  useStudioNavigation(
    [
      ...(browserOpen ? ["browse"] : []),
      ...(browserOpen && detail ? [`look:${detail.id}`] : []),
      ...(customOpen ? ["custom"] : []),
      ...(libraryOpen ? ["library"] : []),
      ...(saveOpen ? ["save"] : []),
      ...(inspirationOpen ? ["inspiration"] : []),
    ],
    (stack) => {
      setBrowserOpen(stack.includes("browse"));
      const detailId = stack.find((item) => item.startsWith("look:"))?.slice(5);
      setDetail(
        detailId ? looks.find((look) => look.id === detailId) || null : null,
      );
      setCustomOpen(stack.includes("custom"));
      setLibraryOpen(stack.includes("library"));
      setSaveOpen(stack.includes("save"));
      if (stack.includes("inspiration") && !inspirationOpen)
        inspirationSession.current.base = stack.includes("custom")
          ? { ...b, ...controls }
          : { ...b };
      setInspirationOpen(stack.includes("inspiration"));
    },
  );
  const [controls, setControls] = useState<Row>({}),
    [section, setSection] = useState("surface");
  const [undo, setUndo] = useState<Row | null>(null),
    [notice, setNotice] = useState("");
  const upload = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const browseTrigger = useRef<HTMLButtonElement>(null),
    customizeTrigger = useRef<HTMLButtonElement>(null),
    libraryTrigger = useRef<HTMLButtonElement>(null);
  const referenceTrigger = useRef<HTMLButtonElement>(null),
    referenceRetryTrigger = useRef<HTMLButtonElement>(null),
    returnFromReferenceCheck = useRef(false);
  useEffect(() => {
    if (inspirationStatus === "checking" || !returnFromReferenceCheck.current)
      return;
    returnFromReferenceCheck.current = false;
    if (
      document.activeElement === document.body ||
      document.activeElement === referenceRetryTrigger.current
    )
      (inspirationStatus === "ready"
        ? referenceTrigger
        : referenceRetryTrigger
      ).current?.focus({ preventScroll: true });
  }, [inspirationStatus]);
  function openInspiration(
    origin: "browse" | "custom" | "main",
    trigger: HTMLButtonElement,
  ) {
    inspirationSession.current = {
      base: origin === "custom" ? { ...b, ...controls } : { ...b },
      origin,
      trigger,
    };
    setInspirationOpen(true);
  }
  const hasRestaurant = !!(
    state.restaurant?.style?.photoPreset ||
    state.restaurant?.style?.referenceIds?.length
  );
  const restaurantLook: PhotoStyle | undefined = hasRestaurant
    ? {
        id: "restaurant",
        name: "Your restaurant look",
        cue: "A familiar look for your menu",
        group: "Saved",
        prompt: "",
        image: state.restaurant.style.referenceIds?.[0]
          ? `/api/assets/${state.restaurant.style.referenceIds[0]}`
          : imageFor(state.restaurant.style.photoPreset),
      }
    : undefined;
  const suggested = recommendationsForPhoto(b);
  const defaultSaved = saved.library.looks.find(
    (look) => look.id === saved.library.defaultLookId && !look.archived,
  );
  const savedRecommendation: PhotoStyle | undefined = defaultSaved
    ? {
        id: defaultSaved.id,
        name: defaultSaved.name,
        cue: "Your default restaurant look",
        group: "Saved",
        prompt: "",
        image: defaultSaved.previewAssetId
          ? `/api/assets/${defaultSaved.previewAssetId}`
          : imageFor(defaultSaved.recipe.look),
      }
    : undefined;
  const recommendations = startingLooks(
    b,
    suggested,
    defaultSaved && disabledStyles.includes(defaultSaved.recipe.look)
      ? undefined
      : savedRecommendation || restaurantLook,
    [defaultSaved?.recipe.look || state.restaurant?.style?.photoPreset].filter(
      Boolean,
    ),
    disabledStyles,
  );
  const galleryScroll = useRef<HTMLDivElement>(null),
    detailScroll = useRef<HTMLDivElement>(null),
    scrollPosition = useRef(0),
    detailHeading = useRef<HTMLHeadingElement>(null),
    detailReturnKey = useRef(""),
    previousDetail = useRef<string | null>(null);
  function galleryScroller() {
    const gallery = galleryScroll.current;
    if (!gallery) return null;
    return getComputedStyle(gallery).overflowY === "visible"
      ? gallery.closest<HTMLElement>('[role="dialog"]')
      : gallery;
  }
  function rememberGalleryPosition() {
    if (!detail) scrollPosition.current = galleryScroller()?.scrollTop || 0;
  }
  useLayoutEffect(() => {
    const returning = previousDetail.current !== null && !detail;
    previousDetail.current = detail?.id || null;
    if (!browserOpen) return;
    if (detail) {
      const dialog = detailHeading.current?.closest('[role="dialog"]');
      if (dialog) dialog.scrollTop = 0;
      if (detailScroll.current) detailScroll.current.scrollTop = 0;
      detailHeading.current?.focus({ preventScroll: true });
    } else if (galleryScroll.current) {
      const gallery = galleryScroll.current;
      const scroller = galleryScroller();
      if (scroller) scroller.scrollTop = scrollPosition.current;
      if (returning) {
        const trigger = [
          ...gallery.querySelectorAll<HTMLButtonElement>("[data-look-detail]"),
        ].find(
          (button) => button.dataset.lookDetail === detailReturnKey.current,
        );
        trigger?.focus({ preventScroll: true });
      }
    }
  }, [detail, browserOpen]);
  function openDetail(
    style: PhotoStyle,
    occasionId = "",
    trigger?: HTMLButtonElement,
  ) {
    scrollPosition.current = galleryScroller()?.scrollTop || 0;
    detailReturnKey.current = trigger?.dataset.lookDetail || "";
    setDetail(style);
    setDetailOccasion(occasionId);
  }
  const search = useMemo(
    () =>
      searchStyles(
        query,
        mood,
        category === "all"
          ? photoStyles.filter((s) => !disabledStyles.includes(s.id))
          : photoStyles.filter(
              (s) => s.category === category && !disabledStyles.includes(s.id),
            ),
      ),
    [query, mood, category, state.studioAvailability],
  );
  const cards = search.styles;
  const capability =
    browseTab === "all" ? styleSearchShortcut(query, b.family) : null;
  const resultCount =
    browseTab === "all"
      ? cards.length + (capability ? 1 : 0)
      : scopedResultCount;
  function changeQuery(value: string) {
    setQuery(value);
    if (browseTab === "occasions") setOccasion("");
  }
  function searchAllLooks() {
    setBrowseTab("all");
    setMood("All");
    setCategory("all");
    setOccasion("");
    searchInput.current?.focus();
  }
  const format = formats[b.format as PhotoFormat] || formats.menu;
  useEffect(() => {
    if (!browserOpen || !query.trim() || state.guest) return;
    const timer = setTimeout(
      () =>
        track("style_search_used", undefined, {
          ...measurementContext,
          intent: searchIntent(query),
          scope: browseTab,
          resultCount,
          category: browseTab === "all" ? category : "all",
          mood: browseTab === "all" ? mood : "All",
        }),
      500,
    );
    return () => clearTimeout(timer);
  }, [query, mood, category, browseTab, browserOpen, resultCount]);
  const photoReady =
    b.mode === "photo" ? !!source : !!b.name?.trim() && !!b.description?.trim();
  const vesselConflict = b.family === "Drinks" && b.plate !== "keep";
  const inspirationBlock = inspirationStatusMessage(inspirationStatus);
  const canCreate =
    !creationBlock &&
    !inspirationBlock &&
    photoReady &&
    !vesselConflict &&
    !busy &&
    (state.guest || state.aiConnected) &&
    state.remaining > 0 &&
    (b.look !== "reference" || !!referencePhoto) &&
    !b.menuDocument;
  const reason =
    creationBlock ||
    inspirationBlock ||
    (b.menuDocument
      ? "This looks like a menu. Add a photo of one dish."
      : vesselConflict
        ? "Keep your original glass to use this look with a drink."
        : !photoReady
          ? "Add a photo to get started."
          : b.look === "reference" && !referencePhoto
            ? "Add an inspiration photo to use this look."
            : !state.guest && !state.aiConnected
              ? "Photo creation is temporarily unavailable. Your work is saved."
              : state.remaining <= 0
                ? "You’ve used your available images."
                : state.guest
                  ? "Create a free account to continue · 1 of 5 free images"
                  : `Uses 1 image · ${state.remaining} remaining`);
  const showImage =
    b.look === "keep" && source
      ? source
      : inspirationStatus === "unavailable" &&
          styleImage.startsWith("/api/assets/")
        ? ""
        : styleImage;
  const detailExpectations = detail
    ? lookExpectations(b, detail.id, state.restaurant)
    : null;
  function select(id: string, from?: string) {
    if (disabledStyles.includes(id)) {
      setNotice("This look is temporarily unavailable. Choose another look.");
      return;
    }
    setUndo(
      Object.fromEntries(
        [
          "look",
          "lookCategory",
          "studioOverrides",
          "savedLookId",
          "savedLookName",
          "savedLookVersion",
          "occasionId",
          "photoStyleSnapshot",
          "photoReferenceIds",
          "selectionOrigin",
          ...lookControls,
        ].map((key) => [key, b[key]]),
      ),
    );
    chooseLook(id);
    const origin =
      from ||
      (browserOpen
        ? detail && detailOccasion
          ? "occasion"
          : query.trim()
            ? "search"
            : "catalog"
        : "suggestion");
    update({ selectionOrigin: origin });
    if (!state.guest) {
      const rank =
        origin === "search" && browseTab === "all"
          ? cards.findIndex((style) => style.id === id) + 1
          : 0;
      track("look_selected", undefined, {
        ...measurementContext,
        look: id,
        origin,
        ...(rank ? { selectedRank: rank } : {}),
      });
    }
    setBrowserOpen(false);
    setDetail(null);
    setNotice(
      b.studioOverrides?.length
        ? "Look changed. Your custom choices are kept."
        : "Look selected.",
    );
  }
  function useSaved(look: SavedLook) {
    if (!state.guest)
      track("look_selected", undefined, {
        ...measurementContext,
        lookId: look.id,
        version: look.version,
        origin: "saved",
      });
    update({
      ...applySavedLook(look),
      styleIntent: true,
      selectionOrigin: "saved",
    });
    setBrowserOpen(false);
    setDetail(null);
    setNotice(`“${look.name}” is ready for this photo.`);
  }
  async function saveCustomLook(updateExisting = false) {
    setSaveError("");
    try {
      const recipe = recipeFromDraft(
        { ...b, ...controls },
        state.restaurant || {},
      );
      const look = {
        id: updateExisting ? b.savedLookId : crypto.randomUUID(),
        name: saveName.trim(),
        recipe,
        previewAssetId: null,
        archived: false,
        version: 1,
        compatibleSubjects: (recipe.plate === "keep"
          ? ["food", "drinks"]
          : ["food"]) as ("food" | "drinks")[],
      };
      if (
        await saved.mutate((value) => ({
          ...value,
          looks: updateExisting
            ? value.looks.map((item) => (item.id === look.id ? look : item))
            : [...value.looks, look],
        }))
      ) {
        update({
          ...controls,
          savedLookId: look.id,
          savedLookName: look.name,
          savedLookVersion: updateExisting ? (b.savedLookVersion || 1) + 1 : 1,
        });
        setSaveOpen(false);
        setNotice(
          `“${look.name}” is saved. Restaurant defaults are unchanged.`,
        );
      }
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  function customize(initialSection?: string) {
    shortcutSection.current = initialSection || "";
    if (initialSection) setSection(initialSection);
    setControls({
      ...Object.fromEntries(lookControls.map((key) => [key, b[key]])),
      studioOverrides: [...(b.studioOverrides || [])],
      note: b.note || "",
      adjustments: { ...b.adjustments },
    });
    setCustomOpen(true);
  }
  function control(key: string, value: string) {
    setControls((current) => ({
      ...current,
      [key]: value,
      studioOverrides: [...new Set([...(current.studioOverrides || []), key])],
    }));
  }
  function identify(family: string) {
    update({
      family,
      recommendationFamily: family,
      recommendationDrink: "other",
      analysisStatus: "manual",
      analysisSourceId: b.sourceId,
      analysisSubject: "",
      menuDocument: false,
    });
  }
  function accept(files: FileList | null) {
    if (!files?.length || busy) return;
    if (files.length > 1)
      setNotice(`Using ${files[0].name}. Add one dish photo at a time.`);
    uploadPhoto(files[0]);
  }
  const createButton = (
    <button
      className="cx-btn ps2-create"
      disabled={!canCreate}
      onClick={create}
    >
      {busy ? (
        <LoaderCircle size={17} className="cx-spin" />
      ) : (
        <Sparkles size={17} />
      )}
      {busy || "Create photo"}
      {!busy && <ArrowRight size={17} />}
    </button>
  );
  return (
    <>
      {creationPaused ? (
        <section
          className="ps2-unavailable"
          aria-labelledby="studio-unavailable-title"
        >
          <div className="ps2-unavailable-copy">
            <span className="ps2-kicker">YOUR WORK IS STILL HERE</span>
            <h2 id="studio-unavailable-title">
              Photo creation is unavailable.
            </h2>
            <p role="status">{state.studioAvailability.message}</p>
            {!state.guest && (
              <p>
                You can still open saved photos, download them, or crop and
                brighten an original.
              </p>
            )}
            <div className="cx-button-row">
              {!state.guest &&
                (source ? (
                  <button
                    className="cx-btn cx-secondary"
                    disabled={!!busy}
                    onClick={quickEdit}
                  >
                    <SlidersHorizontal size={17} />
                    Crop or brighten
                  </button>
                ) : (
                  <button
                    ref={libraryTrigger}
                    className="cx-btn cx-secondary"
                    disabled={!!busy}
                    onClick={() => setLibraryOpen(true)}
                  >
                    <Images size={17} />
                    Choose an original
                  </button>
                ))}
              {refreshAvailability && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={refreshAvailability}
                >
                  Check availability
                </button>
              )}
            </div>
          </div>
          {source && <img src={source} alt="Your original dish photo" />}
        </section>
      ) : (
        <div className={`ps2-workbench ${photoReady ? "ps2-ready" : ""}`}>
          <section className="ps2-photo-area" aria-label="Your photo">
            <div className="ps2-section-heading">
              <div>
                <span className="ps2-step">01</span>
                <h2>Your photo</h2>
              </div>
              {source && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => upload.current?.click()}
                >
                  <Upload size={15} />
                  Replace
                </button>
              )}
            </div>
            <div
              className={`ps2-canvas ${source && b.mode === "photo" ? "has-photo" : ""} ${dragging ? "is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                accept(e.dataTransfer.files);
              }}
            >
              {source && b.mode === "photo" ? (
                <>
                  <img
                    className="ps2-original"
                    src={source}
                    alt="Your original dish photo"
                  />
                  <span className="ps2-photo-label">Your original</span>
                </>
              ) : b.mode === "description" ? (
                <div className="ps2-description">
                  <span className="ps2-kicker">FROM A DESCRIPTION</span>
                  <h3>Imagine your dish.</h3>
                  <Field label="Dish name">
                    <input
                      value={b.name}
                      maxLength={100}
                      onChange={(e) => update({ name: e.target.value })}
                      placeholder="Roasted tomato pasta"
                    />
                  </Field>
                  <Field label="Ingredients, portion and presentation">
                    <textarea
                      value={b.description}
                      maxLength={2000}
                      onChange={(e) => update({ description: e.target.value })}
                      placeholder="Describe the dish you actually serve."
                    />
                  </Field>
                  <p>
                    Creates an illustration. Check it against the real dish
                    before using it.
                  </p>
                  <button
                    className="cx-link"
                    onClick={() => update({ mode: "photo" })}
                  >
                    Use a real photo instead
                  </button>
                </div>
              ) : (
                <div className="ps2-empty-photo">
                  <span className="ps2-upload-icon">
                    <ImagePlus size={28} strokeWidth={1.5} />
                  </span>
                  <h3>
                    Your food.
                    <br />
                    In its best light.
                  </h3>
                  <p>Add a photo of a dish you serve.</p>
                  <button
                    className="cx-btn"
                    disabled={!!busy}
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={17} />
                    Add a photo
                  </button>
                  <div className="ps2-photo-sources">
                    <button
                      className="cx-link"
                      disabled={!!busy}
                      onClick={() => camera.current?.click()}
                    >
                      <Camera size={16} />
                      Take a photo
                    </button>
                    {!state.guest && (
                      <button
                        ref={libraryTrigger}
                        className="cx-link"
                        disabled={!!busy}
                        onClick={() => setLibraryOpen(true)}
                      >
                        <Images size={16} />
                        My Dishes
                      </button>
                    )}
                  </div>
                  <small>
                    Or drop a photo here · JPG, PNG, HEIC · Up to 20 MB
                  </small>
                </div>
              )}
              {busy && (
                <div className="ps2-preparing" role="status">
                  <LoaderCircle className="cx-spin" size={22} />
                  <span>{busy}</span>
                </div>
              )}
            </div>
            <div className="ps2-photo-foot">
              <span>
                <ShieldCheck size={15} />
                {state.guest
                  ? "Your photo stays on this device until you sign up."
                  : "Your original photo is always kept."}
              </span>
              {source && !state.guest && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={quickEdit}
                >
                  Just crop or brighten
                </button>
              )}
            </div>
            {advice && (
              <p className="ps2-inline-note" role="status">
                {advice}
              </p>
            )}
            {b.menuDocument && (
              <div className="ps2-inline-note">
                <p>
                  Use a single dish photo here, or open this menu in Menu Maker.
                </p>
                <button className="cx-link" onClick={openMenu}>
                  <BookOpen size={16} />
                  Open Menu Maker
                </button>
              </div>
            )}
            {!source && b.mode === "photo" && (
              <button
                className="cx-link ps2-description-link"
                disabled={!!busy}
                onClick={() => update({ mode: "description" })}
              >
                Don’t have a photo?
              </button>
            )}
          </section>
          <section className="ps2-decision" aria-label="Choose your look">
            <div className="ps2-section-heading">
              <div>
                <span className="ps2-step">02</span>
                <h2>Find your look</h2>
              </div>
            </div>
            <p className="ps2-intro">
              A little polish. A new setting. Still your food.
            </p>
            <div
              className="ps2-starting-looks"
              role="group"
              aria-label="Suggested starting looks"
            >
              {recommendations.map((style) => (
                <button
                  key={style.id}
                  className="ps2-starting-look"
                  aria-pressed={
                    b.savedLookId
                      ? b.savedLookId === style.id
                      : b.look === style.id
                  }
                  disabled={!!busy}
                  onClick={() =>
                    defaultSaved?.id === style.id
                      ? useSaved(defaultSaved)
                      : select(style.id)
                  }
                >
                  {style.id === "keep" && !source ? (
                    <span className="ps2-polish-icon">
                      <Sparkles size={24} strokeWidth={1.4} />
                    </span>
                  ) : (
                    <img
                      src={style.id === "keep" ? source : style.image}
                      alt=""
                      width={72}
                      height={72}
                    />
                  )}
                  <span>
                    <b>{style.name}</b>
                    <small>
                      {style.id === "keep"
                        ? "Your setting, beautifully refined"
                        : style.id === "restaurant"
                          ? "Consistent with your restaurant"
                          : style.cue}
                    </small>
                  </span>
                  <span className="ps2-selection">
                    {(b.savedLookId
                      ? b.savedLookId === style.id
                      : b.look === style.id) && (
                      <Check size={13} strokeWidth={3} />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <button
              ref={browseTrigger}
              className="ps2-browse"
              disabled={!!busy}
              onClick={() => {
                setDetail(null);
                setBrowserOpen(true);
              }}
            >
              <Images size={17} />
              <span>{photoReady ? "Browse all looks" : "Explore styles"}</span>
              <ChevronRight size={17} />
            </button>
            <div className="ps2-selected">
              <div className="ps2-selected-heading">
                <span className="ps2-kicker">YOUR LOOK</span>
                <button
                  ref={customizeTrigger}
                  className="cx-link"
                  disabled={!!busy || !resolvePhotoLook(b)}
                  onClick={() => customize()}
                >
                  <SlidersHorizontal size={14} />
                  Customize
                </button>
              </div>
              <b>{lookName}</b>
              {b.occasionId && (
                <span className="ps2-occasion-label">
                  {occasionName(b.occasionId)} collection
                </span>
              )}
              <p>{lookSummary(b).join(" · ")}</p>
              {creationBlock && (
                <p className="ps2-inline-note" role="status">
                  {creationBlock}
                </p>
              )}
              {vesselConflict && (
                <p className="ps2-inline-note">
                  This saved look changes the serving dish. For a drink, keep
                  the glass you serve it in.{" "}
                  <button
                    className="cx-link"
                    onClick={() =>
                      update({
                        plate: "keep",
                        studioOverrides: [
                          ...new Set([...(b.studioOverrides || []), "plate"]),
                        ],
                      })
                    }
                  >
                    Keep my glass
                  </button>
                </p>
              )}
              {(b.look === "reference" || referencePhoto) && (
                <button
                  className="cx-link ps2-reference-entry"
                  ref={referenceTrigger}
                  disabled={!!busy}
                  onClick={(event) =>
                    openInspiration("main", event.currentTarget)
                  }
                >
                  {referencePhoto && inspirationStatus !== "unavailable" ? (
                    <img src={referencePhoto.url} alt="" />
                  ) : (
                    <ImagePlus size={16} />
                  )}
                  {referencePhoto
                    ? inspirationStatus === "unavailable"
                      ? "Replace inspiration photo"
                      : "Edit inspiration photo"
                    : "Add inspiration photo"}
                </button>
              )}
              {inspirationBlock && (
                <div className="ps2-reference-recovery" role="status">
                  <p>{inspirationBlock}</p>
                  {retryInspiration && (
                    <div>
                      <button
                        ref={referenceRetryTrigger}
                        className="cx-link"
                        disabled={!!busy || inspirationStatus === "checking"}
                        onClick={() => {
                          returnFromReferenceCheck.current = true;
                          retryInspiration();
                        }}
                      >
                        {inspirationStatus === "checking"
                          ? "Checking…"
                          : "Check again"}
                      </button>
                      <button
                        className="cx-link"
                        disabled={!!busy}
                        onClick={() => {
                          setQuery("");
                          setCategory("all");
                          setMood("All");
                          setBrowseTab("all");
                          setDetail(null);
                          setBrowserOpen(true);
                        }}
                      >
                        Choose another look
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ps2-notice" role="status">
              {notice && <span>{notice}</span>}
              {undo && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => {
                    update(undo);
                    setUndo(null);
                    setNotice("Previous look restored.");
                  }}
                >
                  <Undo2 size={13} />
                  Undo
                </button>
              )}
            </div>
            <Field label="Made for">
              <select
                value={b.format}
                onChange={(e) =>
                  update({
                    format: e.target.value,
                    destination: ["feed", "story"].includes(e.target.value)
                      ? "social"
                      : ["uber", "door", "doordash"].includes(e.target.value)
                        ? "delivery"
                        : "menu",
                  })
                }
              >
                {Object.entries(formats).map(([id, value]) => (
                  <option key={id} value={id}>
                    {value.label}
                  </option>
                ))}
              </select>
            </Field>
            {source && (
              <Collapsible className="ps2-identify">
                <CollapsibleTrigger className="cx-link">
                  {b.analysisStatus === "analyzing" ? (
                    <>
                      <LoaderCircle size={13} className="cx-spin" />
                      Finding looks for your photo
                    </>
                  ) : b.analysisSubject ? (
                    `Looks like ${b.analysisSubject.toLowerCase()}`
                  ) : (
                    "Get suggestions for your dish"
                  )}
                  <ChevronDown size={13} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Field label="What’s in the photo?">
                    <select
                      value={b.recommendationFamily || ""}
                      onChange={(e) => identify(e.target.value)}
                    >
                      <option value="" disabled>
                        Choose a subject
                      </option>
                      {foodFamilies.map((family) => (
                        <option key={family}>{family}</option>
                      ))}
                    </select>
                  </Field>
                  {b.family === "Drinks" && (
                    <Field label="Type of drink">
                      <select
                        value={b.recommendationDrink || "other"}
                        onChange={(e) =>
                          update({
                            recommendationDrink: e.target.value,
                            analysisStatus: "manual",
                            analysisSourceId: b.sourceId,
                            recommendationFamily: "Drinks",
                          })
                        }
                      >
                        {drinkKinds.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind === "other"
                              ? "Another drink"
                              : kind.charAt(0).toUpperCase() + kind.slice(1)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
            {photoReady && (
              <div className="ps2-desktop-action">
                {createButton}
                <p className="ps2-cost">{reason}</p>
                {!state.guest && state.remaining <= 0 && (
                  <button
                    className="cx-link"
                    onClick={() =>
                      window.dispatchEvent(new Event("plateworthy:plans"))
                    }
                  >
                    View plans
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {photoReady && !creationPaused && (
        <WorkspaceActionBar className="ps2-mobile-action">
          <div>
            <b>{lookName}</b>
            <span>{reason}</span>
          </div>
          {createButton}
        </WorkspaceActionBar>
      )}
      <input
        ref={upload}
        hidden
        disabled={!!busy}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={camera}
        hidden
        disabled={!!busy}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent
          className="cx-workspace-popover ps2-dialog ps2-browser"
          showCloseButton={false}
          onScroll={rememberGalleryPosition}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (!customOpen && !inspirationOpen) browseTrigger.current?.focus();
          }}
        >
          <header className="ps2-dialog-header">
            <div>
              <DialogTitle ref={detailHeading} tabIndex={-1}>
                {detail ? detail.name : "Browse styles"}
              </DialogTitle>
              <DialogDescription>
                {detail
                  ? "Style example · your food stays your food"
                  : "Style examples to make your own."}
              </DialogDescription>
            </div>
            <button
              className="ps2-icon-button"
              aria-label="Close style browser"
              onClick={() => setBrowserOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          {detail ? (
            <>
              <div ref={detailScroll} className="ps2-detail ps2-dialog-scroll">
                <button className="cx-link" onClick={() => setDetail(null)}>
                  <ChevronLeft size={15} />
                  Back to looks
                </button>
                <figure className="ps2-style-example">
                  <img
                    src={detail.image}
                    alt={`${detail.name}: ${detail.cue}`}
                  />
                  <figcaption>Style example</figcaption>
                </figure>
                <div>
                  <span className="ps2-kicker">{detail.group}</span>
                  <p className="ps2-look-description">
                    {detail.description || detail.cue}
                  </p>
                  {detail.bestFor && (
                    <p>
                      <b>Beautiful for</b>
                      <br />
                      {detail.bestFor}
                    </p>
                  )}
                  {detailExpectations && (
                    <section
                      className="ps2-expectations"
                      aria-label="Your photo settings"
                    >
                      <h4>
                        {detailExpectations.fromPhoto
                          ? "With your photo"
                          : "For your illustration"}
                      </h4>
                      <dl>
                        {detailExpectations.rows.map((row) => (
                          <div key={row.label}>
                            <dt>{row.label}</dt>
                            <dd>
                              {row.value}
                              {row.custom && <span>Your choice</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {detailExpectations.framing && (
                        <p>
                          Framing: {detailExpectations.framing} · Your choice
                        </p>
                      )}
                      {detailExpectations.angleChanged && (
                        <p>
                          A new angle may reveal parts of the dish that aren’t
                          visible in your photo.
                        </p>
                      )}
                      {detailExpectations.vesselConflict && (
                        <p>
                          Keep your original glass in Customize before creating
                          this drink photo.
                        </p>
                      )}
                      <p className="ps2-fidelity">
                        <ShieldCheck size={16} />
                        {detailExpectations.fromPhoto
                          ? "Your food and portion stay the same. Custom choices carry over when you use this look."
                          : "Created from your description. Review the result against the real dish before using it."}
                      </p>
                    </section>
                  )}
                  <button
                    className="cx-link ps2-detail-favorite"
                    aria-pressed={saved.library.favorites.includes(detail.id)}
                    disabled={saved.busy || !saved.ready}
                    onClick={() => void saved.favorite(detail.id)}
                  >
                    <Heart
                      size={17}
                      fill={
                        saved.library.favorites.includes(detail.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                    {saved.library.favorites.includes(detail.id)
                      ? "Saved to favorites"
                      : "Save to favorites"}
                  </button>
                  {saved.error && (
                    <p role="alert">
                      {saved.error}
                      <button
                        className="cx-link"
                        disabled={saved.busy}
                        onClick={() => void saved.reload()}
                      >
                        Reload saved looks
                      </button>
                    </p>
                  )}
                </div>
              </div>
              <footer className="ps2-dialog-footer">
                <span>
                  {disabledStyles.includes(detail.id)
                    ? "This look is temporarily unavailable. Choose another look."
                    : detailExpectations?.fromPhoto &&
                        detail.angle &&
                        detail.angle !== "keep" &&
                        !detailExpectations.angleChanged
                      ? "Your camera angle is kept. Change it in Customize."
                      : "Example for inspiration, not a preview of your dish."}
                </span>
                <button
                  className="cx-btn"
                  disabled={!!busy || disabledStyles.includes(detail.id)}
                  onClick={() => {
                    select(detail.id);
                    if (detailOccasion) update({ occasionId: detailOccasion });
                  }}
                >
                  Use this look
                  <ArrowRight size={16} />
                </button>
              </footer>
            </>
          ) : (
            <>
              <div
                ref={galleryScroll}
                className="ps2-browser-content ps2-dialog-scroll"
                onScroll={rememberGalleryPosition}
              >
                <div className="ps2-browser-tools">
                  <div
                    className="ps2-browser-tabs"
                    role="group"
                    aria-label="Look collections"
                  >
                    <button
                      aria-pressed={browseTab === "all"}
                      onClick={() => setBrowseTab("all")}
                    >
                      All looks
                    </button>
                    <button
                      aria-pressed={browseTab === "occasions"}
                      onClick={() => setBrowseTab("occasions")}
                    >
                      Occasions
                    </button>
                    <button
                      aria-pressed={browseTab === "saved"}
                      onClick={() => setBrowseTab("saved")}
                    >
                      Saved
                    </button>
                  </div>
                  {saved.error && (
                    <p className="ps2-inline-note" role="alert">
                      {saved.error}{" "}
                      <button
                        className="cx-link"
                        onClick={() => void saved.reload()}
                      >
                        Reload saved looks
                      </button>
                    </p>
                  )}
                  <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                    <div className="ps2-browser-search-row">
                      <div
                        className="ps2-search"
                        role="search"
                        aria-label="Style browser"
                      >
                        <Search size={19} />
                        <input
                          ref={searchInput}
                          aria-label={
                            browseTab === "saved"
                              ? "Search saved looks"
                              : browseTab === "occasions"
                                ? "Search occasions"
                                : "Search all looks"
                          }
                          maxLength={maximumStyleQueryLength}
                          value={query}
                          onChange={(e) => changeQuery(e.target.value)}
                          placeholder={
                            browseTab === "saved"
                              ? "Search a name, setting or light…"
                              : browseTab === "occasions"
                                ? "Try Christmas, football, summer…"
                                : "Try warm wood, café, keep my plate…"
                          }
                        />
                        {query && (
                          <button
                            aria-label="Clear search"
                            onClick={() => {
                              changeQuery("");
                              searchInput.current?.focus();
                            }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                      {browseTab === "all" &&
                        (!capability || cards.length > 0) && (
                          <CollapsibleTrigger asChild>
                            <button className="cx-btn cx-secondary ps2-filter-trigger">
                              <SlidersHorizontal size={16} />
                              Filters
                              {(mood !== "All" || category !== "all") && (
                                <span className="ps2-filter-count">
                                  {Number(mood !== "All") +
                                    Number(category !== "all")}
                                </span>
                              )}
                            </button>
                          </CollapsibleTrigger>
                        )}
                    </div>
                    {browseTab === "all" &&
                      (!capability || cards.length > 0) && (
                        <CollapsibleContent>
                          <div className="ps2-filters">
                            <div
                              className="ps2-moods"
                              role="group"
                              aria-label="Mood"
                            >
                              {lookMoods.map((value) => (
                                <button
                                  key={value}
                                  aria-pressed={mood === value}
                                  onClick={() => setMood(value)}
                                >
                                  {value}
                                </button>
                              ))}
                            </div>
                            <select
                              aria-label="Type of look"
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                            >
                              <option value="all">All looks</option>
                              {styleCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </CollapsibleContent>
                      )}
                  </Collapsible>
                  {browseTab === "all" && (
                    <div className="ps2-search-summary">
                      <p className="ps2-result-count" role="status">
                        {capability && !cards.length ? (
                          "A choice you can customize"
                        ) : (
                          <>
                            {cards.length} {search.related ? "related " : ""}
                            {cards.length === 1 ? "look" : "looks"}
                            {query ? ` for “${query}”` : " to make your own"}
                            {mood !== "All" ? ` · ${mood}` : ""}
                            {category !== "all"
                              ? ` · ${styleCategories.find((entry) => entry.id === category)?.name || category}`
                              : ""}
                          </>
                        )}
                      </p>
                      {(mood !== "All" || category !== "all") && (
                        <button
                          className="cx-link"
                          onClick={() => {
                            setMood("All");
                            setCategory("all");
                            searchInput.current?.focus();
                          }}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="ps2-gallery-scroll">
                  {capability && (
                    <div className="ps2-search-shortcut">
                      <SlidersHorizontal size={22} aria-hidden="true" />
                      <div>
                        <h3>{capability.title}</h3>
                        <p>{capability.description}</p>
                        <button
                          className="cx-link"
                          disabled={!!busy}
                          onClick={() => {
                            setBrowserOpen(false);
                            customize(capability.section);
                          }}
                        >
                          {capability.action}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                  {browseTab === "occasions" ? (
                    <StudioOccasions
                      onSearchAll={searchAllLooks}
                      onResultCount={setScopedResultCount}
                      disabledStyleIds={disabledStyles}
                      timezone={state.restaurant?.timezone}
                      query={query}
                      active={occasion}
                      onActive={setOccasion}
                      explore={openDetail}
                    />
                  ) : browseTab === "saved" ? (
                    <StudioSavedLooks
                      onSearchAll={searchAllLooks}
                      onResultCount={setScopedResultCount}
                      disabledStyleIds={disabledStyles}
                      store={saved}
                      restaurantLook={restaurantLook}
                      select={select}
                      apply={useSaved}
                      guest={!!state.guest}
                      query={query}
                    />
                  ) : cards.length ? (
                    <div className="ps2-gallery">
                      {cards.map((style) => (
                        <article
                          key={style.id}
                          className="ps2-gallery-card"
                          data-selected={b.look === style.id}
                        >
                          <button
                            className="ps2-card-detail"
                            data-look-detail={`catalog-image:${style.id}`}
                            onClick={(event) =>
                              openDetail(style, "", event.currentTarget)
                            }
                            aria-label={`Explore ${style.name}`}
                          >
                            <img
                              src={style.image}
                              alt={style.cue}
                              loading="lazy"
                              width={512}
                              height={512}
                            />
                          </button>
                          <div className="ps2-card-bottom">
                            <button
                              data-look-detail={`catalog-label:${style.id}`}
                              onClick={(event) =>
                                openDetail(style, "", event.currentTarget)
                              }
                            >
                              <b>{style.name}</b>
                              <span>
                                {search.relatedIds.includes(style.id)
                                  ? "Related · "
                                  : ""}
                                {style.cue}
                              </span>
                            </button>
                            <div className="ps2-card-actions">
                              <button
                                className="cx-btn cx-secondary ps2-card-use"
                                aria-label={`Use ${style.name}`}
                                aria-pressed={b.look === style.id}
                                disabled={!!busy}
                                onClick={() => select(style.id)}
                              >
                                {b.look === style.id ? "Selected" : "Use look"}
                              </button>
                              <button
                                className="ps2-favorite"
                                aria-label={`${saved.library.favorites.includes(style.id) ? "Remove" : "Add"} ${style.name} ${saved.library.favorites.includes(style.id) ? "from" : "to"} favorites`}
                                aria-pressed={saved.library.favorites.includes(
                                  style.id,
                                )}
                                disabled={saved.busy || !saved.ready}
                                onClick={() => void saved.favorite(style.id)}
                              >
                                <Heart
                                  size={16}
                                  fill={
                                    saved.library.favorites.includes(style.id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : capability ? null : (
                    <div className="ps2-empty-results">
                      <Search size={28} />
                      <h3>No looks found yet.</h3>
                      <p>
                        Try a mood, a color or a surface — or build your own.
                      </p>
                      <button
                        className="cx-btn"
                        onClick={() => {
                          setQuery("");
                          setMood("All");
                          setCategory("all");
                          searchInput.current?.focus();
                        }}
                      >
                        Show all looks
                      </button>
                      <button
                        className="cx-link"
                        onClick={() => {
                          setBrowserOpen(false);
                          customize();
                        }}
                      >
                        Customize my look
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {(!capability || cards.length > 0) && (
                <footer className="ps2-dialog-footer">
                  <span className="ps2-browser-current" role="status">
                    Current look: {lookName}
                  </span>
                  <button
                    className="cx-link"
                    disabled={!!busy}
                    onClick={(event) =>
                      openInspiration("browse", event.currentTarget)
                    }
                  >
                    <ImagePlus size={17} />
                    Use a photo as inspiration
                    <ArrowRight size={15} />
                  </button>
                </footer>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent
          ref={customDialog}
          className="cx-workspace-popover ps2-dialog ps2-customizer"
          showCloseButton={false}
          onOpenAutoFocus={(e) => {
            if (!shortcutSection.current) return;
            const target = [
              ...(customDialog.current?.querySelectorAll<HTMLButtonElement>(
                "[data-control-section]",
              ) || []),
            ].find(
              (button) =>
                button.dataset.controlSection === shortcutSection.current,
            );
            if (target) {
              e.preventDefault();
              target.focus();
            }
            shortcutSection.current = "";
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (!inspirationOpen) customizeTrigger.current?.focus();
          }}
        >
          <header className="ps2-dialog-header">
            <div>
              <span className="ps2-kicker">{lookName}</span>
              <DialogTitle>Make it yours.</DialogTitle>
              <DialogDescription>
                A few thoughtful choices. No prompt needed.
              </DialogDescription>
            </div>
            <button
              className="ps2-icon-button"
              aria-label="Cancel customization"
              onClick={() => setCustomOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          <div className="ps2-dialog-scroll ps2-custom-scroll">
            <div className="ps2-recipe">
              {showImage ? (
                <img src={showImage} alt="Current look example" />
              ) : (
                <p>
                  Your saved recipe is retained. No example photo is attached.
                </p>
              )}
              <p>{lookSummary({ ...b, ...controls }).join(" · ")}</p>
            </div>
            {[
              { key: "surface", name: "Setting", value: controls.surface },
              {
                key: "plate",
                name: b.family === "Drinks" ? "Glass" : "Serving dish",
                value:
                  b.family === "Drinks" || controls.plate === "keep"
                    ? "Keep mine"
                    : controls.plate === "white"
                      ? "Simple white"
                      : "Follow this look",
              },
              { key: "lighting", name: "Light", value: controls.lighting },
              { key: "framing", name: "Framing", value: controls.composition },
            ].map((item) => (
              <Collapsible
                key={item.key}
                className="ps2-control-group"
                open={section === item.key}
                onOpenChange={(open) => setSection(open ? item.key : "")}
              >
                <CollapsibleTrigger
                  className="ps2-control-heading"
                  data-control-section={item.key}
                >
                  <b>{item.name}</b>
                  <span>
                    {item.value === "As shown"
                      ? "Follow this look"
                      : item.value}
                  </span>
                  <ChevronDown size={17} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {(item.key === "surface" || item.key === "lighting") && (
                    <div
                      className="ps2-visual-options"
                      role="group"
                      aria-label={item.name}
                    >
                      {(item.key === "surface" ? surfaces : lights).map(
                        (option) => (
                          <button
                            key={option.value}
                            aria-pressed={controls[item.key] === option.value}
                            onClick={() => control(item.key, option.value)}
                          >
                            <img
                              src={
                                option.value === "As shown"
                                  ? showImage
                                  : imageFor(option.image)
                              }
                              alt=""
                              loading="lazy"
                            />
                            <span>
                              {option.title}
                              {controls[item.key] === option.value && (
                                <Check size={14} />
                              )}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  )}
                  {item.key === "plate" &&
                    (b.family === "Drinks" ? (
                      <p className="ps2-control-help">
                        We keep your glass, ice, garnish and liquid level true
                        to the drink you serve.
                      </p>
                    ) : (
                      <>
                        <div
                          className="ps2-ware-options"
                          role="group"
                          aria-label="Serving dish"
                        >
                          {[
                            {
                              value: "keep",
                              name: "Keep mine",
                              help: "Your original serving dish",
                            },
                            {
                              value: "style",
                              name: "Follow this look",
                              help: "May replace your serving dish",
                            },
                            {
                              value: "white",
                              name: "Simple white",
                              help: "Replace with white serving ware",
                            },
                          ].map((option) => (
                            <button
                              key={option.value}
                              aria-pressed={controls.plate === option.value}
                              onClick={() => control("plate", option.value)}
                            >
                              <span
                                className={`ps2-ware ps2-ware-${option.value}`}
                              >
                                {option.value === "keep" && (
                                  <ShieldCheck size={22} />
                                )}
                              </span>
                              <b>{option.name}</b>
                              <small>{option.help}</small>
                            </button>
                          ))}
                        </div>
                        {controls.plate !== "keep" && (
                          <p className="ps2-control-help">
                            This changes the serving dish. Ingredients, portions
                            and meaningful branding must stay the same.
                          </p>
                        )}
                      </>
                    ))}
                  {item.key === "framing" && (
                    <div className="ps2-framing">
                      <Field label="Composition">
                        <select
                          value={controls.composition || "Full dish"}
                          onChange={(e) =>
                            control("composition", e.target.value)
                          }
                        >
                          <option>Full dish</option>
                          <option>Close-up detail</option>
                          <option>Space above for a headline</option>
                          <option>Room around the plate</option>
                        </select>
                      </Field>
                      <Field label="Camera angle">
                        <select
                          value={controls.angle || "keep"}
                          onChange={(e) => control("angle", e.target.value)}
                        >
                          <option value="keep">Keep my photo’s angle</option>
                          <option value="overhead">From above</option>
                          <option value="three-quarter">At an angle</option>
                        </select>
                      </Field>
                      {controls.angle !== "keep" && (
                        <p className="ps2-control-help">
                          A new angle may reveal details the original photo
                          doesn’t show. Check the result carefully.
                        </p>
                      )}
                      {source && (
                        <Collapsible>
                          <CollapsibleTrigger className="cx-link">
                            Adjust crop
                            <ChevronDown size={14} />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <PhotoFrame
                              src={source}
                              ratio={format.ratio}
                              edits={controls.adjustments}
                            />
                            <CropControls
                              value={controls.adjustments}
                              onChange={(adjustments) =>
                                setControls((current) => ({
                                  ...current,
                                  adjustments,
                                }))
                              }
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
            <button
              className="cx-link ps2-custom-inspiration"
              disabled={!!busy}
              onClick={(event) =>
                openInspiration("custom", event.currentTarget)
              }
            >
              <ImagePlus size={17} />
              {referencePhoto
                ? "Edit inspiration photo"
                : "Use a photo as inspiration"}
              <ArrowRight size={15} />
            </button>
            <Collapsible className="ps2-note-control">
              <CollapsibleTrigger className="cx-link">
                Add a note (optional)
                <ChevronDown size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Field label="Anything else about the setting?">
                  <textarea
                    maxLength={500}
                    value={controls.note || ""}
                    onChange={(e) =>
                      setControls((current) => ({
                        ...current,
                        note: e.target.value,
                      }))
                    }
                    placeholder="For example, leave some space on the left."
                  />
                </Field>
              </CollapsibleContent>
            </Collapsible>
            {!state.guest && (
              <button
                ref={saveTrigger}
                className="cx-link ps2-save-look"
                disabled={!saved.ready || saved.busy}
                onClick={() => {
                  setSaveName(b.savedLookName || selected.name);
                  setSaveError("");
                  setSaveOpen(true);
                }}
              >
                <BookmarkPlus size={15} />
                Save as a restaurant look
              </button>
            )}
            <button
              className="cx-link ps2-reset"
              onClick={() =>
                setControls({
                  ...studioLookPatch(
                    { ...b, studioOverrides: [] },
                    b.look,
                    state.restaurant,
                  ),
                  note: "",
                  adjustments: { ...emptyAdjustments },
                })
              }
            >
              <Undo2 size={14} />
              Reset to this look
            </button>
          </div>
          <footer className="ps2-dialog-footer">
            <button className="cx-link" onClick={() => setCustomOpen(false)}>
              Cancel
            </button>
            <button
              className="cx-btn"
              onClick={() => {
                const changed = lookControls.filter(
                  (key) => controls[key] !== b[key],
                );
                const categories: string[] = [...changed];
                if ((controls.note || "") !== (b.note || ""))
                  categories.push("note");
                if (
                  JSON.stringify(controls.adjustments) !==
                  JSON.stringify(b.adjustments)
                )
                  categories.push("crop");
                update(controls);
                if (!state.guest && categories.length)
                  track("customization_applied", undefined, {
                    ...measurementContext,
                    controls: categories.join(","),
                  });
                setCustomOpen(false);
                setNotice("Your custom choices are saved for this photo.");
              }}
            >
              Done
              <Check size={16} />
            </button>
          </footer>
        </DialogContent>
      </Dialog>
      <PhotoInspirationSheet
        open={inspirationOpen}
        source={source}
        dishName={b.name || b.description || ""}
        current={referencePhoto}
        customChoices={inspirationSession.current.origin === "custom"}
        onOpenChange={setInspirationOpen}
        onBusyChange={onReferenceBusyChange}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => {
            const trigger = inspirationSession.current.trigger;
            if (
              trigger?.isConnected &&
              !trigger.closest('[aria-hidden="true"]')
            )
              trigger.focus({ preventScroll: true });
            else if (browserOpen)
              searchInput.current?.focus({ preventScroll: true });
            else
              (inspirationSession.current.origin === "custom"
                ? customizeTrigger
                : browseTrigger
              ).current?.focus({ preventScroll: true });
          });
        }}
        onApply={async (selection, signal) => {
          await applyInspiration(
            selection,
            inspirationSession.current.base,
            signal,
          );
          if (signal.aborted) return;
          setInspirationOpen(false);
          setCustomOpen(false);
          setDetail(null);
          setUndo(null);
          if (!selection) {
            setQuery("");
            setCategory("all");
            setMood("All");
            setBrowseTab("all");
            setBrowserOpen(true);
            setNotice("Inspiration removed. Choose a look for your photo.");
          } else {
            setBrowserOpen(false);
            setNotice(
              "Inspiration is ready. Your dish and custom choices stay yours.",
            );
            if (!state.guest)
              track("look_selected", undefined, {
                ...measurementContext,
                look: "reference",
                origin: "reference",
              });
          }
        }}
      />
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent
          className="cx-workspace-popover ps2-dialog ps2-save-dialog"
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            saveTrigger.current?.focus();
          }}
        >
          <header className="ps2-dialog-header">
            <div>
              <DialogTitle>Keep this look.</DialogTitle>
              <DialogDescription>
                Save the setting and light for your next dish. Your photo
                defaults stay as they are.
              </DialogDescription>
            </div>
            <button
              className="ps2-icon-button"
              aria-label="Cancel saving look"
              onClick={() => setSaveOpen(false)}
            >
              <X size={20} />
            </button>
          </header>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveCustomLook();
            }}
          >
            <div className="ps2-save-form">
              <Field label="Look name">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  maxLength={60}
                  placeholder="Our evening menu"
                  autoFocus
                />
              </Field>
              {(saveError || saved.error) && (
                <p role="alert" className="ps2-inline-note">
                  {saveError || saved.error}
                </p>
              )}
            </div>
            <footer className="ps2-dialog-footer">
              <button
                type="button"
                className="cx-link"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </button>
              <button
                className="cx-btn"
                disabled={saved.busy || !saveName.trim()}
                type="submit"
              >
                {saved.busy ? "Saving…" : "Save look"}
                <BookmarkPlus size={16} />
              </button>
              {b.savedLookId &&
                saved.library.looks.some(
                  (look) => look.id === b.savedLookId && !look.archived,
                ) && (
                  <button
                    type="button"
                    className="cx-link"
                    disabled={saved.busy || !saveName.trim()}
                    onClick={() => void saveCustomLook(true)}
                  >
                    Update saved look
                  </button>
                )}
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent
          className="cx-workspace-popover ps2-dialog ps2-library"
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            libraryTrigger.current?.focus();
          }}
        >
          <header className="ps2-dialog-header">
            <div>
              <DialogTitle>Start with one of your dishes.</DialogTitle>
              <DialogDescription>
                Choose an original photo from My Dishes.
              </DialogDescription>
            </div>
            <button
              className="ps2-icon-button"
              aria-label="Close My Dishes"
              onClick={() => setLibraryOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          <div className="ps2-dialog-scroll ps2-gallery-scroll">
            <div className="ps2-gallery">
              {(state.assets || [])
                .filter((asset: Row) =>
                  ["source", "staff"].includes(asset.kind),
                )
                .map((asset: Row) => {
                  const dish = state.dishes?.find(
                    (d: Row) => d.id === asset.dish_id,
                  );
                  return (
                    <button
                      className="ps2-library-photo"
                      key={asset.id}
                      onClick={() => {
                        update({
                          sourceId: asset.id,
                          dishId: asset.dish_id || "",
                          name:
                            dish?.name === "Untitled dish"
                              ? ""
                              : dish?.name || "",
                          description: dish?.description || "",
                          mode: "photo",
                          resultId: "",
                          jobId: "",
                          analysisSourceId: "",
                          analysisStatus: "none",
                          recommendationFamily: "",
                          menuDocument: false,
                          adjustments: { ...emptyAdjustments },
                          step: 1,
                        });
                        setLibraryOpen(false);
                      }}
                    >
                      <img
                        src={`/api/assets/${asset.id}`}
                        alt={dish?.name || "Original dish photo"}
                        loading="lazy"
                      />
                      <span>{dish?.name || "Untitled dish"}</span>
                    </button>
                  );
                })}
            </div>
            {!(state.assets || []).some((asset: Row) =>
              ["source", "staff"].includes(asset.kind),
            ) && (
              <div className="ps2-empty-results">
                <Images size={28} />
                <h3>Your dishes will appear here.</h3>
                <p>Add your first photo to get started.</p>
                <button
                  className="cx-btn"
                  onClick={() => {
                    setLibraryOpen(false);
                    upload.current?.click();
                  }}
                >
                  Add a photo
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

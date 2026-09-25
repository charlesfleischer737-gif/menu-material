"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ImagePlus,
  Images,
  Lightbulb,
  LoaderCircle,
  PenLine,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  emptyAdjustments,
  foodFamilies,
  formatNames,
  formatShapes,
  formats,
  looks,
  photoStyles,
  resolvePhotoLook,
  samplePhoto,
  type PhotoFormat,
} from "@/lib/studio";
import { drinkKinds } from "@/lib/studio-onboarding";
import {
  lookControls,
  lookExpectations,
  startingLooks,
  studioCreationBlock,
  studioLookPatch,
} from "@/lib/studio-discovery";
import {
  draftRelevanceContext,
  subjectLabel,
  cachedSuggestions,
  suggestionReason,
} from "@/lib/style-relevance";
import { styleThumbnail, type PhotoStyle } from "@/lib/photo-styles";
import type { Row } from "@/lib/client";
import { track } from "./creation-shared";
import { useStudioLibrary } from "./use-studio-library";
import { PhotoInspirationSheet } from "./photo-inspiration-sheet";
import WorkspaceActionBar from "./workspace-action-bar";
import { StudioStyleLibrary, type LibraryOrigin } from "./studio-style-library";
import { StudioCustomizeSheet } from "./studio-customize-sheet";
import { StyleMosaic, StyleTile } from "./studio-style-tile";
import { radioKeys, radioTab } from "./radio-keys";
import type {
  InspirationPhoto,
  InspirationSelection,
  InspirationStatus,
} from "@/lib/studio-reference";
import { inspirationStatusMessage } from "@/lib/studio-reference";
import { occasionName } from "@/lib/studio-occasions";
import { useStudioNavigation } from "./use-studio-navigation";
import {
  applySavedLook,
  recipeFromDraft,
  type SavedLook,
} from "@/lib/studio-library";

// The generated master is square, portrait or landscape; these are the four
// shapes owners reach for. Other saved destinations stay selectable.
const formatChoices: PhotoFormat[] = ["menu", "feed", "story", "doordash"];
// Named by use first; the ratio is secondary.
const formatName: Record<string, string> = formatNames;
const formatShape: Record<string, string> = formatShapes;
const formatUse: Record<string, string> = {
  menu: "Menus, websites and listings",
  feed: "Instagram and Facebook posts",
  story: "Stories and Reels",
  doordash: "Delivery apps and wide banners",
  toast: "Toast item photos",
  uber: "Uber Eats item photos",
  print: "Printed menus and table cards",
};
const drinkNames: Record<string, string> = {
  coffee: "Coffee",
  tea: "Tea",
  juice: "Juice",
  smoothie: "Smoothie",
  beer: "Beer",
  wine: "Wine",
  cocktail: "Cocktail",
  spirits: "Spirits",
  other: "Another drink",
};
// Suggested looks shown beside the photo, plus a tile that opens every style:
// 4 × 2 beside the photo, 3 × 3 on phones (where the eighth look appears).
const gridSize = 8;

export function StudioWorkbench({
  draft: b,
  state,
  selected,
  styleImage,
  source,
  busy: parentBusy,
  advice,
  update,
  chooseLook,
  uploadPhoto,
  referencePhoto,
  applyInspiration,
  onReferenceBusyChange,
  inspirationStatus = "ready",
  retryInspiration,
  retryAnalysis,
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
  uploadPhoto: (file: File, options?: { sample?: boolean }) => void;
  referencePhoto: InspirationPhoto | null;
  applyInspiration: (
    selection: InspirationSelection | null,
    base: Row,
    signal: AbortSignal,
  ) => Promise<void>;
  onReferenceBusyChange?: (busy: boolean) => void;
  inspirationStatus?: InspirationStatus;
  retryInspiration?: () => void;
  retryAnalysis?: () => void;
  create: () => void;
  quickEdit: () => void;
  openMenu: () => void;
  refreshAvailability?: () => void;
}) {
  const saved = useStudioLibrary(
    state.guest ? undefined : state.restaurant?.id,
  );
  const [sampleLoading, setSampleLoading] = useState(false);
  const busy = parentBusy || (sampleLoading ? "Preparing your photo" : "");
  const lookName = b.savedLookName || selected.name;
  const disabledStyles: string[] =
    state.studioAvailability?.disabledStyleIds || [];
  const creationBlock = studioCreationBlock(b, state.studioAvailability);
  const creationPaused = state.studioAvailability?.creationEnabled === false;
  // Activity names a draft only once it is saved on the server.
  const measurementContext = {
    ...(state.studioSavedDraftId ? { draftId: state.studioSavedDraftId } : {}),
    ...(b.sourceId ? { sourceId: b.sourceId } : {}),
  };
  // A fresh draft starts from the restaurant's default saved look.
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

  const [libraryOpen, setLibraryOpen] = useState(false),
    [detail, setDetail] = useState<PhotoStyle | null>(null),
    [customOpen, setCustomOpen] = useState(false),
    [dishesOpen, setDishesOpen] = useState(false),
    [saveOpen, setSaveOpen] = useState(false),
    [inspirationOpen, setInspirationOpen] = useState(false);
  const [controls, setControls] = useState<Row>({}),
    [section, setSection] = useState("surface");
  const [saveName, setSaveName] = useState(""),
    [saveError, setSaveError] = useState("");
  const [undo, setUndo] = useState<{ patch: Row; name: string } | null>(null),
    [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const inspirationSession = useRef<{
    base: Row;
    origin: "browse" | "custom" | "main";
    trigger: HTMLButtonElement | null;
  }>({ base: b, origin: "main", trigger: null });
  useStudioNavigation(
    [
      ...(libraryOpen ? ["browse"] : []),
      ...(libraryOpen && detail ? [`look:${detail.id}`] : []),
      ...(customOpen ? ["custom"] : []),
      ...(dishesOpen ? ["library"] : []),
      ...(saveOpen ? ["save"] : []),
      ...(inspirationOpen ? ["inspiration"] : []),
    ],
    (stack) => {
      setLibraryOpen(stack.includes("browse"));
      const detailId = stack.find((item) => item.startsWith("look:"))?.slice(5);
      setDetail(
        detailId ? looks.find((look) => look.id === detailId) || null : null,
      );
      setCustomOpen(stack.includes("custom"));
      setDishesOpen(stack.includes("library"));
      setSaveOpen(stack.includes("save"));
      if (stack.includes("inspiration") && !inspirationOpen)
        inspirationSession.current.base = stack.includes("custom")
          ? { ...b, ...controls }
          : { ...b };
      setInspirationOpen(stack.includes("inspiration"));
    },
  );
  const upload = useRef<HTMLInputElement>(null),
    browseTrigger = useRef<HTMLButtonElement>(null),
    customizeTrigger = useRef<HTMLButtonElement>(null),
    dishesTrigger = useRef<HTMLButtonElement>(null),
    saveTrigger = useRef<HTMLButtonElement>(null),
    referenceTrigger = useRef<HTMLButtonElement>(null),
    referenceRetryTrigger = useRef<HTMLButtonElement>(null),
    returnFromReferenceCheck = useRef(false);
  const [focusSection, setFocusSection] = useState(""),
    [inspirationOrigin, setInspirationOrigin] = useState<
      "browse" | "custom" | "main"
    >("main");
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
    setInspirationOrigin(origin);
    setInspirationOpen(true);
  }

  // The looks beside the photo: a saved restaurant look first, then Polish,
  // then the most relevant, varied suggestions for this photo.
  const hasRestaurant = !!(
    state.restaurant?.style?.photoPreset ||
    state.restaurant?.style?.referenceIds?.length
  );
  const imageFor = (id: string) =>
    photoStyles.find((style) => style.id === id)?.image || photoStyles[0].image;
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
  const defaultSaved = saved.library.looks.find(
    (look) => look.id === saved.library.defaultLookId && !look.archived,
  );
  const savedTile = (look: SavedLook): PhotoStyle => ({
    id: look.id,
    name: look.name,
    cue: "Your restaurant look",
    group: "Saved",
    prompt: "",
    image: look.previewAssetId
      ? `/api/assets/${look.previewAssetId}`
      : imageFor(look.recipe.look),
  });
  const context = draftRelevanceContext(b, {
    cuisine: state.restaurant?.cuisine,
    favorites: saved.library.favorites,
    recent: saved.library.recent,
    unavailable: disabledStyles,
  });
  const suggestions = cachedSuggestions(context, 12);
  const pinned =
    defaultSaved && !disabledStyles.includes(defaultSaved.recipe.look)
      ? savedTile(defaultSaved)
      : restaurantLook;
  const base = startingLooks(
    b,
    suggestions,
    pinned,
    [defaultSaved?.recipe.look || state.restaurant?.style?.photoPreset].filter(
      Boolean,
    ),
    disabledStyles,
    gridSize,
  );
  const selectedKey = b.savedLookId || b.look;
  // A look chosen from the full library joins the grid and stays there for
  // this photo, so tiles never jump around beneath the pointer.
  const draftKey = state.studioDraftId || "guest";
  const [extra, setExtra] = useState({ key: "", draft: draftKey });
  const extraKey = extra.draft === draftKey ? extra.key : "";
  if (
    selectedKey &&
    selectedKey !== extraKey &&
    !base.some((style) => style.id === selectedKey)
  )
    setExtra({ key: selectedKey, draft: draftKey });
  else if (extra.draft !== draftKey) setExtra({ key: "", draft: draftKey });
  const extraStyle = ((): PhotoStyle | undefined => {
    if (
      !extraKey ||
      disabledStyles.includes(extraKey) ||
      base.some((style) => style.id === extraKey)
    )
      return;
    const savedLook = saved.library.looks.find((look) => look.id === extraKey);
    if (savedLook) return savedTile(savedLook);
    if (extraKey === "restaurant") return restaurantLook;
    if (extraKey === "reference")
      return referencePhoto
        ? {
            ...looks.find((look) => look.id === "reference")!,
            image: referencePhoto.url,
          }
        : undefined;
    const catalogLook = photoStyles.find((style) => style.id === extraKey);
    if (catalogLook) return catalogLook;
    if (extraKey === b.look && resolvePhotoLook(b))
      return { ...resolvePhotoLook(b)!, image: styleImage || selected.image };
  })();
  const tiles = extraStyle
    ? [
        ...base.slice(0, base.findIndex((style) => style.id === "keep") + 1),
        extraStyle,
        ...base.slice(base.findIndex((style) => style.id === "keep") + 1),
      ].slice(0, gridSize)
    : base;
  const available = photoStyles.filter(
    (style) => !style.legacy && !disabledStyles.includes(style.id),
  );
  const mosaic = suggestions
    .filter((style) => !tiles.some((tile) => tile.id === style.id))
    .slice(0, 4)
    .map((style) => style.image);

  // Tiles glide to their new places when suggestions change.
  const grid = useRef<HTMLDivElement>(null),
    positions = useRef(new Map<string, { x: number; y: number }>());
  const tileKeys = tiles.map((style) => style.id).join();
  function tilePositions(container: HTMLElement) {
    const origin = container.getBoundingClientRect();
    return new Map(
      [...container.querySelectorAll<HTMLElement>("[data-style-key]")].map(
        (button) => {
          const rect = (
            button.closest(".st-tile") || button
          ).getBoundingClientRect();
          return [
            button.dataset.styleKey!,
            { x: rect.left - origin.left, y: rect.top - origin.top },
          ];
        },
      ),
    );
  }
  useEffect(() => {
    const container = grid.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      positions.current = tilePositions(container);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [creationPaused]);
  useLayoutEffect(() => {
    const container = grid.current;
    if (!container) return;
    const origin = container.getBoundingClientRect();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, { x: number; y: number }>();
    for (const button of container.querySelectorAll<HTMLElement>(
      "[data-style-key]",
    )) {
      const tile = button.closest<HTMLElement>(".st-tile");
      const key = button.dataset.styleKey;
      if (!tile || !key) continue;
      const rect = tile.getBoundingClientRect();
      const point = { x: rect.left - origin.left, y: rect.top - origin.top };
      next.set(key, point);
      const before = positions.current.get(key);
      if (still || !positions.current.size) continue;
      if (!before)
        tile.animate(
          [
            { opacity: 0, transform: "scale(0.92)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 320, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        );
      else if (before.x !== point.x || before.y !== point.y)
        tile.animate(
          [
            {
              transform: `translate(${before.x - point.x}px, ${before.y - point.y}px)`,
            },
            { transform: "none" },
          ],
          { duration: 380, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        );
    }
    positions.current = next;
  }, [tileKeys]);

  const format = formats[b.format as PhotoFormat] || formats.menu;
  // A saved dish is described in My Dishes; the studio never rewrites it.
  const dish: Row | undefined = b.dishId
    ? state.dishes?.find((entry: Row) => entry.id === b.dishId)
    : undefined;
  const photoReady =
    b.mode === "photo"
      ? !!source
      : dish
        ? !!dish.description?.trim()
        : !!b.name?.trim() && !!b.description?.trim();
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
          ? b.mode === "photo"
            ? "Add a photo to get started."
            : dish
              ? "Add a description to this dish in My Dishes."
              : "Add a dish name and description."
          : b.look === "reference" && !referencePhoto
            ? "Add an inspiration photo to use this look."
            : !state.guest && !state.aiConnected
              ? "Photo creation is temporarily unavailable. Your work is saved."
              : state.remaining <= 0
                ? "You’ve used your available images."
                : state.guest
                  ? "Create a free account to continue · 5 free images"
                  : `Uses 1 image · ${state.remaining} left`);
  const showImage =
    b.look === "keep" && source
      ? source
      : inspirationStatus === "unavailable" &&
          styleImage.startsWith("/api/assets/")
        ? ""
        : styleImage;
  const drink = b.family === "Drinks";
  const confirmed =
    !!source &&
    b.analysisSourceId === b.sourceId &&
    ["ready", "manual"].includes(b.analysisStatus) &&
    !!b.recommendationFamily;
  const originals = (state.assets || []).filter((asset: Row) =>
    ["source", "staff"].includes(asset.kind),
  );

  function select(
    id: string,
    origin: LibraryOrigin | "suggestion" = "suggestion",
    extra: { occasionId?: string; rank?: number } = {},
  ) {
    const savedLook = saved.library.looks.find((look) => look.id === id);
    if (savedLook) return applySaved(savedLook);
    if (disabledStyles.includes(id)) {
      setNotice("This style is temporarily unavailable. Choose another.");
      return;
    }
    const keep = !!b.studioOverrides?.length;
    // The previous look stays one tap away in the grid, unless the new pick
    // takes its place there; only then (or with custom choices) offer Undo.
    const stays =
      base.some((style) => style.id === selectedKey) ||
      (selectedKey === extraKey && base.some((style) => style.id === id));
    setUndo(
      keep || !stays
        ? {
            name: lookName,
            patch: Object.fromEntries(
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
          }
        : null,
    );
    chooseLook(id);
    update({
      selectionOrigin: origin,
      ...(extra.occasionId ? { occasionId: extra.occasionId } : {}),
    });
    if (!state.guest)
      track("look_selected", undefined, {
        ...measurementContext,
        look: id,
        origin,
        ...(extra.rank ? { selectedRank: extra.rank } : {}),
      });
    setLibraryOpen(false);
    setDetail(null);
    setNotice(
      keep
        ? "Style changed. Your custom choices are kept."
        : stays
          ? ""
          : `Replaced ${lookName}.`,
    );
  }
  function applySaved(look: SavedLook) {
    if (!state.guest)
      track("look_selected", undefined, {
        ...measurementContext,
        lookId: look.id,
        version: look.version,
        origin: "saved",
      });
    setUndo(null);
    update({
      ...applySavedLook(look),
      styleIntent: true,
      selectionOrigin: "saved",
    });
    setLibraryOpen(false);
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
        setCustomOpen(false);
        setNotice(
          `“${look.name}” is saved. Restaurant defaults are unchanged.`,
        );
      }
    } catch (e) {
      setSaveError((e as Error).message);
    }
  }
  function customize(initialSection?: string) {
    setFocusSection(initialSection || "");
    setSection(initialSection || "surface");
    setControls({
      ...Object.fromEntries(lookControls.map((key) => [key, b[key]])),
      studioOverrides: [...(b.studioOverrides || [])],
      adjustments: { ...b.adjustments },
    });
    setCustomOpen(true);
  }
  function identify(family: string, drinkKind = "other") {
    update({
      family,
      recommendationFamily: family,
      recommendationDrink: family === "Drinks" ? drinkKind : "other",
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
    else setNotice("");
    setUndo(null);
    uploadPhoto(files[0]);
  }
  async function trySample() {
    if (busy) return;
    setSampleLoading(true);
    setNotice("");
    try {
      const response = await fetch(samplePhoto.url);
      if (!response.ok) throw Error();
      const blob = await response.blob();
      setSampleLoading(false);
      uploadPhoto(
        new File([blob], samplePhoto.file, { type: blob.type || "image/jpeg" }),
        { sample: true },
      );
    } catch {
      setSampleLoading(false);
      setNotice("The sample couldn’t load. Try again, or add your own photo.");
    }
  }
  function chooseFormat(id: string) {
    update({
      format: id,
      destination: ["feed", "story"].includes(id)
        ? "social"
        : ["uber", "door", "doordash"].includes(id)
          ? "delivery"
          : "menu",
    });
  }
  const formatOptions = formatChoices.includes(b.format)
    ? formatChoices
    : [...formatChoices, b.format as PhotoFormat];
  const changes = [
    b.look === "keep"
      ? "Your setting, beautifully refined"
      : b.look === "restaurant"
        ? "Consistent with your restaurant"
        : b.look === "reference"
          ? "Matches your inspiration photo"
          : b.savedLookId
            ? "Your saved setting and light"
            : selected.cue,
    ...(b.mode === "photo" && !drink && b.plate !== "keep"
      ? [b.plate === "white" ? "White serving dish" : "New serving dish"]
      : []),
    ...(b.angle && b.angle !== "keep"
      ? [b.angle === "overhead" ? "New overhead angle" : "New angled view"]
      : []),
    ...(b.studioOverrides?.length ? ["Customized"] : []),
  ];

  const createButton = (
    <button className="st-create" disabled={!canCreate} onClick={create}>
      {busy ? (
        <LoaderCircle size={18} className="cx-spin" />
      ) : (
        <Sparkles size={18} />
      )}
      {busy || "Create photo"}
    </button>
  );

  const tile = (style: PhotoStyle, index: number) => {
    const reason = suggestionReason(style, context);
    const polish = style.id === "keep";
    const label = polish
      ? "Polish"
      : style.id === "restaurant"
        ? "Your look"
        : style.id === "reference"
          ? "Inspiration"
          : style.name;
    return (
      <StyleTile
        key={style.id}
        styleKey={style.id}
        label={label}
        description={
          polish
            ? "Polish my original. Your setting, beautifully refined."
            : [label !== style.name && style.name, reason, style.cue]
                .filter(Boolean)
                .join(". ")
        }
        image={polish ? source || undefined : style.image}
        media={
          polish && !source ? (
            <span className="st-tile-icon" aria-hidden="true">
              <Sparkles size={22} strokeWidth={1.6} />
            </span>
          ) : undefined
        }
        eager={index < 4}
        className={index === gridSize - 1 ? "st-tile-phone" : ""}
        selected={selectedKey === style.id}
        disabled={!!busy}
        onSelect={() => select(style.id, "suggestion")}
      />
    );
  };

  return (
    <>
      {creationPaused ? (
        <section className="st-paused" aria-labelledby="st-paused-title">
          <div>
            <span className="st-sheet-kicker">Your work is still here</span>
            <h2 id="st-paused-title">Photo creation is paused.</h2>
            <p role="status">{state.studioAvailability.message}</p>
            {!state.guest && (
              <p>
                You can still open saved photos, download them, or crop and
                brighten an original.
              </p>
            )}
            <div className="st-paused-actions">
              {!state.guest &&
                (source ? (
                  <button
                    className="st-pill"
                    disabled={!!busy}
                    onClick={quickEdit}
                  >
                    <SlidersHorizontal size={16} />
                    Crop or brighten
                  </button>
                ) : (
                  <button
                    ref={dishesTrigger}
                    className="st-pill"
                    disabled={!!busy}
                    onClick={() => setDishesOpen(true)}
                  >
                    <Images size={16} />
                    Choose an original
                  </button>
                ))}
              {refreshAvailability && (
                <button
                  className="st-text-button"
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
        <div className={`st-studio${photoReady ? " is-ready" : ""}`}>
          <section className="st-stage" aria-label="Your photo">
            <div
              className={`st-canvas${source && b.mode === "photo" ? " has-photo" : ""}${dragging ? " is-dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy && b.mode === "photo") setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (b.mode === "photo") accept(event.dataTransfer.files);
              }}
            >
              {source && b.mode === "photo" ? (
                <>
                  <img
                    key={source}
                    className="st-photo"
                    src={source}
                    alt={
                      b.sample
                        ? "Sample burger photo"
                        : "Your original dish photo"
                    }
                  />
                  <span className="st-canvas-label">
                    {b.sample ? "Sample photo" : "Your original"}
                  </span>
                  <button
                    className="st-glass-button"
                    disabled={!!busy}
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={15} />
                    Replace
                  </button>
                </>
              ) : b.mode === "description" ? (
                <div className="st-describe">
                  <span className="st-sheet-kicker">From a description</span>
                  {dish ? (
                    <>
                      <h3>{dish.name}</h3>
                      <p className="st-describe-dish">
                        {dish.description?.trim() || "No description yet."}
                      </p>
                      <p>
                        From My Dishes. Change the name or description there,
                        and add styling notes in Details.
                      </p>
                    </>
                  ) : (
                    <>
                      <h3>Describe your dish</h3>
                      <label className="st-field">
                        <span>Dish name</span>
                        <input
                          className="st-input"
                          value={b.name}
                          maxLength={100}
                          onChange={(event) =>
                            update({ name: event.target.value })
                          }
                          placeholder="Roasted tomato pasta"
                        />
                      </label>
                      <label className="st-field">
                        <span>Ingredients, portion and presentation</span>
                        <textarea
                          className="st-input"
                          value={b.description}
                          maxLength={2000}
                          rows={4}
                          onChange={(event) =>
                            update({ description: event.target.value })
                          }
                          placeholder="Describe the dish you actually serve."
                        />
                      </label>
                    </>
                  )}
                  <p>
                    Creates an illustration. Check it against the real dish
                    before using it.
                  </p>
                </div>
              ) : (
                <button
                  className="st-dropzone"
                  disabled={!!busy}
                  aria-describedby="st-dropzone-hint"
                  onClick={() => upload.current?.click()}
                >
                  <span className="st-dropzone-icon" aria-hidden="true">
                    <ImagePlus size={30} strokeWidth={1.4} />
                  </span>
                  <b>
                    {dragging
                      ? "Drop to add your photo"
                      : "Add a photo of your dish"}
                  </b>
                  <span id="st-dropzone-hint">
                    <span className="st-when-pointer">
                      Drop it here, or click to choose a file.
                    </span>
                    <span className="st-when-touch">
                      Tap to take a photo or choose one.
                    </span>
                  </span>
                  <small>
                    Shoot from above or at a slight angle, with the whole plate
                    in frame.
                  </small>
                </button>
              )}
              {busy && (
                <div className="st-canvas-busy" role="status">
                  <LoaderCircle className="cx-spin" size={22} />
                  <span>{busy}</span>
                </div>
              )}
            </div>
            <div className="st-stage-foot">
              <span>
                <ShieldCheck size={14} aria-hidden="true" />
                {state.guest
                  ? "Your photo stays on this device until you sign up."
                  : b.mode === "description"
                    ? "Illustrations are labeled as illustrations."
                    : "Your original photo is always kept."}
              </span>
              {source && !state.guest && b.mode === "photo" && (
                <button
                  className="st-text-button"
                  disabled={!!busy}
                  onClick={quickEdit}
                >
                  Just crop or brighten
                </button>
              )}
              {!source && b.mode === "photo" && (
                <button
                  className="st-text-button"
                  disabled={!!busy}
                  onClick={() => update({ mode: "description" })}
                >
                  <PenLine size={14} />
                  No photo? Describe your dish
                </button>
              )}
              {b.mode === "description" && (
                <button
                  className="st-text-button"
                  onClick={() => update({ mode: "photo" })}
                >
                  Use a real photo instead
                </button>
              )}
            </div>
            {(advice || b.analysisAdvice) && (
              <p className="st-note" role="status">
                <Lightbulb size={15} aria-hidden="true" />
                {advice || b.analysisAdvice}
              </p>
            )}
            {b.menuDocument && (
              <div className="st-note">
                <BookOpen size={15} aria-hidden="true" />
                <span>
                  This looks like a menu. Use a photo of one dish here, or open
                  it in Menus.{" "}
                  <button className="st-text-button" onClick={openMenu}>
                    Open in Menus
                  </button>
                </span>
              </div>
            )}
          </section>
          <aside className="st-inspector" aria-label="Photo settings">
            {!source && b.mode === "photo" && (
              <section className="st-section" aria-labelledby="st-photo-title">
                <h2 id="st-photo-title" className="st-section-title">
                  Photo
                </h2>
                <button
                  className="st-pill st-pill-wide st-photo-pill"
                  disabled={!!busy}
                  onClick={() => upload.current?.click()}
                >
                  Choose a photo
                </button>
                <p className="st-photo-links">
                  {!state.guest && originals.length > 0 && (
                    <>
                      <button
                        ref={dishesTrigger}
                        className="st-text-button"
                        disabled={!!busy}
                        onClick={() => setDishesOpen(true)}
                      >
                        From My Dishes
                      </button>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <button
                    className="st-text-button"
                    disabled={!!busy}
                    onClick={() => void trySample()}
                  >
                    {!state.guest && originals.length
                      ? "Try a sample"
                      : "No photo handy? Try a sample"}
                  </button>
                </p>
              </section>
            )}

            <section className="st-section" aria-labelledby="st-style-title">
              <div className="st-section-head">
                <h2 id="st-style-title" className="st-section-title">
                  Style
                </h2>
                {source && b.mode === "photo" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="st-subject"
                        disabled={!!busy}
                        aria-label={
                          confirmed
                            ? `Suggestions for ${b.analysisSubject || subjectLabel(b.recommendationFamily, b.recommendationDrink)}. Change what’s in your photo`
                            : "Tell us what’s in your photo"
                        }
                      >
                        {b.analysisStatus === "analyzing" ? (
                          <>
                            <LoaderCircle size={13} className="cx-spin" />
                            <span>Reading your photo…</span>
                          </>
                        ) : (
                          <span>
                            {confirmed
                              ? `For ${(b.analysisSubject || subjectLabel(b.recommendationFamily, b.recommendationDrink)).toLowerCase()}`
                              : "What’s in your photo?"}
                          </span>
                        )}
                        <ChevronDown size={13} aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="cx-workspace-popover st-menu"
                      align="end"
                    >
                      <DropdownMenuLabel>Suggest styles for</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={
                          confirmed && b.recommendationFamily !== "Drinks"
                            ? b.recommendationFamily
                            : ""
                        }
                        onValueChange={(value) => identify(value)}
                      >
                        {foodFamilies
                          .filter((family) => family !== "Drinks")
                          .map((family) => (
                            <DropdownMenuRadioItem key={family} value={family}>
                              {family}
                            </DropdownMenuRadioItem>
                          ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          Drinks
                          {confirmed && b.recommendationFamily === "Drinks" && (
                            <span className="st-menu-value">
                              {drinkNames[b.recommendationDrink] || "Drink"}
                            </span>
                          )}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="cx-workspace-popover st-menu">
                          <DropdownMenuRadioGroup
                            value={
                              confirmed && b.recommendationFamily === "Drinks"
                                ? b.recommendationDrink
                                : ""
                            }
                            onValueChange={(value) => identify("Drinks", value)}
                          >
                            {drinkKinds.map((kind) => (
                              <DropdownMenuRadioItem key={kind} value={kind}>
                                {drinkNames[kind]}
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {retryAnalysis &&
                        b.analysisStatus === "unavailable" &&
                        state.aiConnected && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={retryAnalysis}>
                              Read my photo again
                            </DropdownMenuItem>
                          </>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div
                ref={grid}
                className="st-style-grid"
                role="group"
                aria-label={
                  confirmed
                    ? `Styles suggested for your ${subjectLabel(b.recommendationFamily, b.recommendationDrink)}`
                    : "Suggested styles"
                }
              >
                {tiles.map(tile)}
                <StyleTile
                  label="All styles"
                  description={`Browse all ${available.length} styles, collections and occasions`}
                  media={<StyleMosaic images={mosaic} />}
                  kind="dialog"
                  buttonRef={browseTrigger}
                  disabled={!!busy}
                  onSelect={() => {
                    setDetail(null);
                    setLibraryOpen(true);
                  }}
                />
              </div>
              <div className="st-selected">
                <div>
                  <b>{lookName}</b>
                  {b.occasionId && (
                    <span className="st-occasion">
                      {occasionName(b.occasionId)} collection
                    </span>
                  )}
                  <span>{changes.filter(Boolean).join(" · ")}</span>
                </div>
                <button
                  ref={customizeTrigger}
                  className="st-text-button"
                  disabled={!!busy || !resolvePhotoLook(b)}
                  onClick={() => customize()}
                >
                  <SlidersHorizontal size={14} />
                  Customize
                </button>
              </div>
              {creationBlock && (
                <p className="st-alert" role="status">
                  {creationBlock}
                </p>
              )}
              {vesselConflict && (
                <p className="st-alert">
                  This look changes the serving dish. For a drink, keep the
                  glass you serve it in.{" "}
                  <button
                    className="st-text-button"
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
                  ref={referenceTrigger}
                  className="st-reference"
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
                <div className="st-alert" role="status">
                  <p>{inspirationBlock}</p>
                  {retryInspiration && (
                    <div>
                      <button
                        ref={referenceRetryTrigger}
                        className="st-text-button"
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
                        className="st-text-button"
                        disabled={!!busy}
                        onClick={() => {
                          setDetail(null);
                          setLibraryOpen(true);
                        }}
                      >
                        Choose another style
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <p className="st-status" role="status">
                {notice}
                {undo && (
                  <button
                    className="st-text-button"
                    disabled={!!busy}
                    onClick={() => {
                      update(undo.patch);
                      setNotice(`${undo.name} restored.`);
                      setUndo(null);
                    }}
                  >
                    <Undo2 size={13} />
                    Undo
                  </button>
                )}
              </p>
            </section>

            <section className="st-section" aria-labelledby="st-format-title">
              <h2 id="st-format-title" className="st-section-title">
                Format
              </h2>
              <div
                className="st-segmented st-format-choice"
                role="radiogroup"
                aria-labelledby="st-format-title"
                onKeyDown={radioKeys}
                style={{ "--segments": formatOptions.length } as CSSProperties}
              >
                {formatOptions.map((id, index) => (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={b.format === id}
                    aria-label={`${formatName[id] || formats[id].short}, ${formatShape[id] || ""}, ${formatUse[id] || formats[id].label}`}
                    tabIndex={radioTab(index, formatOptions.indexOf(b.format))}
                    disabled={!!busy}
                    onClick={() => chooseFormat(id)}
                  >
                    <span className="st-format-name">
                      {formatName[id] || formats[id].short}
                    </span>
                    {formatShape[id] && (
                      <small className="st-format-ratio">
                        {formatShape[id]}
                      </small>
                    )}
                  </button>
                ))}
              </div>
              <p className="st-format-use" aria-hidden="true">
                {formatUse[b.format] || format.label}
              </p>
            </section>

            <section className="st-section" aria-labelledby="st-details-title">
              <div className="st-section-head">
                <h2 id="st-details-title" className="st-section-title">
                  Details
                </h2>
                <span className="st-optional">Optional</span>
              </div>
              <textarea
                className="st-input st-details"
                aria-labelledby="st-details-title"
                aria-describedby="st-details-hint"
                value={b.note || ""}
                maxLength={500}
                rows={3}
                placeholder="Candlelight, more room above the dish…"
                onChange={(event) => update({ note: event.target.value })}
              />
              <span id="st-details-hint" className="sr-only">
                Describe the light, setting or framing you’d like. Your food
                always stays the same.
              </span>
            </section>

            <WorkspaceActionBar
              className={`st-action${photoReady ? "" : " is-waiting"}`}
            >
              {createButton}
              <p className="st-action-note">
                {reason}
                {!state.guest && state.remaining <= 0 && (
                  <button
                    className="st-text-button"
                    onClick={() =>
                      window.dispatchEvent(new Event("menu-material:plans"))
                    }
                  >
                    View plans
                  </button>
                )}
              </p>
            </WorkspaceActionBar>
          </aside>
        </div>
      )}
      <input
        ref={upload}
        hidden
        disabled={!!busy}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
        onChange={(event) => {
          accept(event.target.files);
          event.target.value = "";
        }}
      />
      <StudioStyleLibrary
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open) setDetail(null);
        }}
        detail={detail}
        onDetail={setDetail}
        context={context}
        selectedKey={selectedKey}
        unavailable={disabledStyles}
        store={saved}
        restaurantLook={restaurantLook}
        guest={!!state.guest}
        busy={!!busy}
        timezone={state.restaurant?.timezone}
        expectations={(id) => lookExpectations(b, id, state.restaurant)}
        source={b.mode === "photo" ? source : ""}
        onSelect={select}
        onApplySaved={applySaved}
        onInspiration={(trigger) => openInspiration("browse", trigger)}
        onCustomize={(section) => {
          setLibraryOpen(false);
          setDetail(null);
          customize(section);
        }}
        onSearch={(details) => {
          if (!state.guest)
            track("style_search_used", undefined, {
              ...measurementContext,
              ...details,
              scope: "all",
            });
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!customOpen && !inspirationOpen)
            browseTrigger.current?.focus({ preventScroll: true });
        }}
      />
      <StudioCustomizeSheet
        open={customOpen}
        onOpenChange={setCustomOpen}
        draft={b}
        controls={controls}
        setControls={setControls}
        section={section}
        setSection={setSection}
        focusSection={focusSection}
        lookName={lookName}
        lookImage={showImage ? styleThumbnail(showImage) : ""}
        source={b.mode === "photo" ? source : ""}
        ratio={format.ratio}
        guest={!!state.guest}
        canSave={saved.ready && !saved.busy}
        hasReference={!!referencePhoto}
        busy={!!busy}
        onDone={() => {
          const changed = lookControls.filter(
            (key) => controls[key] !== b[key],
          );
          const categories: string[] = [...changed];
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
          setUndo(null);
          setNotice(
            categories.length
              ? "Your custom choices are saved for this photo."
              : "",
          );
        }}
        onReset={() =>
          setControls({
            ...studioLookPatch(
              { ...b, studioOverrides: [] },
              b.look,
              state.restaurant,
            ),
            adjustments: { ...emptyAdjustments },
          })
        }
        onInspiration={(trigger) => openInspiration("custom", trigger)}
        onSaveLook={() => {
          setSaveName(b.savedLookName || selected.name);
          setSaveError("");
          setSaveOpen(true);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!inspirationOpen && !saveOpen)
            customizeTrigger.current?.focus({ preventScroll: true });
        }}
      />
      <PhotoInspirationSheet
        open={inspirationOpen}
        source={source}
        dishName={b.name || b.description || ""}
        current={referencePhoto}
        customChoices={inspirationOrigin === "custom"}
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
            setLibraryOpen(true);
            setNotice("Inspiration removed. Choose a style for your photo.");
          } else {
            setLibraryOpen(false);
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
          className="cx-workspace-popover st-sheet st-rename"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (customOpen ? saveTrigger : customizeTrigger).current?.focus({
              preventScroll: true,
            });
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveCustomLook();
            }}
          >
            <DialogTitle>Save this look</DialogTitle>
            <DialogDescription>
              Save the setting and light for your next dish. Your restaurant
              defaults stay as they are.
            </DialogDescription>
            <input
              className="st-input"
              aria-label="Look name"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              maxLength={60}
              placeholder="Our evening menu"
              autoFocus
            />
            {(saveError || saved.error) && (
              <p role="alert" className="st-inline-error">
                {saveError || saved.error}
              </p>
            )}
            <footer>
              {b.savedLookId &&
                saved.library.looks.some(
                  (look) => look.id === b.savedLookId && !look.archived,
                ) && (
                  <button
                    type="button"
                    className="st-text-button"
                    disabled={saved.busy || !saveName.trim()}
                    onClick={() => void saveCustomLook(true)}
                  >
                    Update saved look
                  </button>
                )}
              <button
                type="button"
                className="st-pill st-pill-quiet"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </button>
              <button
                className="st-pill st-pill-primary"
                disabled={saved.busy || !saveName.trim()}
                type="submit"
              >
                {saved.busy ? "Saving…" : "Save look"}
              </button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dishesOpen} onOpenChange={setDishesOpen}>
        <DialogContent
          className="cx-workspace-popover st-sheet st-dishes"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            dishesTrigger.current?.focus({ preventScroll: true });
          }}
        >
          <header className="st-sheet-header">
            <div>
              <DialogTitle>My Dishes</DialogTitle>
              <DialogDescription>
                Start from an original photo you’ve already added.
              </DialogDescription>
            </div>
            <button
              className="st-icon-button"
              aria-label="Close My Dishes"
              onClick={() => setDishesOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="st-sheet-scroll">
            {originals.length ? (
              <div className="st-library-grid">
                {originals.map((asset: Row) => {
                  const dish = state.dishes?.find(
                    (entry: Row) => entry.id === asset.dish_id,
                  );
                  return (
                    <StyleTile
                      key={asset.id}
                      label={dish?.name || "Untitled dish"}
                      image={`/api/assets/${asset.id}`}
                      kind="action"
                      onSelect={() => {
                        update({
                          sourceId: asset.id,
                          dishId: asset.dish_id || "",
                          name:
                            dish?.name === "Untitled dish"
                              ? ""
                              : dish?.name || "",
                          description: dish?.description || "",
                          mode: "photo",
                          sample: false,
                          resultId: "",
                          jobId: "",
                          analysisSourceId: "",
                          analysisStatus: "none",
                          recommendationFamily: "",
                          menuDocument: false,
                          adjustments: { ...emptyAdjustments },
                          step: 1,
                        });
                        setDishesOpen(false);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="st-library-empty">
                <Images size={26} aria-hidden="true" />
                <h3>Your dishes will appear here.</h3>
                <p>Add your first photo to get started.</p>
                <button
                  className="st-pill"
                  onClick={() => {
                    setDishesOpen(false);
                    upload.current?.click();
                  }}
                >
                  Choose a photo
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

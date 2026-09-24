"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  ImagePlus,
  Info,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  photoStyles,
  styleCategories,
  type PhotoStyle,
} from "@/lib/photo-styles";
import { orderedOccasions, studioOccasions } from "@/lib/studio-occasions";
import {
  findOccasions,
  maximumStyleQueryLength,
  searchSavedLooks,
  searchStyles,
  styleSearchShortcut,
} from "@/lib/studio-search";
import {
  lookMoods,
  searchIntent,
  type lookExpectations,
} from "@/lib/studio-discovery";
import {
  subjectLabel,
  cachedSuggestions,
  suggestionReason,
  type StyleRelevanceContext,
} from "@/lib/style-relevance";
import type { SavedLook } from "@/lib/studio-library";
import type { useStudioLibrary } from "./use-studio-library";
import { StudioSavedLooks } from "./studio-saved-looks";
import { StyleTile } from "./studio-style-tile";
import { radioKeys, radioTab } from "./radio-keys";

export type LibraryOrigin =
  | "suggestion"
  | "catalog"
  | "search"
  | "favorite"
  | "saved"
  | "occasion"
  | "recent";
type Collection = string;

/**
 * Every look in one place. Suggestions come first; search, collections and
 * occasions keep a growing catalog quick to scan. Tapping a look selects it.
 */
export function StudioStyleLibrary({
  open,
  onOpenChange,
  detail,
  onDetail,
  context,
  selectedKey,
  unavailable,
  store,
  restaurantLook,
  guest,
  busy,
  timezone,
  expectations,
  source,
  onSelect,
  onApplySaved,
  onInspiration,
  onCustomize,
  onSearch,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: PhotoStyle | null;
  onDetail: (style: PhotoStyle | null) => void;
  context: StyleRelevanceContext;
  selectedKey: string;
  unavailable: string[];
  store: ReturnType<typeof useStudioLibrary>;
  restaurantLook?: PhotoStyle;
  guest: boolean;
  busy: boolean;
  timezone?: string;
  expectations: (id: string) => ReturnType<typeof lookExpectations>;
  // The owner's photo, shown for Polish my original.
  source: string;
  onSelect: (
    id: string,
    origin: LibraryOrigin,
    extra?: { occasionId?: string; rank?: number },
  ) => void;
  onApplySaved: (look: SavedLook) => void;
  onInspiration: (trigger: HTMLButtonElement) => void;
  onCustomize: (section?: string) => void;
  onSearch: (details: {
    intent: string;
    resultCount: number;
    category: string;
    mood: string;
  }) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [collection, setCollection] = useState<Collection>("suggested"),
    [query, setQuery] = useState(""),
    [mood, setMood] = useState("All");
  const searchInput = useRef<HTMLInputElement>(null),
    title = useRef<HTMLHeadingElement>(null),
    detailTitle = useRef<HTMLHeadingElement>(null),
    body = useRef<HTMLDivElement>(null),
    detailTrigger = useRef<HTMLButtonElement | null>(null),
    detailOccasion = useRef("");
  const available = useMemo(
    () =>
      photoStyles.filter(
        (style) => !style.legacy && !unavailable.includes(style.id),
      ),
    [unavailable],
  );
  const suggestions = cachedSuggestions(context, 12);
  const occasions = useMemo(() => orderedOccasions(timezone), [timezone]);
  const favorites = store.library.favorites;
  const text = query.trim();
  const occasion = collection.startsWith("occasion:")
    ? studioOccasions.find((entry) => `occasion:${entry.id}` === collection)
    : undefined;
  const category = collection.startsWith("category:")
    ? styleCategories.find((entry) => `category:${entry.id}` === collection)
    : undefined;
  const scoped =
    category && !text
      ? available.filter((style) => style.category === category.id)
      : available;
  const search = useMemo(
    () => searchStyles(text, mood, scoped),
    [text, mood, scoped],
  );
  const shortcut = text ? styleSearchShortcut(text, context.family) : null;
  const matchingOccasions = text
    ? findOccasions(text, occasions, unavailable)
    : [];
  const matchingSaved =
    text && !guest
      ? searchSavedLooks(
          text,
          store.library.looks.filter((look) => !look.archived),
        )
      : [];
  const resultCount = text
    ? search.styles.length + matchingSaved.length + (shortcut ? 1 : 0)
    : 0;
  useEffect(() => {
    if (!open || !text) return;
    const timer = setTimeout(
      () =>
        onSearch({
          intent: searchIntent(text),
          resultCount,
          category: category?.id || "all",
          mood,
        }),
      500,
    );
    return () => clearTimeout(timer);
  }, [text, mood, category?.id, open, resultCount]);
  // Opening a look's details keeps the grid (and its scroll) in place beneath.
  useEffect(() => {
    if (detail) detailTitle.current?.focus({ preventScroll: true });
    else if (detailTrigger.current?.isConnected) {
      detailTrigger.current.focus({ preventScroll: true });
      detailTrigger.current = null;
    }
  }, [detail]);
  function choose(nextCollection: Collection) {
    setCollection(nextCollection);
    setQuery("");
    if (nextCollection !== "all" && !nextCollection.startsWith("category:"))
      setMood("All");
    body.current?.scrollTo({ top: 0 });
  }
  const selectOrigin = (origin: LibraryOrigin): LibraryOrigin =>
    text ? "search" : origin;
  function tile(
    style: PhotoStyle,
    origin: LibraryOrigin,
    options: { occasionId?: string; rank?: number; eager?: boolean } = {},
  ) {
    const favorite = favorites.includes(style.id);
    const reason =
      origin === "suggestion" ? suggestionReason(style, context) : "";
    const blocked = unavailable.includes(style.id);
    const polish = style.id === "keep";
    return (
      <StyleTile
        key={`${origin}:${style.id}`}
        label={style.name}
        description={[reason, style.cue, blocked && "Temporarily unavailable"]
          .filter(Boolean)
          .join(". ")}
        image={polish ? source || undefined : style.image}
        media={
          polish && !source ? (
            <span className="st-tile-icon" aria-hidden="true">
              <Sparkles size={26} strokeWidth={1.5} />
            </span>
          ) : undefined
        }
        eager={options.eager}
        selected={selectedKey === style.id}
        disabled={busy || blocked}
        styleKey={style.id}
        onSelect={() =>
          onSelect(style.id, selectOrigin(origin), {
            occasionId: options.occasionId,
            rank: options.rank,
          })
        }
        actions={
          ["restaurant", "keep"].includes(style.id) ? undefined : (
            <>
              <button
                className="st-tile-action"
                aria-label={`${favorite ? "Remove" : "Add"} ${style.name} ${favorite ? "from" : "to"} favorites`}
                aria-pressed={favorite}
                disabled={store.busy || !store.ready}
                onClick={() => void store.favorite(style.id)}
              >
                <Heart size={15} fill={favorite ? "currentColor" : "none"} />
              </button>
              <button
                className="st-tile-action"
                aria-label={`About ${style.name}`}
                onClick={(event) => {
                  detailTrigger.current = event.currentTarget;
                  detailOccasion.current = options.occasionId || "";
                  onDetail(style);
                }}
              >
                <Info size={15} />
              </button>
            </>
          )
        }
      />
    );
  }
  const personalized = !!subjectLabel(context.family, context.drinkKind);
  const moodFilter = !!text || collection === "all" || !!category;
  const detailInfo = detail ? expectations(detail.id) : null;
  const detailBlocked = !!detail && unavailable.includes(detail.id);
  const detailFavorite = !!detail && favorites.includes(detail.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="cx-workspace-popover st-sheet st-library"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (matchMedia("(pointer: fine)").matches
            ? searchInput.current
            : title.current
          )?.focus({ preventScroll: true });
        }}
        onEscapeKeyDown={(event) => {
          if (detail) {
            event.preventDefault();
            onDetail(null);
          } else if (query) {
            event.preventDefault();
            setQuery("");
          }
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <header className="st-library-header">
          <div className="st-library-title">
            <DialogTitle ref={title} tabIndex={-1}>
              Styles
            </DialogTitle>
            <DialogDescription>
              {available.length} looks · your food stays your food
            </DialogDescription>
          </div>
          <div className="st-search" role="search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchInput}
              type="search"
              aria-label="Search styles"
              placeholder="Search styles, moods or settings"
              maxLength={maximumStyleQueryLength}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (detail) onDetail(null);
              }}
            />
            {query && (
              <button
                className="st-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            className="st-icon-button"
            aria-label="Close styles"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} />
          </button>
        </header>
        <div className="st-library-layout">
          <nav className="st-library-rail" aria-label="Style collections">
            {[
              ["suggested", "Suggested", <Sparkles key="s" size={16} />],
              ["saved", "Saved", <Heart key="h" size={16} />],
            ].map(([id, label, icon]) => (
              <button
                key={id as string}
                aria-current={!text && collection === id ? "true" : undefined}
                onClick={() => choose(id as string)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
            <span className="st-rail-label" aria-hidden="true">
              Collections
            </span>
            <button
              aria-current={!text && collection === "all" ? "true" : undefined}
              onClick={() => choose("all")}
            >
              <span>All styles</span>
              <small>{available.length}</small>
            </button>
            {styleCategories.map((entry) => {
              const count = available.filter(
                (style) => style.category === entry.id,
              ).length;
              return count ? (
                <button
                  key={entry.id}
                  aria-current={
                    !text && collection === `category:${entry.id}`
                      ? "true"
                      : undefined
                  }
                  onClick={() => choose(`category:${entry.id}`)}
                >
                  <span>{entry.name}</span>
                  <small>{count}</small>
                </button>
              ) : null;
            })}
            <span className="st-rail-label" aria-hidden="true">
              Occasions
            </span>
            {occasions
              .filter((entry) =>
                entry.looks.some((id) => !unavailable.includes(id)),
              )
              .map((entry) => (
                <button
                  key={entry.id}
                  aria-current={
                    !text && collection === `occasion:${entry.id}`
                      ? "true"
                      : undefined
                  }
                  onClick={() => choose(`occasion:${entry.id}`)}
                >
                  <span>{entry.name}</span>
                </button>
              ))}
          </nav>
          <div className="st-library-main">
            <div
              ref={body}
              className="st-library-body"
              inert={!!detail}
              aria-hidden={detail ? true : undefined}
            >
              {moodFilter && (
                <div
                  className="st-moods"
                  role="radiogroup"
                  aria-label="Mood"
                  onKeyDown={radioKeys}
                >
                  {lookMoods.map((value, index) => (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={mood === value}
                      tabIndex={radioTab(
                        index,
                        lookMoods.indexOf(mood as never),
                      )}
                      onClick={() => setMood(value)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
              {text ? (
                <>
                  <p className="st-library-count" role="status">
                    {search.styles.length
                      ? `${search.styles.length} ${search.related ? "related " : ""}${search.styles.length === 1 ? "style" : "styles"} for “${text}”`
                      : shortcut ||
                          matchingOccasions.length ||
                          matchingSaved.length
                        ? `Results for “${text}”`
                        : ""}
                  </p>
                  {shortcut && (
                    <div className="st-shortcut">
                      <SlidersHorizontal size={20} aria-hidden="true" />
                      <div>
                        <b>{shortcut.title}</b>
                        <p>{shortcut.description}</p>
                      </div>
                      <button
                        className="st-pill"
                        disabled={busy}
                        onClick={() => onCustomize(shortcut.section)}
                      >
                        {shortcut.action}
                      </button>
                    </div>
                  )}
                  {matchingOccasions.length > 0 && (
                    <div className="st-occasion-chips">
                      {matchingOccasions.map((entry) => (
                        <button
                          key={entry.id}
                          className="st-chip"
                          onClick={() => choose(`occasion:${entry.id}`)}
                        >
                          {entry.name} collection
                          <ArrowRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                  {matchingSaved.length > 0 && (
                    <>
                      <h3 className="st-library-heading">Your saved looks</h3>
                      <div className="st-library-grid">
                        {matchingSaved.map((look) => (
                          <StyleTile
                            key={look.id}
                            label={look.name}
                            description="Restaurant look"
                            image={
                              look.previewAssetId
                                ? `/api/assets/${look.previewAssetId}`
                                : photoStyles.find(
                                    (style) => style.id === look.recipe.look,
                                  )?.image
                            }
                            selected={selectedKey === look.id}
                            disabled={busy}
                            onSelect={() => onApplySaved(look)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                  {search.styles.length > 0 ? (
                    <div className="st-library-grid">
                      {search.styles.map((style, index) =>
                        tile(style, "search", { rank: index + 1 }),
                      )}
                    </div>
                  ) : (
                    !shortcut &&
                    !matchingOccasions.length &&
                    !matchingSaved.length && (
                      <div className="st-library-empty" role="status">
                        <Search size={26} aria-hidden="true" />
                        <h3>No styles match “{text}”</h3>
                        <p>
                          Try a mood, a color or a setting, like “bright”,
                          “marble” or “candlelight”.
                        </p>
                        <div>
                          {mood !== "All" && (
                            <button
                              className="st-pill"
                              onClick={() => setMood("All")}
                            >
                              Clear mood
                            </button>
                          )}
                          <button
                            className="st-pill"
                            disabled={busy}
                            onClick={() => onCustomize()}
                          >
                            Customize your look
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : collection === "suggested" ? (
                <>
                  <div className="st-library-intro">
                    <h3>
                      {personalized
                        ? `Suggested for your ${subjectLabel(context.family, context.drinkKind)}`
                        : "Suggested for you"}
                    </h3>
                    <p>
                      {personalized
                        ? "Looks made for what’s in your photo, in a range of light and color."
                        : source
                          ? "Versatile looks that flatter most dishes."
                          : "Versatile looks that flatter most dishes. Add a photo for suggestions made for it."}
                    </p>
                  </div>
                  <div className="st-library-grid">
                    {suggestions.map((style, index) =>
                      tile(style, "suggestion", { eager: index < 8 }),
                    )}
                  </div>
                </>
              ) : collection === "saved" ? (
                <StudioSavedLooks
                  store={store}
                  restaurantLook={restaurantLook}
                  selectedKey={selectedKey}
                  guest={guest}
                  disabledStyleIds={unavailable}
                  tile={(style, origin) => tile(style, origin)}
                  onApply={onApplySaved}
                />
              ) : occasion ? (
                <>
                  <div className="st-library-intro">
                    <h3>{occasion.name}</h3>
                    <p>{occasion.description}</p>
                  </div>
                  <div className="st-library-grid">
                    {occasion.looks
                      .filter((id) => !unavailable.includes(id))
                      .map((id) =>
                        tile(
                          photoStyles.find((style) => style.id === id)!,
                          "occasion",
                          { occasionId: occasion.id, eager: true },
                        ),
                      )}
                  </div>
                  <p className="st-library-hint">
                    Seasonal touches change the scene, never your food. Add
                    promotional words later in Post Maker.
                  </p>
                </>
              ) : category ? (
                <>
                  <div className="st-library-intro">
                    <h3>{category.name}</h3>
                    <p>{category.description}</p>
                  </div>
                  {search.styles.length ? (
                    <div className="st-library-grid">
                      {search.styles.map((style) => tile(style, "catalog"))}
                    </div>
                  ) : (
                    <p className="st-library-hint" role="status">
                      No {mood.toLowerCase()} looks in {category.name} yet.
                    </p>
                  )}
                </>
              ) : (
                styleCategories.map((entry) => {
                  const styles = search.styles.filter(
                    (style) => style.category === entry.id,
                  );
                  return styles.length ? (
                    <section
                      key={entry.id}
                      aria-labelledby={`st-all-${entry.id}`}
                    >
                      <h3
                        id={`st-all-${entry.id}`}
                        className="st-library-heading"
                      >
                        {entry.name}
                        <small>{styles.length}</small>
                      </h3>
                      <div className="st-library-grid">
                        {styles.map((style) => tile(style, "catalog"))}
                      </div>
                    </section>
                  ) : null;
                })
              )}
            </div>
            {detail && (
              <div
                className="st-detail"
                role="group"
                aria-labelledby="st-detail-title"
              >
                <div className="st-detail-scroll">
                  <button className="st-back" onClick={() => onDetail(null)}>
                    <ArrowLeft size={16} />
                    Styles
                  </button>
                  <div className="st-detail-layout">
                    <figure>
                      <img
                        src={detail.image}
                        alt={`${detail.name} style example: ${detail.cue}`}
                        width={1000}
                        height={1000}
                      />
                      <figcaption>Style example</figcaption>
                    </figure>
                    <div className="st-detail-copy">
                      <span className="st-detail-kicker">{detail.group}</span>
                      <h3 id="st-detail-title" ref={detailTitle} tabIndex={-1}>
                        {detail.name}
                      </h3>
                      <p>{detail.description || detail.cue}</p>
                      {detail.bestFor && (
                        <p className="st-detail-best">
                          <b>Beautiful for</b>
                          {detail.bestFor}
                        </p>
                      )}
                      {detailInfo && (
                        <section
                          className="st-expectations"
                          aria-label="With your photo"
                        >
                          <h4>
                            {detailInfo.fromPhoto
                              ? "With your photo"
                              : "For your illustration"}
                          </h4>
                          <dl>
                            {detailInfo.rows.map((row) => (
                              <div key={row.label}>
                                <dt>{row.label}</dt>
                                <dd>
                                  {row.value}
                                  {row.custom && <span> · Your choice</span>}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {detailInfo.vesselConflict && (
                            <p>
                              Keep your original glass in Customize before
                              creating this drink photo.
                            </p>
                          )}
                          <p className="st-fidelity">
                            <ShieldCheck size={15} aria-hidden="true" />
                            {detailInfo.fromPhoto
                              ? "Your food and portion stay the same."
                              : "Review the result against the real dish."}
                          </p>
                        </section>
                      )}
                      <button
                        className="st-text-button"
                        aria-pressed={detailFavorite}
                        disabled={store.busy || !store.ready}
                        onClick={() => void store.favorite(detail.id)}
                      >
                        <Heart
                          size={16}
                          fill={detailFavorite ? "currentColor" : "none"}
                        />
                        {detailFavorite
                          ? "In your favorites"
                          : "Add to favorites"}
                      </button>
                    </div>
                  </div>
                </div>
                <footer className="st-library-footer">
                  <span>
                    {detailBlocked
                      ? "Temporarily unavailable. Choose another style."
                      : "An example of the look, not a preview of your dish."}
                  </span>
                  <button
                    className="st-pill st-pill-primary"
                    disabled={busy || detailBlocked}
                    onClick={() =>
                      onSelect(
                        detail.id,
                        detailOccasion.current
                          ? "occasion"
                          : text
                            ? "search"
                            : "catalog",
                        { occasionId: detailOccasion.current || undefined },
                      )
                    }
                  >
                    Use this style
                    <ArrowRight size={16} />
                  </button>
                </footer>
              </div>
            )}
          </div>
        </div>
        {!detail && (
          <footer className="st-library-footer">
            <button
              className="st-text-button"
              disabled={busy}
              onClick={(event) => onInspiration(event.currentTarget)}
            >
              <ImagePlus size={16} />
              Match a photo you love
            </button>
            {store.error && (
              <span role="alert">
                {store.error}{" "}
                <button
                  className="st-text-button"
                  onClick={() => void store.reload()}
                >
                  Retry
                </button>
              </span>
            )}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}

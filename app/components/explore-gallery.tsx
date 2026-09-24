"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  exploreStyles,
  lookbook,
  type LookbookEntry,
} from "@/lib/explore-styles";
import {
  styleCategories,
  styleThumbnail,
  type PhotoStyle,
} from "@/lib/photo-styles";
import { orderedOccasions } from "@/lib/studio-occasions";
import { maximumStyleQueryLength, searchStyles } from "@/lib/studio-search";
import { radioKeys, radioTab } from "./radio-keys";

// Ends the placeholder shimmer and fades the photo in once it has arrived.
function showPhoto(img: HTMLImageElement) {
  img.parentElement?.setAttribute("data-loaded", "");
}
const tintFor = (style: PhotoStyle) =>
  styleCategories.find((entry) => entry.id === style.category)?.color;
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
// Occasions share one warm tint; collections use their own color.
const occasionTint = "#ecd9cf";
// The occasions band follows the first 13 looks, where rows end in two and
// four columns.
const occasionsAfter = 13;
// Shown in the closing invitation; an unavailable look is left out.
const invitation = ["menu-courtyard", "studio-levitate", "bar-velvet"];

export default function ExploreGallery({
  active = true,
  disabledStyleIds = [],
  timezone,
  onTryStyle,
  onOpenStudio,
}: {
  active?: boolean;
  disabledStyleIds?: string[];
  timezone?: string;
  onTryStyle: (styleId: string) => void;
  onOpenStudio?: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<PhotoStyle | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const opened = useRef("");
  const trying = useRef(false);
  const gallery = useRef<HTMLElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  const detailScroll = useRef<HTMLDivElement | null>(null);
  const detailTitle = useRef<HTMLHeadingElement | null>(null);
  const seasonal = useMemo(() => orderedOccasions(timezone), [timezone]);

  const available = exploreStyles.filter(
    (style) => !disabledStyleIds.includes(style.id),
  );
  const collections = styleCategories.filter((entry) =>
    available.some((style) => style.category === entry.id),
  );
  const occasions = seasonal
    .map((entry) => ({
      ...entry,
      styles: entry.looks.flatMap((id) =>
        available.filter((style) => style.id === id),
      ),
    }))
    .filter((entry) => entry.styles.length);
  const category = collections.find(
    (entry) => filter === `category:${entry.id}`,
  );
  const occasion = occasions.find((entry) => filter === `occasion:${entry.id}`);
  const current = category || occasion ? filter : "all";
  const scope = category
    ? available.filter((style) => style.category === category.id)
    : occasion
      ? occasion.styles
      : available;
  const scopeName = category?.name || occasion?.name || "";
  const text = query.trim();
  const search = text ? searchStyles(text, "All", scope) : null;
  // All looks read as a lookbook with double-size features, a collection as
  // an even grid, and an occasion's three looks as one feature beside two.
  const entries: LookbookEntry[] = search
    ? search.styles.map((style) => ({ style, feature: false }))
    : category
      ? scope.map((style) => ({ style, feature: false }))
      : occasion
        ? scope.map((style, index) => ({
            style,
            feature: index === 0 && scope.length === 3,
          }))
        : lookbook(scope);
  const layout = search || category ? "grid" : occasion ? "trio" : "lookbook";
  const options = [
    { id: "all", label: "All looks" },
    ...collections.map((entry) => ({
      id: `category:${entry.id}`,
      label: entry.name,
    })),
    ...(occasion
      ? [{ id: `occasion:${occasion.id}`, label: occasion.name }]
      : []),
  ];
  const checked = options.findIndex((option) => option.id === current);

  // The detail view steps through what the gallery shows; a look opened from
  // its collection row steps through that collection instead.
  const shown = entries.map((entry) => entry.style);
  const family = !detail
    ? []
    : shown.some((style) => style.id === detail.id)
      ? shown
      : available.filter((style) => style.category === detail.category);
  const position = detail
    ? family.findIndex((style) => style.id === detail.id)
    : -1;
  const neighbor = (offset: number) =>
    position >= 0 && family.length > 1
      ? family[(position + offset + family.length) % family.length]
      : null;
  const previous = neighbor(-1);
  const next = neighbor(1);
  const siblings = detail
    ? available.filter((style) => style.category === detail.category)
    : [];
  const at = detail
    ? siblings.findIndex((style) => style.id === detail.id)
    : -1;
  const more = [
    ...siblings.slice(at + 1),
    ...siblings.slice(0, Math.max(at, 0)),
  ].slice(0, 4);
  const unavailable = !!detail && disabledStyleIds.includes(detail.id);

  // Looks and bands rise into place once, a few at a time, as they first
  // scroll into view. With reduced motion or no observer they simply appear.
  useLayoutEffect(() => {
    const root = gallery.current;
    if (
      !root ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (records) => {
        let delay = 0;
        for (const record of records) {
          if (!record.isIntersecting) continue;
          const element = record.target as HTMLElement;
          element.style.transitionDelay = `${delay}ms`;
          element.setAttribute("data-revealed", "");
          observer.unobserve(element);
          delay = Math.min(delay + 60, 240);
        }
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    for (const element of root.querySelectorAll<HTMLElement>(
      ".ex-tile, .ex-occasions, .ex-cta",
    )) {
      if (element.hasAttribute("data-revealed")) continue;
      element.setAttribute("data-reveal", "");
      observer.observe(element);
    }
    return () => observer.disconnect();
  });

  // The collection bar gains a hairline once it sticks to the top.
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) =>
      bar.current?.toggleAttribute(
        "data-stuck",
        !entry.isIntersecting && entry.boundingClientRect.top < 0,
      ),
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Keeps the chosen collection in view where the bar scrolls sideways.
  useEffect(() => {
    const rail = bar.current?.querySelector<HTMLElement>(".ex-chips");
    const chip = rail?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!rail || !chip || rail.scrollWidth <= rail.clientWidth) return;
    const box = rail.getBoundingClientRect();
    const target = chip.getBoundingClientRect();
    rail.scrollTo({
      left:
        rail.scrollLeft +
        target.left -
        box.left -
        (box.width - target.width) / 2,
      behavior: scrollBehavior(),
    });
  }, [current]);

  function choose(next: string) {
    setFilter(next);
    // Each selection starts from its top, just below the collection bar.
    const anchor = sentinel.current;
    if (!anchor) return;
    const top = anchor.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top)
      window.scrollTo({ top, behavior: scrollBehavior() });
  }
  function clearSearch() {
    setQuery("");
    searchInput.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function open(style: PhotoStyle, from: HTMLButtonElement) {
    trigger.current = from;
    opened.current = style.id;
    trying.current = false;
    setAnnouncement("");
    setDetail(style);
    setDetailOpen(true);
  }
  // Arrows keep focus in place and announce the new look; choosing from the
  // collection row moves focus to the new title.
  function show(style: PhotoStyle, focusTitle = false) {
    setDetail(style);
    setAnnouncement(focusTitle ? "" : `${style.name}, ${style.group}`);
    detailScroll.current?.scrollTo({ top: 0 });
    if (focusTitle) detailTitle.current?.focus({ preventScroll: true });
  }

  const band = occasions.length > 0 && (
    <section className="ex-occasions" aria-labelledby="ex-occasions-title">
      <div className="ex-occasions-heading">
        <h2 id="ex-occasions-title">Made for the moment</h2>
        <p>Ready-made sets of looks for the dates that fill your tables.</p>
      </div>
      <div className="ex-occasion-list">
        {occasions.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="ex-occasion"
            onClick={() => choose(`occasion:${entry.id}`)}
          >
            <span className="ex-occasion-fan" aria-hidden="true">
              {entry.styles.slice(0, 3).map((style) => (
                <img
                  key={style.id}
                  src={styleThumbnail(style.image)}
                  alt=""
                  width={400}
                  height={400}
                  loading="lazy"
                  decoding="async"
                />
              ))}
            </span>
            <span className="ex-occasion-name">{entry.name}</span>
            <span className="ex-occasion-text">{entry.description}</span>
            <span className="ex-occasion-link">
              {entry.styles.length === 1
                ? "1 look"
                : `${entry.styles.length} looks`}
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );

  const tile = ({ style, feature }: LookbookEntry, index: number) => (
    <button
      type="button"
      className="ex-tile"
      data-explore-style={style.id}
      data-feature={feature || undefined}
      aria-label={`${style.name} — ${style.group}`}
      aria-haspopup="dialog"
      onClick={(event) => open(style, event.currentTarget)}
    >
      <span className="ex-tile-image">
        <img
          ref={(img) => {
            if (img?.complete) showPhoto(img);
          }}
          src={styleThumbnail(style.image)}
          srcSet={`${styleThumbnail(style.image)} 400w, ${style.image} 1254w`}
          sizes={
            feature
              ? "(max-width: 760px) 100vw, 50vw"
              : "(max-width: 760px) 50vw, 25vw"
          }
          alt={`${style.name} food photography style: ${style.cue}`}
          width={1000}
          height={1000}
          loading={index < 5 ? "eager" : "lazy"}
          fetchPriority={index === 0 ? "high" : undefined}
          decoding="async"
          onLoad={(event) => showPhoto(event.currentTarget)}
          onError={(event) => showPhoto(event.currentTarget)}
        />
        {feature && (
          <span className="ex-tile-kicker" aria-hidden="true">
            {style.group}
          </span>
        )}
      </span>
      <span className="ex-tile-caption" aria-hidden="true">
        <span className="ex-tile-name">{style.name}</span>
        <span className="ex-tile-meta">
          {feature || category ? style.cue : style.group}
        </span>
      </span>
    </button>
  );

  return (
    <section
      ref={gallery}
      className="ex-gallery"
      aria-labelledby="explore-title"
    >
      <header className="ex-intro">
        <div className="ex-intro-copy">
          {available.length > 0 && (
            <p className="ex-eyebrow">
              {available.length} looks · {collections.length} collections
            </p>
          )}
          <h1 id="explore-title" tabIndex={-1}>
            Find the look for every dish
          </h1>
          <p className="ex-lede">
            Pick a look, add your dish photo, and Photo Studio restyles the
            scene around it for your menu, delivery apps and social.
          </p>
        </div>
        <div className="ex-search" role="search" aria-label="Explore styles">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInput}
            aria-label="Search styles"
            type="text"
            role="searchbox"
            placeholder="Search a style, mood or setting"
            value={query}
            maxLength={maximumStyleQueryLength}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear style search"
              onClick={() => {
                setQuery("");
                searchInput.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div ref={sentinel} className="ex-sentinel" aria-hidden="true" />
      <div ref={bar} className="ex-filter-bar">
        <div
          className="ex-chips"
          role="radiogroup"
          aria-label="Collections"
          onKeyDown={radioKeys}
        >
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === current}
              tabIndex={radioTab(index, checked)}
              onClick={() => choose(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {!text && (category || occasion) && (
        <div
          className="ex-collection"
          style={
            { "--ex-tint": category?.color ?? occasionTint } as CSSProperties
          }
        >
          <div>
            <h2 className="ex-collection-title">{scopeName}</h2>
            <p className="ex-collection-text">
              {category?.description ?? occasion?.description}
            </p>
          </div>
          <dl className="ex-collection-notes">
            {category ? (
              <>
                <div>
                  <dt>Made for</dt>
                  <dd>{category.use}</dd>
                </div>
                <div>
                  <dt>Tip</dt>
                  <dd>{category.tip}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Good to know</dt>
                <dd>
                  These looks change the scene, never your food. Add promotional
                  words later in Post Maker.
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
      {!!search?.styles.length && (
        <p className="ex-search-summary" role="status">
          {search.styles.length} {search.styles.length === 1 ? "look" : "looks"}
          {scopeName ? ` in ${scopeName}` : ""} for “{text}”
          {search.related ? " · Related looks included" : ""}
        </p>
      )}

      <div ref={grid} key={current} className="ex-grid" data-layout={layout}>
        {entries.map((entry, index) => (
          <Fragment key={entry.style.id}>
            {layout === "lookbook" && index === occasionsAfter && band}
            {tile(entry, index)}
          </Fragment>
        ))}
      </div>
      {layout === "lookbook" && entries.length <= occasionsAfter && band}

      {available.length === 0 && (
        <p className="cx-feedback" role="status">
          Styles are being refreshed. Please check back soon.
        </p>
      )}
      {search && !search.styles.length && (
        <div className="ex-empty" role="status">
          <Search size={24} aria-hidden="true" />
          <h2 className="ex-empty-title">
            No looks match “{text}”{scopeName ? ` in ${scopeName}` : ""}
          </h2>
          <p className="ex-empty-text">
            Try a mood, a color or a setting, like “bright”, “marble” or
            “candlelight”.
          </p>
          <div className="ex-empty-actions">
            {scopeName && (
              <button
                type="button"
                className="ex-pill"
                onClick={() => choose("all")}
              >
                Search all looks
              </button>
            )}
            <button type="button" className="ex-pill" onClick={clearSearch}>
              Clear search
            </button>
          </div>
        </div>
      )}

      {onOpenStudio && entries.length > 0 && (
        <section className="ex-cta" aria-labelledby="ex-cta-title">
          <div className="ex-cta-copy">
            <h2 id="ex-cta-title" className="ex-cta-title">
              Your dish, in its best light
            </h2>
            <p className="ex-cta-text">
              Add a photo in Photo Studio, choose any look, then fine-tune the
              light, surface and framing before you create.
            </p>
            <button
              type="button"
              className="ex-cta-button"
              onClick={onOpenStudio}
            >
              Open Photo Studio
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="ex-cta-art" aria-hidden="true">
            {invitation
              .flatMap((id) => available.filter((style) => style.id === id))
              .map((style) => (
                <img
                  key={style.id}
                  src={styleThumbnail(style.image)}
                  alt=""
                  width={400}
                  height={400}
                  loading="lazy"
                  decoding="async"
                />
              ))}
          </div>
        </section>
      )}

      <Dialog
        open={active && detailOpen}
        onOpenChange={(open) => !open && setDetailOpen(false)}
      >
        <DialogContent
          className="ex-detail"
          showCloseButton={false}
          style={
            detail
              ? ({ "--ex-tint": tintFor(detail) } as CSSProperties)
              : undefined
          }
          // Opening reads the look's name first; arrows and actions follow.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            detailTitle.current?.focus({ preventScroll: true });
          }}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if ((event.target as HTMLElement).closest("input, textarea"))
              return;
            const to =
              event.key === "ArrowLeft"
                ? previous
                : event.key === "ArrowRight"
                  ? next
                  : null;
            if (!to) return;
            event.preventDefault();
            show(to);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (trying.current) return;
            // After stepping to another look, return to that look's tile.
            const stepped =
              detail && detail.id !== opened.current
                ? grid.current?.querySelector<HTMLElement>(
                    `[data-explore-style="${CSS.escape(detail.id)}"]`,
                  )
                : null;
            if (stepped) stepped.focus();
            else trigger.current?.focus({ preventScroll: true });
          }}
        >
          {detail && (
            <>
              <div ref={detailScroll} className="ex-detail-scroll">
                <div
                  className="ex-detail-photo"
                  style={
                    {
                      "--ex-backdrop": `url("${styleThumbnail(detail.image)}")`,
                    } as CSSProperties
                  }
                >
                  <img
                    key={detail.id}
                    src={detail.image}
                    alt={`${detail.name} style example: ${detail.cue}`}
                    width={1000}
                    height={1000}
                  />
                  {previous && next && (
                    <>
                      <button
                        type="button"
                        className="ex-detail-nav"
                        data-direction="previous"
                        aria-label={`Previous look: ${previous.name}`}
                        onClick={() => show(previous)}
                      >
                        <ChevronLeft size={22} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="ex-detail-nav"
                        data-direction="next"
                        aria-label={`Next look: ${next.name}`}
                        onClick={() => show(next)}
                      >
                        <ChevronRight size={22} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
                <div className="ex-detail-info">
                  <p className="ex-category">
                    <span className="ex-category-dot" aria-hidden="true" />
                    {detail.group}
                  </p>
                  <DialogTitle
                    ref={detailTitle}
                    tabIndex={-1}
                    className="ex-detail-title"
                  >
                    {detail.name}
                  </DialogTitle>
                  <DialogDescription className="ex-description">
                    {detail.description || detail.cue}
                  </DialogDescription>
                  {!!detail.traits?.length && (
                    <ul className="ex-traits" aria-label="Style details">
                      {detail.traits.map((trait) => (
                        <li key={trait}>{trait}</li>
                      ))}
                    </ul>
                  )}
                  {detail.bestFor && (
                    <div className="ex-best-for">
                      <h3>Perfect for</h3>
                      <p>{detail.bestFor}</p>
                    </div>
                  )}
                  <p className="ex-fidelity">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Your food and portion stay the same.
                  </p>
                  {more.length > 0 && (
                    <section className="ex-more" aria-labelledby="ex-more">
                      <h3 id="ex-more">More in {detail.group}</h3>
                      <div className="ex-more-list">
                        {more.map((style) => (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => show(style, true)}
                          >
                            <img
                              src={styleThumbnail(style.image)}
                              alt=""
                              width={400}
                              height={400}
                              loading="lazy"
                              decoding="async"
                            />
                            <span>{style.name}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
              <footer className="ex-detail-action">
                <small>AI-generated style example</small>
                <button
                  type="button"
                  className="ex-try"
                  disabled={unavailable}
                  onClick={() => {
                    trying.current = true;
                    setDetailOpen(false);
                    onTryStyle(detail.id);
                  }}
                >
                  {unavailable ? "Temporarily unavailable" : "Use this look"}
                  {!unavailable && <ArrowRight size={18} aria-hidden="true" />}
                </button>
              </footer>
              <p className="sr-only" aria-live="polite">
                {announcement}
              </p>
              <DialogClose
                className="ex-close"
                aria-label="Close style details"
              >
                <X size={20} aria-hidden="true" />
              </DialogClose>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { exploreStyles } from "@/lib/explore-styles";
import type { PhotoStyle } from "@/lib/photo-styles";
import { maximumStyleQueryLength, searchStyles } from "@/lib/studio-search";

// Ends the placeholder shimmer and fades the photo in once it has arrived.
function showPhoto(img: HTMLImageElement) {
  img.parentElement?.setAttribute("data-loaded", "");
}

export default function ExploreGallery({
  active = true,
  disabledStyleIds = [],
  onTryStyle,
}: {
  active?: boolean;
  disabledStyleIds?: string[];
  onTryStyle: (styleId: string) => void;
}) {
  const [selected, setSelected] = useState<PhotoStyle | null>(null);
  const [query, setQuery] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const trying = useRef(false);
  const available = exploreStyles.filter(
    (style) => !disabledStyleIds.includes(style.id),
  );
  const unavailable = !!selected && disabledStyleIds.includes(selected.id);
  const results = searchStyles(query, "All", available);

  return (
    <section className="ex-gallery" aria-labelledby="explore-title">
      <header className="ex-header">
        <h1 id="explore-title" tabIndex={-1}>
          All Styles
        </h1>
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
      {query && (
        <p className="ex-search-summary" role="status">
          {results.styles.length}{" "}
          {results.styles.length === 1 ? "style" : "styles"}
          {results.related ? " · Related looks included" : ""}
        </p>
      )}
      <div className="ex-grid">
        {results.styles.map((style, index) => (
          <button
            key={style.id}
            type="button"
            className="ex-tile"
            data-explore-style={style.id}
            aria-label={`Explore ${style.name} — ${style.group}`}
            aria-haspopup="dialog"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              trying.current = false;
              setSelected(style);
            }}
          >
            <span className="ex-tile-image">
              <img
                ref={(img) => {
                  if (img?.complete) showPhoto(img);
                }}
                src={style.image}
                alt={`${style.name} food photography style: ${style.cue}`}
                width={1000}
                height={1000}
                loading={index < 3 ? "eager" : "lazy"}
                decoding="async"
                onLoad={(event) => showPhoto(event.currentTarget)}
                onError={(event) => showPhoto(event.currentTarget)}
              />
            </span>
            <span className="ex-tile-name" aria-hidden="true">
              {style.name}
            </span>
          </button>
        ))}
      </div>
      {available.length === 0 && (
        <p className="cx-feedback" role="status">
          Styles are being refreshed. Please check back soon.
        </p>
      )}
      {!!available.length && !results.styles.length && (
        <div className="ex-empty" role="status">
          <h2>No styles found</h2>
          <p>Try a mood, color or setting, or return to all styles.</p>
          <button
            className="cx-btn cx-secondary"
            onClick={() => {
              setQuery("");
              searchInput.current?.focus({ preventScroll: true });
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
          >
            Show all styles
          </button>
        </div>
      )}

      <Dialog
        open={active && !!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          className="ex-detail"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!trying.current)
              trigger.current?.focus({ preventScroll: true });
          }}
        >
          {selected && (
            <>
              <div className="ex-detail-scroll">
                <div className="ex-detail-photo">
                  <img
                    src={selected.image}
                    alt={`${selected.name} style example: ${selected.cue}`}
                    width={1000}
                    height={1000}
                  />
                </div>
                <div className="ex-detail-info">
                  <div>
                    <p className="ex-category">{selected.group}</p>
                    <DialogTitle className="ex-detail-title">
                      {selected.name}
                    </DialogTitle>
                    <DialogDescription className="ex-description">
                      {selected.description || selected.cue}
                    </DialogDescription>
                    {!!selected.traits?.length && (
                      <ul className="ex-traits" aria-label="Style details">
                        {selected.traits.map((trait) => (
                          <li key={trait}>{trait}</li>
                        ))}
                      </ul>
                    )}
                    {selected.bestFor && (
                      <div className="ex-best-for">
                        <h3>Perfect for</h3>
                        <p>{selected.bestFor}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <footer className="ex-detail-action">
                <button
                  type="button"
                  className="ex-try"
                  disabled={unavailable}
                  onClick={() => {
                    trying.current = true;
                    setSelected(null);
                    onTryStyle(selected.id);
                  }}
                >
                  {unavailable ? "Temporarily unavailable" : "Use this look"}
                  {!unavailable && <ArrowRight size={18} aria-hidden="true" />}
                </button>
                <small>AI-generated style example</small>
              </footer>
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

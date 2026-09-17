"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { photoStyles } from "@/lib/studio";
import { orderedOccasions, studioOccasions } from "@/lib/studio-occasions";
import type { PhotoStyle } from "@/lib/photo-styles";
import { findOccasions } from "@/lib/studio-search";
export function StudioOccasions({
  timezone,
  query,
  active,
  onActive,
  explore,
  disabledStyleIds = [],
  onSearchAll,
  onResultCount,
}: {
  timezone?: string;
  query: string;
  active: string;
  onActive: (id: string) => void;
  explore: (
    look: PhotoStyle,
    occasion: string,
    trigger?: HTMLButtonElement,
  ) => void;
  disabledStyleIds?: string[];
  onSearchAll: () => void;
  onResultCount: (count: number) => void;
}) {
  const [collections] = useState(() => orderedOccasions(timezone));
  const section = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    previousActive = useRef(active),
    previousQuery = useRef(query);
  useLayoutEffect(() => {
    const before = previousActive.current;
    const queryChanged = previousQuery.current !== query;
    previousActive.current = active;
    previousQuery.current = query;
    if (before === active || queryChanged) return;
    if (active) heading.current?.focus();
    else
      [
        ...(section.current?.querySelectorAll<HTMLButtonElement>(
          "[data-occasion-trigger]",
        ) || []),
      ]
        .find((button) => button.dataset.occasionTrigger === before)
        ?.focus();
  }, [active, query]);
  const current = studioOccasions.find((o) => o.id === active);
  const matching = findOccasions(query, collections, disabledStyleIds);
  const resultCount = matching.length;
  useEffect(() => onResultCount(resultCount), [resultCount, onResultCount]);
  return (
    <section ref={section} className="ps2-occasions">
      {current ? (
        <>
          <button className="cx-link" onClick={() => onActive("")}>
            <ChevronLeft size={16} />
            All occasions
          </button>
          <h3 ref={heading} tabIndex={-1}>
            {current.name}
          </h3>
          <p>{current.description}</p>
          <div className="ps2-gallery">
            {current.looks
              .filter((id) => !disabledStyleIds.includes(id))
              .map((id) => {
                const look = photoStyles.find((style) => style.id === id)!;
                return (
                  <button
                    key={id}
                    className="ps2-occasion-card"
                    data-look-detail={`occasion-look:${id}`}
                    onClick={(event) =>
                      explore(look, current.id, event.currentTarget)
                    }
                  >
                    <img
                      src={look.image}
                      alt={`${look.name} style example`}
                      loading="lazy"
                      width={512}
                      height={512}
                    />
                    <span>
                      <b>{look.name}</b>
                      <small>{look.cue}</small>
                      <ArrowRight size={18} />
                    </span>
                  </button>
                );
              })}
          </div>
          {current.looks.every((id) => disabledStyleIds.includes(id)) && (
            <p role="status">
              These looks are temporarily unavailable. Choose another occasion.
            </p>
          )}
          <p className="ps2-control-help">
            Scene inspiration only. Your food, portion and serving dish stay
            yours. Add promotional wording later in Post Maker.
          </p>
        </>
      ) : (
        <>
          <p>
            Find a setting for the moment. Explore the curated looks in each
            collection.
          </p>
          <div className="ps2-occasion-grid">
            {matching.map((occasion) => (
              <button
                key={occasion.id}
                className="ps2-occasion-card"
                data-occasion-trigger={occasion.id}
                onClick={() => onActive(occasion.id)}
              >
                <img
                  src={
                    photoStyles.find(
                      (look) =>
                        look.id ===
                        occasion.looks.find(
                          (id) => !disabledStyleIds.includes(id),
                        ),
                    )!.image
                  }
                  alt={`${occasion.name} style inspiration`}
                  loading="lazy"
                  width={512}
                  height={512}
                />
                <span>
                  <b>{occasion.name}</b>
                  <small>{occasion.description}</small>
                  <ArrowRight size={18} />
                </span>
              </button>
            ))}
          </div>
          {!matching.length && (
            <div className="ps2-empty-results">
              <h3 role="status">No matching occasion.</h3>
              <p>
                Try Christmas, game day, Valentine’s or summer, or search the
                full collection.
              </p>
              <button className="cx-btn" onClick={onSearchAll}>
                Search all looks
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

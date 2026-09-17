"use client";

import { useRef, useState } from "react";
import { ArrowRight, Expand, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { exploreStyles } from "@/lib/explore-styles";
import type { PhotoStyle } from "@/lib/photo-styles";

export default function ExploreGallery({
  disabledStyleIds = [],
  onTryStyle,
}: {
  disabledStyleIds?: string[];
  onTryStyle: (styleId: string) => void;
}) {
  const [selected, setSelected] = useState<PhotoStyle | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const trying = useRef(false);
  const available = exploreStyles.filter(
    (style) => !disabledStyleIds.includes(style.id),
  );
  const unavailable = !!selected && disabledStyleIds.includes(selected.id);

  return (
    <section className="ex-gallery" aria-labelledby="explore-title">
      <header className="ex-header">
        <h1 id="explore-title" tabIndex={-1}>
          Explore
        </h1>
        <p>A little inspiration for your next great photo.</p>
      </header>

      <div className="ex-grid">
        {available.map((style, index) => (
          <button
            key={style.id}
            type="button"
            className="ex-tile"
            aria-label={`Explore ${style.name} — ${style.group}`}
            aria-haspopup="dialog"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              trying.current = false;
              setSelected(style);
            }}
          >
            <img
              src={style.image}
              alt={`${style.name} food photography style: ${style.cue}`}
              width={1000}
              height={1000}
              loading={index < 3 ? "eager" : "lazy"}
              decoding="async"
            />
            <span className="ex-tile-caption">
              <span>
                <small>{style.group}</small>
                <strong>{style.name}</strong>
              </span>
              <Expand size={19} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      {available.length === 0 && (
        <p className="cx-feedback" role="status">
          Styles are being refreshed. Please check back soon.
        </p>
      )}

      <Dialog
        open={!!selected}
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
                <div className="ex-detail-action">
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
                    {unavailable ? "Temporarily unavailable" : "Try This Style"}
                    {!unavailable && (
                      <ArrowRight size={18} aria-hidden="true" />
                    )}
                  </button>
                  <p>Make it yours in Photo Studio.</p>
                  <small>AI-generated style example</small>
                </div>
              </div>
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

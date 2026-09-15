"use client";
import { Camera, Check, SlidersHorizontal } from "lucide-react";
import type { PhotoStyle } from "@/lib/photo-styles";

export function StudioIntroduction() {
  return (
    <aside className="cx-first-guide">
      <div className="cx-first-example">
        <img
          className="cx-first-after"
          src="/homepage/burger-enhanced.webp"
          alt="Example burger photo with a clean setting and studio lighting"
        />
        <span className="cx-first-example-label">
          A little inspiration · example edit
        </span>
        <figure className="cx-first-before">
          <img
            src="/homepage/burger-original.webp"
            alt="The original burger photo before editing"
          />
          <figcaption>Started with a phone photo</figcaption>
        </figure>
      </div>
      <div className="cx-first-guidance">
        <span className="cx-eyebrow">
          YOU BRING THE FOOD. WE BRING THE LIGHT.
        </span>
        <h2>No studio. No editing experience.</h2>
        <p>
          A clear phone photo is a great place to start. You’ll choose the look
          before we create anything.
        </p>
        <ul>
          <li>
            <Check size={16} /> Keep the whole dish in the frame.
          </li>
          <li>
            <Check size={16} /> Start with one dish or drink.
          </li>
          <li>
            <Check size={16} /> Your original is always saved.
          </li>
        </ul>
      </div>
    </aside>
  );
}

export function RecommendedPhotoStyles({
  source,
  recommendations,
  selected,
  onSelect,
  onReplace,
  onQuickEdit,
  busy,
  advice,
}: {
  source: string;
  recommendations: PhotoStyle[];
  selected: PhotoStyle;
  onSelect: (id: string) => void;
  onReplace: () => void;
  onQuickEdit: () => void;
  busy: boolean;
  advice: string;
}) {
  return (
    <>
      {source && (
        <div className="cx-source-receipt">
          <img src={source} alt="Your uploaded original photo" />
          <div>
            <span className="cx-upload-saved">
              <Check size={15} /> Your photo is ready
            </span>
            <p>
              {advice ||
                "We’ll use your food as the reference. Your original stays safe."}
            </p>
          </div>
          <div className="cx-source-actions">
            <button className="cx-link" disabled={busy} onClick={onReplace}>
              <Camera size={15} /> Replace
            </button>
            <button className="cx-link" disabled={busy} onClick={onQuickEdit}>
              <SlidersHorizontal size={15} /> Just a touch-up
            </button>
          </div>
        </div>
      )}
      <div
        className="cx-recommended-styles"
        role="group"
        aria-label="Three recommended photo styles"
      >
        {recommendations.map((style, index) => (
          <button
            className="cx-recommendation"
            key={style.id}
            aria-pressed={selected.id === style.id}
            disabled={busy}
            onClick={() => onSelect(style.id)}
          >
            <div className="cx-recommendation-image">
              <img src={style.image} alt={`${style.name} style example`} />
              <span className="cx-recommendation-check">
                {selected.id === style.id && <Check size={17} />}
              </span>
              {index === 0 && (
                <span className="cx-recommendation-badge">
                  A great place to start
                </span>
              )}
            </div>
            <div className="cx-recommendation-copy">
              <span className="cx-eyebrow">{style.group}</span>
              <strong>{style.name}</strong>
              <p>{style.cue}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="cx-recommendation-note">
        These photos show the style. Your result will feature your own dish.
      </p>
    </>
  );
}

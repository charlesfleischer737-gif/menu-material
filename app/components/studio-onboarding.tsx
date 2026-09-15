"use client";
import { useId, useState } from "react";
import { Check, ChevronsLeftRight, Sparkles } from "lucide-react";
import type { PhotoStyle } from "@/lib/photo-styles";

export function PhotoComparison({
  original,
  result,
  ratio = 1.35,
  example = false,
}: {
  original: string;
  result: string;
  ratio?: number;
  example?: boolean;
}) {
  const [position, setPosition] = useState(50);
  const [failed, setFailed] = useState(false);
  const labelId = useId();
  return (
    <figure className="cx-photo-comparison">
      <div className="cx-comparison-stage" style={{ aspectRatio: ratio }}>
        <img
          src={result}
          alt={
            example ? "Example studio edit of a burger" : "Your edited photo"
          }
          onError={() => setFailed(true)}
        />
        <div
          className="cx-comparison-original"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={original}
            alt={
              example
                ? "Original phone photo of the burger"
                : "Your original photo"
            }
            onError={() => setFailed(true)}
          />
        </div>
        <span className="cx-comparison-tag is-before">Before</span>
        <span className="cx-comparison-tag is-after">After</span>
        {!failed && (
          <>
            <div
              className="cx-comparison-divider"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            >
              <span>
                <ChevronsLeftRight size={21} />
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={position}
              onChange={(e) => setPosition(Number(e.target.value))}
              aria-labelledby={labelId}
              aria-valuetext={`${position}% original photo, ${100 - position}% edited photo`}
            />
          </>
        )}
        {failed && (
          <p className="cx-comparison-error" role="status">
            {example
              ? "The example couldn’t load. You can still upload your photo to get started."
              : "The comparison couldn’t load. Open Your result to view the photo."}
          </p>
        )}
      </div>
      <figcaption>
        <span id={labelId}>
          <ChevronsLeftRight size={16} /> Slide to compare
        </span>
        <span>{example ? "Example edit" : "Original → your result"}</span>
      </figcaption>
    </figure>
  );
}

export function StudioIntroduction() {
  return (
    <aside className="cx-first-guide">
      <div className="cx-first-example">
        <PhotoComparison
          original="/homepage/burger-original.webp"
          result="/homepage/burger-enhanced.webp"
          example
        />
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
  recommendations,
  selected,
  onSelect,
  busy,
}: {
  recommendations: PhotoStyle[];
  selected: PhotoStyle;
  onSelect: (id: string) => void;
  busy: boolean;
}) {
  return (
    <>
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
                <span className="cx-recommendation-badge">Recommended</span>
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
        Style inspiration. We’ll create this look with your food.
      </p>
    </>
  );
}

export function StudioCreating({
  source,
  style,
  queued,
}: {
  source: string;
  style: PhotoStyle;
  queued: boolean;
}) {
  return (
    <div className="cx-creating-scene" role="status">
      <div className="cx-creating-photo">
        <img
          src={source || style.image}
          alt={
            source
              ? "Your original photo, safely saved"
              : "Your chosen style example"
          }
        />
        <span className="cx-comparison-tag is-before">
          {source ? "Your original" : "Style inspiration"}
        </span>
        <div className="cx-creating-style">
          <img src={style.image} alt="Chosen style example" />
          <span>
            Your chosen look<strong>{style.name}</strong>
          </span>
        </div>
      </div>
      <div className="cx-creating-copy">
        <span className="cx-creating-icon">
          <Sparkles size={28} />
        </span>
        <span className="cx-eyebrow">
          {queued ? "IN THE QUEUE" : "IN YOUR PHOTO STUDIO"}
        </span>
        <h2>
          {queued ? "Ready for its close-up." : "A fresh light on your food."}
        </h2>
        <p>
          {queued
            ? "Your photo and style are saved. We’re waiting to start your image."
            : "We’re creating your chosen look, using your original food as the reference."}
        </p>
        <div className="cx-creating-activity" aria-hidden="true">
          <span />
        </div>
        <p className="cx-creating-note">
          Keep this tab open. Your result will appear here, ready to compare and
          download.
        </p>
        <span className="cx-original-safe">
          <Check size={16} /> Your original stays saved
        </span>
      </div>
    </div>
  );
}

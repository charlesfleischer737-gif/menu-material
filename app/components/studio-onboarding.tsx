"use client";
import { useEffect, useId, useRef, useState } from "react";
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

export function StudioCreating({
  source,
  style,
  queued,
  startedAt,
  jobId,
}: {
  source: string;
  style: PhotoStyle;
  queued: boolean;
  startedAt?: number;
  jobId: string;
}) {
  const fallbackStart = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Number(startedAt) || fallbackStart.current;
    const tick = () => setElapsed(Math.max(0, (Date.now() - start) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, jobId]);
  const takingLonger = elapsed > 120;
  return (
    <div className="ps-render" aria-busy="true">
      <div className="ps-render-visual">
        <div className="ps-render-photo">
          <img
            src={source || style.image}
            alt={
              source
                ? "Your original photo, saved while your image is created"
                : "Your selected style example"
            }
          />
          <span>{source ? "YOUR ORIGINAL" : "STYLE INSPIRATION"}</span>
        </div>
        <div className="ps-render-style">
          <img src={style.image} alt="Selected style example" />
          <div>
            <span>The look we’re creating</span>
            <b>{style.name}</b>
          </div>
        </div>
      </div>
      <div className="ps-render-copy">
        <span className="ps-render-mark">
          <Sparkles size={23} />
        </span>
        <p className="cx-eyebrow">In your Photo Studio</p>
        <h1 tabIndex={-1}>
          A little light.
          <br />A whole new look.
        </h1>
        <p className="ps-render-status" role="status">
          {queued
            ? takingLonger
              ? "Your image is still queued. Your photo and choices are safely saved."
              : "Your photo is saved. Waiting for the studio to start."
            : takingLonger
              ? "Still creating your photo. Some images take a little longer."
              : "Your photo is taking shape. Creation time varies with the image and service demand."}
        </p>
        <div className="ps2-job-status">
          <span className="ps2-job-indicator" aria-hidden="true" />
          <div>
            <b>{queued ? "Waiting to start" : "Creating your photo"}</b>
            <p>
              {queued
                ? "Your place in the queue is saved."
                : "We’ll show your result when it is ready. You can leave this page and return to the same photo."}
            </p>
          </div>
        </div>
        <p className="ps-render-safe">
          <Check size={15} />
          Your original stays saved. Your result appears here.
        </p>
      </div>
    </div>
  );
}

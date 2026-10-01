"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { ChevronsLeftRight, Sparkles } from "lucide-react";
import { styleThumbnail, type PhotoStyle } from "@/lib/photo-styles";
import { creationProgress, typicalWait } from "@/lib/creation-progress";
import { serverNow } from "@/lib/server-clock";
import {
  subscribeWorkerHealth,
  workerHealthServerSnapshot,
  workerHealthSnapshot,
} from "@/lib/worker-health";
import Kitty from "./kitty";
import { prefersReducedMotion } from "./motion";

// Motion tokens from globals.css, for motion started from JavaScript.
function token(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}
const arriving = () => token("--ease") || "cubic-bezier(0.25, 1, 0.5, 1)";
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A photo on the studio canvas. It settles in once it has loaded, never as
 * an empty frame (photo-studio.css).
 */
export function StudioPhoto(props: ComponentProps<"img">) {
  return (
    <img
      {...props}
      className="st-photo"
      data-settle=""
      onLoad={settle}
      onError={settle}
    />
  );
}
function settle(event: SyntheticEvent<HTMLImageElement>) {
  const photo = event.currentTarget;
  // A photo that loads before its first frame still settles: its waiting
  // style is computed first, for the transition to start from.
  void getComputedStyle(photo).opacity;
  photo.dataset.loaded = "";
}

export function PhotoComparison({
  original,
  result,
  ratio = 1.35,
  example = false,
  intro = false,
}: {
  original: string;
  result: string;
  ratio?: number;
  example?: boolean;
  /** Sweeps the divider in from the edge to where it rests, once. */
  intro?: boolean;
}) {
  const [position, setPosition] = useState(50);
  const [failed, setFailed] = useState(false);
  const labelId = useId();
  const before = useRef<HTMLDivElement>(null),
    divider = useRef<HTMLDivElement>(null),
    resting = useRef(position),
    sweep = useRef<Animation[]>([]);
  useEffect(() => {
    resting.current = position;
  }, [position]);
  const stopSweep = () => {
    for (const animation of sweep.current) animation.cancel();
    sweep.current = [];
  };
  // From all new photo to the split. Started before the frame is painted, so
  // the comparison never shows the split first.
  useLayoutEffect(() => {
    if (!intro || prefersReducedMotion()) return;
    const timing = { duration: 900, easing: arriving() };
    const to = resting.current;
    sweep.current = [
      before.current?.animate(
        { clipPath: ["inset(0 100% 0 0)", `inset(0 ${100 - to}% 0 0)`] },
        timing,
      ),
      divider.current?.animate(
        { transform: ["translateX(0%)", `translateX(${to}%)`] },
        timing,
      ),
    ].filter((animation) => !!animation);
    return stopSweep;
  }, [intro]);
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
          ref={before}
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
            {/* As wide as the frame and moved with a transform, so dragging
                never lays out the page. */}
            <div
              className="cx-comparison-divider"
              ref={divider}
              style={{ transform: `translateX(${position}%)` }}
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
              onPointerDown={stopSweep}
              onKeyDown={stopSweep}
              onChange={(e) => {
                stopSweep();
                setPosition(Number(e.target.value));
              }}
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
      {/* The Before and After tags label the photos; the hint is spoken. */}
      <figcaption className="sr-only">
        <span id={labelId}>Slide to compare</span>
        <span>{example ? "Example edit" : "Original → your result"}</span>
      </figcaption>
    </figure>
  );
}

export type ResultView = "result" | "before" | "compare";

/**
 * The finished photo, its original and the comparison, stacked in one frame
 * so switching between them crossfades instead of starting over. A photo
 * that was just made waits until it has decoded, then wipes in from the left
 * as it comes into focus; the comparison then sweeps in to show what changed.
 */
export function ResultPhotos({
  result,
  original,
  view,
  comparable,
  ratio,
  resultAlt,
  reveal = false,
  hold = false,
  onReady,
  onRevealed,
  onCompare,
}: {
  result: string;
  original: string;
  view: ResultView;
  comparable: boolean;
  ratio: number;
  resultAlt: string;
  /** Reveal a photo that was just made. Read once, when mounted. */
  reveal?: boolean;
  /** Keeps it waiting, out of sight, until the page is ready to reveal it. */
  hold?: boolean;
  /** The photo has decoded (or can't be), so it can be revealed whole. */
  onReady?: () => void;
  onRevealed?: () => void;
  /** Asks to show the comparison, after a reveal the owner didn't interrupt. */
  onCompare?: () => void;
}) {
  const photo = useRef<HTMLImageElement>(null);
  const [revealing] = useState(reveal),
    [sweep, setSweep] = useState(false);
  const latest = useRef({ view, comparable, onReady, onRevealed, onCompare });
  useEffect(() => {
    latest.current = { view, comparable, onReady, onRevealed, onCompare };
  });
  // The same element decodes and is revealed: private photos aren't cached,
  // so decoding a copy would download the photo twice.
  useEffect(() => {
    const image = photo.current;
    if (!revealing || !image) return;
    let live = true;
    // A slow photo is revealed as it loads rather than held back, and one
    // that can't decode is revealed with its error.
    void Promise.race([image.decode().catch(() => {}), wait(5000)]).then(() => {
      if (live) latest.current.onReady?.();
    });
    return () => {
      live = false;
    };
  }, [revealing]);
  // Started before the frame is painted, so the photo never flashes in whole.
  useLayoutEffect(() => {
    const image = photo.current;
    if (!revealing || hold || !image) return;
    let live = true,
      beat = 0;
    const reduced = prefersReducedMotion();
    delete image.dataset.reveal;
    // The clip reaches past the photo so its shadow is wiped in with it.
    const animation = reduced
      ? image.animate({ opacity: [0, 1] }, 150)
      : image.animate(
          {
            clipPath: [
              "inset(-40px calc(100% + 40px) -80px -40px)",
              "inset(-40px -40px -80px -40px)",
            ],
            filter: ["blur(6px)", "blur(0)"],
          },
          { duration: 700, easing: arriving() },
        );
    animation.finished.then(
      () => {
        if (!live) return;
        latest.current.onRevealed?.();
        if (reduced) return;
        // A beat on the new photo, then the original sweeps in beside it.
        beat = window.setTimeout(() => {
          const now = latest.current;
          if (now.view !== "result" || !now.comparable) return;
          setSweep(true);
          now.onCompare?.();
        }, 300);
      },
      () => {},
    );
    return () => {
      live = false;
      animation.cancel();
      clearTimeout(beat);
      image.dataset.reveal = "";
    };
  }, [revealing, hold]);
  // Views out of sight are inert: never focused, never read.
  const layer = (id: ResultView) => ({
    className: "st-layer",
    "data-shown": view === id || undefined,
    inert: view !== id,
  });
  return (
    <>
      <div {...layer("result")}>
        {revealing ? (
          <img
            ref={photo}
            className="st-photo"
            src={result}
            alt={resultAlt}
            data-reveal=""
          />
        ) : (
          <StudioPhoto src={result} alt={resultAlt} />
        )}
      </div>
      {original && (
        <div {...layer("before")}>
          <StudioPhoto src={original} alt="Original photo" />
        </div>
      )}
      {comparable && (
        <div {...layer("compare")}>
          <PhotoComparison
            original={original}
            result={result}
            ratio={ratio}
            intro={sweep}
          />
        </div>
      )}
    </>
  );
}

export function StudioCreating({
  source,
  style,
  queued,
  requestedAt,
  createdAt,
  sentAt,
  typicalMs,
  jobId,
  held = "",
  done = false,
  onDone,
  children,
}: {
  source: string;
  style: PhotoStyle;
  queued: boolean;
  /** Why a held image waits to start (the daily AI budget or a pause). */
  held?: string;
  /** The photo is ready: the bar runs to the end, then `onDone`. */
  done?: boolean;
  onDone?: () => void;
  /** When Create was pressed, by this device's clock. */
  requestedAt?: number;
  /** When the job was saved, by the server's clock. */
  createdAt?: number;
  /** When the image was sent for creation, by the server's clock. */
  sentAt?: number;
  /** How long most recent images with these settings took. */
  typicalMs?: number;
  jobId: string;
  children?: ReactNode;
}) {
  const fallbackStart = useRef(0);
  const [times, setTimes] = useState({
    queuedFor: 0,
    sentFor: null as number | null,
  });
  // The furthest the bar has been for this image (one screen per image): a
  // refreshed estimate never moves it back.
  const [shown, setShown] = useState(0);
  // Only promise background progress while the background worker checks in.
  const workerHealthy = useSyncExternalStore(
    subscribeWorkerHealth,
    workerHealthSnapshot,
    workerHealthServerSnapshot,
  );
  useEffect(() => {
    const tick = () => {
      const local = Date.now(),
        server = serverNow();
      const queuedFor = createdAt
        ? server - createdAt
        : local - (Number(requestedAt) || (fallbackStart.current ||= local));
      const next = {
        queuedFor,
        // A running image without a send time counts from its request.
        sentFor: sentAt ? server - sentAt : queued ? null : queuedFor,
      };
      setTimes(next);
      const { value } = creationProgress({ ...next, typical: typicalMs });
      setShown((furthest) => Math.max(furthest, value));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [requestedAt, createdAt, sentAt, queued, jobId, typicalMs]);
  const finished = useRef(onDone);
  useEffect(() => {
    finished.current = onDone;
  });
  useEffect(() => {
    if (!done) return;
    // After the bar's last stretch (photo-studio.css).
    const timer = setTimeout(
      () => finished.current?.(),
      prefersReducedMotion() ? 0 : parseFloat(token("--duration")) || 0,
    );
    return () => clearTimeout(timer);
  }, [done]);
  const progress = creationProgress({ ...times, typical: typicalMs });
  const value = done ? 1 : Math.max(progress.value, shown);
  // The side panel and the card say it's taking longer at the same moment.
  const takingLonger = progress.late;
  // Time-based shimmer is decoration only; status comes from the saved job.
  return (
    <div className="st-studio st-creating" aria-busy="true">
      <section className="st-stage" aria-label="Your photo">
        <div className="st-canvas has-photo st-developing">
          <StudioPhoto
            src={source || style.image}
            alt={
              source
                ? "Your original dish photo"
                : "Your selected style example"
            }
          />
          <span className="st-canvas-label">
            {source ? "Your original" : "Style example"}
          </span>
          <span className="st-develop" aria-hidden="true" />
          {/* On the photo, so it stays in view on a phone as well. The
              --progress value fills the bar and moves the kitty's eyes. */}
          <div
            className="st-progress-card"
            data-done={done ? "" : undefined}
            style={{ "--progress": value } as CSSProperties}
          >
            <div className="st-progress-head" aria-hidden="true">
              <b>
                {done
                  ? "Your photo is ready"
                  : held
                    ? "On hold"
                    : progress.stage}
              </b>
              {progress.time && !done && <span>{progress.time}</span>}
            </div>
            {/* Waits at the end of the track, watching the bar fill. */}
            <Kitty pose="sit" className="st-progress-kitty" />
            <div
              className="st-progress"
              role="progressbar"
              aria-label="Photo progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(value * 20) * 5}
              aria-valuetext={
                done
                  ? "Ready"
                  : held
                    ? "On hold"
                    : progress.time || progress.stage
              }
            >
              <span />
            </div>
          </div>
        </div>
      </section>
      <aside className="st-inspector" aria-label="Creating your photo">
        <div className="st-section">
          <span className="st-badge">
            <span className="st-pulse" aria-hidden="true" />
            {held ? "On hold" : queued ? "Waiting to start" : "Creating"}
          </span>
          <h2 className="st-result-title">
            {held
              ? "Your photo is on hold."
              : queued
                ? "Your photo is next in line."
                : "Your photo is taking shape."}
          </h2>
          <p className="st-result-copy" role="status">
            {held
              ? held
              : queued
                ? takingLonger
                  ? "Still waiting for the studio."
                  : "The studio starts in a moment."
                : takingLonger
                  ? "Still creating. Some images take a little longer."
                  : `Most photos are ready in ${typicalWait(typicalMs)}.`}
          </p>
        </div>
        <div className="st-creating-look">
          <img src={styleThumbnail(style.image)} alt="" />
          <div>
            <small>Style</small>
            <b>{style.name}</b>
          </div>
          <Sparkles size={16} aria-hidden="true" />
        </div>
        {!held && (
          <p className="st-result-copy">
            {workerHealthy
              ? "You can leave this page. We’ll keep working, and your result will be waiting here."
              : "Keep this page open until your photo is ready. It can stay in a background tab."}
          </p>
        )}
        {children}
      </aside>
    </div>
  );
}

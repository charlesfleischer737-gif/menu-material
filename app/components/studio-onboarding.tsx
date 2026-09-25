"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Check, ChevronsLeftRight, Sparkles } from "lucide-react";
import { styleThumbnail, type PhotoStyle } from "@/lib/photo-styles";
import { creationProgress, typicalWait } from "@/lib/creation-progress";
import { serverNow } from "@/lib/server-clock";
import {
  subscribeWorkerHealth,
  workerHealthServerSnapshot,
  workerHealthSnapshot,
} from "@/lib/worker-health";

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
      {/* The Before and After tags label the photos; the hint is spoken. */}
      <figcaption className="sr-only">
        <span id={labelId}>Slide to compare</span>
        <span>{example ? "Example edit" : "Original → your result"}</span>
      </figcaption>
    </figure>
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
  children,
}: {
  source: string;
  style: PhotoStyle;
  queued: boolean;
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
      setTimes({
        queuedFor,
        // A running image without a send time counts from its request.
        sentFor: sentAt ? server - sentAt : queued ? null : queuedFor,
      });
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [requestedAt, createdAt, sentAt, queued, jobId]);
  const takingLonger = times.queuedFor > 120000;
  const progress = creationProgress({ ...times, typical: typicalMs });
  // Time-based shimmer is decoration only; status comes from the saved job.
  return (
    <div className="st-studio st-creating" aria-busy="true">
      <section className="st-stage" aria-label="Your photo">
        <div className="st-canvas has-photo st-developing">
          <img
            className="st-photo"
            src={source || style.image}
            alt={
              source
                ? "Your original photo, saved while your image is created"
                : "Your selected style example"
            }
          />
          <span className="st-canvas-label">
            {source ? "Your original" : "Style example"}
          </span>
          <span className="st-develop" aria-hidden="true" />
          {/* On the photo, so it stays in view on a phone as well. */}
          <div className="st-progress-card">
            <div className="st-progress-head" aria-hidden="true">
              <b>{progress.stage}</b>
              {progress.time && <span>{progress.time}</span>}
            </div>
            <div
              className="st-progress"
              role="progressbar"
              aria-label="Photo progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.value * 20) * 5}
              aria-valuetext={progress.time || progress.stage}
            >
              <span
                style={{
                  transform: `translateX(${(progress.value - 1) * 100}%)`,
                }}
              />
            </div>
          </div>
        </div>
        <div className="st-stage-foot">
          <span>
            <Check size={14} aria-hidden="true" />
            Your original stays saved. Your result appears here.
          </span>
        </div>
      </section>
      <aside className="st-inspector" aria-label="Creating your photo">
        <div className="st-section">
          <span className="st-badge">
            <span className="st-pulse" aria-hidden="true" />
            {queued ? "Waiting to start" : "Creating"}
          </span>
          <h2 className="st-result-title">
            {queued
              ? "Your photo is next in line."
              : "Your photo is taking shape."}
          </h2>
          <p className="st-result-copy" role="status">
            {queued
              ? takingLonger
                ? "Still waiting for the studio. Your photo and choices are safely saved."
                : "Your photo is saved. The studio starts in a moment."
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
        <p className="st-result-copy">
          {workerHealthy
            ? "You can leave this page. We’ll keep working, and your result will be waiting here."
            : "Keep this page open until your photo is ready."}
        </p>
        {children}
      </aside>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { type Row } from "@/lib/client";
import { renderPost } from "@/lib/creation-export";
import { postSize } from "@/lib/post-composition";
import { postVisualState } from "@/lib/sharing";
/** Thumbnails draw at their display size; previews wait for typing to pause. */
export function PostCanvas({
  draft,
  restaurant,
  channel = "feed",
  slide = 0,
  example = false,
  onQuality,
  thumbnail = false,
  scale,
}: {
  draft: Row;
  restaurant: Row;
  channel?: string;
  slide?: number;
  example?: boolean;
  onQuality?: (issues: string[]) => void;
  thumbnail?: boolean;
  scale?: number;
}) {
  const quality = useRef(onQuality);
  useEffect(() => {
    quality.current = onQuality;
  }, [onQuality]);
  const ref = useRef<HTMLCanvasElement>(null),
    drawn = useRef(false),
    [rendered, setRendered] = useState({ key: "", error: "" }),
    [framed, setFramed] = useState(false);
  const renderKey = JSON.stringify(
    postVisualState(draft, restaurant, channel, slide),
  );
  const loading = rendered.key !== renderKey;
  const error = loading ? "" : rendered.error;
  const size = postSize(draft, channel);
  const factor = scale || (thumbnail ? 324 / 1080 : 1);
  useEffect(() => {
    let live = true;
    const run = () => {
      const temp = document.createElement("canvas");
      const preview = JSON.parse(renderKey);
      renderPost(
        temp,
        preview.draft,
        preview.restaurant,
        preview.channel,
        preview.slide,
        { scale: factor },
      )
        .then((result) => {
          if (live && ref.current) {
            // Legacy designs render full size; draw them down to the display size.
            ref.current.width = Math.round(size.width * factor);
            ref.current.height = Math.round(size.height * factor);
            ref.current
              .getContext("2d")!
              .drawImage(temp, 0, 0, ref.current.width, ref.current.height);
            drawn.current = true;
            setFramed(true);
            setRendered({ key: renderKey, error: "" });
            quality.current?.(result.warnings || []);
          }
        })
        .catch((e) => {
          if (live) {
            setRendered({ key: renderKey, error: e.message });
            quality.current?.([e.message]);
          }
        });
    };
    // The first frame draws at once; later edits wait for a pause in typing.
    const timer = setTimeout(run, drawn.current ? 150 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [renderKey, factor, size.width, size.height]);
  const format =
    channel === "story"
      ? "Story"
      : channel === "carousel"
        ? `Carousel slide ${slide + 1}`
        : "Post";
  return (
    <div
      className="cx-post-canvas"
      style={{ aspectRatio: size.width / size.height }}
    >
      {/* A design thumbnail sits in a button that already names the design. */}
      <canvas
        ref={ref}
        style={{ visibility: error ? "hidden" : "visible" }}
        role="img"
        aria-hidden={thumbnail || undefined}
        aria-label={
          example
            ? `Example Instagram ${format.toLowerCase()} design`
            : `${format} preview using your approved photo`
        }
      />
      {loading && !framed && (
        <span className="cx-canvas-status">Preparing preview…</span>
      )}
      {error && (
        <p role={thumbnail ? undefined : "alert"} className="cx-canvas-status">
          {error}
        </p>
      )}
    </div>
  );
}

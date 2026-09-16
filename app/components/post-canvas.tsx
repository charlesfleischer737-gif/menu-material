"use client";
import { useEffect, useRef, useState } from "react";
import { type Row } from "@/lib/client";
import { renderPost } from "@/lib/creation-export";
import { postVisualState } from "@/lib/sharing";
export function PostCanvas({
  draft,
  restaurant,
  channel = "feed",
  slide = 0,
  example = false,
  onQuality,
  thumbnail = false,
}: {
  draft: Row;
  restaurant: Row;
  channel?: string;
  slide?: number;
  example?: boolean;
  onQuality?: (issues: string[]) => void;
  thumbnail?: boolean;
}) {
  const quality = useRef(onQuality);
  useEffect(() => {
    quality.current = onQuality;
  }, [onQuality]);
  const ref = useRef<HTMLCanvasElement>(null),
    [rendered, setRendered] = useState({ key: "", error: "" });
  const renderKey = JSON.stringify(
    postVisualState(draft, restaurant, channel, slide),
  );
  const loading = rendered.key !== renderKey;
  const error = loading ? "" : rendered.error;
  useEffect(() => {
    let live = true;
    const temp = document.createElement("canvas");
    const preview = JSON.parse(renderKey);
    renderPost(
      temp,
      preview.draft,
      preview.restaurant,
      preview.channel,
      preview.slide,
    )
      .then((result) => {
        if (live && ref.current) {
          ref.current.width = thumbnail ? 324 : temp.width;
          ref.current.height = thumbnail
            ? Math.round((temp.height * 324) / temp.width)
            : temp.height;
          ref.current
            .getContext("2d")!
            .drawImage(temp, 0, 0, ref.current.width, ref.current.height);
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
    return () => {
      live = false;
    };
  }, [renderKey, thumbnail]);
  return (
    <div
      className="cx-post-canvas"
      style={{ aspectRatio: channel === "story" ? 9 / 16 : 4 / 5 }}
    >
      <canvas
        ref={ref}
        style={{ visibility: error ? "hidden" : "visible" }}
        role="img"
        aria-label={
          example
            ? `Example Instagram ${channel} design`
            : `${channel} design preview using your approved photo`
        }
      />
      {loading && <span className="cx-canvas-status">Preparing preview…</span>}
      {error && (
        <p role="alert" className="cx-canvas-status">
          {error}
        </p>
      )}
    </div>
  );
}

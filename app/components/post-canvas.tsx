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
}: {
  draft: Row;
  restaurant: Row;
  channel?: string;
  slide?: number;
  example?: boolean;
}) {
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
      .then(() => {
        if (live && ref.current) {
          ref.current.width = temp.width;
          ref.current.height = temp.height;
          ref.current.getContext("2d")!.drawImage(temp, 0, 0);
          setRendered({ key: renderKey, error: "" });
        }
      })
      .catch((e) => {
        if (live) {
          setRendered({ key: renderKey, error: e.message });
        }
      });
    return () => {
      live = false;
    };
  }, [renderKey]);
  return (
    <div
      className="cx-post-canvas"
      style={{ aspectRatio: channel === "story" ? 9 / 16 : 4 / 5 }}
    >
      <canvas
        ref={ref}
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

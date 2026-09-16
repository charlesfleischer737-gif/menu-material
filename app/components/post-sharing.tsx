"use client";
import { useEffect, useState } from "react";
import { Copy, Download, LoaderCircle, Share2, Smartphone } from "lucide-react";
import { canvasBlob, renderPost } from "@/lib/creation-export";
import { downloadBlob, type Row } from "@/lib/client";
import { track } from "./creation-shared";

export default function PostSharing({
  draft,
  restaurant,
  busy,
  notice,
}: {
  draft: Row;
  restaurant: Row;
  busy: boolean;
  notice: (message: string) => void;
}) {
  const [selected, setSelected] = useState(draft.channels[0] || "feed");
  const [prepared, setPrepared] = useState<{
    key: string;
    files: File[];
  } | null>(null);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({
    draft,
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      currency: restaurant.currency,
      logo_id: restaurant.logo_id,
    },
    selected,
  });
  const files = prepared?.key === key ? prepared.files : [];
  const ready = draft.reviewed && files.length > 0 && !busy && !sharing;
  useEffect(() => {
    if (!draft.channels.includes(selected))
      setSelected(draft.channels[0] || "feed");
  }, [draft.channels, selected]);
  useEffect(() => {
    let active = true;
    setError("");
    setPrepared(null);
    if (!draft.reviewed) return;
    const data = JSON.parse(key);
    void (async () => {
      const outputs: File[] = [];
      const count = data.selected === "carousel" ? data.draft.items.length : 1;
      for (let i = 0; i < count; i++) {
        const c = document.createElement("canvas");
        await renderPost(c, data.draft, data.restaurant, data.selected, i);
        outputs.push(
          new File(
            [await canvasBlob(c, "image/png")],
            `${data.restaurant.slug}-${data.selected}${count > 1 ? "-" + (i + 1) : ""}.png`,
            { type: "image/png" },
          ),
        );
        if (!active) return;
      }
      setPrepared({ key, files: outputs });
    })().catch((e) => {
      if (active)
        setError(e.message || "Your image couldn’t be prepared. Try again.");
    });
    return () => {
      active = false;
    };
  }, [key, attempt]);
  const canShare =
    typeof navigator !== "undefined" &&
    !!navigator.share &&
    files.length > 0 &&
    !!navigator.canShare?.({ files });
  function share() {
    if (!ready || !canShare) return;
    // Files are prepared before the tap so the device share sheet retains user activation.
    setSharing(true);
    void navigator
      .share({ files })
      .then(() => {
        track("export_complete", undefined, {
          tool: "post",
          channel: selected,
          method: "share",
        });
        notice(
          "Returned from sharing. Paste your copied caption in Instagram before posting.",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Your phone couldn’t open sharing. Save the image below, then choose it in Instagram.",
          );
      })
      .finally(() => setSharing(false));
  }
  return (
    <section className="cx-post-sharing">
      <div className="cx-sharing-heading">
        <Smartphone size={21} />
        <div>
          <h3>From here to Instagram.</h3>
          <p>Your photo, ready for the app you use.</p>
        </div>
      </div>
      <label className="cx-field">
        <span>What are you posting?</span>
        <select
          disabled={busy || sharing}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {draft.channels.map((channel: string) => (
            <option key={channel} value={channel}>
              {channel === "feed"
                ? "Instagram post · 4:5"
                : channel === "story"
                  ? "Instagram story · 9:16"
                  : `Carousel · ${draft.items.length} slides`}
            </option>
          ))}
        </select>
      </label>
      <button
        className="cx-btn cx-secondary cx-full"
        disabled={!draft.reviewed || busy || sharing}
        onClick={() => {
          void navigator.clipboard
            .writeText(draft.caption || "")
            .then(() =>
              notice(
                "Caption copied. Paste it into Instagram after choosing your image.",
              ),
            )
            .catch(() =>
              setError(
                "Copy the caption from the preview, then paste it into Instagram.",
              ),
            );
        }}
      >
        <Copy size={16} /> 1. Copy caption
      </button>
      {draft.reviewed && !files.length && !error && (
        <p className="cx-share-preparing" role="status">
          <LoaderCircle size={16} className="cx-spin" /> Preparing your{" "}
          {selected === "carousel" ? "slides" : "image"}…
        </p>
      )}
      {canShare && (
        <button className="cx-btn cx-full" disabled={!ready} onClick={share}>
          <Share2 size={17} /> 2. Share {files.length > 1 ? "slides" : "image"}
        </button>
      )}
      {files.map((file, index) => (
        <button
          className={`cx-btn ${canShare || files.length > 1 ? "cx-secondary" : ""} cx-full`}
          key={file.name}
          disabled={!ready}
          onClick={() => {
            downloadBlob(file, file.name);
            track("export_complete", undefined, {
              tool: "post",
              channel: selected,
              method: "download",
            });
            notice(
              "Image downloaded. On a phone, save it to Photos or your gallery, then choose it in Instagram.",
            );
          }}
        >
          <Download size={17} />{" "}
          {files.length > 1
            ? `Save slide ${index + 1}`
            : canShare
              ? "Save image to device"
              : "2. Save image"}
        </button>
      ))}
      {error && (
        <div className="cx-feedback cx-error" role="alert">
          {error}
          <button className="cx-link" onClick={() => setAttempt((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}
      <p className="cx-sharing-instructions">
        {canShare
          ? "Choose Instagram if it appears in your share sheet, or save to your photo library. "
          : "Save the image to Photos or your gallery, then open Instagram and choose Post or Story. "}
        Paste your caption before posting.
      </p>
      <small>You choose when to publish in Instagram.</small>
    </section>
  );
}

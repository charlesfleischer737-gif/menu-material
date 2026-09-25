"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Download, Megaphone } from "lucide-react";
import { downloadBlob } from "@/lib/client";
import {
  downloadFormats,
  eventDestination,
  masterPhotoExport,
  photoExport,
  type DownloadFormat,
} from "@/lib/photo-export";
import {
  catalogProfiles,
  emptyAdjustments,
  type Adjustments,
} from "@/lib/studio";
import {
  isCatalogDestination,
  photoDestination,
  photoDestinations,
  photoFilename,
  type DownloadPhoto,
  type PhotoDestination,
} from "@/lib/photo-destinations";
import { readPreference, rememberPreference } from "@/lib/workspace-navigation";
import { photoExportEventKey } from "@/lib/photo-export-identity";
import {
  CropControls,
  Feedback,
  PhotoFrame,
  track,
  useAction,
} from "./creation-shared";

// Instagram's 3:4 post is a download size under the Instagram choice.
type Destination = PhotoDestination | "feed-3x4";
const instagramSizes: { id: Destination; label: string }[] = [
  { id: "feed", label: "Post 4:5" },
  { id: "feed-3x4", label: "Post 3:4" },
  { id: "story", label: "Story" },
];

export default function PhotoDownloads({
  items,
  preferenceKey,
  initialFormat = "menu",
  onPromote,
}: {
  items: DownloadPhoto[];
  preferenceKey: string;
  initialFormat?: string;
  onPromote?: (item: DownloadPhoto) => void;
}) {
  const [destination, setDestination] = useState<Destination>(
    photoDestination(initialFormat),
  );
  const [index, setIndex] = useState(0);
  const [crops, setCrops] = useState<Record<string, Adjustments>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [progress, setProgress] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const action = useAction();
  const key = `${preferenceKey}:photo-destination`;
  useEffect(() => {
    const remembered = readPreference(key);
    if (remembered) setDestination(photoDestination(remembered));
  }, [key]);
  const item = items[Math.min(index, items.length - 1)];
  if (!item) return null;
  const master = destination === "master";
  const catalog = isCatalogDestination(destination);
  const instagram = instagramSizes.some((size) => size.id === destination);
  const choice = photoDestinations.find(
    (d) => d.id === (instagram ? "feed" : destination),
  )!;
  const sizeLabel =
    instagram && destination !== "feed"
      ? downloadFormats[destination as DownloadFormat].label
      : choice.label;
  const cropKey = `${item.assetId}:${destination}`;
  const edits = crops[cropKey] || { ...emptyAdjustments, fit: !catalog };
  const allChecked =
    master || items.every((i) => checked[`${i.assetId}:${destination}`]);
  const photoOnly = !catalog || items.every((i) => i.fromPhoto);
  const profile = catalogProfiles[destination as keyof typeof catalogProfiles];
  function select(value: Destination) {
    setDestination(value);
    setDownloaded(false);
    action.setError("");
    action.setNotice("");
    rememberPreference(key, value);
    track("destination_selected", item.dishId, {
      destination: eventDestination(value),
    });
  }
  async function download() {
    const attemptId = crypto.randomUUID();
    if (!allChecked)
      throw Error("Review the crop for each selected dish first.");
    if (!photoOnly)
      throw Error("Use a photo of your actual dish for ordering platforms.");
    const files: Record<string, Uint8Array> = {};
    let totalBytes = 0;
    const completed: {
      item: DownloadPhoto;
      width?: number;
      height?: number;
    }[] = [];
    for (let n = 0; n < items.length; n++) {
      const photo = items[n];
      setProgress(`Preparing photo ${n + 1} of ${items.length}…`);
      try {
        const output =
          destination === "master"
            ? await masterPhotoExport(photo.assetId)
            : await photoExport(
                photo.assetId,
                destination,
                crops[`${photo.assetId}:${destination}`] || {
                  ...emptyAdjustments,
                  fit: !catalog,
                },
              );
        const filename = photoFilename(
          photo,
          destination,
          "extension" in output ? output.extension : "jpg",
        );
        totalBytes += output.blob.size;
        if (items.length > 1 && totalBytes > 80 * 1024 * 1024)
          throw Error(
            "This collection is large. Download fewer photos at a time to keep your device responsive.",
          );
        void photoExportEventKey(
          photo.assetId,
          destination,
          crops[`${photo.assetId}:${destination}`] || {
            ...emptyAdjustments,
            fit: !catalog,
          },
        )
          .then((key) =>
            track(
              "export_prepared",
              photo.assetId,
              { destination: eventDestination(destination) },
              key,
            ),
          )
          .catch(() => {});
        if (items.length === 1) downloadBlob(output.blob, filename);
        else files[filename] = new Uint8Array(await output.blob.arrayBuffer());
        completed.push({
          item: photo,
          ...("width" in output
            ? { width: output.width, height: output.height }
            : {}),
        });
      } catch (error) {
        setIndex(n);
        throw Error(`${photo.name}: ${(error as Error).message}`);
      }
    }
    if (items.length > 1) {
      const { zipSync, strToU8 } = await import("fflate");
      files["Upload instructions.txt"] = strToU8(choice.instructions);
      downloadBlob(
        new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], {
          type: "application/zip",
        }),
        `menu-material-${destination}-photos.zip`,
      );
    }
    for (const { item: photo } of completed)
      track(
        "export_download_started",
        photo.assetId,
        { destination: eventDestination(destination) },
        attemptId,
      );
    rememberPreference(key, destination);
    setDownloaded(true);
    action.setNotice(
      items.length > 1
        ? "Download started. Your photos and upload instructions are in one file."
        : "Download started. Your photo is also saved in My Dishes.",
    );
  }
  return (
    <section className="cx-downloads" aria-label="Download your photos">
      <div className="cx-section-line">
        <div>
          <h2>
            Where will you use{" "}
            {items.length > 1 ? "these photos" : "this photo"}?
          </h2>
          <p className="cx-hint">
            Choose a destination. Downloads and crops don’t use any images.
          </p>
        </div>
      </div>
      <fieldset disabled={!!action.busy} className="cx-download-fields">
        <legend className="sr-only">Photo destination and crop</legend>
        <div
          className="cx-export-destinations"
          aria-label="Download destination"
        >
          {photoDestinations.map((d) => (
            <button
              key={d.id}
              className={choice.id === d.id ? "is-selected" : ""}
              aria-pressed={choice.id === d.id}
              onClick={() => select(d.id)}
            >
              <b>{d.label}</b>
              <span>{d.hint}</span>
              {choice.id === d.id && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
        {items.length > 1 && (
          <div className="cx-batch-review">
            <p>Review each dish before downloading the collection.</p>
            <div className="cx-button-row">
              {items.map((photo, i) => (
                <button
                  className="cx-btn cx-secondary"
                  key={photo.assetId}
                  aria-pressed={i === index}
                  onClick={() => setIndex(i)}
                >
                  {checked[`${photo.assetId}:${destination}`] && (
                    <Check size={15} />
                  )}
                  {photo.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="cx-export-workspace">
          <div className="cx-export-preview">
            {master ? (
              <img src={`/api/assets/${item.assetId}`} alt={item.name} />
            ) : (
              <PhotoFrame
                src={`/api/assets/${item.assetId}`}
                ratio={downloadFormats[destination as DownloadFormat].ratio}
                edits={edits}
                label={`${item.name} · ${sizeLabel} preview`}
                onChange={(next) => {
                  setCrops((old) => ({ ...old, [cropKey]: next }));
                  setChecked((old) => ({ ...old, [cropKey]: false }));
                  setDownloaded(false);
                }}
              />
            )}
          </div>
          <div>
            {instagram && (
              <div className="cx-segment" aria-label="Instagram format">
                {instagramSizes.map((size) => (
                  <button
                    key={size.id}
                    aria-pressed={destination === size.id}
                    onClick={() => select(size.id)}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            )}
            {master ? (
              <p>{choice.instructions}</p>
            ) : (
              <>
                <CropControls
                  value={edits}
                  allowFit={!catalog}
                  onChange={(next) => {
                    setCrops((old) => ({ ...old, [cropKey]: next }));
                    setChecked((old) => ({ ...old, [cropKey]: false }));
                    setDownloaded(false);
                  }}
                />
                <label className="cx-check">
                  <input
                    type="checkbox"
                    checked={!!checked[cropKey]}
                    onChange={(e) =>
                      setChecked((old) => ({
                        ...old,
                        [cropKey]: e.target.checked,
                      }))
                    }
                  />
                  The full dish is visible and accurately represents what I
                  serve.
                </label>
              </>
            )}
            {!photoOnly && (
              <p className="cx-feedback" role="status">
                Ordering platforms need a photo of the actual dish. A selected
                image was created from a description or has no original photo
                attached. Choose another photo, or download it for a different
                use.
              </p>
            )}
            <button
              className="cx-btn cx-full"
              disabled={!allChecked || !photoOnly}
              onClick={() => action.act("Preparing your download", download)}
            >
              <Download size={18} />
              {action.busy
                ? progress || "Preparing…"
                : items.length > 1
                  ? `Download ${items.length} photos`
                  : master
                    ? "Download full-quality image"
                    : `Download for ${sizeLabel}`}
            </button>
            <p className="cx-hint">
              Your saved photo stays unchanged. Full-quality image keeps the
              original resolution and file.
            </p>
            {!master && (
              <div className="cx-upload-guidance">
                <h3>Next: upload to {choice.label}</h3>
                <p>{choice.instructions}</p>
                {profile && (
                  <>
                    <p className="cx-hint">
                      We check file size and dimensions. Each platform reviews
                      photo acceptance; editing restrictions may apply.
                    </p>
                    <a
                      className="cx-link"
                      href={profile.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Photo requirements & upload help <ArrowRight size={14} />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </fieldset>
      <Feedback {...action} />
      {onPromote && (
        <div className="cx-reuse-next">
          <div>
            <h3>
              {downloaded
                ? "Now give this dish a little more spotlight."
                : "Want a matching post, too?"}
            </h3>
            <p>
              Use this approved photo, your restaurant’s look, and an editable
              caption. No images used.
            </p>
          </div>
          <button
            className="cx-btn cx-secondary"
            disabled={!!action.busy}
            onClick={() => onPromote(item)}
          >
            <Megaphone size={18} />
            Make a post & Story <ArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

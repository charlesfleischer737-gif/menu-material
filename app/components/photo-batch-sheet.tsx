"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, downloadBlob, type Row } from "@/lib/client";
import { recipeFromDraft } from "@/lib/studio-library";
import {
  formatNames,
  formatShapes,
  formats,
  styleFor,
  type PhotoFormat,
} from "@/lib/studio";
import { masterPhotoExport } from "@/lib/photo-export";
import { photoFilename } from "@/lib/photo-destinations";
import { track } from "./creation-shared";

export function PhotoBatchSheet({
  state,
  draft,
  onClose,
  remember,
  onReview,
  refresh,
  onCloseAutoFocus,
}: {
  state: Row;
  draft: Row;
  onClose: () => void;
  remember: (id: string) => Promise<void>;
  onReview: (item: Row, jobId: string, assetId: string) => void;
  refresh: () => Promise<void>;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [batch, setBatch] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [included, setIncluded] = useState<string[]>([]);
  const batchId = useRef(draft.photoBatchId || crypto.randomUUID()),
    lock = useRef(false);
  const format: PhotoFormat = draft.format in formats ? draft.format : "menu",
    note = String(draft.note || "")
      .trim()
      .slice(0, 500);
  // What a set is made as: its own saved shape once started.
  const setFormat: PhotoFormat =
    batch?.settings?.controls?.format in formats
      ? batch!.settings.controls.format
      : format;
  const madeAs = `${formatNames[setFormat]} · ${formatShapes[setFormat]}`;
  useEffect(() => {
    let active = true;
    if (draft.photoBatchId && !lock.current)
      api(`photo-batches/${draft.photoBatchId}`)
        .then(({ batch }) => {
          if (active) setBatch(batch);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [draft.photoBatchId]);
  const candidates = state.dishes
    .filter((dish: Row) => !dish.archived_at)
    .map((dish: Row) => ({
      ...dish,
      source: state.assets.find(
        (a: Row) =>
          a.dish_id === dish.id && a.kind === "source" && !a.deleted_at,
      ),
    }));
  async function act(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function begin() {
    const items = selected.map((id) => {
      const dish = candidates.find((d: Row) => d.id === id);
      return { dishId: id, sourceId: dish.source.id };
    });
    await remember(batchId.current);
    const result = await api("photo-batches", {
      batchId: batchId.current,
      items,
      style: styleFor(draft, state.restaurant),
      // The set copies this photo's look, shape and Details note.
      recipe: { ...recipeFromDraft(draft, state.restaurant), note },
      format,
    });
    setBatch(result.batch);
    void api("jobs/tick", {}).catch(() => {});
  }
  const itemState = (item: Row, index: number) => {
    const submitted =
      index === 0
        ? null
        : state.batchItems.find((entry: Row) => entry.id === item.itemId);
    const jobId = index === 0 ? batch?.sampleJobId : submitted?.job_id;
    const output = state.outputs.find(
      (entry: Row) => entry.job_id === jobId && entry.status === "completed",
    );
    const job = state.jobs.find((entry: Row) => entry.id === jobId);
    const asset = state.assets.find(
      (entry: Row) => entry.id === output?.asset_id,
    );
    return {
      jobId,
      output,
      asset,
      failed: job?.status === "failed" || submitted?.status === "failed",
      error:
        submitted?.error ||
        state.outputs.find(
          (entry: Row) => entry.job_id === jobId && entry.status === "failed",
        )?.error,
    };
  };
  const sample = batch && itemState(batch.items[0], 0),
    remaining = batch ? batch.items.length - 1 : 0;
  const eligibleExports = batch
    ? batch.items
        .map(itemState)
        .filter(
          (entry: Row) =>
            entry.asset?.approved_at &&
            !entry.asset.needs_correction &&
            included.includes(entry.asset.id),
        )
    : [];
  async function exportSet() {
    const attemptId = crypto.randomUUID();
    const { zipSync } = await import("fflate");
    const files: Record<string, Uint8Array> = {};
    for (const entry of eligibleExports) {
      const dish = state.dishes.find((d: Row) => d.id === entry.asset.dish_id);
      const photo = await masterPhotoExport(entry.asset.id);
      track(
        "export_prepared",
        entry.asset.id,
        { destination: "master" },
        `${entry.asset.id}:master`,
      );
      files[
        photoFilename(
          {
            assetId: entry.asset.id,
            dishId: dish.id,
            name: dish.name,
            fromPhoto: true,
          },
          "master",
          photo.extension,
        )
      ] = new Uint8Array(await photo.blob.arrayBuffer());
    }
    const bytes = zipSync(files, { level: 0 });
    downloadBlob(
      new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
      "restaurant-photos.zip",
    );
    setNotice("Download started. Each file keeps its full saved quality.");
    for (const entry of eligibleExports)
      track(
        "export_download_started",
        entry.asset.id,
        {
          destination: "photo-set",
          count: eligibleExports.length,
        },
        attemptId,
      );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="cx-workspace-popover ps2-dialog ps2-batch"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle>Apply to more dishes</DialogTitle>
            <DialogDescription>
              Create one sample first. Review it before continuing with the
              rest.
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            aria-label="Close photo set"
            disabled={busy}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className="ps2-dialog-scroll">
          {error && (
            <p className="cx-feedback error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {!batch ? (
            <>
              <p>
                Choose up to 8 dishes with an original photo. The first selected
                dish becomes your sample.
              </p>
              <p>
                Each photo uses this look
                {note ? " and your Details note" : ""}, made {madeAs}.
              </p>
              <div className="ps2-batch-grid">
                {candidates.map((dish: Row) => {
                  const checked = selected.includes(dish.id),
                    eligible = !!dish.source && !!dish.confirmed_at;
                  return (
                    <label key={dish.id} className="ps2-batch-choice">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={
                          busy ||
                          !eligible ||
                          (!checked && selected.length >= 8)
                        }
                        onChange={() =>
                          setSelected((ids) =>
                            checked
                              ? ids.filter((id) => id !== dish.id)
                              : [...ids, dish.id],
                          )
                        }
                      />
                      {dish.source && (
                        <img
                          src={`/api/assets/${dish.source.id}`}
                          alt="Original dish photo"
                          loading="lazy"
                        />
                      )}
                      <span>
                        <b>{dish.name}</b>
                        <small>
                          {!dish.source
                            ? "Add an original photo in My Dishes"
                            : !dish.confirmed_at
                              ? "Confirm dish details first"
                              : selected[0] === dish.id
                                ? "First sample"
                                : "Original photo ready"}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
              {!candidates.length && (
                <p>
                  Add dish photos in My Dishes, then come back to build a set.
                </p>
              )}
              <p>
                {selected.length} selected · {selected.length} images total if
                you continue. Only the first image is used now.
              </p>
              <button
                className="cx-btn"
                disabled={
                  busy ||
                  !selected.length ||
                  state.remaining < 1 ||
                  !state.aiConnected
                }
                onClick={() => void act(begin)}
              >
                Create sample · 1 image
              </button>
              {!state.aiConnected && (
                <p>
                  Image creation is unavailable. Your existing photos are safe.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="ps2-batch-grid">
                {batch.items.map((item: Row, index: number) => {
                  const result = itemState(item, index),
                    dish = state.dishes.find(
                      (dish: Row) => dish.id === item.dishId,
                    );
                  return (
                    <article className="ps2-batch-result" key={item.itemId}>
                      <img
                        src={`/api/assets/${result.asset?.id || item.sourceId}`}
                        alt={
                          result.asset
                            ? `${dish?.name} result`
                            : `${dish?.name} original`
                        }
                        loading="lazy"
                      />
                      <b>{dish?.name || "Dish photo"}</b>
                      <p>
                        {result.asset?.needs_correction
                          ? "Needs correction"
                          : result.asset?.approved_at
                            ? "Ready to use"
                            : result.asset
                              ? "Needs your review"
                              : result.failed
                                ? "Couldn’t create this photo"
                                : index > 0 && !batch.continued
                                  ? "Waiting for your sample choice"
                                  : "Creating…"}
                      </p>
                      {result.error && <p role="alert">{result.error}</p>}
                      {result.asset && (
                        <button
                          className="cx-link"
                          disabled={busy}
                          onClick={() =>
                            onReview(item, result.jobId, result.asset.id)
                          }
                        >
                          Review photo
                        </button>
                      )}
                      {result.asset?.approved_at &&
                        !result.asset.needs_correction && (
                          <label>
                            <input
                              type="checkbox"
                              checked={included.includes(result.asset.id)}
                              onChange={(e) =>
                                setIncluded((ids) =>
                                  e.target.checked
                                    ? [...ids, result.asset.id]
                                    : ids.filter(
                                        (id) => id !== result.asset.id,
                                      ),
                                )
                              }
                            />
                            Include in download
                          </label>
                        )}
                      {result.failed && (
                        <button
                          className="cx-link"
                          disabled={
                            busy || !state.aiConnected || state.remaining < 1
                          }
                          onClick={() =>
                            void act(async () => {
                              await api(
                                index === 0
                                  ? `photo-batches/${batchId.current}/retry-sample`
                                  : "batches/retry",
                                index === 0 ? {} : { id: item.itemId },
                              );
                              void api("jobs/tick", {}).catch(() => {});
                            })
                          }
                        >
                          Retry this photo · 1 image
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              {!batch.continued && remaining > 0 && (
                <>
                  <p>
                    {sample?.asset?.approved_at &&
                    !sample.asset.needs_correction
                      ? `Continue with the remaining ${remaining} dishes. Uses ${remaining} images · ${state.remaining} remaining.`
                      : "Use your sample in Photo Studio to continue. The remaining images have not been charged."}
                  </p>
                  <button
                    className="cx-btn"
                    disabled={
                      busy ||
                      !state.aiConnected ||
                      !sample?.asset?.approved_at ||
                      !!sample?.asset?.needs_correction ||
                      state.remaining < remaining
                    }
                    onClick={() =>
                      void act(async () => {
                        await api(`photo-batches/${batchId.current}/continue`, {
                          remainingCount: remaining,
                        });
                        setBatch({ ...batch, continued: true });
                        void api("jobs/tick", {}).catch(() => {});
                      })
                    }
                  >
                    Create remaining {remaining} · {remaining} images
                  </button>
                </>
              )}
              <p className="ps2-control-help">
                Made {madeAs}. Review every result separately. Download includes
                only the photos you select, at full saved quality with no new
                crop.
              </p>
              <button
                className="cx-btn cx-secondary"
                disabled={busy || !eligibleExports.length}
                onClick={() => void act(exportSet)}
              >
                Download selected ({eligibleExports.length})
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

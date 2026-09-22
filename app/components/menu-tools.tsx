"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, normalizePhoto, money, type Row } from "@/lib/client";
import {
  Upload,
  Copy,
  RefreshCw,
  Check,
  Camera,
  ArrowRight,
} from "lucide-react";
import { photoAdvice } from "@/lib/photo-advice";
import { draftStatus } from "@/lib/workspace-status";
import WorkspaceActionBar from "./workspace-action-bar";
import {
  useWorkspaceOperation,
  WorkspaceOperationStatus,
} from "./workspace-operation";

export default function MenuTools({
  state,
  refresh,
  selectDish,
  onSuggestion,
}: {
  state: Row;
  refresh: () => Promise<void>;
  selectDish: (d: Row) => void;
  onSuggestion: (s: Row) => void;
}) {
  const [busy, setBusy] = useState(""),
    [tool, setTool] = useState("import"),
    [feedbackTool, setFeedbackTool] = useState("import"),
    [localFeedback, setLocalFeedback] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  const toolsRoot = useRef<HTMLElement | null>(null);
  const focusedToolNavigation = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const keepToolFocus = () => {
      // CSS can blur a newly hidden tab before the media event is delivered.
      const active = focusedToolNavigation.current || document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      const root = toolsRoot.current;
      if (!root?.contains(active)) return;
      if (media.matches && active.closest(".mm-tool-tabs")) {
        root.querySelector<HTMLElement>(".mm-tool-picker select")?.focus();
      } else if (!media.matches && active.closest(".mm-tool-picker")) {
        root
          .querySelector<HTMLElement>('.mm-tool-tabs [aria-selected="true"]')
          ?.focus();
      }
    };
    media.addEventListener("change", keepToolFocus);
    return () => media.removeEventListener("change", keepToolFocus);
  }, []);
  async function act(label: string, fn: () => Promise<void>, local = false) {
    if (lock.current) return;
    lock.current = true;
    setFeedbackTool(tool);
    setLocalFeedback(local);
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  const localAct = (label: string, fn: () => Promise<void>) =>
    act(label, fn, true);
  const missing = state.dishes.filter(
    (d: Row) =>
      !state.assets.some((a: Row) => a.dish_id === d.id && a.approved_at),
  );
  return (
    <section
      className="menu-tools"
      ref={toolsRoot}
      onFocusCapture={(event) => {
        focusedToolNavigation.current = event.target.closest(
          ".mm-tool-tabs, .mm-tool-picker",
        )
          ? event.target
          : null;
      }}
      onBlurCapture={(event) => {
        if (event.relatedTarget || event.target.getClientRects().length) {
          focusedToolNavigation.current = null;
        }
      }}
    >
      {busy && !localFeedback && (
        <p className="notice" role="status">
          {busy}
        </p>
      )}
      {error && !localFeedback && feedbackTool === tool && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && !localFeedback && feedbackTool === tool && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <label className="mm-tool-picker">
        Choose a tool
        <select value={tool} onChange={(event) => setTool(event.target.value)}>
          <option value="import">Import menu</option>
          <option value="batch">Photos & batches</option>
          <option value="staff">Staff uploads</option>
          <option value="weekly">Weekly assistant</option>
          <option value="insights">Activity</option>
        </select>
      </label>
      <Tabs value={tool} onValueChange={setTool}>
        <TabsList
          variant="line"
          className="mm-tool-tabs"
          aria-label="More tools"
        >
          <TabsTrigger value="import">Import menu</TabsTrigger>
          <TabsTrigger value="batch">Photos & batches</TabsTrigger>
          <TabsTrigger value="staff">Staff uploads</TabsTrigger>
          <TabsTrigger value="weekly">Weekly assistant</TabsTrigger>
          <TabsTrigger value="insights">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="import" forceMount className="tools-tab">
          <ImportMenu {...{ state, refresh, act, busy, setNotice }} />
        </TabsContent>
        <TabsContent value="batch" forceMount className="tools-tab">
          <BatchPhotos
            {...{ state, refresh, busy, selectDish, missing }}
            act={localAct}
          />
        </TabsContent>
        <TabsContent value="staff" forceMount className="tools-tab">
          <StaffUploads {...{ state, refresh, busy }} act={localAct} />
        </TabsContent>
        <TabsContent value="weekly" forceMount className="tools-tab">
          <Weekly {...{ state, act, busy, onSuggestion }} />
        </TabsContent>
        <TabsContent value="insights" className="tools-tab">
          <Insights />
        </TabsContent>
      </Tabs>
    </section>
  );
}
function ImportMenu({ state, refresh, act, busy, setNotice }: Row) {
  const [iid, setIid] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [checked, setChecked] = useState(false),
    [dirty, setDirty] = useState(false),
    [saveState, setSaveState] = useState("");
  const imp = state.imports?.find((i: Row) => i.id === iid),
    saving = useRef<Promise<unknown> | null>(null),
    latest = useRef(rows),
    revision = useRef(0),
    savedRevision = useRef(0);
  const incomplete = rows.some(
    (row) => !row.name.trim() || !row.category.trim(),
  );
  function replaceRows(next: Row[]) {
    latest.current = next;
    revision.current = 0;
    savedRevision.current = 0;
    setRows(next);
    setDirty(false);
    setChecked(false);
  }
  async function save() {
    while (saving.current) await saving.current;
    if (!iid || revision.current === savedRevision.current) return;
    if (latest.current.some((row) => !row.name.trim() || !row.category.trim()))
      throw Error("Add a category and dish name to every row before saving.");
    const version = revision.current;
    setSaveState(draftStatus.saving);
    const promise = api("imports/" + iid, { items: latest.current });
    saving.current = promise;
    try {
      await promise;
      savedRevision.current = version;
      if (revision.current === version) {
        setDirty(false);
        setSaveState(draftStatus.saved);
      }
    } catch (error) {
      setSaveState(draftStatus.failed);
      throw error;
    } finally {
      saving.current = null;
    }
  }
  useEffect(() => {
    if (!iid || !dirty || incomplete) return;
    const t = setTimeout(
      () => void save().catch(() => setSaveState(draftStatus.failed)),
      800,
    );
    return () => clearTimeout(t);
  }, [iid, rows, dirty, incomplete]);
  function change(next: Row[]) {
    latest.current = next;
    revision.current += 1;
    setRows(next);
    setDirty(true);
    setChecked(false);
    setSaveState(draftStatus.saving);
  }
  async function open(id: string) {
    await save();
    const latestState = id ? await api("state") : state;
    const i = latestState.imports.find((x: Row) => x.id === id);
    setIid(id);
    replaceRows(JSON.parse(i?.draft || "[]"));
    setSaveState(draftStatus.saved);
  }
  return (
    <div className="panel mm-import-panel" data-action-layout>
      <h3 className="sr-only">Import menu</h3>
      <div className="button-row mm-import-actions">
        <label className="upload-button">
          <Upload size={16} /> Upload menu
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={!!busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                act("Saving menu file", async () => {
                  await save();
                  const form = new FormData();
                  form.set("file", file);
                  const data = await api("imports", form);
                  setIid(data.id);
                  replaceRows([]);
                  setSaveState(draftStatus.saved);
                  await refresh();
                  setNotice(
                    "Menu file saved privately. Read it to create a draft.",
                  );
                });
            }}
          />
        </label>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() =>
            act("Creating draft", async () => {
              await save();
              const data = await api("imports", {});
              setIid(data.id);
              replaceRows([]);
              setSaveState(draftStatus.saved);
              await refresh();
            })
          }
        >
          Enter manually
        </Button>
      </div>
      <p className="mm-import-help">
        Add a clear photo or PDF, up to 4 MB and 60 dishes. Review every dish
        and price before adding them to your library.
      </p>
      <details className="mm-import-note">
        <summary>About your live menu</summary>
        <p>
          Your live menu stays in your existing ordering platform; publishing a
          Menu Material menu is optional.
        </p>
      </details>
      <label className="field">
        Saved imports
        <select
          value={iid}
          disabled={!!busy}
          onChange={(e) => act("Opening import", () => open(e.target.value))}
        >
          <option value="">Choose an import</option>
          {state.imports?.map((i: Row) => (
            <option value={i.id} key={i.id}>
              {i.name} · {i.status}
            </option>
          ))}
        </select>
      </label>
      {imp && (
        <>
          {imp.mime && (
            <div className="button-row">
              <Button
                variant="outline"
                disabled={
                  !!busy || !state.aiConnected || imp.status === "reviewed"
                }
                onClick={() =>
                  act("Reading your menu", async () => {
                    await save();
                    await api("imports/" + iid + "/extract", {});
                    await refresh();
                    const s = await api("state");
                    replaceRows(
                      JSON.parse(
                        s.imports.find((i: Row) => i.id === iid).draft,
                      ),
                    );
                    setSaveState("Read complete — review every field");
                  })
                }
              >
                <SparklesIcon />
                {imp.status === "failed"
                  ? "Retry reading menu"
                  : "Read menu into draft"}
              </Button>
              {imp.mime && (
                <a
                  className="text-button"
                  href={"/api/imports/" + iid + "/original"}
                  target="_blank"
                  rel="noreferrer"
                >
                  View original
                </a>
              )}
            </div>
          )}
          {imp.error && <p className="error">{imp.error}</p>}
          {imp.status === "reviewed" && (
            <p role="status" className="mm-import-status">
              Reviewed and added to your menu draft. Publish from Menus.
            </p>
          )}
          <div className="import-rows">
            {rows.map((row, i) => (
              <div className="import-row" key={i}>
                <label className="field">
                  Category
                  <input
                    disabled={!!busy || imp.status === "reviewed"}
                    maxLength={100}
                    value={row.category}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          j === i ? { ...r, category: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="field">
                  Dish
                  <input
                    disabled={!!busy || imp.status === "reviewed"}
                    maxLength={100}
                    value={row.name}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          j === i ? { ...r, name: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="field">
                  Price ({state.restaurant.currency})
                  <input
                    disabled={!!busy || imp.status === "reviewed"}
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.price ?? ""}
                    placeholder="Check price"
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                price:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label className="field import-description">
                  Description
                  <textarea
                    rows={2}
                    maxLength={2000}
                    disabled={!!busy || imp.status === "reviewed"}
                    value={row.description}
                    onChange={(e) =>
                      change(
                        rows.map((r, j) =>
                          j === i ? { ...r, description: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
                {imp.status !== "reviewed" && (
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    aria-label={`Remove ${row.name || `dish row ${i + 1}`}`}
                    onClick={() => change(rows.filter((_, j) => j !== i))}
                  >
                    Remove dish
                  </Button>
                )}
              </div>
            ))}
          </div>
          {imp.status !== "reviewed" && (
            <>
              <Button
                variant="outline"
                disabled={!!busy || rows.length >= 60}
                onClick={() =>
                  change([
                    ...rows,
                    {
                      category: rows.at(-1)?.category || "Dishes",
                      name: "",
                      description: "",
                      price: null,
                    },
                  ])
                }
              >
                Add a row
              </Button>
              <WorkspaceActionBar className="mm-import-footer">
                <p
                  role={saveState === draftStatus.failed ? "alert" : "status"}
                  className="mm-import-status"
                >
                  {incomplete
                    ? "Add a category and dish name to every row to save."
                    : saveState}
                </p>
                <label className="check-label">
                  <input
                    type="checkbox"
                    disabled={!!busy}
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                  />{" "}
                  I reviewed the categories, descriptions and every price.
                </label>
                <div className="button-row mm-import-submit">
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      act("Saving import draft", async () => {
                        await save();
                        await refresh();
                      })
                    }
                  >
                    Save draft
                  </Button>
                  <Button
                    disabled={!!busy || !checked || !rows.length || incomplete}
                    onClick={() =>
                      act("Adding reviewed dishes", async () => {
                        await save();
                        await api("imports/" + iid + "/review", {
                          items: rows,
                          confirmed: true,
                        });
                        setDirty(false);
                        await refresh();
                        setNotice(
                          "Dishes added to the library and menu draft. They are not published yet.",
                        );
                      })
                    }
                  >
                    Add reviewed dishes
                  </Button>
                </div>
              </WorkspaceActionBar>
            </>
          )}
        </>
      )}
    </div>
  );
}
function SparklesIcon() {
  return <Camera size={16} />;
}
function BatchPhotos({ state, refresh, act, busy, selectDish, missing }: Row) {
  const [chosen, setChosen] = useState<string[]>([]),
    [target, setTarget] = useState(""),
    [uploadResults, setUploadResults] = useState<Row[]>([]);
  const batchId = useRef("");
  const uploadOperation = useWorkspaceOperation(act, busy);
  const batchOperation = useWorkspaceOperation(act, busy);
  return (
    <div className="panel batch-tools">
      <h3>Upload original photos</h3>
      <p className="muted">
        Use soft window light, show the whole plate and try a 45° angle. For a
        flat dish, try overhead. Avoid zoom and flash.
      </p>
      <div className="two-fields">
        <label className="field">
          Upload photos for
          <select
            value={target}
            disabled={!!busy}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose a dish</option>
            {state.dishes.map((d: Row) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Add up to 5 originals
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,.heic"
            disabled={!!busy || !target}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length)
                uploadOperation.run(
                  "Uploading photos",
                  "Uploads complete. Saved originals are kept with this dish.",
                  async () => {
                    setUploadResults([]);
                    if (files.length > 5)
                      throw Error("Choose at most 5 photos at a time.");
                    const results: Row[] = [];
                    for (const file of files) {
                      try {
                        const advice = await photoAdvice(file),
                          form = new FormData();
                        form.set("file", file);
                        form.set(
                          "normalized",
                          await normalizePhoto(file),
                          "dish.jpg",
                        );
                        form.set("dishId", target);
                        await api("assets", form);
                        results.push({
                          name: file.name,
                          status: "Saved",
                          advice,
                        });
                      } catch (e) {
                        results.push({
                          name: file.name,
                          status: "Not saved — choose this file again to retry",
                          failed: true,
                          advice: (e as Error).message,
                        });
                      }
                      setUploadResults([...results]);
                    }
                    await refresh();
                    const failed = results.filter(
                      (result) => result.failed,
                    ).length;
                    if (failed)
                      throw Error(
                        `${results.length - failed} of ${results.length} photos saved. Choose only the unsuccessful files again to retry.`,
                      );
                  },
                );
            }}
          />
        </label>
      </div>
      <WorkspaceOperationStatus feedback={uploadOperation.feedback} />
      {uploadResults.map((v, i) => (
        <p className="capture-advice" key={i}>
          <b>
            {v.name}: {v.status}.
          </b>{" "}
          {v.advice}
        </p>
      ))}
      <details className="mm-missing-photos">
        <summary>
          {missing.length} of {state.dishes.length} dishes need an approved
          photo
        </summary>
        {missing.length ? (
          <div className="missing-dishes">
            {missing.map((d: Row) => (
              <button key={d.id} onClick={() => selectDish(d)}>
                <span>
                  <b>{d.name}</b>
                  <small>Add or approve a photo</small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : (
          <p>Every dish has an approved photo.</p>
        )}
      </details>
      <h3 className="style-heading">
        Create photos using your restaurant style
      </h3>
      <p className="muted">
        Choose up to 5 dishes. Each uses its latest original, or its description
        when no original exists. One image unit per dish.
      </p>
      <div className="batch-picks">
        {state.dishes.map((d: Row) => (
          <label className="check-label" key={d.id}>
            <input
              type="checkbox"
              checked={chosen.includes(d.id)}
              disabled={
                !!busy ||
                !d.confirmed_at ||
                (!chosen.includes(d.id) && chosen.length >= 5)
              }
              onChange={(e) => {
                batchId.current = "";
                setChosen(
                  e.target.checked
                    ? [...chosen, d.id]
                    : chosen.filter((x) => x !== d.id),
                );
              }}
            />
            <span>
              {d.name}
              <small>
                {!d.confirmed_at
                  ? "Confirm dish details in Photos first"
                  : state.assets.some(
                        (a: Row) => a.dish_id === d.id && a.kind === "source",
                      )
                    ? "Original photo"
                    : "Description only"}
              </small>
            </span>
          </label>
        ))}
      </div>
      <Button
        disabled={!!busy || !chosen.length || !state.aiConnected}
        onClick={() =>
          batchOperation.run(
            "Starting batch",
            "Batch started. Follow each dish’s progress below.",
            async () => {
              batchId.current ||= crypto.randomUUID();
              await api("batches", {
                batchId: batchId.current,
                candidateCount: 1,
                items: chosen.map((dishId) => ({
                  dishId,
                  sourceId:
                    state.assets.find(
                      (a: Row) => a.dish_id === dishId && a.kind === "source",
                    )?.id || null,
                })),
              });
              setChosen([]);
              batchId.current = "";
              await refresh();
            },
          )
        }
      >
        Create photos for {chosen.length || "selected"}{" "}
        {chosen.length === 1 ? "dish" : "dishes"}
      </Button>
      {!state.aiConnected && (
        <p className="muted">
          Photo creation is currently unavailable. You can still upload and
          review originals.
        </p>
      )}
      <WorkspaceOperationStatus feedback={batchOperation.feedback} />
      <div className="batch-progress">
        {!!state.batchItems?.length && <h3>Photo progress</h3>}
        {state.batchItems?.map((b: Row) => {
          return (
            <BatchProgressItem
              key={b.id}
              item={b}
              state={state}
              act={act}
              busy={busy}
              refresh={refresh}
              selectDish={selectDish}
            />
          );
        })}
      </div>
    </div>
  );
}
function BatchProgressItem({
  item,
  state,
  act,
  busy,
  refresh,
  selectDish,
}: Row) {
  const operation = useWorkspaceOperation(act, busy);
  const dish = state.dishes.find((d: Row) => d.id === item.dish_id);
  const name = dish?.name || "Unavailable dish";
  const outputs = state.outputs.filter(
    (output: Row) => output.job_id === item.job_id,
  );
  const ready = outputs.filter(
    (output: Row) => output.status === "completed" && output.asset_id,
  ).length;
  const failed =
    item.status === "failed" ||
    outputs.some((output: Row) => output.status === "failed");
  const running =
    ["queued", "processing", "submitted"].includes(
      item.job_status || item.status,
    ) &&
    (!failed ||
      outputs.some(
        (output: Row) => !["completed", "failed"].includes(output.status),
      ));
  const retryable =
    !running &&
    (item.status === "failed" ||
      outputs.some(
        (output: Row) => output.status === "failed" && output.attempts < 3,
      ));
  const status = running
    ? (item.job_status || item.status) === "queued"
      ? "Waiting to start"
      : "Creating photos"
    : failed
      ? ready
        ? "Some photos need another try"
        : "Couldn’t create photos"
      : ready
        ? "Ready to review"
        : "No photos ready";
  return (
    <article className="batch-progress-row">
      <div className="batch-progress-details">
        <h4>{name}</h4>
        <p>
          {status} · {ready} {ready === 1 ? "photo" : "photos"} ready
        </p>
        {failed && (retryable || item.error) && (
          <p className="batch-recovery">
            {item.error ||
              (ready
                ? "Your finished photos are saved. Retry only the unsuccessful images."
                : "Your dish details are saved. Retry the unsuccessful images.")}
          </p>
        )}
        {failed && !retryable && !running && (
          <p className="batch-recovery">
            These images have reached their retry limit. Open the dish to start
            a new photo.
          </p>
        )}
      </div>
      <div className="button-row">
        {dish && (ready > 0 || (failed && !retryable && !running)) && (
          <Button
            variant="outline"
            aria-label={
              ready ? `Review photos for ${name}` : `Open dish ${name}`
            }
            onClick={() => selectDish(dish)}
          >
            {ready ? "Review photos" : "Open dish"}
          </Button>
        )}
        {retryable && (
          <Button
            variant="outline"
            disabled={!!busy}
            aria-label={`Retry failed photos for ${name}`}
            onClick={() =>
              operation.run(
                "Retrying failed photos",
                "Retry started. Finished photos are kept.",
                async () => {
                  await api("batches/retry", { id: item.id });
                  await refresh();
                },
              )
            }
          >
            <RefreshCw /> Retry failed only
          </Button>
        )}
      </div>
      <WorkspaceOperationStatus feedback={operation.feedback} />
    </article>
  );
}
function StaffUploads({ state, refresh, act, busy }: Row) {
  const [link, setLink] = useState("");
  const [handled, setHandled] = useState<string[]>([]);
  const [reviewNotice, setReviewNotice] = useState("");
  const [refreshError, setRefreshError] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const links = useWorkspaceOperation(act, busy);
  const review = useWorkspaceOperation(act, busy);
  const pending = state.assets.filter(
    (asset: Row) => asset.kind === "staff" && !handled.includes(asset.id),
  );
  async function reviewed(asset: Row, name: string, approved: boolean) {
    review.changed("");
    setHandled((ids) => [...ids, asset.id]);
    setReviewNotice(
      approved
        ? `Approved photo saved with ${name}.`
        : `Photo rejected for ${name}.`,
    );
    if (reviewHeading.current?.getClientRects().length)
      reviewHeading.current.focus();
    try {
      await refresh();
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    }
  }
  return (
    <div className="panel staff-review">
      <h3>Let your team send dish photos</h3>
      <p className="muted">
        An upload-only link for this restaurant, valid for 7 days. Staff choose
        a dish and submit photos for your review.
      </p>
      <div className="button-row">
        <Button
          disabled={!!busy}
          onClick={() =>
            links.run(
              "Creating staff upload link",
              "Upload link ready. Copy it to share with your team.",
              async () => {
                const value = await api("staff-links", {});
                setLink(location.origin + value.path);
              },
            )
          }
        >
          Create staff upload link
        </Button>
        <Button
          variant="outline"
          className="staff-revoke"
          disabled={!!busy}
          onClick={() =>
            links.run(
              "Revoking staff links",
              "Existing staff upload links are now disabled.",
              async () => {
                await api("staff-links/revoke", {});
                setLink("");
              },
            )
          }
        >
          Revoke all staff links
        </Button>
      </div>
      {link && (
        <div className="invitation-result">
          <input aria-label="Staff upload link" readOnly value={link} />
          <Button
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              links.run(
                "Copying staff link",
                "Staff link copied. Share it with your team.",
                async () => {
                  await navigator.clipboard.writeText(link);
                },
              )
            }
          >
            <Copy /> Copy link
          </Button>
        </div>
      )}
      <WorkspaceOperationStatus feedback={links.feedback} />
      <div className="staff-review-header">
        <h3 ref={reviewHeading} tabIndex={-1}>
          Photos awaiting review <span>({pending.length})</span>
        </h3>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() =>
            review.run(
              "Refreshing photos",
              "Review list is up to date.",
              async () => {
                await refresh();
                setRefreshError(false);
              },
            )
          }
        >
          <RefreshCw /> Refresh list
        </Button>
      </div>
      {refreshError && (
        <p className="error" role="alert">
          Your review was saved, but the list couldn’t refresh. Use Refresh list
          to check for new photos.
        </p>
      )}
      <WorkspaceOperationStatus
        feedback={
          review.feedback.message
            ? review.feedback
            : { kind: "success", message: reviewNotice }
        }
      />
      {!pending.length ? (
        <p className="empty">No staff photos waiting for review.</p>
      ) : (
        <div className="staff-grid">
          {pending.map((asset: Row) => (
            <StaffReviewCard
              key={asset.id}
              asset={asset}
              name={
                state.dishes.find((dish: Row) => dish.id === asset.dish_id)
                  ?.name || "Unavailable dish"
              }
              act={act}
              busy={busy}
              onReviewed={reviewed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
function StaffReviewCard({ asset, name, act, busy, onReviewed }: Row) {
  const [confirmed, setConfirmed] = useState(false);
  const operation = useWorkspaceOperation(act, busy);
  return (
    <article className="staff-review-card">
      <img src={"/api/assets/" + asset.id} alt={"Staff upload for " + name} />
      <h4>{name}</h4>
      <label className="check-label">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!!busy}
          aria-label={`Confirm staff photo matches ${name}`}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>This photo matches the dish we serve.</span>
      </label>
      <div className="staff-review-actions">
        <Button
          disabled={!!busy || !confirmed}
          aria-label={`Approve staff photo for ${name}`}
          onClick={() =>
            operation.run("Approving photo", "Photo approved.", async () => {
              await api("assets/" + asset.id + "/approve", { accurate: true });
              await onReviewed(asset, name, true);
            })
          }
        >
          <Check /> Approve
        </Button>
        <Button
          variant="outline"
          className="staff-reject"
          disabled={!!busy}
          aria-label={`Reject staff photo for ${name}`}
          onClick={() =>
            operation.run("Rejecting photo", "Photo rejected.", async () => {
              await api("assets/" + asset.id, undefined, "DELETE");
              await onReviewed(asset, name, false);
            })
          }
        >
          Reject photo
        </Button>
      </div>
      <WorkspaceOperationStatus feedback={operation.feedback} />
    </article>
  );
}
function Weekly({ state, act, busy, onSuggestion }: Row) {
  const [goal, setGoal] = useState("lunch"),
    [suggestions, setSuggestions] = useState<Row[]>([]);
  return (
    <div className="panel">
      <h3>A little help with your week</h3>
      <p className="muted">
        Suggestions use your available dishes, approved photos, regular prices
        and opening hours. You make the final offer.
      </p>
      <label className="field">
        Your goal
        <select value={goal} onChange={(e) => setGoal(e.target.value)}>
          <option value="lunch">Bring attention to weekday lunch</option>
          <option value="catering">Build a catering offer</option>
          <option value="new_dish">Spotlight a new dish</option>
        </select>
      </label>
      <Button
        disabled={!!busy}
        onClick={() =>
          act("Preparing menu-based suggestions", async () =>
            setSuggestions((await api("suggestions", { goal })).suggestions),
          )
        }
      >
        Suggest promotions
      </Button>
      <div className="suggestion-grid">
        {suggestions.map((s, i) => (
          <article className="panel" key={i}>
            <img src={"/api/assets/" + s.items[0].photoId} alt={s.title} />
            <h3>{s.title}</h3>
            <b>{money(s.price, state.restaurant.currency)}</b>
            <p>{s.reason}</p>
            <p className="fine">
              {s.startsLocal.replace("T", " ")} · {state.restaurant.timezone}
            </p>
            <Button variant="outline" onClick={() => onSuggestion(s)}>
              Edit this promotion
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
function Insights() {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    return api("insights")
      .then(setData)
      .catch((error) => setError(error.message))
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
      });
  }
  useEffect(() => {
    void load();
  }, []);
  const count = (kind: string) => data?.counts[kind] || 0;
  const noCreativeActivity =
    data && !data.creative?.downloads && !count("photo_reused");
  return (
    <div className="panel mm-activity-panel" aria-busy={loading}>
      <div className="mm-activity-heading">
        <h3>Last 28 days</h3>
        <Button
          className="mm-activity-refresh"
          variant="outline"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setError("");
            void load();
          }}
        >
          {loading ? "Refreshing…" : error ? "Retry" : "Refresh"}
        </Button>
      </div>
      <p className="muted">
        Photo exports and saved-photo reuse. Export actions don’t confirm file
        receipt or publication.
      </p>
      <div className="mm-activity-status" role={error ? "alert" : "status"}>
        {error
          ? `Activity couldn’t ${data ? "refresh" : "load"}. ${error} Use Retry to try again.`
          : loading
            ? data
              ? "Refreshing recorded activity…"
              : "Loading recorded activity…"
            : "Activity is up to date."}
      </div>
      <div className="metric-grid mm-creative-metrics">
        {[
          ["Photo export actions", data?.creative?.downloads || 0],
          ["Dishes exported", data?.creative?.dishes || 0],
          ["Days with photo exports", data?.creative?.days || 0],
          ["Posts started from saved photos", count("photo_reused")],
        ].map(([label, value]) => (
          <div key={label}>
            <strong className={!data && loading ? "mm-metric-loading" : ""}>
              {data ? value : <span aria-label="Not yet available">—</span>}
            </strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {noCreativeActivity && (
        <div className="mm-activity-empty">
          <h3>No creative activity yet</h3>
          <p>Your photo exports and saved-photo reuse will appear here.</p>
          <a className="cx-btn cx-secondary" href="#studio">
            Open Photo Studio <ArrowRight size={16} />
          </a>
        </div>
      )}
      {data && (
        <>
          <p className="muted">
            First approved photo export action:{" "}
            {data.firstDownloadElapsedMs == null
              ? "Not recorded yet."
              : `${Math.max(1, Math.round(data.firstDownloadElapsedMs / 60000))} minutes after your first upload (elapsed time, including time away).`}{" "}
            Returned to download on{" "}
            {Math.max(0, (data.creative?.days || 0) - 1)} additional days in
            this period.
          </p>
          <details className="cx-secondary-actions">
            <summary>Optional hosted-menu activity</summary>
            <p className="muted">
              Customer events count once per browsing session, dish and action.
              Link clicks measure interest; sales attribution needs order data.
            </p>
            <div className="metric-grid">
              {[
                ["Menu visits", count("menu_visit")],
                ["Dish views", count("dish_view")],
                ["Ordering-link clicks", count("ordering_click")],
                ["Packages approved", count("promotion_approved")],
                [
                  "Downloads",
                  count("promotion_exported") + count("image_downloaded"),
                ],
                ["Hosted special publications", count("promotion_published")],
              ].map(([label, value]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </details>
          <details className="mm-activity-details">
            <summary>How activity is measured</summary>
            <p>
              Export actions record a download starting or a native share
              completing; they do not confirm file receipt or publication.
            </p>
            <div className="measurement-list">
              <p>
                <b>Active time to approval:</b>{" "}
                {data.active.count
                  ? `${Math.round(data.active.average / 1000)} seconds average (${data.active.count} approvals)`
                  : "No approvals recorded yet"}
                .
              </p>
              <p>
                <b>Generation wait:</b>{" "}
                {data.wait.count
                  ? `${Math.round(data.wait.average / 1000)} seconds average (${data.wait.count} images)`
                  : "No completed generations recorded yet"}
                .
              </p>
              <p>
                <b>First-result acceptance:</b>{" "}
                {data.acceptance.reviewed
                  ? `${data.acceptance.accepted} of ${data.acceptance.reviewed} first photo requests reviewed`
                  : "No first photo requests reviewed yet"}
                .
              </p>
              <p>
                <b>Revisions:</b> {count("revision_requested")} ·{" "}
                <b>Active weeks:</b> {data.weeks.length} · <b>Return weeks:</b>{" "}
                {Math.max(0, data.weeks.length - 1)}
              </p>
            </div>
            <p className="fine">
              Active time counts visible editing with recent interaction,
              excluding photo generation. Wait measures request-to-archived
              result and includes queue time. These are observed events; no
              two-minute target result is assumed.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

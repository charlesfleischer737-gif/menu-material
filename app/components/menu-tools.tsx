"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api, normalizePhoto, money, type Row } from "@/lib/client";
import { Upload, Copy, RefreshCw, Check, Camera } from "lucide-react";
import { photoAdvice } from "@/lib/photo-advice";

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
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function act(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
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
  const missing = state.dishes.filter(
    (d: Row) =>
      !state.assets.some((a: Row) => a.dish_id === d.id && a.approved_at),
  );
  return (
    <section className="menu-tools">
      <div className="promotion-toolbar">
        <div>
          <h2>Complete your menu</h2>
          <p className="muted">
            {missing.length} of {state.dishes.length} dishes need an approved
            photo.
          </p>
        </div>
      </div>
      {busy && (
        <p className="notice" role="status">
          {busy}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <Tabs defaultValue="import">
        <TabsList className="tool-tabs">
          <TabsTrigger value="import">Import menu</TabsTrigger>
          <TabsTrigger value="batch">Photos & batches</TabsTrigger>
          <TabsTrigger value="staff">Staff uploads</TabsTrigger>
          <TabsTrigger value="weekly">Weekly assistant</TabsTrigger>
          <TabsTrigger value="insights">Engagement</TabsTrigger>
        </TabsList>
        <TabsContent value="import" forceMount className="tools-tab">
          <ImportMenu {...{ state, refresh, act, busy, setNotice }} />
        </TabsContent>
        <TabsContent value="batch" forceMount className="tools-tab">
          <BatchPhotos
            {...{ state, refresh, act, busy, setNotice, selectDish, missing }}
          />
        </TabsContent>
        <TabsContent value="staff" forceMount className="tools-tab">
          <StaffUploads {...{ state, refresh, act, busy, setNotice }} />
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
    latest = useRef(rows);
  useEffect(() => {
    latest.current = rows;
  }, [rows]);
  async function save() {
    if (saving.current) await saving.current;
    if (!iid || !dirty) return;
    const promise = api("imports/" + iid, { items: latest.current });
    saving.current = promise;
    try {
      await promise;
      setSaveState("Draft saved");
    } finally {
      saving.current = null;
    }
  }
  useEffect(() => {
    if (!iid || !dirty) return;
    const t = setTimeout(
      () => void save().catch((e) => setSaveState(e.message)),
      800,
    );
    return () => clearTimeout(t);
  }, [iid, rows, dirty]);
  function change(next: Row[]) {
    setRows(next);
    setDirty(true);
    setChecked(false);
    setSaveState("Saving draft…");
  }
  async function open(id: string) {
    await save();
    const i = state.imports.find((x: Row) => x.id === id);
    setIid(id);
    setRows(JSON.parse(i?.draft || "[]"));
    setDirty(false);
    setChecked(false);
    setSaveState("Draft saved");
  }
  return (
    <div className="panel">
      <h3>Turn your menu into an editable draft</h3>
      <p className="muted">
        Upload a clear photo or PDF, up to 4 MB and 60 dishes. Check every price
        before adding dishes to your menu draft.
      </p>
      <div className="button-row">
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
                  setRows([]);
                  setDirty(false);
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
          onClick={() =>
            act("Creating draft", async () => {
              await save();
              const data = await api("imports", {});
              setIid(data.id);
              setRows([]);
              setDirty(false);
              await refresh();
            })
          }
        >
          Enter a menu manually
        </Button>
      </div>
      <label className="field">
        Saved imports
        <select
          value={iid}
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
                  setRows(
                    JSON.parse(s.imports.find((i: Row) => i.id === iid).draft),
                  );
                  setDirty(false);
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
          {imp.error && <p className="error">{imp.error}</p>}
          <p role="status" className="fine">
            {imp.status === "reviewed"
              ? "Reviewed and added to your menu draft. Publish from Your menu."
              : saveState}
          </p>
          <div className="import-rows">
            {rows.map((row, i) => (
              <div className="import-row" key={i}>
                <label className="field">
                  Category
                  <input
                    disabled={imp.status === "reviewed"}
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
                    disabled={imp.status === "reviewed"}
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
                    disabled={imp.status === "reviewed"}
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
                  <input
                    disabled={imp.status === "reviewed"}
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
                disabled={rows.length >= 60}
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
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                />{" "}
                I reviewed the categories, descriptions and every price.
              </label>
              <div className="button-row">
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
                  disabled={!!busy || !checked || !rows.length}
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
                  Add reviewed dishes to menu draft
                </Button>
              </div>
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
function BatchPhotos({
  state,
  refresh,
  act,
  busy,
  setNotice,
  selectDish,
  missing,
}: Row) {
  const [chosen, setChosen] = useState<string[]>([]),
    [target, setTarget] = useState(""),
    [uploadResults, setUploadResults] = useState<Row[]>([]);
  const batchId = useRef("");
  return (
    <div className="panel">
      <h3>Give every dish a photo</h3>
      <p className="muted">
        Use soft window light, show the whole plate and try a 45° angle. For a
        flat dish, try overhead. Avoid zoom and flash.
      </p>
      <div className="missing-dishes">
        {missing.map((d: Row) => (
          <button
            key={d.id}
            className="text-button"
            onClick={() => selectDish(d)}
          >
            {d.name} · Add or approve a photo
          </button>
        ))}
      </div>
      <div className="two-fields">
        <label className="field">
          Upload photos for
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
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
              if (files.length)
                act("Uploading photos", async () => {
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
                        status: "Failed — select this file again to retry",
                        advice: (e as Error).message,
                      });
                    }
                    setUploadResults([...results]);
                  }
                  await refresh();
                  setNotice(
                    "Uploads finished. Saved originals are kept separately for this dish.",
                  );
                });
            }}
          />
        </label>
      </div>
      {uploadResults.map((v, i) => (
        <p className="capture-advice" key={i}>
          <b>
            {v.name}: {v.status}.
          </b>{" "}
          {v.advice}
        </p>
      ))}
      <h3 className="style-heading">
        Create photos using your restaurant style
      </h3>
      <p className="muted">
        Choose up to 5 dishes. Each uses its latest original, or its description
        when no original exists. Two image units per dish.
      </p>
      <div className="batch-picks">
        {state.dishes.map((d: Row) => (
          <label className="check-label" key={d.id}>
            <input
              type="checkbox"
              checked={chosen.includes(d.id)}
              disabled={
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
          act("Starting batch", async () => {
            batchId.current ||= crypto.randomUUID();
            await api("batches", {
              batchId: batchId.current,
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
          })
        }
      >
        Create photos for {chosen.length || "selected"} dishes
      </Button>
      <div className="batch-progress">
        {state.batchItems?.map((b: Row) => {
          const d = state.dishes.find((d: Row) => d.id === b.dish_id),
            outputs = state.outputs.filter((o: Row) => o.job_id === b.job_id),
            failed =
              b.status === "failed" ||
              outputs.some((o: Row) => o.status === "failed");
          return (
            <div className="batch-progress-row" key={b.id}>
              <div>
                <b>{d?.name}</b>
                <p>
                  {b.job_status || b.status} ·{" "}
                  {outputs.filter((o: Row) => o.status === "completed").length}{" "}
                  photos ready
                </p>
                {b.error && <p className="error">{b.error}</p>}
              </div>
              <div className="button-row">
                {outputs.some((o: Row) => o.asset_id) && (
                  <Button variant="outline" onClick={() => selectDish(d)}>
                    Review photos
                  </Button>
                )}
                {failed && (
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      act("Retrying failed images", async () => {
                        await api("batches/retry", { id: b.id });
                        await refresh();
                      })
                    }
                  >
                    <RefreshCw /> Retry failed only
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function StaffUploads({ state, refresh, act, busy, setNotice }: Row) {
  const [link, setLink] = useState(""),
    [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const pending = state.assets.filter((a: Row) => a.kind === "staff");
  return (
    <div className="panel">
      <h3>Let your team send dish photos</h3>
      <p className="muted">
        An upload-only link for this restaurant, valid for 7 days. Staff choose
        a dish and submit photos for your review.
      </p>
      <div className="button-row">
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Creating staff upload link", async () => {
              const v = await api("staff-links", {});
              setLink(location.origin + v.path);
            })
          }
        >
          Create staff upload link
        </Button>
        <Button
          variant="outline"
          disabled={!!busy}
          onClick={() =>
            act("Revoking staff links", async () => {
              await api("staff-links/revoke", {});
              setLink("");
              setNotice("Existing staff upload links are now disabled.");
            })
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
            onClick={() =>
              act("Copying staff link", async () => {
                await navigator.clipboard.writeText(link);
                setNotice("Staff link copied. Share it with your team.");
              })
            }
          >
            <Copy /> Copy link
          </Button>
        </div>
      )}
      {!pending.length ? (
        <p className="empty">No staff photos waiting for review.</p>
      ) : (
        <div className="staff-grid">
          {pending.map((a: Row) => (
            <div className="panel" key={a.id}>
              <img
                src={"/api/assets/" + a.id}
                alt={
                  "Staff upload for " +
                  state.dishes.find((d: Row) => d.id === a.dish_id)?.name
                }
              />
              <h3>{state.dishes.find((d: Row) => d.id === a.dish_id)?.name}</h3>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!confirmed[a.id]}
                  onChange={(e) =>
                    setConfirmed({ ...confirmed, [a.id]: e.target.checked })
                  }
                />{" "}
                This photo matches the dish we serve.
              </label>
              <div className="button-row">
                <Button
                  disabled={!!busy || !confirmed[a.id]}
                  onClick={() =>
                    act("Approving staff photo", async () => {
                      await api("assets/" + a.id + "/approve", {
                        accurate: true,
                      });
                      await refresh();
                      setNotice("Approved photo saved with this dish.");
                    })
                  }
                >
                  <Check /> Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    act("Removing staff photo", async () => {
                      await api("assets/" + a.id, undefined, "DELETE");
                      await refresh();
                    })
                  }
                >
                  Reject photo
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    [error, setError] = useState("");
  const load = () =>
    api("insights")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  if (!data)
    return (
      <div className="panel">
        {error || "Loading recorded activity…"}
        {error && <Button onClick={load}>Retry</Button>}
      </div>
    );
  const count = (kind: string) => data.counts[kind] || 0;
  return (
    <div className="panel">
      <div className="promotion-toolbar">
        <h3>Last 28 days</h3>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>
      <p className="muted">
        Engagement measures, not sales. Sales attribution needs order data.
        Customer events count once per browsing session, dish and action.
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
          <b>Revisions:</b> {count("revision_requested")} · <b>Active weeks:</b>{" "}
          {data.weeks.length} · <b>Return weeks:</b>{" "}
          {Math.max(0, data.weeks.length - 1)}
        </p>
      </div>
      <p className="fine">
        Active time counts visible editing with recent interaction, excluding
        photo generation. Wait measures request-to-archived result and includes
        queue time. These are observed events; no two-minute target result is
        assumed.
      </p>
    </div>
  );
}

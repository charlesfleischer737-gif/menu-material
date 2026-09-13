"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Sparkles,
  ArrowRight,
  ImagePlus,
  UtensilsCrossed,
  Images,
  BookOpen,
  Check,
  Plus,
  Settings,
  LogOut,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pick, ConfirmDelete } from "./components/controls";
import Auth from "./components/auth";
import Landing from "./components/landing";
import Brand from "./components/brand";
import MenuView from "./components/menu-view";
import {
  api,
  downloadBlob,
  exportImage,
  money,
  normalizePhoto,
  Row,
} from "@/lib/client";
const emptyDish = {
  name: "",
  description: "",
  portion: "",
  plating: "",
  setting: "Natural daylight",
  price: 0,
  available: true,
  confirmed: false,
};
export default function Home() {
  const [state, setState] = useState<Row>({
      user: null,
      dishes: [],
      assets: [],
      jobs: [],
      outputs: [],
      captions: [],
    }),
    [loaded, setLoaded] = useState(false),
    [view, setView] = useState("studio"),
    [overview, setOverview] = useState(false),
    [auth, setAuth] = useState(false),
    [authMode, setAuthMode] = useState<"login" | "signup">("login"),
    [mode, setMode] = useState("photo"),
    [dish, setDish] = useState({ ...emptyDish }),
    [dishId, setDishId] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [filePreview, setFilePreview] = useState(""),
    [sourceId, setSourceId] = useState(""),
    [parentId, setParentId] = useState(""),
    [revision, setRevision] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [review, setReview] = useState<Row | null>(null),
    [deleteId, setDeleteId] = useState(""),
    [ratio, setRatio] = useState("square"),
    [format, setFormat] = useState("jpeg"),
    [accurate, setAccurate] = useState(false),
    [caption, setCaption] = useState(""),
    [settings, setSettings] = useState(false);
  const requestKey = useRef(""),
    actionBusy = useRef(false),
    tickBusy = useRef(false);
  const refresh = useCallback(async () => {
    const s = await api("state");
    setState(s);
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
  }, [refresh]);
  useEffect(() => {
    if (state.user?.id) void api("events", { kind: "visit" }).catch(() => {});
  }, [state.user?.id]);
  useEffect(() => {
    if (!state.user) return;
    const interval = setInterval(async () => {
      if (tickBusy.current || document.hidden) return;
      tickBusy.current = true;
      try {
        if (
          state.jobs?.some((j: Row) =>
            ["queued", "processing"].includes(j.status),
          )
        ) {
          await api("jobs/tick", {});
          await refresh();
        }
      } catch {
      } finally {
        tickBusy.current = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [state.user, state.jobs, refresh]);
  useEffect(() => {
    if (!file) {
      setFilePreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const act = async (label: string, fn: () => Promise<void>) => {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      actionBusy.current = false;
    }
  };
  function update(k: string, v: any) {
    setDish((d) => ({ ...d, [k]: v }));
    requestKey.current = "";
  }
  function selectDish(d: Row) {
    setDishId(d.id);
    setDish({
      name: d.name,
      description: d.description,
      portion: d.portion,
      plating: d.plating,
      setting: d.setting,
      price: d.price / 100,
      available: !!d.available,
      confirmed: !!d.confirmed_at,
    });
    const source = state.assets?.find(
      (a: Row) => a.dish_id === d.id && a.kind === "source",
    );
    setSourceId(source?.id || "");
    setMode(source ? "photo" : "description");
    setFile(null);
    setParentId("");
    setRevision("");
    setCaption(
      state.captions?.find((c: Row) => c.dish_id === d.id)?.body || "",
    );
    requestKey.current = "";
    setView("studio");
  }
  function newDish() {
    setDish({ ...emptyDish });
    setDishId("");
    setSourceId("");
    setParentId("");
    setRevision("");
    setFile(null);
    setCaption("");
    setMode("photo");
    requestKey.current = "";
    setView("studio");
  }
  async function saveDish() {
    if (!state.user) {
      setAuth(true);
      return null;
    }
    if (!dish.name.trim() || !dish.description.trim())
      throw Error("Add a dish name and a description first.");
    const saved = await api("dishes" + (dishId ? "/" + dishId : ""), dish);
    setDishId(saved.id);
    let ref = sourceId;
    if (file && mode === "photo") {
      const normalized = await normalizePhoto(file);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("normalized", normalized, "working.jpg");
      fd.set("dishId", saved.id);
      const uploaded = await api("assets", fd);
      ref = uploaded.id;
      setSourceId(ref);
      setFile(null);
    }
    await refresh();
    return { id: saved.id, sourceId: mode === "photo" ? ref : "" };
  }
  async function generate() {
    if (!state.user) {
      setAuth(true);
      return;
    }
    await act("Creating your two options", async () => {
      if (!dish.confirmed)
        throw Error("Confirm the dish details below before creating images.");
      if (mode === "photo" && !file && !sourceId)
        throw Error(
          "Add a photo, or choose “Describe your dish” to continue without one.",
        );
      const saved = await saveDish();
      if (!saved) return;
      requestKey.current ||= crypto.randomUUID();
      await api("jobs", {
        dishId: saved.id,
        sourceId: saved.sourceId || null,
        parentId: parentId || null,
        revision,
        requestKey: requestKey.current,
      });
      requestKey.current = "";
      setParentId("");
      setRevision("");
      await refresh();
      setNotice(
        "Your two options are queued. You can leave this page and return to review them.",
      );
      void api("jobs/tick", {})
        .then(refresh)
        .catch(() => {});
    });
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "read_dish_workspace",
          title: "Read restaurant workspace",
          description:
            "Read saved dishes and remaining image allowance for the signed-in restaurant.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw Error("Expected an empty object.");
            const s = await api("state");
            setState(s);
            return {
              signedIn: !!s.user,
              remaining: s.remaining,
              dishes:
                s.dishes?.map((d: Row) => ({
                  id: d.id,
                  name: d.name,
                  description: d.description,
                })) ?? [],
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const assets = state.assets?.filter((a: Row) => a.dish_id === dishId) || [],
    jobs = state.jobs?.filter((j: Row) => j.dish_id === dishId) || [];
  const reviewJob = review
    ? state.jobs?.find((j: Row) =>
        state.outputs?.some(
          (o: Row) => o.job_id === j.id && o.asset_id === review.id,
        ),
      )
    : null;
  const reviewSource =
    reviewJob?.source_id &&
    state.assets?.some((a: Row) => a.id === reviewJob.source_id)
      ? reviewJob.source_id
      : "";
  const reviewDetails = reviewJob ? JSON.parse(reviewJob.details) : dish;

  return (
    <>
      {!state.user || overview ? (
        <>
          <Landing
            signedIn={!!state.user}
            onStart={() => {
              if (state.user) {
                setOverview(false);
                return;
              }
              setAuthMode("signup");
              setAuth(true);
            }}
            onSignIn={() => {
              if (state.user) {
                setOverview(false);
                return;
              }
              setAuthMode("login");
              setAuth(true);
            }}
          />
          {error && (
            <div className="landing-error error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="topbar">
            <button
              className="brand brand-home"
              onClick={() => setOverview(true)}
              aria-label="About SideDish"
            >
              <Brand />
              <span className="pilot">WORKSPACE</span>
            </button>
            <nav aria-label="Workspace">
              <button
                className={view === "studio" ? "active" : ""}
                onClick={() => setView("studio")}
              >
                <Camera size={17} />
                Photos
              </button>
              <button
                className={view === "library" ? "active" : ""}
                onClick={() =>
                  state.user ? setView("library") : setAuth(true)
                }
              >
                <Images size={17} />
                Your dishes
              </button>
              <button
                className={view === "menu" ? "active" : ""}
                onClick={() => (state.user ? setView("menu") : setAuth(true))}
              >
                <BookOpen size={17} />
                Your menu
              </button>
            </nav>
            <div className="account-controls">
              {state.user ? (
                <>
                  <button
                    aria-label="Restaurant settings"
                    onClick={() => setSettings(true)}
                    className="avatar"
                  >
                    {state.restaurant?.name?.slice(0, 1) || "R"}
                  </button>
                  <button
                    aria-label="Sign out"
                    className="icon-button"
                    onClick={() =>
                      act("Signing out", async () => {
                        await api("auth/logout", {});
                        setView("studio");
                        newDish();
                        await refresh();
                      })
                    }
                  >
                    <LogOut size={17} />
                  </button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setAuth(true)}>
                  Sign in <ArrowRight />
                </Button>
              )}
            </div>
          </header>
          <main className="workspace">
            <div className="intro">
              <div>
                <p className="eyebrow">{state.restaurant?.name}</p>
                <h1>
                  {view === "studio"
                    ? dishId
                      ? dish.name
                      : "What’s cooking?"
                    : view === "library"
                      ? "Your dishes, all together."
                      : view === "admin"
                        ? "Your pilot restaurants."
                        : "A menu that’s up to date."}
                </h1>
                <p>
                  {view === "studio"
                    ? "Start with a dish. We’ll help with the photo and the words."
                    : view === "library"
                      ? "Photos, captions, and details. Pick a dish to keep going."
                      : view === "admin"
                        ? "Manage invitations, allowances, and pilot activity."
                        : "Make your changes here. Publish when you’re ready."}
                </p>
              </div>
              <div className="allowance">
                <div>
                  <b>
                    {state.remaining ?? 0}
                    <span> images left</span>
                  </b>
                  <p>Free pilot · 2 options per request</p>
                </div>
              </div>
            </div>
            {error && (
              <div className="error global-message" role="alert">
                {error}
                <button onClick={() => setError("")} aria-label="Dismiss error">
                  ×
                </button>
              </div>
            )}
            {notice && (
              <div className="notice global-message" role="status">
                {notice}
                <button
                  onClick={() => setNotice("")}
                  aria-label="Dismiss notice"
                >
                  ×
                </button>
              </div>
            )}
            {state.user && !state.aiConnected && (
              <div className="connection-note">
                <Sparkles size={17} />
                <p>
                  Image creation and AI captions are being connected. You can
                  save dishes, write captions and publish your menu now.
                </p>
              </div>
            )}
            {view === "studio" && (
              <>
                <section className="studio-grid">
                  <div className="studio-card">
                    <div className="card-heading">
                      <span className="step">01</span>
                      <div>
                        <h2>
                          {dishId
                            ? "Make this dish shine"
                            : "Start with your dish"}
                        </h2>
                        <p>A real photo gives the most faithful result.</p>
                      </div>
                      {dishId && (
                        <button
                          className="text-button push-right"
                          onClick={newDish}
                        >
                          <Plus size={15} />
                          New dish
                        </button>
                      )}
                    </div>
                    {state.user && state.dishes?.length > 0 && (
                      <div className="saved-picker">
                        <Pick
                          value={dishId || "new"}
                          onChange={(v) =>
                            v === "new"
                              ? newDish()
                              : selectDish(
                                  state.dishes.find((d: Row) => d.id === v),
                                )
                          }
                          label="Choose a saved dish"
                          options={[
                            { value: "new", label: "Create a new dish" },
                            ...state.dishes.map((d: Row) => ({
                              value: d.id,
                              label: d.name,
                            })),
                          ]}
                        />
                      </div>
                    )}
                    <Tabs
                      value={mode}
                      onValueChange={(v) => {
                        setMode(v);
                        requestKey.current = "";
                      }}
                    >
                      <TabsList className="mode-tabs">
                        <TabsTrigger value="photo">
                          <Camera />
                          Upload a photo
                        </TabsTrigger>
                        <TabsTrigger value="description">
                          <Sparkles />
                          Describe your dish
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="photo">
                        <label
                          className={
                            "upload-zone " +
                            (file || sourceId ? "has-photo" : "")
                          }
                        >
                          {(filePreview &&
                            !/hei[cf]/i.test(file?.type || file?.name || "")) ||
                          sourceId ? (
                            <img
                              className="upload-thumb"
                              src={filePreview || `/api/assets/${sourceId}`}
                              alt="Your original dish"
                            />
                          ) : (
                            <span className="upload-icon">
                              <ImagePlus size={27} />
                            </span>
                          )}
                          <b>
                            {file
                              ? file.name
                              : sourceId
                                ? "Your original photo is saved"
                                : "Add a photo of your dish"}
                          </b>
                          <span>
                            {file || sourceId
                              ? "Choose another photo"
                              : "Choose a photo or take one on your phone"}
                          </span>
                          <small>JPEG, PNG or HEIC · up to 20 MB</small>
                          <input
                            aria-label="Upload a dish photo"
                            type="file"
                            accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
                            onChange={(e) => {
                              const chosen = e.target.files?.[0];
                              if (chosen) {
                                setFile(chosen);
                                requestKey.current = "";
                              }
                            }}
                          />
                        </label>
                      </TabsContent>
                      <TabsContent value="description">
                        <div className="description-tip">
                          <Sparkles size={21} />
                          <p>
                            No photo? Start with the details.
                            <br />
                            <span>
                              Be specific about ingredients, portion and
                              presentation.
                            </span>
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                    <label className="field">
                      Dish name
                      <input
                        value={dish.name}
                        onChange={(e) => update("name", e.target.value)}
                        placeholder="e.g. Our Sunday tomato pasta"
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      What’s in the dish?
                      <textarea
                        value={dish.description}
                        onChange={(e) => update("description", e.target.value)}
                        placeholder="e.g. Spaghetti with our tomato sauce, three basil leaves and grated Parmesan."
                        rows={3}
                        maxLength={2000}
                      />
                    </label>
                    <details className="dish-options">
                      <summary>
                        Presentation & menu details <Plus size={16} />
                      </summary>
                      <div className="two-fields">
                        <label className="field">
                          Portion
                          <input
                            value={dish.portion}
                            onChange={(e) => update("portion", e.target.value)}
                            placeholder="e.g. One serving, 250 g"
                            maxLength={300}
                          />
                        </label>
                        <label className="field">
                          Plating
                          <input
                            value={dish.plating}
                            onChange={(e) => update("plating", e.target.value)}
                            placeholder="e.g. White ceramic bowl"
                            maxLength={300}
                          />
                        </label>
                      </div>
                      <label className="field">
                        The look you’re after
                        <Pick
                          label="Presentation style"
                          value={dish.setting}
                          onChange={(v) => update("setting", v)}
                          options={[
                            "Natural daylight",
                            "Lighting and color cleanup",
                            "Background styling — simple tabletop",
                            "Warm restaurant lighting",
                          ].map((v) => ({ value: v, label: v }))}
                        />
                      </label>
                      <div className="two-fields">
                        <label className="field">
                          Menu price ({state.restaurant?.currency || "USD"})
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={dish.price}
                            onChange={(e) =>
                              update("price", Number(e.target.value))
                            }
                          />
                        </label>
                        <label className="check-label availability-check">
                          <input
                            type="checkbox"
                            checked={dish.available}
                            onChange={(e) =>
                              update("available", e.target.checked)
                            }
                          />
                          Available on the menu
                        </label>
                      </div>
                    </details>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={dish.confirmed}
                        onChange={(e) => update("confirmed", e.target.checked)}
                      />
                      <span>These details match the dish we serve.</span>
                    </label>
                    {parentId && (
                      <div className="revision-box">
                        <p>Revising a saved image · 2 new image units</p>
                        <label className="field">
                          What would you like to change?
                          <textarea
                            value={revision}
                            onChange={(e) => {
                              setRevision(e.target.value);
                              requestKey.current = "";
                            }}
                            placeholder="e.g. Softer light, keep the portion exactly the same"
                            rows={2}
                          />
                        </label>
                        <button
                          className="text-button"
                          onClick={() => {
                            setParentId("");
                            setRevision("");
                          }}
                        >
                          Cancel revision
                        </button>
                      </div>
                    )}
                    <div className="form-foot">
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() =>
                          act("Saving dish", async () => {
                            const saved = await saveDish();
                            if (saved)
                              setNotice(
                                "Dish saved. You can add it to your menu anytime.",
                              );
                          })
                        }
                      >
                        <Save />
                        Save dish
                      </Button>
                      <Button
                        disabled={
                          !!busy ||
                          (state.user &&
                            (!state.aiConnected ||
                              state.remaining < 2 ||
                              state.restaurant?.paused))
                        }
                        onClick={generate}
                      >
                        {busy ||
                          (!state.user
                            ? "Start with this dish"
                            : parentId
                              ? "Create 2 revised options"
                              : "Create 2 image options")}{" "}
                        {!busy && <ArrowRight />}
                      </Button>
                    </div>
                    <p className="fine">
                      {state.user
                        ? "Uses 2 free images. Failed options restore your allowance."
                        : "Free, invitation-only pilot. No credit card."}
                    </p>
                  </div>
                  <div className="studio-results">
                    {dishId && assets.length > 0 ? (
                      <div className="results-card">
                        <div className="card-heading">
                          <span className="step">02</span>
                          <div>
                            <h2>Your photos</h2>
                            <p>
                              Review every image against the food you serve.
                            </p>
                          </div>
                        </div>
                        <div className="asset-grid">
                          {assets.map((a: Row) => (
                            <button
                              className="asset-tile"
                              key={a.id}
                              onClick={() => {
                                setReview(a);
                                setAccurate(!!a.approved_at);
                                setRatio("square");
                              }}
                            >
                              <img
                                src={`/api/assets/${a.id}`}
                                alt={
                                  a.kind === "source"
                                    ? "Original dish photo"
                                    : `Generated ${dish.name}`
                                }
                              />
                              <span>
                                {a.kind === "source"
                                  ? "Original photo"
                                  : a.approved_at
                                    ? "Approved"
                                    : "Needs your review"}
                                <span>View</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="example-card">
                        <div className="example-top">
                          <span>A GOOD PLACE TO START</span>
                          <span className="chip">Food first. Always.</span>
                        </div>
                        <div className="example-image">
                          <img
                            src="/pasta.jpg"
                            alt="Tomato spaghetti topped with fresh basil on a white plate"
                          />
                          <div className="image-overlay">
                            <span className="chip">
                              Start with the real thing
                            </span>
                            <h2>
                              Your food,
                              <br />
                              looking its best.
                            </h2>
                          </div>
                        </div>
                        <div className="example-bottom">
                          <div>
                            <Check />
                            <span>Keep real ingredients</span>
                          </div>
                          <div>
                            <Check />
                            <span>Keep honest portions</span>
                          </div>
                          <div>
                            <Check />
                            <span>You approve every image</span>
                          </div>
                          <a
                            className="photo-credit"
                            href="https://www.pexels.com/photo/pasta-on-a-plate-11654225/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Inspiration photo by Adrian Vieriu · Not an AI
                            result
                          </a>
                        </div>
                      </div>
                    )}
                    {jobs.length > 0 && (
                      <section className="history-card">
                        <h2>Version history</h2>
                        {jobs.map((j: Row) => (
                          <div className="job" key={j.id}>
                            <div>
                              <b>
                                {j.parent_id ? "Revision" : "Generation"} ·{" "}
                                {j.input_method === "photo"
                                  ? "From your photo"
                                  : "From description"}
                              </b>
                              <small>
                                {new Date(j.created_at).toLocaleString()}
                              </small>
                            </div>
                            <span className={"tag " + j.status}>
                              {j.status === "partial"
                                ? "1 of 2 ready"
                                : j.status}
                            </span>
                            {state.outputs
                              ?.filter((o: Row) => o.job_id === j.id)
                              .map((o: Row) => (
                                <p key={o.id}>
                                  Option {o.slot + 1}: {o.status}
                                  {o.error && ` · ${o.error}`}
                                </p>
                              ))}
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                </section>
                {dishId && (
                  <section className="caption-card">
                    <div>
                      <p className="eyebrow">FIND THE WORDS</p>
                      <h2>A caption to go with it</h2>
                      <p>
                        Based on your confirmed dish details. Give it your own
                        voice before sharing.
                      </p>
                    </div>
                    <div>
                      <textarea
                        aria-label="Social caption"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Write your caption, or let SideDish give you a starting point…"
                        rows={4}
                        maxLength={2200}
                      />
                      <div className="button-row">
                        <Button
                          variant="outline"
                          disabled={!!busy || !state.aiConnected}
                          onClick={() =>
                            act("Writing caption", async () => {
                              const c = await api("captions/generate", {
                                dishId,
                              });
                              setCaption(c.body);
                              await refresh();
                            })
                          }
                        >
                          <Sparkles />
                          Write a caption
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!!busy || !caption}
                          onClick={() =>
                            act("Saving caption", async () => {
                              await api("captions", { dishId, body: caption });
                              await refresh();
                              setNotice("Caption saved to this dish.");
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          disabled={!caption}
                          onClick={() =>
                            act("Copying caption", async () => {
                              await navigator.clipboard.writeText(caption);
                              await api("events", {
                                kind: "caption_copied",
                                entityId: dishId,
                              });
                              setNotice("Caption copied.");
                            })
                          }
                        >
                          <Copy />
                          Copy
                        </Button>
                      </div>
                      {state.captions
                        ?.filter((c: Row) => c.dish_id === dishId)
                        .slice(0, 5)
                        .map((c: Row) => (
                          <button
                            className="saved-caption"
                            key={c.id}
                            onClick={() => setCaption(c.body)}
                          >
                            {c.body.slice(0, 110)}
                            {c.body.length > 110 ? "…" : ""}
                          </button>
                        ))}
                    </div>
                  </section>
                )}
              </>
            )}
            {view === "library" && (
              <section>
                <div className="section-toolbar">
                  <h2>{state.dishes?.length || 0} saved dishes</h2>
                  <Button onClick={newDish}>
                    <Plus />
                    Add a dish
                  </Button>
                </div>
                {!state.dishes?.length ? (
                  <div className="empty">
                    <UtensilsCrossed />
                    <h2>Your dish library starts here.</h2>
                    <p>
                      Save your first dish and reuse it for photos, captions and
                      your menu.
                    </p>
                    <Button onClick={newDish}>Add your first dish</Button>
                  </div>
                ) : (
                  <div className="library-grid">
                    {state.dishes.map((d: Row) => {
                      const a = state.assets.find(
                        (a: Row) => a.dish_id === d.id,
                      );
                      return (
                        <button
                          key={d.id}
                          className="library-card"
                          onClick={() => selectDish(d)}
                        >
                          {a ? (
                            <img src={`/api/assets/${a.id}`} alt={d.name} />
                          ) : (
                            <div className="dish-no-photo">
                              <UtensilsCrossed />
                            </div>
                          )}
                          <div>
                            <h2>{d.name}</h2>
                            <p>{d.description}</p>
                            <span>
                              {
                                state.assets.filter(
                                  (a: Row) => a.dish_id === d.id,
                                ).length
                              }{" "}
                              saved photos <ArrowRight size={16} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            {view === "menu" && (
              <MenuEditor
                state={state}
                refresh={refresh}
                act={act}
                busy={busy}
                selectDish={selectDish}
                newDish={newDish}
                setNotice={setNotice}
              />
            )}
            <footer className="page-footer">
              <span>SideDish. Your restaurant’s right hand.</span>
              <span>
                {state.user?.role === "admin" ? (
                  <button
                    className="text-button"
                    onClick={() =>
                      setView(view === "admin" ? "studio" : "admin")
                    }
                  >
                    <ShieldCheck size={14} />
                    Pilot admin
                  </button>
                ) : (
                  <>Photos · Captions · Your menu</>
                )}
              </span>
            </footer>
            {view === "admin" && (
              <Admin act={act} refresh={refresh} busy={busy} />
            )}
          </main>
        </>
      )}
      <Auth
        open={auth}
        setOpen={setAuth}
        local={!!state.local}
        ownerSetup={!!state.ownerSetup}
        initialMode={authMode}
        onDone={async () => {
          await refresh();
          setOverview(false);
        }}
      />
      <Dialog open={!!review} onOpenChange={(v) => !v && setReview(null)}>
        <DialogContent className="review-dialog">
          <DialogHeader>
            <DialogTitle>
              {review?.kind === "source"
                ? "Your original dish"
                : "Does this look like your dish?"}
            </DialogTitle>
            <DialogDescription>
              Check ingredients, portion and plating. Only use images that
              accurately represent the food you serve.
            </DialogDescription>
          </DialogHeader>
          {review && (
            <>
              <div className="review-images">
                {review.kind === "generated" && reviewSource && (
                  <figure>
                    <img
                      src={`/api/assets/${reviewSource}`}
                      alt="Original dish for comparison"
                    />
                    <figcaption>Original</figcaption>
                  </figure>
                )}
                <figure>
                  <img
                    style={{
                      aspectRatio:
                        ratio === "portrait"
                          ? "4/5"
                          : ratio === "story"
                            ? "9/16"
                            : "1",
                      objectFit: "cover",
                    }}
                    src={`/api/assets/${review.id}`}
                    alt="Image under review"
                  />
                  <figcaption>
                    {review.kind === "source"
                      ? "Original photo"
                      : "Your selected image"}
                  </figcaption>
                </figure>
              </div>
              {!reviewSource && (
                <p className="review-details">
                  Source description: {reviewDetails.description}
                  <br />
                  Portion: {reviewDetails.portion || "Not specified"} · Plating:{" "}
                  {reviewDetails.plating || "Not specified"}
                </p>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={accurate}
                  onChange={(e) => setAccurate(e.target.checked)}
                />
                <span>This image represents the dish we serve.</span>
              </label>
              <div className="two-fields">
                <label className="field">
                  Crop preview
                  <Pick
                    label="Crop"
                    value={ratio}
                    onChange={setRatio}
                    options={["square", "portrait", "story"].map((s) => ({
                      value: s,
                      label:
                        s === "square"
                          ? "Square · 1:1"
                          : s === "portrait"
                            ? "Portrait · 4:5"
                            : "Story · 9:16",
                    }))}
                  />
                </label>
                <label className="field">
                  Download format
                  <Pick
                    label="Format"
                    value={format}
                    onChange={setFormat}
                    options={[
                      { value: "jpeg", label: "JPEG" },
                      { value: "png", label: "PNG" },
                    ]}
                  />
                </label>
              </div>
              <div className="button-row">
                <Button
                  disabled={!accurate || !!busy}
                  onClick={() =>
                    act("Approving image", async () => {
                      await api(`assets/${review.id}/approve`, {
                        accurate: true,
                      });
                      setReview({ ...review, approved_at: Date.now() });
                      await refresh();
                      setNotice(
                        "Image approved. It is ready for your menu and downloads.",
                      );
                    })
                  }
                >
                  <Check />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={!accurate || !review.approved_at || !!busy}
                  onClick={() =>
                    act("Preparing download", async () => {
                      await exportImage(review, format, ratio);
                      setNotice("Image downloaded.");
                    })
                  }
                >
                  <Download />
                  Download
                </Button>
                {review.kind === "generated" && (
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() => {
                      setParentId(review.id);
                      setSourceId(reviewSource);
                      setMode(reviewSource ? "photo" : "description");
                      setReview(null);
                      window.scrollTo({ top: 350, behavior: "smooth" });
                    }}
                  >
                    <RefreshCw />
                    Revise
                  </Button>
                )}
                <Button
                  variant="ghost"
                  aria-label="Delete image"
                  onClick={() => setDeleteId(review.id)}
                >
                  <Trash2 />
                </Button>
              </div>
              {review.kind === "generated" && (
                <label className="field">
                  Something off? Record why.
                  <Pick
                    value="select"
                    label="Rejection reason"
                    options={[
                      { value: "select", label: "Choose a reason" },
                      ...[
                        "ingredients",
                        "portion",
                        "artificial",
                        "plating",
                        "other",
                      ].map((v) => ({
                        value: v,
                        label:
                          v === "artificial"
                            ? "Looks artificial"
                            : v.charAt(0).toUpperCase() + v.slice(1),
                      })),
                    ]}
                    onChange={(v) => {
                      if (v !== "select")
                        act("Saving feedback", async () => {
                          await api(`assets/${review.id}/reject`, {
                            reason: v,
                          });
                          setNotice("Feedback saved. Thank you.");
                          setReview(null);
                        });
                    }}
                  />
                </label>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDelete
        open={!!deleteId}
        onClose={() => setDeleteId("")}
        onConfirm={() =>
          act("Deleting image", async () => {
            await api("assets/" + deleteId, undefined, "DELETE");
            if (sourceId === deleteId) setSourceId("");
            setDeleteId("");
            setReview(null);
            await refresh();
            setNotice("Image deleted from your workspace and public menu.");
          })
        }
      />
      <SettingsPanel
        open={settings}
        close={() => setSettings(false)}
        state={state}
        act={act}
        refresh={refresh}
        busy={busy}
      />
      {!loaded && (
        <div className="loading-strip" role="status">
          Opening your workspace…
        </div>
      )}
    </>
  );
}
function MenuEditor({
  state,
  refresh,
  act,
  busy,
  selectDish,
  newDish,
  setNotice,
}: any) {
  const [draft, setDraft] = useState<Row>(state.restaurant.menuDraft),
    [preview, setPreview] = useState(false),
    [dirty, setDirty] = useState(false),
    [previewMenu, setPreviewMenu] = useState<Row | null>(null);
  useEffect(() => {
    if (!dirty) setDraft(state.restaurant.menuDraft);
  }, [state.restaurant.menu_draft, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function change(next: Row) {
    setDraft(next);
    setDirty(true);
  }
  function sectionChange(index: number, next: Row) {
    const sections = [...draft.sections];
    sections[index] = next;
    change({ sections });
  }
  function move<T>(items: T[], index: number, delta: number) {
    const n = [...items];
    [n[index], n[index + delta]] = [n[index + delta], n[index]];
    return n;
  }
  function makePreview() {
    return {
      restaurant: {
        name: state.restaurant.name,
        cuisine: state.restaurant.cuisine,
        currency: state.restaurant.currency,
        logoId: state.restaurant.logo_id,
      },
      sections: draft.sections.map((s: Row) => ({
        ...s,
        items: s.items.map((i: Row) => {
          const d = state.dishes.find((d: Row) => d.id === i.dishId);
          return { ...d, photoId: i.photoId, available: !!d.available };
        }),
      })),
    };
  }
  async function save() {
    await api("menu", draft);
    setDirty(false);
    await refresh();
  }
  async function qr() {
    if (!state.restaurant.published)
      throw Error("Publish your menu before downloading the QR code.");
    const { default: QRCode } = await import("qrcode");
    const href = location.origin + "/m/" + state.restaurant.slug;
    const url = await QRCode.toDataURL(href, {
      width: 1000,
      margin: 3,
      color: { dark: "#195a42", light: "#ffffff" },
    });
    downloadBlob(await (await fetch(url)).blob(), "sidedish-menu-qr.png");
  }
  return (
    <>
      <div className="menu-status">
        <div>
          <span
            className={"tag " + (state.restaurant.published ? "completed" : "")}
          >
            {state.restaurant.published ? "Published" : "Private draft"}
          </span>
          <p>
            {state.restaurant.published
              ? "Customers see your last published version."
              : "Only you can see this menu until you publish."}
          </p>
        </div>
        <div className="button-row">
          <Button
            variant="outline"
            onClick={() => {
              setPreviewMenu(makePreview());
              setPreview(true);
            }}
          >
            Preview draft
          </Button>
          <Button
            disabled={!!busy}
            onClick={() =>
              act("Saving menu", async () => {
                await save();
                setNotice("Menu draft saved.");
              })
            }
          >
            <Save />
            Save draft
          </Button>
          <Button
            disabled={
              !!busy || !draft.sections.some((s: Row) => s.items.length)
            }
            onClick={() =>
              act("Publishing menu", async () => {
                await save();
                await api("menu/publish", {});
                await refresh();
                setNotice("Your menu is published and ready to share.");
              })
            }
          >
            {state.restaurant.published ? "Republish menu" : "Publish menu"}{" "}
            <ArrowRight />
          </Button>
        </div>
      </div>
      <div className="menu-edit-layout">
        <section className="menu-editor">
          {draft.sections.map((s: Row, i: number) => (
            <div className="menu-section" key={s.id}>
              <div className="section-toolbar">
                <label className="field compact">
                  Section name
                  <input
                    value={s.name}
                    aria-label={`Section ${i + 1} name`}
                    onChange={(e) =>
                      sectionChange(i, { ...s, name: e.target.value })
                    }
                  />
                </label>
                <div className="button-row">
                  <button
                    className="icon-button"
                    aria-label="Move section up"
                    disabled={i === 0}
                    onClick={() =>
                      change({ sections: move(draft.sections, i, -1) })
                    }
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Move section down"
                    disabled={i === draft.sections.length - 1}
                    onClick={() =>
                      change({ sections: move(draft.sections, i, 1) })
                    }
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Remove section from draft"
                    onClick={() =>
                      change({
                        sections: draft.sections.filter(
                          (_: Row, j: number) => i !== j,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {s.items.map((item: Row, j: number) => {
                const d = state.dishes.find((d: Row) => d.id === item.dishId);
                if (!d) return null;
                const photos = state.assets.filter(
                  (a: Row) => a.dish_id === d.id && a.approved_at,
                );
                return (
                  <div className="menu-item-editor" key={d.id + j}>
                    <div className="section-toolbar">
                      <div>
                        <b>{d.name}</b>
                        <p>
                          {money(d.price, state.restaurant.currency)} ·{" "}
                          {d.available ? "Available" : "Unavailable"}
                        </p>
                      </div>
                      <div className="button-row">
                        <button
                          className="text-button"
                          onClick={() => selectDish(d)}
                        >
                          Edit dish
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Move ${d.name} up`}
                          disabled={j === 0}
                          onClick={() =>
                            sectionChange(i, {
                              ...s,
                              items: move(s.items, j, -1),
                            })
                          }
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Move ${d.name} down`}
                          disabled={j === s.items.length - 1}
                          onClick={() =>
                            sectionChange(i, {
                              ...s,
                              items: move(s.items, j, 1),
                            })
                          }
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${d.name} from menu`}
                          onClick={() =>
                            sectionChange(i, {
                              ...s,
                              items: s.items.filter(
                                (_: Row, k: number) => j !== k,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <Pick
                      label={`Photo for ${d.name}`}
                      value={item.photoId || "none"}
                      onChange={(v) =>
                        sectionChange(i, {
                          ...s,
                          items: s.items.map((a: Row, k: number) =>
                            j === k
                              ? { ...a, photoId: v === "none" ? null : v }
                              : a,
                          ),
                        })
                      }
                      options={[
                        { value: "none", label: "No photo" },
                        ...photos.map((a: Row, index: number) => ({
                          value: a.id,
                          label: `Approved ${a.kind === "source" ? "original" : "image"} ${index + 1}`,
                        })),
                      ]}
                    />
                  </div>
                );
              })}
              <div className="add-menu-dish">
                <Pick
                  label="Add a dish to this section"
                  value="choose"
                  onChange={(v) =>
                    v !== "choose" &&
                    sectionChange(i, {
                      ...s,
                      items: [...s.items, { dishId: v, photoId: null }],
                    })
                  }
                  options={[
                    { value: "choose", label: "+ Add a saved dish" },
                    ...state.dishes
                      .filter(
                        (d: Row) =>
                          !s.items.some((i: Row) => i.dishId === d.id),
                      )
                      .map((d: Row) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              change({
                sections: [
                  ...draft.sections,
                  {
                    id: crypto.randomUUID(),
                    name: draft.sections.length ? "New section" : "Our menu",
                    items: [],
                  },
                ],
              })
            }
          >
            <Plus />
            Add a section
          </Button>
          {!state.dishes.length && (
            <div className="empty">
              <p>
                Save a dish first, then add it to a section. Photos are
                optional.
              </p>
              <Button onClick={newDish}>Add your first dish</Button>
            </div>
          )}
          {dirty && <p className="fine">You have unsaved menu changes.</p>}
        </section>
        <aside className="share-card">
          <BookOpen size={28} />
          <h2>Your menu, everywhere</h2>
          <p>
            Share one link or put a QR code on your counter, truck or market
            stall.
          </p>
          {state.restaurant.published ? (
            <>
              <a
                href={"/m/" + state.restaurant.slug}
                target="_blank"
                rel="noreferrer"
                className="menu-link"
              >
                Open published menu <ExternalLink size={16} />
              </a>
              <Button
                variant="outline"
                onClick={() =>
                  act("Copying menu link", async () => {
                    await navigator.clipboard.writeText(
                      location.origin + "/m/" + state.restaurant.slug,
                    );
                    setNotice("Menu link copied.");
                  })
                }
              >
                <Copy />
                Copy menu link
              </Button>
              <Button
                variant="outline"
                onClick={() => act("Creating QR code", qr)}
              >
                <Download />
                Download QR code
              </Button>
              <button
                className="text-button danger"
                onClick={() =>
                  act("Unpublishing menu", async () => {
                    await api("menu/unpublish", {});
                    await refresh();
                    setNotice(
                      "Menu unpublished. Customers can no longer view it.",
                    );
                  })
                }
              >
                Unpublish menu
              </button>
              <small>
                Last published{" "}
                {new Date(state.restaurant.published_at).toLocaleString()}
              </small>
            </>
          ) : (
            <small>
              Your share link and QR code will be ready after publishing.
            </small>
          )}
        </aside>
      </div>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="menu-preview-dialog">
          <DialogHeader>
            <DialogTitle>Preview your menu</DialogTitle>
            <DialogDescription>
              This draft is visible only to you.
            </DialogDescription>
          </DialogHeader>
          {previewMenu && <MenuView menu={previewMenu} preview />}
        </DialogContent>
      </Dialog>
    </>
  );
}
function SettingsPanel({ open, close, state, act, refresh, busy }: any) {
  const [profile, setProfile] = useState<Row>({
    name: "",
    cuisine: "",
    brand: "",
    currency: "USD",
  });
  useEffect(() => {
    if (state.restaurant)
      setProfile({
        name: state.restaurant.name,
        cuisine: state.restaurant.cuisine,
        brand: state.restaurant.brand,
        currency: state.restaurant.currency,
      });
  }, [state.restaurant]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your restaurant</DialogTitle>
          <DialogDescription>
            A few details to keep your workspace and menu consistent.
          </DialogDescription>
        </DialogHeader>
        {["name", "cuisine", "brand"].map((k) => (
          <label className="field" key={k}>
            {k === "name"
              ? "Restaurant name"
              : k === "cuisine"
                ? "Cuisine"
                : "Brand preferences"}
            <input
              value={profile[k]}
              onChange={(e) => setProfile({ ...profile, [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          Menu currency
          <Pick
            label="Currency"
            value={profile.currency}
            onChange={(v) => setProfile({ ...profile, currency: v })}
            options={["USD", "GBP", "EUR", "JPY", "CAD", "AUD"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
        </label>
        <label className="field">
          Logo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/heic,.heic"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                act("Saving logo", async () => {
                  const form = new FormData();
                  form.set("file", f);
                  form.set("normalized", await normalizePhoto(f), "logo.jpg");
                  form.set("kind", "logo");
                  await api("assets", form);
                  await refresh();
                });
            }}
          />
        </label>
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Saving restaurant", async () => {
              await api("restaurant", profile);
              await refresh();
              close();
            })
          }
        >
          Save restaurant
        </Button>
        <p className="fine">
          Your published menu changes only when you republish.
        </p>
      </DialogContent>
    </Dialog>
  );
}
function Admin({ act, refresh, busy }: any) {
  const [data, setData] = useState<Row | null>(null),
    [email, setEmail] = useState(""),
    [allowance, setAllowance] = useState(20),
    [link, setLink] = useState(""),
    [reset, setReset] = useState(false);
  const load = useCallback(async () => setData(await api("admin")), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  return (
    <section className="admin-panel">
      <div className="section-toolbar">
        <h2>Pilot administration</h2>
        <Button variant="outline" onClick={() => act("Refreshing pilot", load)}>
          Refresh
        </Button>
      </div>
      <div className="admin-invite">
        <label className="field">
          Invite email
          <input
            value={email}
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@restaurant.com"
          />
        </label>
        <label className="field">
          Free image allowance
          <input
            value={allowance}
            min={0}
            max={10000}
            type="number"
            onChange={(e) => setAllowance(Number(e.target.value))}
          />
        </label>
        <Button
          disabled={!!busy}
          onClick={() =>
            act("Creating invitation", async () => {
              const r = await api("admin/invite", { email, allowance, reset });
              setLink(location.origin + r.path);
              await load();
            })
          }
        >
          {reset ? "Create password reset" : "Create invitation"}
        </Button>
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={reset}
          onChange={(e) => setReset(e.target.checked)}
        />
        Create a password reset for an existing account
      </label>
      {link && (
        <div className="invitation-result">
          <p>
            Share this invitation directly with the restaurant owner. It expires
            in 7 days.
          </p>
          <input aria-label="Invitation link" readOnly value={link} />
          <Button
            variant="outline"
            onClick={() =>
              act("Copying invite", async () =>
                navigator.clipboard.writeText(link),
              )
            }
          >
            <Copy />
            Copy invitation
          </Button>
        </div>
      )}
      <div className="admin-restaurants">
        {data?.restaurants.map((r: Row) => (
          <AdminRestaurant
            key={r.id}
            restaurant={r}
            act={act}
            refresh={async () => {
              await load();
              await refresh();
            }}
          />
        ))}
      </div>
      <p className="fine">
        Costs are estimates when a per-image estimate is configured. Provider
        usage records are retained for invoice reconciliation, including
        failures and retries.
      </p>
      {data && (
        <details className="admin-details">
          <summary>Recent quality and usage events</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e: Row) => (
                  <tr key={e.id}>
                    <td>{new Date(e.created_at).toLocaleString()}</td>
                    <td>{e.kind}</td>
                    <td>{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
function AdminRestaurant({ restaurant: r, act, refresh }: any) {
  const [allowance, setAllowance] = useState(r.allowance),
    [paused, setPaused] = useState(!!r.paused),
    [minutes, setMinutes] = useState(15);
  return (
    <div className="admin-restaurant">
      <div>
        <h3>{r.name}</h3>
        <p>{r.email}</p>
        <p>
          {r.completed} completed · {r.reserved} reserved · {r.failed} failed ·{" "}
          {r.approved} approved
        </p>
        <small>
          {r.approved > 0 && (
            <span>
              {Math.round((r.support_minutes || 0) / r.approved)} support min
              per approved image ·{" "}
            </span>
          )}
          {r.cost_estimate === null
            ? "Cost estimate not configured"
            : `Estimated provider cost: $${Number(r.cost_estimate).toFixed(2)}`}{" "}
          · {r.support_minutes || 0} support minutes
        </small>
      </div>
      <div className="admin-row-controls">
        <label className="field">
          Total allowance
          <input
            aria-label={`Allowance for ${r.name}`}
            type="number"
            min={0}
            value={allowance}
            onChange={(e) => setAllowance(Number(e.target.value))}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
          />
          Pause images
        </label>
        <Button
          variant="outline"
          onClick={() =>
            act("Updating allowance", async () => {
              await api("admin/restaurant", { id: r.id, allowance, paused });
              await refresh();
            })
          }
        >
          Save
        </Button>
      </div>
      <div className="support-entry">
        <label className="field">
          Support minutes
          <input
            type="number"
            min={1}
            max={600}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <Button
          variant="outline"
          onClick={() =>
            act("Recording support time", async () => {
              await api("admin/support", { restaurantId: r.id, minutes });
              await refresh();
            })
          }
        >
          Log time
        </Button>
      </div>
    </div>
  );
}

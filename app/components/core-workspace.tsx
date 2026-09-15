"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Home,
  Images,
  Megaphone,
  Settings,
  LogOut,
  Plus,
  Download,
  SlidersHorizontal,
  ShieldCheck,
  UtensilsCrossed,
  Sparkles,
  Clock3,
} from "lucide-react";
import { api, downloadBlob, money, type Row } from "@/lib/client";
import { photoExport } from "@/lib/creation-export";
import { formats, type PhotoFormat } from "@/lib/studio";
import Brand from "./brand";
import PhotoStudio from "./photo-studio";
import MenuBuilder from "./menu-builder";
import PostMaker from "./post-maker";
import MenuTools from "./menu-tools";
import PromotionWorkspace from "./promotion-workspace";
import { Feedback, Field, Heading, track, useAction } from "./creation-shared";
export default function CoreWorkspace({
  state,
  refresh,
  onOverview,
  onSettings,
  onLogout,
  adminContent,
}: {
  state: Row;
  refresh: () => Promise<void>;
  onOverview: () => void;
  onSettings: () => void;
  onLogout: () => void;
  adminContent: ReactNode;
}) {
  const [view, setView] = useState("home"),
    [photoSeed, setPhotoSeed] = useState<Row | null>(null),
    [menuSeed, setMenuSeed] = useState<Row | null>(null),
    [postSeed, setPostSeed] = useState<Row | null>(null),
    [legacySeed, setLegacySeed] = useState<Row | null>(null),
    [visited, setVisited] = useState<string[]>(["home"]),
    [drafts, setDrafts] = useState<Row[]>([]);
  const validViews = [
    "home",
    "studio",
    "menu",
    "post",
    "library",
    "tools",
    "admin",
  ];
  useEffect(() => {
    const read = () => {
      const next = location.hash.slice(1);
      if (validViews.includes(next)) {
        setView(next);
        setVisited((v) => (v.includes(next) ? v : [...v, next]));
      } else {
        setView("home");
      }
    };
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, []);
  useEffect(() => {
    if (view !== "home") return;
    let live = true;
    const refreshDrafts = () =>
      void api("creation-drafts")
        .then((data) => {
          if (live) setDrafts(data.drafts);
        })
        .catch(() => {});
    refreshDrafts();
    window.addEventListener("plateworthy:draft-saved", refreshDrafts);
    return () => {
      live = false;
      window.removeEventListener("plateworthy:draft-saved", refreshDrafts);
    };
  }, [view, state.restaurant.id]);
  function navigate(next: string) {
    if (location.hash !== "#" + next) history.pushState(null, "", "#" + next);
    setView(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
  }
  useEffect(() => {
    document
      .querySelector<HTMLElement>('.cx-main [aria-hidden="false"] h1')
      ?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);
  function photo(dishId = "", photoId = "", destination = "menu") {
    setPhotoSeed({ token: crypto.randomUUID(), dishId, photoId, destination });
    navigate("studio");
  }
  function destination(
    where: string,
    dishId: string,
    photoId: string,
    extra: Row = {},
  ) {
    if (where === "post") {
      setPostSeed({ token: crypto.randomUUID(), dishId, photoId });
      navigate("post");
    } else if (where === "menu" || where === "print") {
      setMenuSeed({
        token: crypto.randomUUID(),
        dishId,
        photoId,
        print: where === "print",
        ...extra,
      });
      navigate("menu");
    }
  }
  const recent = state.dishes.slice(0, 4),
    approved = state.assets.filter((a: Row) => a.approved_at),
    active = state.jobs.filter((j: Row) =>
      ["queued", "processing"].includes(j.status),
    );
  const resumeDrafts = ["studio", "menu", "post"]
    .map((kind) => drafts.find((d) => d.kind === kind))
    .filter((row): row is Row => {
      if (!row) return false;
      const d = row.draft;
      return !!(row.kind === "studio"
        ? (d.sourceId || d.description) && d.step < 5
        : row.kind === "menu"
          ? d.rows?.length
          : d.items?.length && (!d.reviewed || d.step < 6));
    });
  function resume(row: Row) {
    const seed = { token: crypto.randomUUID(), draftId: row.id };
    if (row.kind === "studio") setPhotoSeed(seed);
    else if (row.kind === "menu") setMenuSeed(seed);
    else setPostSeed(seed);
    navigate(row.kind);
  }
  const nav = [
    ["home", "Overview", Home],
    ["studio", "Photo Studio", Camera],
    ["menu", "Menu Builder", BookOpen],
    ["post", "Post Maker", Megaphone],
    ["library", "My Dishes", Images],
  ] as const;
  return (
    <div className="cx-app">
      <a className="cx-skip" href="#creation-main">
        Skip to your workspace
      </a>
      <aside className="cx-sidebar">
        <button
          className="cx-brand"
          onClick={onOverview}
          aria-label="Plateworthy home"
        >
          <Brand />
        </button>
        <p className="cx-sidebar-label">YOUR CREATIVE KITCHEN</p>
        <nav aria-label="Workspace">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === "studio" && active.length > 0 && (
                <span className="cx-nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="cx-sidebar-bottom">
          <div className="cx-pilot">
            <Sparkles size={17} />
            <b>{state.remaining} images remaining</b>
            <small>Your free pilot allowance</small>
          </div>
          <button onClick={onSettings}>
            <Settings size={18} />
            Restaurant look & settings
          </button>
          <button onClick={() => navigate("tools")}>
            <SlidersHorizontal size={18} />
            More tools
          </button>
          {state.user.role === "admin" && (
            <button onClick={() => navigate("admin")}>
              <ShieldCheck size={18} />
              Pilot admin
            </button>
          )}
          <button onClick={onLogout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="cx-body">
        <header className="cx-topbar">
          <span>{state.restaurant.name}</span>
          <span className="cx-topbar-caption">
            Food photos worth ordering from.
          </span>
          <button
            className="cx-account"
            aria-label="Restaurant settings"
            onClick={onSettings}
          >
            {state.restaurant.name.slice(0, 1)}
          </button>
          <details className="cx-mobile-tools">
            <summary aria-label="More workspace options">
              <SlidersHorizontal size={20} />
            </summary>
            <div>
              <span>{state.remaining} images remaining</span>
              <button onClick={() => navigate("tools")}>More tools</button>
              {state.user.role === "admin" && (
                <button onClick={() => navigate("admin")}>Pilot admin</button>
              )}
              <button onClick={onLogout}>Sign out</button>
            </div>
          </details>
        </header>
        <main id="creation-main" className="cx-main">
          <div hidden={view !== "home"} aria-hidden={view !== "home"}>
            <div className="cx-overview-intro">
              <div>
                <p className="cx-eyebrow">YOUR CREATIVE KITCHEN</p>
                <h1 tabIndex={-1}>
                  What are we <em>creating today?</em>
                </h1>
                <p>A better photo. A beautiful menu. Your next great post.</p>
              </div>
              <span className="cx-workspace-count">
                <Images size={17} />
                {approved.length} ready-to-use photos
              </span>
            </div>
            <div className="cx-launch-grid">
              <button
                className="cx-launch-card cx-launch-photo"
                onClick={() => photo()}
              >
                <div className="cx-launch-visual">
                  <img
                    src="/studio/daylight-cafe.webp"
                    alt="Food photography style example"
                  />
                  <span>Style example</span>
                  <span className="cx-launch-number">01</span>
                </div>
                <div className="cx-launch-copy">
                  <span className="cx-pill">
                    <Sparkles size={14} />
                    START WITH YOUR FOOD
                  </span>
                  <h2>
                    Make it look
                    <br />
                    <em>as good as it tastes.</em>
                  </h2>
                  <p>Give your photo a new look, or make a quick touch-up.</p>
                  <span className="cx-launch-cta">
                    Open Photo Studio <ArrowRight size={19} />
                  </span>
                </div>
              </button>
              <button
                className="cx-launch-card cx-launch-menu"
                onClick={() => navigate("menu")}
              >
                <div className="cx-launch-small-visual">
                  <img
                    src="/studio/clean-white.webp"
                    alt="Food photo style example"
                  />
                  <span>Style example</span>
                  <BookOpen size={25} />
                </div>
                <div className="cx-launch-copy">
                  <span className="cx-eyebrow">02 / MENU BUILDER</span>
                  <h2>
                    Your menu,
                    <br />
                    <em>beautifully served.</em>
                  </h2>
                  <p>
                    Start with a menu, saved dishes, or a few simple details.
                  </p>
                  <span className="cx-launch-cta">
                    Create a menu <ArrowRight size={18} />
                  </span>
                </div>
              </button>
              <button
                className="cx-launch-card cx-launch-post"
                onClick={() => navigate("post")}
              >
                <div className="cx-launch-small-visual">
                  <img
                    src="/studio/bold-color.webp"
                    alt="Food photo style example"
                  />
                  <span>Style example</span>
                  <Megaphone size={25} />
                </div>
                <div className="cx-launch-copy">
                  <span className="cx-eyebrow">03 / POST MAKER</span>
                  <h2>
                    A little inspiration.
                    <br />
                    <em>A great next post.</em>
                  </h2>
                  <p>Turn an approved photo into a ready-to-share design.</p>
                  <span className="cx-launch-cta">
                    Make a post <ArrowRight size={18} />
                  </span>
                </div>
              </button>
            </div>
            {resumeDrafts.length > 0 && (
              <section className="cx-resume">
                <div className="cx-section-line">
                  <h2>Pick up where you left off</h2>
                  <span>Saved automatically</span>
                </div>
                <div className="cx-resume-grid">
                  {resumeDrafts.map((row) => {
                    const kind = row.kind,
                      d = row.draft;
                    const label =
                        kind === "studio"
                          ? "Photo Studio"
                          : kind === "menu"
                            ? "Menu Builder"
                            : "Post Maker",
                      title =
                        kind === "studio"
                          ? d.name || "Your photo"
                          : kind === "menu"
                            ? `${d.rows.length} dishes · ${d.layout === "grid" ? "Photo grid" : d.layout === "featured" ? "Featured dish" : "Classic text"}`
                            : d.title || "Your next post";
                    const imageId =
                      kind === "studio"
                        ? d.resultId || d.sourceId
                        : kind === "post"
                          ? d.items[0]?.photoId
                          : d.rows.find((r: Row) => r.photoId)?.photoId;
                    return (
                      <button key={row.id} onClick={() => resume(row)}>
                        {imageId ? (
                          <img src={`/api/assets/${imageId}`} alt="" />
                        ) : (
                          <span className="cx-resume-icon">
                            <BookOpen size={24} />
                          </span>
                        )}
                        <span>
                          <small>{label}</small>
                          <b>{title}</b>
                          <small>
                            <Clock3 size={12} />
                            Continue your saved work
                          </small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
            <section className="cx-recent">
              <div className="cx-section-line">
                <h2>Fresh from your kitchen</h2>
                <button className="cx-link" onClick={() => navigate("library")}>
                  View My Dishes <ArrowRight size={16} />
                </button>
              </div>
              {recent.length ? (
                <div className="cx-dish-grid">
                  {recent.map((d: Row) => {
                    const a =
                      state.assets.find(
                        (a: Row) => a.dish_id === d.id && a.approved_at,
                      ) || state.assets.find((a: Row) => a.dish_id === d.id);
                    return (
                      <button
                        key={d.id}
                        className="cx-dish-card"
                        onClick={() => photo(d.id, a?.id || "")}
                      >
                        {a ? (
                          <img src={`/api/assets/${a.id}`} alt={d.name} />
                        ) : (
                          <div className="cx-dish-empty">
                            <UtensilsCrossed size={28} />
                          </div>
                        )}
                        <div>
                          <b>{d.name}</b>
                          <small>
                            {a?.approved_at
                              ? "Ready to use"
                              : a
                                ? "Ready to improve"
                                : "Add a photo"}
                          </small>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="cx-empty-library">
                  <Images size={29} />
                  <div>
                    <h3>Your best dishes will live here.</h3>
                    <p>
                      Save a photo once. Use it in your menu, posts and delivery
                      listings.
                    </p>
                  </div>
                  <button
                    className="cx-btn cx-secondary"
                    onClick={() => photo()}
                  >
                    Add your first dish <Plus size={16} />
                  </button>
                </div>
              )}
            </section>
            {active.length > 0 && (
              <button
                className="cx-feedback cx-full"
                onClick={() => photo(active[0].dish_id)}
              >
                <Sparkles size={18} />
                {active.length}{" "}
                {active.length === 1 ? "photo is" : "photos are"} being created.
                Open Photo Studio to check progress.
              </button>
            )}
            <div className="cx-home-note">
              <Check size={16} />
              <span>
                {approved.length
                  ? `${approved.length} approved photos ready to reuse`
                  : "Your originals stay saved, and every result is yours to review."}
              </span>
            </div>
          </div>
          {visited.includes("studio") && (
            <div hidden={view !== "studio"} aria-hidden={view !== "studio"}>
              <PhotoStudio
                state={state}
                refresh={refresh}
                seed={photoSeed}
                onSeedUsed={() => setPhotoSeed(null)}
                onDestination={destination}
              />
            </div>
          )}
          {visited.includes("menu") && (
            <div hidden={view !== "menu"} aria-hidden={view !== "menu"}>
              <MenuBuilder
                state={state}
                refresh={refresh}
                seed={menuSeed}
                onSeedUsed={() => setMenuSeed(null)}
                onPhoto={(d, p) => photo(d, p, "menu")}
              />
            </div>
          )}
          {visited.includes("post") && (
            <div hidden={view !== "post"} aria-hidden={view !== "post"}>
              <PostMaker
                state={state}
                seed={postSeed}
                onSeedUsed={() => setPostSeed(null)}
                onPhoto={() => photo("", "", "social")}
              />
            </div>
          )}
          {visited.includes("library") && (
            <div hidden={view !== "library"} aria-hidden={view !== "library"}>
              <DishLibrary
                state={state}
                refresh={refresh}
                onPhoto={photo}
                onDestination={destination}
              />
            </div>
          )}
          {view === "tools" && (
            <>
              <Heading
                eyebrow="A LITTLE EXTRA HELP"
                title="Keep your kitchen moving."
              >
                Staff photos, imports, earlier campaigns and pilot activity.
              </Heading>
              <button
                className="cx-btn cx-secondary"
                onClick={() => navigate("campaigns")}
              >
                Open existing campaigns <ArrowRight size={16} />
              </button>
              <div className="cx-legacy">
                <MenuTools
                  state={state}
                  refresh={refresh}
                  selectDish={(d) => photo(d.id)}
                  onSuggestion={(s) => {
                    setLegacySeed(s);
                    navigate("campaigns");
                  }}
                />
              </div>
            </>
          )}
          {visited.includes("campaigns") && (
            <div className="cx-legacy" hidden={view !== "campaigns"}>
              <PromotionWorkspace
                state={state}
                refresh={refresh}
                active={view === "campaigns"}
                seed={legacySeed}
                onSeedUsed={() => setLegacySeed(null)}
              />
            </div>
          )}
          {view === "admin" && <div className="cx-legacy">{adminContent}</div>}
        </main>
        <footer className="cx-footer">
          Made for the people who make good food.
        </footer>
      </div>
    </div>
  );
}
function DishLibrary({
  state,
  refresh,
  onPhoto,
  onDestination,
}: {
  state: Row;
  refresh: () => Promise<void>;
  onPhoto: (id?: string, photoId?: string, destination?: string) => void;
  onDestination: (where: string, did: string, aid: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [format, setFormat] = useState<PhotoFormat>("menu"),
    [detail, setDetail] = useState<Row | null>(null),
    [chosen, setChosen] = useState("");
  const action = useAction(),
    { act, busy, setNotice } = action;
  const dishes = state.dishes.filter((d: Row) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );
  const images = detail
    ? state.assets.filter(
        (a: Row) =>
          a.dish_id === detail.id &&
          ["source", "generated", "edited"].includes(a.kind),
      )
    : [];
  const current =
    images.find((a: Row) => a.id === chosen) ||
    images.find((a: Row) => a.approved_at) ||
    images[0];
  return (
    <section className="cx-tool">
      <Heading eyebrow="MY DISHES" title="One dish. So many possibilities.">
        Your originals, approved photos and saved versions, all together.
      </Heading>
      <Feedback {...action} />
      <div className="cx-section-line">
        <input
          className="cx-search"
          type="search"
          placeholder="Find a dish…"
          aria-label="Search your dishes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="cx-btn" onClick={() => onPhoto()}>
          <Plus size={17} />
          Add a dish
        </button>
      </div>
      {selected.length > 0 && (
        <div className="cx-bulk-bar">
          <b>{selected.length} dishes selected</b>
          <Field label="Download format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as PhotoFormat)}
            >
              {Object.entries(formats)
                .filter(([id]) => id !== "doordash" && id !== "uber")
                .map(([id, f]) => (
                  <option value={id} key={id}>
                    {f.label}
                  </option>
                ))}
            </select>
          </Field>
          <button
            className="cx-btn cx-secondary"
            disabled={!!busy}
            onClick={() =>
              act("Preparing your photo collection", async () => {
                const { zipSync } = await import("fflate");
                const files: Record<string, Uint8Array> = {};
                for (const id of selected) {
                  const d = state.dishes.find((d: Row) => d.id === id),
                    a = state.assets.find(
                      (a: Row) => a.dish_id === id && a.approved_at,
                    );
                  if (!a) throw Error(`Approve a photo of ${d.name} first.`);
                  const result = await photoExport(a.id, format);
                  files[
                    `${d.name.replace(/[^a-z0-9]+/gi, "-")}-${id.slice(0, 6)}.jpg`
                  ] = new Uint8Array(await result.blob.arrayBuffer());
                }
                downloadBlob(
                  new Blob(
                    [zipSync(files, { level: 1 }) as Uint8Array<ArrayBuffer>],
                    { type: "application/zip" },
                  ),
                  "plateworthy-dishes.zip",
                );
                track("export_complete", undefined, {
                  format: "dish-zip",
                  count: selected.length,
                });
                setNotice("Your selected approved photos are downloaded.");
              })
            }
          >
            <Download size={16} />
            Download selected
          </button>
        </div>
      )}
      {!dishes.length ? (
        <div className="cx-empty-library">
          <Images size={32} />
          <h2>
            {search
              ? "No dishes match your search."
              : "Your dish library starts here."}
          </h2>
          <button className="cx-btn" onClick={() => onPhoto()}>
            Add a dish <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="cx-dish-grid">
          {dishes.map((d: Row) => {
            const a =
              state.assets.find(
                (a: Row) => a.dish_id === d.id && a.approved_at,
              ) || state.assets.find((a: Row) => a.dish_id === d.id);
            return (
              <article className="cx-dish-card cx-library-card" key={d.id}>
                <button
                  className="cx-dish-open"
                  onClick={() => {
                    setDetail({
                      ...d,
                      price: d.price / 100,
                      available: !!d.available,
                    });
                    setChosen(a?.id || "");
                  }}
                >
                  {a ? (
                    <img src={`/api/assets/${a.id}`} alt={d.name} />
                  ) : (
                    <div className="cx-dish-empty">
                      <UtensilsCrossed size={30} />
                    </div>
                  )}
                  <div>
                    <b>{d.name}</b>
                    <small>
                      {d.category} ·{" "}
                      {a?.approved_at ? "Approved" : "Ready for review"}
                    </small>
                  </div>
                </button>
                <label className="cx-library-select">
                  <input
                    type="checkbox"
                    aria-label={`Select ${d.name} for download`}
                    checked={selected.includes(d.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, d.id]
                          : selected.filter((id) => id !== d.id),
                      )
                    }
                  />
                </label>
              </article>
            );
          })}
        </div>
      )}
      {detail && (
        <div className="cx-panel cx-dish-detail">
          <div className="cx-section-line">
            <h2>{detail.name}</h2>
            <button className="cx-link" onClick={() => setDetail(null)}>
              Close details
            </button>
          </div>
          <div className="cx-studio-grid">
            <div>
              {current && (
                <img
                  className="cx-detail-photo"
                  src={`/api/assets/${current.id}`}
                  alt={detail.name}
                />
              )}
              <div className="cx-version-strip">
                {images.map((a: Row, n: number) => (
                  <button
                    key={a.id}
                    aria-pressed={current?.id === a.id}
                    onClick={() => setChosen(a.id)}
                  >
                    <img
                      src={`/api/assets/${a.id}`}
                      alt={
                        a.kind === "source"
                          ? "Original photo"
                          : `Version ${n + 1}`
                      }
                    />
                    <small>
                      {a.kind === "source"
                        ? "Original"
                        : a.approved_at
                          ? "Approved"
                          : "Review"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="cx-button-row">
                <button
                  className="cx-btn"
                  onClick={() => onPhoto(detail.id, current?.id || "")}
                >
                  {current ? "Review & adjust" : "Add a photo"}{" "}
                  <ArrowRight size={16} />
                </button>
                {current?.approved_at && (
                  <>
                    <button
                      className="cx-btn cx-secondary"
                      onClick={() =>
                        onDestination("menu", detail.id, current.id)
                      }
                    >
                      Use in menu
                    </button>
                    <button
                      className="cx-btn cx-secondary"
                      onClick={() =>
                        onDestination("post", detail.id, current.id)
                      }
                    >
                      Make a post
                    </button>
                    <button
                      className="cx-link"
                      disabled={!!busy}
                      onClick={() =>
                        act("Saving your photo", async () => {
                          const out = await photoExport(current.id, "menu");
                          downloadBlob(
                            out.blob,
                            `${detail.name.replace(/[^a-z0-9]+/gi, "-")}.jpg`,
                          );
                        })
                      }
                    >
                      Download photo
                    </button>
                  </>
                )}
              </div>
              {images.find((a: Row) => a.kind === "source") && (
                <a
                  className="cx-link"
                  download
                  href={`/api/assets/${images.find((a: Row) => a.kind === "source").id}?original=1&download=1`}
                >
                  Download untouched original
                </a>
              )}
            </div>
            <div>
              <Field label="Dish name">
                <input
                  value={detail.name}
                  maxLength={100}
                  onChange={(e) =>
                    setDetail({ ...detail, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Description">
                <textarea
                  value={detail.description}
                  maxLength={2000}
                  onChange={(e) =>
                    setDetail({ ...detail, description: e.target.value })
                  }
                />
              </Field>
              <Field label="Section">
                <input
                  value={detail.category}
                  maxLength={100}
                  onChange={(e) =>
                    setDetail({ ...detail, category: e.target.value })
                  }
                />
              </Field>
              <Field label={`Price (${state.restaurant.currency})`}>
                <input
                  type="number"
                  min="0"
                  step=".01"
                  value={detail.price}
                  onChange={(e) =>
                    setDetail({ ...detail, price: e.target.value })
                  }
                />
              </Field>
              <label className="cx-check">
                <input
                  type="checkbox"
                  checked={detail.available}
                  onChange={(e) =>
                    setDetail({ ...detail, available: e.target.checked })
                  }
                />
                Available to order
              </label>
              <button
                className="cx-btn cx-secondary"
                disabled={!!busy}
                onClick={() =>
                  act("Saving your dish details", async () => {
                    await api("dishes/" + detail.id, {
                      ...detail,
                      price: Number(detail.price),
                      confirmed: true,
                    });
                    await refresh();
                    setNotice(
                      "Dish details saved. Review and publish your menu to update what guests see.",
                    );
                  })
                }
              >
                Save dish details
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

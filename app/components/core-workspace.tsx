"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
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
} from "lucide-react";
import { api, downloadBlob, money, type Row } from "@/lib/client";
import { photoExport } from "@/lib/creation-export";
import { formats, type PhotoFormat } from "@/lib/studio";
import {
  hasSavedContent,
  readPreference,
  rememberPreference,
  resolveWorkspace,
  workspacePreferenceKey,
} from "@/lib/workspace-navigation";
import Brand from "./brand";
import { ConfirmDelete } from "./controls";
import PhotoStudio from "./photo-studio";
import MenuBuilder from "./menu-builder";
import PostMaker from "./post-maker";
import MenuTools from "./menu-tools";
import PromotionWorkspace from "./promotion-workspace";
import { Feedback, Field, Heading, track, useAction } from "./creation-shared";
export default function CoreWorkspace({
  state,
  refresh,
  onSettings,
  onPlans,
  onLogout,
  adminContent,
}: {
  state: Row;
  refresh: () => Promise<void>;
  onSettings: () => void;
  onPlans: () => void;
  onLogout: () => void;
  adminContent: ReactNode;
}) {
  const preferenceKey = workspacePreferenceKey(
    state.user.id,
    state.restaurant.id,
  );
  const [view, setView] = useState("loading"),
    [photoSeed, setPhotoSeed] = useState<Row | null>(null),
    [menuSeed, setMenuSeed] = useState<Row | null>(null),
    [postSeed, setPostSeed] = useState<Row | null>(null),
    [legacySeed, setLegacySeed] = useState<Row | null>(null),
    [visited, setVisited] = useState<string[]>([]),
    [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    let live = true;
    let request = 0;
    const show = (next: string) => {
      setView(next);
      setVisited((v) => (v.includes(next) ? v : [...v, next]));
      if (next !== "admin") rememberPreference(preferenceKey, next);
      if (location.hash !== "#" + next)
        history.replaceState(null, "", "#" + next);
    };
    const read = async () => {
      const current = ++request;
      const hash = location.hash;
      const next = resolveWorkspace(
        hash,
        readPreference(preferenceKey),
        state.user.role === "admin",
      );
      if (next) return show(next);
      // On another device, open the most recently saved useful draft.
      let fallback = "studio";
      try {
        const data = await api("creation-drafts");
        fallback = data.drafts.find(hasSavedContent)?.kind || "studio";
      } catch {
        // The studio still provides its own saved-work loading and error state.
      }
      if (live && current === request && location.hash === hash) show(fallback);
    };
    void read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    return () => {
      live = false;
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
    };
  }, [preferenceKey, state.user.role]);
  function navigate(next: string) {
    if (location.hash !== "#" + next) history.pushState(null, "", "#" + next);
    if (next !== "admin") rememberPreference(preferenceKey, next);
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
  const active = state.jobs.filter((j: Row) =>
    ["queued", "processing"].includes(j.status),
  );
  const nav = [
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
        <div className="cx-sidebar-heading">
          <button
            className="cx-brand"
            onClick={() => navigate("studio")}
            aria-label="Plateworthy Photo Studio"
          >
            <Brand />
          </button>
          <details
            className="cx-mobile-tools"
            onToggle={(e) => setMoreOpen(e.currentTarget.open)}
          >
            <summary
              role="button"
              aria-expanded={moreOpen}
              aria-label="More workspace options"
            >
              <SlidersHorizontal size={20} />
            </summary>
            <div>
              <span>{state.remaining} images remaining</span>
              <button onClick={onPlans}>
                {state.billing?.plan === "pro"
                  ? "Pro · Manage plan"
                  : "Free · View plans"}
              </button>
              <button onClick={onSettings}>Restaurant look & settings</button>
              <button onClick={() => navigate("tools")}>More tools</button>
              {state.user.role === "admin" && (
                <button onClick={() => navigate("admin")}>
                  Administration
                </button>
              )}
              <button onClick={onLogout}>Sign out</button>
            </div>
          </details>
        </div>
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
            <small>
              {state.billing?.plan === "pro"
                ? "Pro · Monthly allowance"
                : "Free · One-time allowance"}
            </small>
            <button className="cx-link" onClick={onPlans}>
              {state.billing?.plan === "pro"
                ? "Manage plan"
                : "Get Pro · $9.99/month"}
            </button>
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
              Administration
            </button>
          )}
          <button onClick={onLogout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="cx-body">
        <main
          id="creation-main"
          className={`cx-main${["studio", "menu", "post"].includes(view) ? " cx-feature-main" : ""}`}
        >
          {view === "loading" && (
            <p className="cx-feedback" role="status">
              Opening your workspace…
            </p>
          )}
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
                Staff photos, imports, earlier campaigns and activity.
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
    [chosen, setChosen] = useState(""),
    [deleting, setDeleting] = useState("");
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
                    <img
                      src={`/api/assets/${a.id}`}
                      alt={d.name}
                      loading="lazy"
                      decoding="async"
                    />
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
                      loading="lazy"
                      decoding="async"
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
                {current && (
                  <button
                    className="cx-link"
                    disabled={!!busy}
                    onClick={() => setDeleting(current.id)}
                  >
                    Delete this photo
                  </button>
                )}
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
      <ConfirmDelete
        open={!!deleting}
        onClose={() => setDeleting("")}
        onConfirm={() => {
          const photoId = deleting;
          setDeleting("");
          void act("Deleting photo", async () => {
            await api(`assets/${photoId}`, undefined, "DELETE");
            await refresh();
            setChosen("");
            setNotice(
              "Photo deleted. Any published menu using it has been updated.",
            );
          });
        }}
      />
    </section>
  );
}

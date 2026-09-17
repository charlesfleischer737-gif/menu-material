"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Compass,
  Images,
  Megaphone,
  Settings,
  LogOut,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type Row } from "@/lib/client";
import {
  hasSavedContent,
  readPreference,
  rememberPreference,
  resolveWorkspace,
  workspacePreferenceKey,
} from "@/lib/workspace-navigation";
import Brand from "./brand";
import PhotoStudio from "./photo-studio";
import { deferredWorkspace } from "./deferred-workspace";
import { Heading } from "./creation-shared";
const DishLibrary = deferredWorkspace(
  "My Dishes",
  () => import("./dish-library"),
);
const MenuBuilder = deferredWorkspace("Menus", () => import("./menu-builder"));
const PostMaker = deferredWorkspace("Post Maker", () => import("./post-maker"));
const MenuTools = deferredWorkspace("menu tools", () => import("./menu-tools"));
const ExploreGallery = deferredWorkspace(
  "Explore",
  () => import("./explore-gallery"),
);
const PromotionWorkspace = deferredWorkspace(
  "campaigns",
  () => import("./promotion-workspace"),
);
export default function CoreWorkspace({
  foreground = true,
  state,
  refresh,
  onSettings,
  onPlans,
  onLogout,
  adminContent,
}: {
  foreground?: boolean;
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
    setMoreOpen(false);
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
      setPostSeed({ token: crypto.randomUUID(), dishId, photoId, ...extra });
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
    ["explore", "Explore", Compass],
    ["library", "My Dishes", Images],
    ["post", "Post Maker", Megaphone],
    ["menu", "Menus", BookOpen],
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
            aria-label="Menu Material Photo Studio"
          >
            <Brand />
          </button>
          <details
            className="cx-mobile-tools"
            open={moreOpen}
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
              <span className="cx-nav-icon" aria-hidden="true">
                <Icon size={20} />
                {id === "studio" && active.length > 0 && (
                  <span className="cx-nav-dot" />
                )}
              </span>
              <span className="cx-nav-label">{label}</span>
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
      <div className={`cx-body${view === "explore" ? " cx-explore-body" : ""}`}>
        <main
          id="creation-main"
          className={`cx-main${["studio", "menu", "post"].includes(view) ? " cx-feature-main" : ""}${view === "explore" ? " cx-explore-main" : ""}`}
        >
          {view === "loading" && (
            <p className="cx-feedback" role="status">
              Opening your workspace…
            </p>
          )}
          {visited.includes("studio") && (
            <div hidden={view !== "studio"} aria-hidden={view !== "studio"}>
              <PhotoStudio
                active={foreground && view === "studio"}
                state={state}
                refresh={refresh}
                seed={photoSeed}
                onSeedUsed={() => setPhotoSeed(null)}
                onDestination={destination}
              />
            </div>
          )}
          {view === "explore" && (
            <div aria-hidden={false}>
              <ExploreGallery
                disabledStyleIds={state.studioAvailability?.disabledStyleIds}
                onTryStyle={(styleId) => {
                  setPhotoSeed({ token: crypto.randomUUID(), styleId });
                  navigate("studio");
                }}
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
                onImports={() => {
                  setMenuSeed({ token: crypto.randomUUID(), openImport: true });
                  navigate("menu");
                }}
                onOpenWork={(kind, draftId) => {
                  if (kind === "post") {
                    setPostSeed({ token: crypto.randomUUID(), draftId });
                    navigate("post");
                  } else {
                    setMenuSeed({ token: crypto.randomUUID(), draftId });
                    navigate("menu");
                  }
                }}
              />
            </div>
          )}
          {view === "tools" && (
            <>
              <Heading
                eyebrow="A LITTLE EXTRA HELP"
                title="Keep your kitchen moving."
              >
                Import an existing menu to organize your photos, refresh several
                dishes, or review your activity.
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

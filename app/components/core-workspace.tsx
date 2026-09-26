"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Camera,
  ChevronsUpDown,
  Compass,
  CreditCard,
  Images,
  Megaphone,
  Settings,
  LogOut,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, type Row } from "@/lib/client";
import { rememberScroll } from "@/lib/scroll-memory";
import {
  hasSavedContent,
  readPreference,
  rememberPreference,
  resolveWorkspace,
  workspacePreferenceKey,
} from "@/lib/workspace-navigation";
import Brand from "./brand";
import CreativeHeader from "./creative-header";
import WorkspacePlaceholder from "./workspace-placeholder";
import PhotoStudio from "./photo-studio";
import { deferredWorkspace } from "./deferred-workspace";
import { ProBadge } from "./pro-badge";
import { hasProFeatures } from "@/lib/upgrade";
const DishLibrary = deferredWorkspace(
  "My Dishes",
  () => import("./dish-library"),
);
const MenuBuilder = deferredWorkspace("Menus", () => import("./menu-studio"));
const PostMaker = deferredWorkspace("Post Maker", () => import("./post-maker"));
const MenuTools = deferredWorkspace(
  "More tools",
  () => import("./menu-tools"),
  true,
);
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
    [visited, setVisited] = useState<string[]>([]);
  const explorePosition = useRef(0);
  const exploreReturnStyle = useRef<string | null>(null);
  // Set when a section is chosen here rather than reached by Back or Forward.
  const chosen = useRef(false);
  useEffect(() => {
    let live = true;
    let request = 0;
    const show = (next: string) => {
      setView(next);
      setVisited((v) => (v.includes(next) ? v : [...v, next]));
      if (next !== "admin") rememberPreference(preferenceKey, next);
      const campaignLink =
        next === "campaigns" && /^#promotion\/[^/]+$/.test(location.hash);
      if (!campaignLink && location.hash !== "#" + next)
        history.replaceState(null, "", "#" + next);
    };
    const read = async () => {
      const current = ++request;
      chosen.current = false;
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
    if (view === "explore") explorePosition.current = window.scrollY;
    // Back returns to this section at this position.
    rememberScroll();
    chosen.current = true;
    if (location.hash !== "#" + next) history.pushState(null, "", "#" + next);
    if (next !== "admin") rememberPreference(preferenceKey, next);
    setView(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
  }
  useEffect(() => {
    const heading = Array.from(
      document.querySelectorAll<HTMLElement>(".cx-main h1"),
    ).find((element) => !element.closest("[hidden], [aria-hidden='true']"));
    const previousStyle =
      view === "explore" && exploreReturnStyle.current
        ? document.querySelector<HTMLElement>(
            `[data-explore-style="${CSS.escape(exploreReturnStyle.current)}"]`,
          )
        : null;
    (previousStyle || heading)?.focus({ preventScroll: true });
    // A section chosen here opens at the top, or for Explore where it was
    // left. Back, Forward and reload return to the saved position instead.
    if (!chosen.current) return;
    chosen.current = false;
    window.scrollTo({
      top: view === "explore" ? explorePosition.current : 0,
      behavior: "instant",
    });
  }, [view]);
  useEffect(() => {
    if (view !== "explore") return;
    const remember = () => {
      explorePosition.current = window.scrollY;
    };
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
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
    } else if (where === "promote") {
      // Campaigns open on this dish and photo (a preview on Free).
      const dish = state.dishes.find((d: Row) => d.id === dishId);
      setLegacySeed({
        title: dish?.name || "",
        description: dish?.description || "",
        price: dish?.price ?? 0,
        items: [{ dishId, photoId, quantity: 1 }],
      });
      navigate("campaigns");
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
  const shortLabels: Record<string, string> = {
    studio: "Studio",
    explore: "Explore",
    library: "Dishes",
    post: "Post",
    menu: "Menus",
  };
  // Pro features: a paid plan, a comp or a renewal being retried.
  const pro =
    state.billing?.plan === "pro" || state.billing?.features?.pro === true;
  const restaurantName = state.restaurant?.name || "Your restaurant";
  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="cx-account" aria-label="Account and settings">
          <span className="cx-avatar" aria-hidden="true">
            {restaurantName.trim().charAt(0).toUpperCase() || "M"}
          </span>
          <span className="cx-account-name">{restaurantName}</span>
          <ChevronsUpDown
            className="cx-account-chevron"
            size={16}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="cx-workspace-popover cx-account-menu"
        align="start"
        side="top"
        sideOffset={8}
      >
        <DropdownMenuLabel className="cx-account-label">
          <strong>{restaurantName}</strong>
          <span>{state.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem className="cx-account-credits" onSelect={onPlans}>
          <Sparkles size={16} aria-hidden="true" />
          {state.remaining} images left · {pro ? "Pro" : "Free"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSettings}>
          <Settings size={16} aria-hidden="true" />
          Restaurant look & settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPlans}>
          <CreditCard size={16} aria-hidden="true" />
          {pro ? "Manage plan" : "Plans"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => navigate("tools")}
          aria-current={view === "tools" ? "page" : undefined}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          More tools
        </DropdownMenuItem>
        {state.user.role === "admin" && (
          <DropdownMenuItem
            onSelect={() => navigate("admin")}
            aria-current={view === "admin" ? "page" : undefined}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            Administration
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
            <Brand reversedMedia="(min-width: 761px)" />
          </button>
          <div className="cx-mobile-account">{accountMenu}</div>
        </div>
        <nav className="cx-nav" aria-label="Workspace">
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
              <span className="cx-nav-label">
                <span className="cx-nav-full">{label}</span>
                <span className="cx-nav-short">{shortLabels[id]}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="cx-sidebar-bottom">
          <button className="cx-credits" onClick={onPlans}>
            <Sparkles size={15} aria-hidden="true" />
            <span>{state.remaining} images left</span>
            <span className="cx-plan-chip">{pro ? "Pro" : "Free"}</span>
          </button>
          {accountMenu}
        </div>
      </aside>
      <div className={`cx-body${view === "explore" ? " cx-explore-body" : ""}`}>
        <main
          id="creation-main"
          className={`cx-main${["studio", "menu", "post"].includes(view) ? " cx-feature-main" : ""}${view === "explore" ? " cx-explore-main" : ""}`}
        >
          {view === "loading" && (
            <WorkspacePlaceholder
              title="Your workspace"
              message="Opening your saved work…"
            />
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
          {visited.includes("explore") && (
            <div hidden={view !== "explore"} aria-hidden={view !== "explore"}>
              <ExploreGallery
                active={foreground && view === "explore"}
                disabledStyleIds={state.studioAvailability?.disabledStyleIds}
                timezone={state.restaurant?.timezone}
                onOpenStudio={() => navigate("studio")}
                onTryStyle={(styleId) => {
                  exploreReturnStyle.current = styleId;
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
                refresh={refresh}
                active={view === "post"}
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
              <CreativeHeader
                title="More tools"
                action={
                  <button
                    className="cx-link"
                    onClick={() => navigate("campaigns")}
                  >
                    Campaigns {!hasProFeatures(state) && <ProBadge />}
                    <ArrowRight size={16} />
                  </button>
                }
              />
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
      </div>
    </div>
  );
}

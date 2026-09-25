"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import MenuPhoto from "./menu-photo";
import { menuHero, menuAppearance } from "@/lib/menu-design";
import { scheduleLabel } from "@/lib/promotions";
import { money, Row } from "@/lib/client";
import { brandTypeface, readableBrandInk } from "@/lib/restaurant-look";
import MenuDocumentView, { useDishViews } from "./menu-document-view";
import CustomerMenuSwitcher from "./customer-menu-switcher";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DesignedMenu } from "@/lib/menu-document";
export default function MenuView({
  menu,
  slug,
  preview = false,
  serverNow = 0,
  onSelect,
  structuredData,
}: {
  menu: Row;
  slug?: string;
  preview?: boolean;
  serverNow?: number;
  onSelect?: (dishId: string) => void;
  /**
   * The page's schema.org JSON-LD. It's rendered here, beside the menu, so
   * the page has a single root: as a separately streamed sibling on the page
   * it hydrated in a different tree position, and every generated id
   * (aria-controls, section anchors) mismatched the server's.
   */
  structuredData?: string;
}) {
  const view =
    menu.version === 2 ? (
      <MenuDocumentView
        menu={menu as DesignedMenu}
        slug={slug}
        preview={preview}
        onSelect={onSelect}
      />
    ) : (
      <LegacyMenuView
        menu={menu}
        slug={slug}
        preview={preview}
        serverNow={serverNow}
        onSelect={onSelect}
      />
    );
  if (!structuredData) return view;
  return (
    <>
      {view}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </>
  );
}
function LegacyMenuView({
  menu: initialMenu,
  slug,
  preview = false,
  serverNow = 0,
  onSelect,
}: {
  menu: Row;
  slug?: string;
  preview?: boolean;
  serverNow?: number;
  onSelect?: (dishId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sectionTarget, setSectionTarget] = useState<{ index: number } | null>(
      null,
    ),
    [activeSection, setActiveSection] = useState("0"),
    [sectionsOverflow, setSectionsOverflow] = useState(false),
    [sectionsAtEnd, setSectionsAtEnd] = useState(false);
  const [liveMenu, setMenu] = useState(initialMenu),
    [time, setTime] = useState(serverNow),
    [unavailable, setUnavailable] = useState(false);
  const serverClock = useRef({ server: serverNow, local: 0 }),
    article = useRef<HTMLElement>(null),
    sectionLinks = useRef<HTMLDivElement>(null),
    session = useRef("");
  const menuId = useId();
  const menu = preview ? initialMenu : liveMenu;
  const hero = menuHero(menu);
  useEffect(() => {
    if (!sectionTarget) return;
    const heading = article.current?.querySelector<HTMLElement>(
      `[data-menu-section="${sectionTarget.index}"] h2`,
    );
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  }, [sectionTarget]);
  useEffect(() => {
    const list = sectionLinks.current;
    if (!list) return;
    const measure = () => {
      setSectionsOverflow(list.scrollWidth > list.clientWidth + 2);
      setSectionsAtEnd(
        list.scrollLeft + list.clientWidth >= list.scrollWidth - 2,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [menu.sections]);
  useEffect(() => {
    const list = sectionLinks.current;
    const current = list?.querySelector<HTMLElement>(
      '[aria-current="location"]',
    );
    if (!list || !current) return;
    const rail = list.getBoundingClientRect();
    const button = current.getBoundingClientRect();
    // Reveal the current section without moving the page or stealing focus.
    if (button.left < rail.left + 3)
      list.scrollBy({ left: button.left - rail.left - 3, behavior: "instant" });
    else if (button.right > rail.right - 3)
      list.scrollBy({
        left: button.right - rail.right + 3,
        behavior: "instant",
      });
  }, [activeSection]);
  useEffect(() => {
    if (preview || !article.current) return;
    const targets = Array.from(
      article.current.querySelectorAll<HTMLElement>("[data-menu-section]"),
    );
    let frame = 0;
    const measure = () => {
      frame = 0;
      const atEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      const current = atEnd
        ? targets.at(-1)
        : targets
            .filter(
              (target) =>
                target.getBoundingClientRect().top <= window.innerHeight * 0.25,
            )
            .at(-1) || targets[0];
      setActiveSection(current?.dataset.menuSection || "");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [menu.sections, search, preview]);
  const track = useCallback(
    (kind: string, entityIds?: string[]) => {
      if (preview || !slug || !session.current) return;
      void fetch(`/api/public/${slug}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, entityIds, session: session.current }),
        keepalive: true,
      }).catch(() => {});
    },
    [preview, slug],
  );
  useEffect(() => {
    if (preview || !slug || menu.version === 2) return;
    try {
      session.current =
        sessionStorage.getItem("menu-session:" + slug) || crypto.randomUUID();
      sessionStorage.setItem("menu-session:" + slug, session.current);
    } catch {
      session.current = crypto.randomUUID();
    }
    serverClock.current.local = Date.now();
    track("menu_visit");
    const clock = setInterval(
      () =>
        setTime(
          serverClock.current.server + Date.now() - serverClock.current.local,
        ),
      1000,
    );
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const selected = new URLSearchParams(location.search).get("menu");
        const res = await fetch(
          "/api/public/" +
            slug +
            (selected ? `?menu=${encodeURIComponent(selected)}` : ""),
          { cache: "no-store" },
        );
        if (res.status === 404) {
          setUnavailable(true);
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as Row;
        serverClock.current = { server: data.serverNow, local: Date.now() };
        setTime(data.serverNow);
        setMenu(data.menu);
        setUnavailable(false);
      } catch {}
    };
    const interval = setInterval(refresh, 20000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(clock);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [slug, preview, track, menu.version]);
  useDishViews(
    article,
    "dish",
    !preview && slug ? (ids) => track("dish_view", ids) : null,
  );
  if (unavailable)
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <p>Please check with the restaurant.</p>
      </main>
    );
  if (menu.version === 2)
    return (
      <MenuDocumentView
        menu={menu as DesignedMenu}
        slug={slug}
        preview={preview}
        onSelect={onSelect}
      />
    );
  return (
    <article
      role={preview ? undefined : "main"}
      aria-label={preview ? undefined : `${menu.restaurant.name} menu`}
      className={`customer-menu menu-designed menu-art-directed menu-design-${menu.design || "bistro"} menu-density-${menu.density || "comfortable"} menu-layout-${menu.layout || "classic"} menu-appearance-${menuAppearance(menu)}`}
      style={
        {
          "--menu-brand":
            readableBrandInk(menu.restaurant.style?.primary || "#235b48") ===
            "#ffffff"
              ? menu.restaurant.style?.primary || "#235b48"
              : "#203b2c",
          "--menu-accent": menu.restaurant.style?.accent || "#f0e3c3",
          "--menu-accent-ink": readableBrandInk(
            menu.restaurant.style?.accent || "#f0e3c3",
          ),
          "--menu-heading-font": `"${brandTypeface(menu.restaurant.style).family}"`,
        } as React.CSSProperties
      }
      ref={article}
    >
      <header className={hero ? "has-hero" : ""}>
        {hero && (
          <div className="menu-hero-photo">
            <MenuPhoto
              photoId={hero.photoId}
              crop={hero.crop}
              featured
              priority
              slug={preview ? undefined : slug}
              alt={hero.name}
            />
            {onSelect && (
              <button
                className="mm-menu-edit-target"
                aria-label={`Edit ${hero.name}`}
                onClick={() => onSelect(hero.id)}
              />
            )}
          </div>
        )}
        <div className="menu-identity">
          {menu.restaurant.logoId ? (
            <img
              className="menu-logo"
              src={
                preview
                  ? `/api/assets/${menu.restaurant.logoId}`
                  : `/api/public/${slug}/assets/${menu.restaurant.logoId}`
              }
              alt="Restaurant logo"
            />
          ) : null}
          {!menu.restaurant.logoId && (
            <span className="menu-monogram" aria-hidden="true">
              {String(menu.restaurant.name)
                .split(/\s+/)
                .filter((w: string) => /[a-z]/i.test(w))
                .slice(0, 2)
                .map((w: string) => w[0])
                .join("")}
            </span>
          )}
          <h1>{menu.restaurant.name}</h1>
          <p>{menu.title || menu.restaurant.cuisine}</p>
          {menu.restaurant.orderingUrl && (
            <a
              className="order-button"
              href={menu.restaurant.orderingUrl}
              onClick={() => track("ordering_click")}
              rel="noreferrer"
            >
              Order from {menu.restaurant.name}
            </a>
          )}
        </div>
        {hero && (
          <div className="menu-hero-caption">
            <span>{hero.name}</span>
            <span>
              {Number.isFinite(hero.price)
                ? money(hero.price, menu.restaurant.currency)
                : ""}
            </span>
          </div>
        )}
      </header>
      {!preview && menu.menus?.length > 1 && (
        <CustomerMenuSwitcher
          menus={menu.menus}
          currentId={
            menu.documentId || menu.menus.find((m: Row) => m.isPrimary)?.id
          }
          slug={slug!}
          className="menu-document-switcher"
        />
      )}
      {(menu.sections.length > 3 ||
        menu.sections.reduce((n: number, s: Row) => n + s.items.length, 0) >
          12) && (
        <nav className="mm-guest-nav" aria-label="Find a dish">
          <input
            aria-label="Search menu"
            type="search"
            placeholder="Find a dish…"
            aria-controls={`${menuId}-items`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mm-guest-section-navigation">
            <div
              className="mm-guest-section-links"
              ref={sectionLinks}
              onScroll={(event) => {
                const list = event.currentTarget;
                setSectionsAtEnd(
                  list.scrollLeft + list.clientWidth >= list.scrollWidth - 2,
                );
              }}
            >
              {menu.sections.map((s: Row, n: number) => (
                <button
                  key={s.id}
                  aria-current={
                    activeSection === String(n) ? "location" : undefined
                  }
                  aria-controls={
                    !search ||
                    s.items.some((d: Row) =>
                      `${d.name} ${d.description || ""} ${s.name}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                      ? `${menuId}-section-${n}`
                      : undefined
                  }
                  onClick={() => {
                    setSearch("");
                    setActiveSection(String(n));
                    setSectionTarget({ index: n });
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {sectionsOverflow && (
              <button
                className="mm-guest-sections-more"
                aria-label={
                  sectionsAtEnd
                    ? "Back to first sections"
                    : "Show more sections"
                }
                onClick={() => {
                  const list = sectionLinks.current;
                  if (!list) return;
                  const behavior = matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth";
                  if (sectionsAtEnd) list.scrollTo({ left: 0, behavior });
                  else
                    list.scrollBy({ left: list.clientWidth * 0.8, behavior });
                }}
              >
                {sectionsAtEnd ? (
                  <ChevronLeft size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            )}
          </div>
        </nav>
      )}
      {(menu.specials || [])
        .filter((s: Row) => !s.endsAt || s.endsAt > time)
        .map((special: Row) => (
          <section className="customer-special" key={special.id}>
            <p className="eyebrow">SPECIAL OFFER</p>
            <div className="dish-title">
              <h2>{special.title}</h2>
              <b>{money(special.price, menu.restaurant.currency)}</b>
            </div>
            <p>{special.description}</p>
            <div className="customer-special-photos">
              {special.items.map((item: Row) => (
                <figure key={item.dishId} data-dish={item.dishId}>
                  <img
                    src={
                      preview
                        ? `/api/assets/${item.photoId}`
                        : `/api/public/${slug}/assets/${item.photoId}`
                    }
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>
                    {item.quantity} × {item.name}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="fine">
              {scheduleLabel(
                special.startsAt,
                special.endsAt,
                special.timezone,
              )}
            </p>
          </section>
        ))}
      <div className="menu-sections" id={`${menuId}-items`}>
        {menu.sections.map((section: Row, sectionIndex: number) => {
          const dishes = section.items.filter((d: Row) =>
            `${d.name} ${d.description || ""} ${section.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          );
          return (
            !!dishes.length && (
              <section
                key={section.id}
                id={`${menuId}-section-${sectionIndex}`}
                data-menu-section={sectionIndex}
              >
                <header className="menu-section-heading">
                  <span aria-hidden="true">
                    {String(sectionIndex + 1).padStart(2, "0")}
                  </span>
                  <h2 tabIndex={-1}>{section.name}</h2>
                </header>
                <div className="menu-section-body">
                  {dishes.map((dish: Row, index: number) => {
                    const featured =
                      menu.layout === "featured" &&
                      (dish.featured ?? section.items[0] === dish);
                    return (
                      <div
                        className={`customer-dish ${!dish.available ? "sold-out" : ""} ${featured ? "is-featured" : ""} ${onSelect ? "is-editable" : ""}`}
                        key={dish.id + index}
                        data-dish={dish.id}
                      >
                        <div className="mm-menu-dish-copy">
                          <div className="dish-title">
                            <h3>{dish.name}</h3>
                            <span>
                              {Number.isFinite(dish.price)
                                ? money(dish.price, menu.restaurant.currency)
                                : "—"}
                            </span>
                          </div>
                          {dish.description && <p>{dish.description}</p>}
                          {!dish.available && (
                            <span className="tag">Currently unavailable</span>
                          )}
                        </div>
                        {dish.photoId &&
                          dish.photoId !== hero?.photoId &&
                          (menu.layout === "grid" || featured) && (
                            <MenuPhoto
                              photoId={dish.photoId}
                              crop={dish.crop}
                              featured={featured}
                              slug={preview ? undefined : slug}
                              alt={dish.name}
                            />
                          )}
                        {onSelect && (
                          <button
                            className="mm-menu-edit-target"
                            aria-label={`Edit ${dish.name}`}
                            onClick={() => onSelect(dish.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )
          );
        })}
      </div>
      {search &&
        !menu.sections.some((s: Row) =>
          s.items.some((d: Row) =>
            `${d.name} ${d.description || ""} ${s.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          ),
        ) && <p className="mm-menu-no-results">No dishes match “{search}”.</p>}
      <footer>Made with Menu Material</footer>
    </article>
  );
}

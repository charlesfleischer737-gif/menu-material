"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Row } from "@/lib/client";
import { scheduleLabel } from "@/lib/promotions";
import {
  entryPrice,
  menuPrice,
  visibleMenuSections,
  type DesignedMenu,
} from "@/lib/menu-document";
import {
  menuDesignSpec,
  menuFontFamilies,
  menuTheme,
} from "@/lib/menu-design-system";
import MenuPhoto from "./menu-photo";
import CustomerMenuSwitcher from "./customer-menu-switcher";
import { ChevronLeft, ChevronRight } from "lucide-react";

type GuestMenu = DesignedMenu & {
  menus?: { id: string; name: string }[];
  specials?: Row[];
  serverNow?: number;
};
export default function MenuDocumentView({
  menu: initial,
  preview = false,
  slug,
  onSelect,
}: {
  menu: GuestMenu;
  preview?: boolean;
  slug?: string;
  onSelect?: (id: string) => void;
}) {
  const [live, setLive] = useState(initial),
    [search, setSearch] = useState(""),
    [sectionTarget, setSectionTarget] = useState<{ id: string } | null>(null),
    [activeSection, setActiveSection] = useState(""),
    [sectionsOverflow, setSectionsOverflow] = useState(false),
    [sectionsAtEnd, setSectionsAtEnd] = useState(false),
    [unavailable, setUnavailable] = useState(false),
    [time, setTime] = useState(initial.serverNow || 0);
  const root = useRef<HTMLElement>(null),
    sectionLinks = useRef<HTMLDivElement>(null),
    session = useRef("");
  const menuId = useId();
  const menu = preview ? initial : live,
    theme = menuTheme(menu),
    spec = menuDesignSpec(menu.design),
    sections = visibleMenuSections(menu);
  const query = search.trim();
  const hero =
    menu.layout === "featured"
      ? sections
          .flatMap((s) => s.items)
          .find((i) => i.featured && i.photoId && i.available)
      : undefined;
  const asset = (id: string) =>
    slug && !preview ? `/api/public/${slug}/assets/${id}` : `/api/assets/${id}`;
  const track = useCallback(
    (kind: string, entityId?: string) => {
      if (preview || !slug || !session.current) return;
      void fetch(
        `/api/public/${slug}/events${menu.documentId ? `?menu=${menu.documentId}` : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, entityId, session: session.current }),
          keepalive: true,
        },
      ).catch(() => {});
    },
    [preview, slug, menu.documentId],
  );
  useEffect(() => {
    if (!sectionTarget) return;
    // Wait for the cleared search to render before moving keyboard focus.
    const heading = root.current?.querySelector<HTMLElement>(
      `[data-section="${CSS.escape(sectionTarget.id)}"] h2`,
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
    if (preview || !root.current) return;
    const targets = Array.from(
      root.current.querySelectorAll<HTMLElement>("[data-section]"),
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
      setActiveSection(current?.dataset.section || "");
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
  }, [menu.sections, preview, query]);
  useEffect(() => {
    if (preview || !live.specials?.length) return;
    const local = Date.now(),
      server = live.serverNow || local;
    const timer = setInterval(() => setTime(server + Date.now() - local), 1000);
    return () => clearInterval(timer);
  }, [preview, live]);
  useEffect(() => {
    if (preview || !slug) return;
    try {
      const key = `menu-session:${slug}`;
      session.current = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, session.current);
    } catch {
      session.current = crypto.randomUUID();
    }
    track("menu_visit");
    const requestedMenu = new URLSearchParams(location.search).get("menu");
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(
          `/api/public/${slug}${requestedMenu ? `?menu=${encodeURIComponent(requestedMenu)}` : ""}`,
          { cache: "no-store" },
        );
        if (res.status === 404) {
          setUnavailable(true);
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { menu: GuestMenu };
          setLive(data.menu);
          setUnavailable(false);
        }
      } catch {
        /* Keep the most recent menu during a temporary connection failure. */
      }
    };
    const timer = setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [slug, initial.documentId, preview, track]);
  useEffect(() => {
    if (preview || !slug || !root.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            track("dish_view", (e.target as HTMLElement).dataset.entry);
            observer.unobserve(e.target);
          }
      },
      { threshold: 0.5 },
    );
    root.current
      .querySelectorAll("[data-entry]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [live, preview, slug, track]);
  if (unavailable)
    return (
      <main className="unavailable">
        <h1>This menu isn’t available right now.</h1>
        <p>Please check with the restaurant.</p>
        {slug && <a href={`/m/${slug}`}>View the restaurant’s current menu</a>}
      </main>
    );
  const filtered = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) =>
        `${s.name} ${i.name} ${i.description} ${i.dietary.join(" ")}`
          .toLocaleLowerCase(menu.language)
          .includes(query.toLocaleLowerCase(menu.language)),
      ),
    }))
    .filter((s) => s.items.length);
  const resultCount = filtered.reduce((n, s) => n + s.items.length, 0);
  const Surface = preview ? "article" : "main";
  return (
    <Surface
      ref={root}
      className={`md-guest md-design-${menu.design} md-density-${menu.density} ${onSelect ? "md-editable" : ""}`}
      lang={menu.language}
      aria-label={`${menu.restaurant.name} ${menu.title}`}
      style={
        {
          "--md-paper": theme.background,
          "--md-ink": theme.ink,
          "--md-muted": theme.muted,
          "--md-accent": theme.accent,
          "--md-rule": theme.rule,
          "--md-subtle": theme.subtle,
          "--md-on-accent": theme.onAccent,
          "--md-heading": menuFontFamilies[spec.heading],
          "--md-item": menuFontFamilies[spec.item],
        } as React.CSSProperties
      }
    >
      <header className={`md-guest-header ${hero ? "has-photo" : ""}`}>
        {menu.showLogo &&
          (menu.restaurant.logoId || menu.restaurant.logo_id) && (
            <img
              className="md-guest-logo"
              src={asset((menu.restaurant.logoId || menu.restaurant.logo_id)!)}
              alt={`${menu.restaurant.name} logo`}
            />
          )}
        <h1>{menu.restaurant.name}</h1>
        <p className="md-guest-title">{menu.title}</p>
        {menu.subtitle && <p className="md-guest-intro">{menu.subtitle}</p>}
        {menu.fixedPrice != null && (
          <p className="md-guest-fixed">
            {menuPrice(
              menu.fixedPrice,
              menu.restaurant.currency,
              menu.priceFormat,
              menu.language,
            )}{" "}
            <span>{menu.fixedPriceLabel}</span>
          </p>
        )}
        {hero?.photoId && (
          <div className="md-guest-hero">
            <MenuPhoto
              photoId={hero.photoId}
              crop={hero.crop}
              alt={hero.name}
              featured
              priority
              slug={preview ? undefined : slug}
            />
            <span>{hero.name}</span>
            {onSelect && (
              <button
                className="md-item-select"
                aria-label={`Edit ${hero.name}`}
                onClick={() => onSelect(hero.id)}
              />
            )}
          </div>
        )}
        {!preview && menu.restaurant.orderingUrl && (
          <a
            className="md-order"
            href={menu.restaurant.orderingUrl}
            onClick={() => track("ordering_click")}
          >
            Order online
          </a>
        )}
      </header>
      {!preview && !!menu.menus && menu.menus.length > 1 && (
        <CustomerMenuSwitcher
          menus={menu.menus}
          currentId={menu.documentId}
          slug={slug!}
          className="md-menu-switcher"
        />
      )}
      {(sections.length > 3 ||
        sections.reduce((n, s) => n + s.items.length, 0) > 12) && (
        <nav className="md-guest-nav" aria-label="Find a menu item">
          <input
            type="search"
            aria-label="Search this menu"
            placeholder="Search the menu…"
            aria-controls={`${menuId}-items`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="md-section-navigation">
            <div
              className="md-section-links"
              ref={sectionLinks}
              onScroll={(event) => {
                const list = event.currentTarget;
                setSectionsAtEnd(
                  list.scrollLeft + list.clientWidth >= list.scrollWidth - 2,
                );
              }}
            >
              {sections.map((s) => (
                <button
                  key={s.id}
                  aria-current={
                    (activeSection || sections[0]?.id) === s.id
                      ? "location"
                      : undefined
                  }
                  aria-controls={
                    filtered.some((section) => section.id === s.id)
                      ? `${menuId}-${s.id}`
                      : undefined
                  }
                  onClick={() => {
                    setSearch("");
                    setActiveSection(s.id);
                    setSectionTarget({ id: s.id });
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            {sectionsOverflow && (
              <button
                className="md-sections-more"
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
          <p
            className="md-guest-search-status"
            role="status"
            aria-atomic="true"
          >
            {query
              ? `${resultCount} ${resultCount === 1 ? "item matches" : "items match"} “${query}”.`
              : `All ${resultCount} items shown.`}
          </p>
        </nav>
      )}
      {!preview && !!menu.specials?.length && (
        <div className="md-guest-specials">
          {menu.specials
            .filter((s) => !s.endsAt || s.endsAt > time)
            .map((s) => (
              <section key={s.id}>
                <span>Special offer</span>
                <div>
                  <h2>{s.title}</h2>
                  <strong>
                    {menuPrice(
                      s.price,
                      menu.restaurant.currency,
                      menu.priceFormat,
                      menu.language,
                    )}
                  </strong>
                </div>
                <p>{s.description}</p>
                <div className="md-special-photos">
                  {s.items.map((i: Row) => (
                    <figure data-entry={i.dishId} key={i.dishId}>
                      <img
                        src={asset(i.photoId)}
                        alt={i.name}
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption>
                        {i.quantity} × {i.name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <small>{scheduleLabel(s.startsAt, s.endsAt, s.timezone)}</small>
              </section>
            ))}
        </div>
      )}
      <div className="md-guest-sections" id={`${menuId}-items`}>
        {filtered.map((section) => (
          <section key={section.id} data-section={section.id}>
            <header>
              <h2 id={`${menuId}-${section.id}`} tabIndex={-1}>
                {section.name}
              </h2>
              {section.description && <p>{section.description}</p>}
            </header>
            <div>
              {section.items.map((item) => (
                <div
                  className={`md-guest-item ${!item.available ? "is-unavailable" : ""}`}
                  data-entry={item.id}
                  key={item.id}
                >
                  {item.photoId &&
                    item.photoId !== hero?.photoId &&
                    (menu.layout === "grid" ||
                      (menu.layout === "featured" && item.featured)) && (
                      <MenuPhoto
                        photoId={item.photoId}
                        crop={item.crop}
                        alt={item.name}
                        slug={preview ? undefined : slug}
                        featured
                      />
                    )}
                  <div
                    className="md-guest-item-title"
                    data-price-mode={item.priceMode}
                  >
                    <h3>{item.name || "Untitled dish"}</h3>
                    {entryPrice(item, menu) && (
                      <span>{entryPrice(item, menu)}</span>
                    )}
                  </div>
                  {item.description && <p>{item.description}</p>}
                  {!!item.variants.length && item.priceMode === "variants" && (
                    <dl
                      className="md-guest-prices"
                      data-options={item.variants.length}
                    >
                      {item.variants.map((v) => (
                        <div key={v.id}>
                          <dt>{v.label}</dt>
                          <dd>
                            {menuPrice(
                              v.price,
                              menu.restaurant.currency,
                              menu.priceFormat,
                              menu.language,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {!!item.additions.length && (
                    <dl className="md-guest-additions">
                      {item.additions.map((v) => (
                        <div key={v.id}>
                          <dt>+ {v.label}</dt>
                          <dd>
                            {menuPrice(
                              v.price,
                              menu.restaurant.currency,
                              menu.priceFormat,
                              menu.language,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {!!item.dietary.length && (
                    <p className="md-guest-dietary">
                      {item.dietary.join(" · ")}
                    </p>
                  )}
                  {!item.available && (
                    <p className="md-guest-unavailable">
                      Currently unavailable
                    </p>
                  )}
                  {onSelect && (
                    <button
                      className="md-item-select"
                      aria-label={`Edit ${item.name || "dish"}`}
                      onClick={() => onSelect(item.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!filtered.length && (
        <p className="md-guest-empty">
          {query
            ? `No menu items match “${query}”.`
            : "Your dishes will appear here."}
        </p>
      )}
      {menu.footer && (
        <footer className="md-guest-footer">{menu.footer}</footer>
      )}
      {!preview && (
        <div className="md-guest-credit">Made with Menu Material</div>
      )}
    </Surface>
  );
}

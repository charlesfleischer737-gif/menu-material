"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import MenuPhoto from "./menu-photo";
import { menuHero, menuAppearance } from "@/lib/menu-design";
import { scheduleLabel } from "@/lib/promotions";
import { money, Row } from "@/lib/client";
import { brandTypeface, readableBrandInk } from "@/lib/restaurant-look";
import MenuDocumentView from "./menu-document-view";
import type { DesignedMenu } from "@/lib/menu-document";
export default function MenuView({
  menu,
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
    <LegacyMenuView
      menu={menu}
      slug={slug}
      preview={preview}
      serverNow={serverNow}
      onSelect={onSelect}
    />
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
  const [liveMenu, setMenu] = useState(initialMenu),
    [time, setTime] = useState(serverNow),
    [unavailable, setUnavailable] = useState(false);
  const serverClock = useRef({ server: serverNow, local: 0 }),
    article = useRef<HTMLElement>(null),
    session = useRef("");
  const menu = preview ? initialMenu : liveMenu;
  const hero = menuHero(menu);
  const track = useCallback(
    (kind: string, entityId?: string) => {
      if (preview || !slug || !session.current) return;
      void fetch(`/api/public/${slug}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, entityId, session: session.current }),
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
  useEffect(() => {
    if (preview || !slug || !article.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            track("dish_view", (entry.target as HTMLElement).dataset.dish);
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.5 },
    );
    article.current
      .querySelectorAll("[data-dish]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [menu, preview, slug, track]);
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
        <nav className="menu-document-switcher" aria-label="Our menus">
          {menu.menus.map((m: Row) => (
            <a
              key={m.id}
              href={`/m/${slug}?menu=${m.id}`}
              aria-current={
                m.id === menu.documentId || (!menu.documentId && m.isPrimary)
                  ? "page"
                  : undefined
              }
            >
              {m.name}
            </a>
          ))}
        </nav>
      )}
      {(menu.sections.length > 3 ||
        menu.sections.reduce((n: number, s: Row) => n + s.items.length, 0) >
          12) && (
        <nav className="mm-guest-nav" aria-label="Find a dish">
          <input
            aria-label="Search menu"
            type="search"
            placeholder="Find a dish…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div>
            {menu.sections.map((s: Row, n: number) => (
              <button
                key={s.id}
                onClick={() => {
                  setSearch("");
                  requestAnimationFrame(() =>
                    article.current
                      ?.querySelector(`[data-menu-section="${n}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
              >
                {s.name}
              </button>
            ))}
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
      <div className="menu-sections">
        {menu.sections.map((section: Row, sectionIndex: number) => {
          const dishes = section.items.filter((d: Row) =>
            `${d.name} ${d.description || ""} ${section.name}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          );
          return (
            !!dishes.length && (
              <section key={section.id} data-menu-section={sectionIndex}>
                <header className="menu-section-heading">
                  <span aria-hidden="true">
                    {String(sectionIndex + 1).padStart(2, "0")}
                  </span>
                  <h2>{section.name}</h2>
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

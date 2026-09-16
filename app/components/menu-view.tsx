"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { scheduleLabel } from "@/lib/promotions";
import { money, Row } from "@/lib/client";
import { brandTypeface, readableBrandInk } from "@/lib/restaurant-look";
export default function MenuView({
  menu: initialMenu,
  slug,
  preview = false,
  serverNow = 0,
}: {
  menu: Row;
  slug?: string;
  preview?: boolean;
  serverNow?: number;
}) {
  const [liveMenu, setMenu] = useState(initialMenu),
    [time, setTime] = useState(serverNow),
    [unavailable, setUnavailable] = useState(false);
  const serverClock = useRef({ server: serverNow, local: 0 }),
    article = useRef<HTMLElement>(null),
    session = useRef("");
  const menu = preview ? initialMenu : liveMenu;
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
    if (preview || !slug) return;
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
      try {
        const res = await fetch("/api/public/" + slug, { cache: "no-store" });
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
  }, [slug, preview, track]);
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
  return (
    <article
      className={`customer-menu menu-layout-${menu.layout || "classic"} menu-appearance-${menu.appearance || "light"}`}
      style={
        {
          "--menu-brand":
            readableBrandInk(menu.restaurant.style?.primary || "#235b48") ===
            "#ffffff"
              ? menu.restaurant.style?.primary || "#235b48"
              : "#203b2c",
          "--menu-accent": menu.restaurant.style?.accent || "#f0e3c3",
          "--menu-heading-font": `"${brandTypeface(menu.restaurant.style).family}"`,
        } as React.CSSProperties
      }
      ref={article}
    >
      <header>
        {preview && <p className="eyebrow">PRIVATE PREVIEW</p>}
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
        ) : (
          <UtensilsCrossed className="menu-mark" />
        )}
        <h1>{menu.restaurant.name}</h1>
        <p>{menu.restaurant.cuisine}</p>
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
      </header>
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
      {menu.sections.map((section: Row) => (
        <section key={section.id}>
          <h2>{section.name}</h2>
          {section.items.map((dish: Row, index: number) => (
            <div
              className={"customer-dish " + (!dish.available ? "sold-out" : "")}
              key={dish.id + index}
              data-dish={dish.id}
            >
              <div>
                <div className="dish-title">
                  <h3>{dish.name}</h3>
                  <span>{money(dish.price, menu.restaurant.currency)}</span>
                </div>
                <p>{dish.description}</p>
                {!dish.available && (
                  <span className="tag">Currently unavailable</span>
                )}
              </div>
              {dish.photoId && (
                <img
                  src={
                    preview
                      ? `/api/assets/${dish.photoId}`
                      : `/api/public/${slug}/assets/${dish.photoId}`
                  }
                  alt={dish.name}
                />
              )}
            </div>
          ))}
        </section>
      ))}
      <footer>Made with Plateworthy</footer>
    </article>
  );
}

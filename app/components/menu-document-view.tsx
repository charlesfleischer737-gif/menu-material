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
import {
  allergyNotice,
  containsText,
  dietTags,
  dietaryParts,
  suitsDiet,
} from "@/lib/dietary";
import CustomerMenuSwitcher from "./customer-menu-switcher";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  ShoppingBag,
} from "lucide-react";
import {
  dayName,
  directionsHref,
  formatTime,
  openingStatus,
  telephoneHref,
  type MenuContact,
} from "@/lib/restaurant-contact";
import { isMenuPlacement } from "@/lib/menu-placements";

/** "Vegetarian · Gluten-free · Contains: milk, egg", for search. */
function guestDietary(values: string[]) {
  const { diets, allergens, notes } = dietaryParts(values);
  return [...diets.map((tag) => tag.label), containsText(allergens), ...notes]
    .filter(Boolean)
    .join(" · ");
}
/**
 * A dish's tags as guests read them: what it suits (with the owner's own
 * notes), then its allergens on a line of their own, "Contains: milk, egg".
 */
function DishDietary({ values }: { values: string[] }) {
  const { diets, allergens, notes } = dietaryParts(values);
  const suits = [...diets.map((tag) => tag.label), ...notes].join(" · ");
  return (
    <>
      {suits && <p className="md-guest-dietary">{suits}</p>}
      {!!allergens.length && (
        <p className="md-guest-dietary md-guest-contains">
          {containsText(allergens)}
        </p>
      )}
    </>
  );
}
type GuestMenu = DesignedMenu & {
  contact?: MenuContact;
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
    [diets, setDiets] = useState<string[]>([]),
    [time, setTime] = useState(initial.serverNow || 0);
  const root = useRef<HTMLElement>(null),
    sectionLinks = useRef<HTMLDivElement>(null),
    session = useRef(""),
    placement = useRef<string | null>(null);
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
          body: JSON.stringify({
            kind,
            entityId,
            session: session.current,
            ...(placement.current ? { src: placement.current } : {}),
          }),
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
  const hasHours = menu.contact?.hours?.length === 7,
    hasSpecials = !preview && !!live.specials?.length,
    serverNow = preview ? 0 : live.serverNow;
  useEffect(() => {
    if (!hasSpecials && !hasHours) return;
    // Server time keeps "Open now" and specials right on a wrong device clock.
    const local = Date.now(),
      server = serverNow || local;
    const tick = () => setTime(server + Date.now() - local);
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, hasSpecials ? 1000 : 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [hasSpecials, hasHours, serverNow]);
  useEffect(() => {
    if (preview || !slug) return;
    try {
      const key = `menu-session:${slug}`;
      session.current = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, session.current);
    } catch {
      session.current = crypto.randomUUID();
    }
    // A placement QR code (?src=table) counts toward that placement for the
    // whole visit; the tag leaves the address so a shared link starts fresh.
    const params = new URLSearchParams(location.search),
      src = params.get("src");
    try {
      if (isMenuPlacement(src)) sessionStorage.setItem(`menu-src:${slug}`, src);
      placement.current = sessionStorage.getItem(`menu-src:${slug}`);
    } catch {
      placement.current = isMenuPlacement(src) ? src : null;
    }
    if (src) {
      params.delete("src");
      const rest = params.toString();
      history.replaceState(
        history.state,
        "",
        `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`,
      );
    }
    track("menu_visit");
    const requestedMenu = params.get("menu");
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
  // Guests can narrow to dishes the restaurant marked suitable for them
  // (vegan dishes count as vegetarian and dairy-free).
  const offeredDiets = dietTags.filter((tag) =>
    sections.some((s) => s.items.some((i) => suitsDiet(i.dietary, tag.id))),
  );
  const chosenDiets = diets.filter((id) =>
    offeredDiets.some((tag) => tag.id === id),
  );
  const filtered = sections
    .map((s) => ({
      ...s,
      items: s.items.filter(
        (i) =>
          chosenDiets.every((id) => suitsDiet(i.dietary, id)) &&
          `${s.name} ${i.name} ${i.description} ${guestDietary(i.dietary)}`
            .toLocaleLowerCase(menu.language)
            .includes(query.toLocaleLowerCase(menu.language)),
      ),
    }))
    .filter((s) => s.items.length);
  const resultCount = filtered.reduce((n, s) => n + s.items.length, 0);
  const narrowed = !!query || chosenDiets.length > 0;
  // Wherever the menu shows diet or allergen details, remind guests to tell
  // the restaurant, unless the owner's own footer already does.
  const allergyNote =
    sections.some((s) => s.items.some((i) => i.dietary.length)) &&
    !/allerg/i.test(menu.footer);
  const searchInput = (
    <input
      type="search"
      aria-label="Search this menu"
      placeholder="Search the menu…"
      aria-controls={`${menuId}-items`}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  );
  // One compact choice beside search, so the first dishes stay near the top.
  const dietFilter = !!offeredDiets.length && (
    <select
      className="md-guest-diet"
      aria-label="Show dishes suitable for"
      aria-controls={`${menuId}-items`}
      value={chosenDiets[0] || ""}
      onChange={(e) => setDiets(e.target.value ? [e.target.value] : [])}
    >
      <option value="">Any diet</option>
      {offeredDiets.map((tag) => (
        <option key={tag.id} value={tag.id}>
          {tag.label}
        </option>
      ))}
    </select>
  );
  const contact = menu.contact,
    orderingUrl = contact ? contact.orderingUrl : menu.restaurant.orderingUrl,
    status = contact
      ? openingStatus(contact.hours, contact.timezone, time, menu.language)
      : null;
  const actions = [
    orderingUrl && {
      kind: "ordering_click",
      label: "Order online",
      href: orderingUrl,
      Icon: ShoppingBag,
      primary: true,
    },
    contact?.reservationUrl && {
      kind: "reserve_click",
      label: "Reserve",
      href: contact.reservationUrl,
      Icon: CalendarDays,
    },
    contact?.phone && {
      kind: "call_click",
      label: "Call",
      href: telephoneHref(contact.phone),
      Icon: Phone,
    },
    contact?.address && {
      kind: "directions_click",
      label: "Directions",
      href: directionsHref(menu.restaurant.name, contact.address),
      Icon: MapPin,
    },
  ].filter(Boolean) as {
    kind: string;
    label: string;
    href: string;
    Icon: typeof Phone;
    primary?: boolean;
  }[];
  const visit =
    contact && (contact.address || contact.phone || hasHours) ? contact : null;
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
        {(status || !!actions.length) && (
          <div className="md-guest-visit-bar">
            {status && (
              <p className={`md-guest-status ${status.open ? "is-open" : ""}`}>
                {status.label}
              </p>
            )}
            {!!actions.length && (
              <div className="md-guest-actions">
                {actions.map(({ kind, label, href, Icon, primary }) =>
                  preview ? (
                    <span key={kind} className={primary ? "is-primary" : ""}>
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </span>
                  ) : (
                    <a
                      key={kind}
                      className={primary ? "is-primary" : ""}
                      href={href}
                      {...(kind === "call_click"
                        ? {}
                        : { target: "_blank", rel: "noreferrer" })}
                      onClick={() => track(kind)}
                    >
                      <Icon size={16} aria-hidden="true" />
                      {label}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>
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
          {dietFilter ? (
            <div className="md-guest-search-row">
              {searchInput}
              {dietFilter}
            </div>
          ) : (
            searchInput
          )}
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
                    // Show the section even if a dietary filter hides it.
                    if (
                      !s.items.some((i) =>
                        chosenDiets.every((id) => suitsDiet(i.dietary, id)),
                      )
                    )
                      setDiets([]);
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
            {narrowed
              ? `${resultCount} ${resultCount === 1 ? "item matches" : "items match"}${query ? ` “${query}”` : " your choices"}.`
              : `All ${resultCount} items shown.`}
          </p>
        </nav>
      )}
      {!(
        sections.length > 3 ||
        sections.reduce((n, s) => n + s.items.length, 0) > 12
      ) && dietFilter}
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
                    <DishDietary values={item.dietary} />
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
            : chosenDiets.length
              ? "No dishes match your choices."
              : "Your dishes will appear here."}
        </p>
      )}
      {allergyNote && <p className="md-guest-allergy">{allergyNotice}</p>}
      {visit && (
        <section className="md-guest-visit" aria-labelledby={`${menuId}-visit`}>
          <h2 id={`${menuId}-visit`}>Hours & location</h2>
          {visit.address &&
            (preview ? (
              <p>{visit.address}</p>
            ) : (
              <p>
                <a
                  href={directionsHref(menu.restaurant.name, visit.address)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("directions_click")}
                >
                  {visit.address}
                </a>
              </p>
            ))}
          {visit.phone &&
            (preview ? (
              <p>{visit.phone}</p>
            ) : (
              <p>
                <a
                  href={telephoneHref(visit.phone)}
                  onClick={() => track("call_click")}
                >
                  {visit.phone}
                </a>
              </p>
            ))}
          {hasHours && (
            <dl className="md-guest-hours">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                const h = visit.hours.find((x) => x.day === day);
                return (
                  <div key={day}>
                    <dt>{dayName(day, menu.language)}</dt>
                    <dd>
                      {!h || h.closed
                        ? "Closed"
                        : `${formatTime(h.open, menu.language)} – ${formatTime(h.close, menu.language)}`}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </section>
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

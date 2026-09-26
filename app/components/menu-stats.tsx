"use client";
import { useEffect, useId, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/client";
import { MenuDialog } from "./menu-studio-controls";
import { ProNote } from "./pro-badge";

type FullStats = {
  orders: number;
  reservations: number;
  calls: number;
  directions: number;
  placements: { id: string; label: string; views: number }[];
  menus: { id: string; name: string; views: number }[];
  mostSeen: { name: string; guests: number } | null;
};
// Free gets visits and only counts of what Pro shows (`locked`).
export type MenuStatsData = {
  published: boolean;
  views: number;
  previousViews: number;
  locked?: { actions: number; dishes: number };
} & (FullStats | { [key in keyof FullStats]?: undefined });
const count = (n: number) =>
  new Intl.NumberFormat(
    "en",
    n >= 10000 ? { notation: "compact", maximumFractionDigits: 1 } : {},
  ).format(n);

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous)
    return current ? (
      <small className="md-stat-delta">No visits the week before</small>
    ) : null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (!change)
    return <small className="md-stat-delta">Same as the previous 7 days</small>;
  const Arrow = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <small className={`md-stat-delta ${change > 0 ? "is-up" : "is-down"}`}>
      <Arrow size={14} aria-hidden="true" />
      {change > 0 ? "+" : "−"}
      {Math.abs(change)}% vs previous 7 days
    </small>
  );
}

/** Loads again when `version` changes (for example after publishing). */
export function useMenuStats(version: string) {
  const [stats, setStats] = useState<MenuStatsData | null>(null);
  useEffect(() => {
    let active = true;
    api("menus/stats")
      .then((data) => {
        if (active) setStats(data as MenuStatsData);
      })
      .catch(() => {
        /* Stats are a bonus; the editor works without them. */
      });
    return () => {
      active = false;
    };
  }, [version]);
  return stats;
}

// What Pro would show, counted but not itemized. Taps are interest, not sales.
function lockedSummary(locked?: { actions: number; dishes: number }) {
  if (!locked?.actions && !locked?.dishes)
    return "See which dishes guests look at and what they tap, with Pro.";
  const taps = `${count(locked.actions)} ${locked.actions === 1 ? "tap" : "taps"} to order, call or get directions`,
    dishes = `${count(locked.dishes)} ${locked.dishes === 1 ? "dish" : "dishes"}`;
  return `Guests made ${taps} and looked at ${dishes}. See which with Pro.`;
}

/** On a phone the headline sits in the status line and opens the details. */
export function MenuStatsSummary({
  stats,
  onOpen,
}: {
  stats: MenuStatsData | null;
  onOpen: () => void;
}) {
  if (!stats?.published) return null;
  // The numbers cover every menu, not only the one that's open.
  return (
    <button className="md-stats-summary" onClick={onOpen}>
      {stats.views
        ? `${count(stats.views)} ${stats.views === 1 ? "view" : "views"} this week · all menus`
        : "No menu views yet"}
    </button>
  );
}

/**
 * The owner's weekly proof that the menu is working: guest visits, taps on
 * order, reserve, call and directions, and where guests found the menu.
 */
export default function MenuStats({
  stats,
  open,
  setOpen,
  onShare,
}: {
  stats: MenuStatsData | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  onShare?: () => void;
}) {
  const titleId = useId();
  if (!stats?.published) return null;
  const quiet = !stats.views && !stats.previousViews;
  return (
    <section className="md-stats" aria-labelledby={titleId}>
      <h2 id={titleId} className="md-stats-title">
        Last 7 days · all menus
      </h2>
      {quiet ? (
        <p className="md-stats-empty">
          No menu views yet. Put your QR code out or share your menu link, and
          visits will show here.
          {onShare && (
            <button className="md-text-button" onClick={onShare}>
              Share your menu
            </button>
          )}
        </p>
      ) : stats.orders === undefined ? (
        <>
          <div className="md-stat">
            <span>Menu views</span>
            <strong>{count(stats.views)}</strong>
            <Delta current={stats.views} previous={stats.previousViews} />
          </div>
          <ProNote feature="insights">{lockedSummary(stats.locked)}</ProNote>
        </>
      ) : (
        <>
          <div className="md-stat">
            <span>Menu views</span>
            <strong>{count(stats.views)}</strong>
            <Delta current={stats.views} previous={stats.previousViews} />
          </div>
          <div className="md-stat">
            <span>Order clicks</span>
            <strong>{count(stats.orders)}</strong>
          </div>
          <div className="md-stat md-stat-secondary">
            <span>Calls & directions</span>
            <strong>{count(stats.calls + stats.directions)}</strong>
          </div>
          {stats.mostSeen && (
            <div className="md-stat md-stat-secondary md-stat-text">
              <span>Most seen dish</span>
              <strong>{stats.mostSeen.name}</strong>
            </div>
          )}
          <button
            className="md-button md-secondary md-stats-details"
            onClick={() => setOpen(true)}
          >
            Details
          </button>
        </>
      )}
      {open && stats.orders !== undefined && (
        <MenuDialog
          title="Menu visits"
          description="All your menus, over the last 7 days. Each guest counts once per menu, however often they look."
          close={() => setOpen(false)}
        >
          <div className="md-stat-grid">
            <div className="md-stat">
              <span>Menu views</span>
              <strong>{count(stats.views)}</strong>
              <Delta current={stats.views} previous={stats.previousViews} />
            </div>
            {(
              [
                ["Order clicks", stats.orders],
                ["Reservation clicks", stats.reservations],
                ["Calls", stats.calls],
                ["Directions", stats.directions],
              ] as const
            ).map(([label, value]) => (
              <div className="md-stat" key={label}>
                <span>{label}</span>
                <strong>{count(value)}</strong>
              </div>
            ))}
          </div>
          <h3 className="md-stats-heading">Where guests found your menu</h3>
          {stats.placements.length ? (
            <ul className="md-stat-list">
              {stats.placements.map((p) => (
                <li key={p.id}>
                  <span>{p.label}</span>
                  <strong>{count(p.views)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="md-help">No visits in the last 7 days.</p>
          )}
          <p className="md-help">
            Give each spot its own QR code or link in Share to see which one
            brings guests in. Older codes count as Other links.
          </p>
          {stats.menus.length > 1 && (
            <>
              <h3 className="md-stats-heading">By menu</h3>
              <ul className="md-stat-list">
                {stats.menus.map((m) => (
                  <li key={m.id}>
                    <span>{m.name}</span>
                    <strong>{count(m.views)}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          {stats.mostSeen && (
            <>
              <h3 className="md-stats-heading">Most seen dish</h3>
              <p className="md-stats-seen">
                <strong>{stats.mostSeen.name}</strong> · on screen for{" "}
                {count(stats.mostSeen.guests)}{" "}
                {stats.mostSeen.guests === 1 ? "guest" : "guests"}.
              </p>
              <p className="md-help">
                Dishes near the top of your menu are seen most, so this shows
                where a dish sits more than how popular it is.
              </p>
            </>
          )}
        </MenuDialog>
      )}
    </section>
  );
}

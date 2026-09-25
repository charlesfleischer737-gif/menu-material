"use client";
import { useState } from "react";
import type { Row } from "@/lib/client";
import { MenuDialog, MoneyInput } from "./menu-studio-controls";

export type QuickChange = {
  entryId: string;
  available?: boolean;
  price?: number;
  variants?: { id: string; price: number }[];
};

/**
 * Everyday changes to what guests see, from a phone: mark a dish sold out (or
 * back on) with one tap, or change prices. Both go live right away; the
 * menu's other draft edits stay private until it's published.
 */
export default function MenuQuickUpdate({
  live,
  busy,
  close,
  apply,
}: {
  /** The published copy: exactly what guests see now. */
  live: Row;
  busy: boolean;
  close: () => void;
  /** Resolves to a confirmation, or null when the change didn't go through. */
  apply: (changes: QuickChange[], message: string) => Promise<string | null>;
}) {
  const [query, setQuery] = useState(""),
    [prices, setPrices] = useState<Record<string, number | null>>({}),
    [done, setDone] = useState("");
  const sections = (live.sections || []) as Row[],
    items = sections.flatMap((s) => s.items as Row[]);
  const edited = (key: string, fallback: number) =>
    key in prices ? prices[key] : fallback;
  const changes: QuickChange[] = [];
  for (const item of items) {
    if ((item.priceMode ?? "single") === "single" && item.id in prices) {
      if (prices[item.id] !== item.price)
        changes.push({ entryId: item.id, price: prices[item.id] ?? 0 });
    } else if (item.priceMode === "variants") {
      const variants = (item.variants as Row[]).map((v) => ({
        id: v.id as string,
        price: edited(`${item.id}:${v.id}`, v.price) ?? 0,
      }));
      if (variants.some((v, i) => v.price !== item.variants[i].price))
        changes.push({ entryId: item.id, variants });
    }
  }
  const invalid = changes.some(
    (c) => c.price === 0 || c.variants?.some((v) => !v.price),
  );
  async function run(list: QuickChange[], message: string) {
    setDone("");
    const confirmation = await apply(list, message);
    if (!confirmation) return;
    setDone(confirmation);
    if (list.some((c) => c.price !== undefined || c.variants)) setPrices({});
  }
  const shown = (item: Row) =>
    !query.trim() ||
    String(item.name).toLowerCase().includes(query.trim().toLowerCase());
  return (
    <MenuDialog
      title="Quick update"
      description="Mark dishes sold out or change prices. Guests see it right away; your other edits stay private until you publish."
      close={close}
    >
      {items.length > 8 && (
        <input
          className="md-library-search"
          type="search"
          aria-label="Find a dish on your live menu"
          placeholder="Find a dish…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="md-quick-list">
        {sections.map((section) => {
          const visible = (section.items as Row[]).filter(shown);
          if (!visible.length) return null;
          return (
            <section key={section.id}>
              <h3>{section.name}</h3>
              {visible.map((item) => {
                const soldOut = item.available === false;
                return (
                  <div
                    key={item.id}
                    className={`md-quick-row ${soldOut ? "is-sold-out" : ""}`}
                  >
                    <div className="md-quick-name">
                      <strong>{item.name}</strong>
                      {soldOut && <small>Sold out</small>}
                    </div>
                    <div className="md-quick-prices">
                      {(item.priceMode ?? "single") === "single" ? (
                        <MoneyInput
                          label={`${item.name} price`}
                          value={edited(item.id, item.price)}
                          onChange={(price) => {
                            setDone("");
                            setPrices((before) => ({
                              ...before,
                              [item.id]: price,
                            }));
                          }}
                        />
                      ) : item.priceMode === "variants" ? (
                        (item.variants as Row[]).map((v) => (
                          <label key={v.id} className="md-quick-variant">
                            <span>{v.label}</span>
                            <MoneyInput
                              label={`${item.name}, ${v.label} price`}
                              value={edited(`${item.id}:${v.id}`, v.price)}
                              onChange={(price) => {
                                setDone("");
                                setPrices((before) => ({
                                  ...before,
                                  [`${item.id}:${v.id}`]: price,
                                }));
                              }}
                            />
                          </label>
                        ))
                      ) : (
                        <span className="md-quick-note">
                          {item.priceMode === "label"
                            ? item.priceLabel
                            : "Included"}
                        </span>
                      )}
                    </div>
                    <div className="ui-chips">
                      <button
                        type="button"
                        aria-pressed={soldOut}
                        aria-label={`${item.name} sold out`}
                        disabled={busy}
                        onClick={() =>
                          void run(
                            [{ entryId: item.id, available: soldOut }],
                            soldOut
                              ? `${item.name} is back on your live menu.`
                              : `${item.name} is sold out on your live menu.`,
                          )
                        }
                      >
                        Sold out
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <div className="md-quick-actions">
        <p role="status">
          {done ||
            (invalid
              ? "Enter a price above 0 for each changed dish."
              : changes.length
                ? `${changes.length} ${changes.length === 1 ? "price change" : "price changes"} ready.`
                : "Sold out goes live as soon as you tap it.")}
        </p>
        <button
          className="md-button"
          disabled={!changes.length || invalid || busy}
          onClick={() =>
            void run(
              changes,
              `${changes.length} ${changes.length === 1 ? "price" : "prices"} updated on your live menu.`,
            )
          }
        >
          {changes.length > 1
            ? `Update ${changes.length} prices`
            : "Update price"}
        </button>
      </div>
    </MenuDialog>
  );
}

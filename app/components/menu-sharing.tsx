"use client";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  LoaderCircle,
  Printer,
  QrCode,
  Share2,
} from "lucide-react";
import { api, downloadBlob, type Row } from "@/lib/client";
import { brandTypeface, readableBrandInk } from "@/lib/restaurant-look";
import { publishedRestaurant } from "@/lib/sharing";

export default function MenuSharing({
  restaurant,
  busy,
  act,
  refresh,
  notice,
}: {
  restaurant: Row;
  busy: boolean;
  act: (label: string, fn: () => Promise<void>) => unknown;
  refresh: () => Promise<void>;
  notice: (message: string) => void;
}) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [check, setCheck] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [shareable, setShareable] = useState(false);
  const [mode, setMode] = useState("link");
  const [copied, setCopied] = useState("");
  const [checkedTime, setCheckedTime] = useState("");
  const [retry, setRetry] = useState(0);
  const published = publishedRestaurant(restaurant);
  const font = brandTypeface(published.style);
  useEffect(() => {
    let live = true;
    setQr("");
    setError("");
    setShareable(typeof navigator.share === "function");
    if (!restaurant.published) return;
    const link = location.origin + "/m/" + encodeURIComponent(restaurant.slug);
    setUrl(link);
    import("qrcode")
      .then(({ default: QR }) =>
        QR.toDataURL(link, {
          width: 1000,
          margin: 4,
          errorCorrectionLevel: "M",
          color: { dark: "#183e31", light: "#ffffff" },
        }),
      )
      .then((image) => {
        if (live) setQr(image);
      })
      .catch(() => {
        if (live)
          setError(
            "The QR code couldn’t load. Try again, or copy your menu link.",
          );
      });
    return () => {
      live = false;
    };
  }, [restaurant.slug, !!restaurant.published, retry]);
  useEffect(() => {
    let live = true;
    setCheck(null);
    setCheckedTime("");
    if (!restaurant.published) return;
    api("sharing/check", {})
      .then((result) => {
        if (live) {
          setCheck(result);
          setCheckedTime(
            new Date(result.checkedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
          );
        }
      })
      .catch(() => {
        if (live)
          setCheck({
            accessible: false,
            message:
              "Guest access couldn’t be checked. Try again before printing.",
          });
      });
    return () => {
      live = false;
    };
  }, [restaurant.slug, restaurant.published_at, !!restaurant.published, retry]);
  if (!restaurant.published) return null;
  return (
    <div className="cx-menu-sharing cx-share-studio">
      <div className="cx-sharing-heading">
        <span className="cx-pill">
          <Check size={14} /> Your menu is published
        </span>
        <p>Share the live menu. Your draft edits stay private.</p>
      </div>
      <div
        className="cx-sharing-tabs"
        role="group"
        aria-label="Ways to share your menu"
      >
        <button
          type="button"
          aria-pressed={mode === "link"}
          onClick={() => setMode("link")}
        >
          <Link2 size={16} /> Send a link
        </button>
        <button
          type="button"
          aria-pressed={mode === "print"}
          onClick={() => setMode("print")}
        >
          <Printer size={16} /> At your tables
        </button>
      </div>
      {mode === "link" ? (
        <div className="cx-menu-link-panel">
          <h3>Your menu, one tap away.</h3>
          <p>Add it to your Instagram bio, website or a message to guests.</p>
          <label className="cx-field">
            <span>Your guest link</span>
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="cx-sharing-buttons">
            <button
              className="cx-btn"
              disabled={busy || !url}
              onClick={() =>
                act("Copying your menu link", async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(url);
                  notice(
                    "Menu link copied. Paste it wherever your guests find you.",
                  );
                })
              }
            >
              {copied === url ? <Check size={16} /> : <Copy size={16} />}
              {copied === url ? "Link copied" : "Copy menu link"}
            </button>
            <a
              className="cx-btn cx-secondary"
              href={url || undefined}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Open menu
            </a>
          </div>
          {shareable && (
            <button
              className="cx-link cx-share-native-link"
              disabled={busy || !url}
              onClick={() => {
                void navigator
                  .share({ title: published.name + " — Menu", url })
                  .catch((e) => {
                    if (e.name !== "AbortError")
                      notice("Use Copy menu link to share this menu.");
                  });
              }}
            >
              <Share2 size={16} /> Share through another app
            </button>
          )}
        </div>
      ) : (
        <div className="cx-menu-print-panel">
          <div
            className="cx-qr-table-card"
            aria-label="Printed menu card preview"
          >
            <div
              className="cx-qr-card-name"
              style={{
                background: published.style.primary,
                color: readableBrandInk(published.style.primary),
                borderColor: published.style.accent,
                fontFamily: `"${font.family}"`,
              }}
            >
              {published.name}
            </div>
            <p>Something good is on the menu.</p>
            {qr ? (
              <img
                src={qr}
                width={180}
                height={180}
                alt={`Scan to open ${published.name}’s published menu`}
              />
            ) : (
              <div className="cx-qr-placeholder">
                <QrCode size={48} />
              </div>
            )}
            <strong>Scan to explore our menu</strong>
            <small>Open your camera and point it at the code.</small>
          </div>
          <h3>A little card. Your whole menu.</h3>
          <p>Put it on tables, at the counter or beside your pickup orders.</p>
          <button
            className="cx-btn cx-full"
            disabled={busy || !qr}
            onClick={() =>
              act("Preparing your table card", async () => {
                const { menuQrCard } = await import("@/lib/qr-card");
                downloadBlob(
                  await menuQrCard(published, url, qr),
                  `${restaurant.slug}-menu-card-4x6.pdf`,
                );
                notice(
                  "Menu card saved. Print at actual size, then scan a printed copy before putting it out.",
                );
              })
            }
          >
            <Printer size={17} /> Download table card PDF
          </button>
          <p className="cx-sharing-meta">
            4 × 6 inches · Print at actual size or center on larger paper.
          </p>
          <button
            className="cx-btn cx-secondary cx-full"
            disabled={busy || !qr}
            onClick={() =>
              act("Saving your QR code", async () => {
                downloadBlob(
                  await (await fetch(qr)).blob(),
                  `${restaurant.slug}-menu-qr.png`,
                );
                notice(
                  "QR image saved. Keep its white border when adding it to a design.",
                );
              })
            }
          >
            <Download size={16} /> Just the QR image
          </button>
          <p className="cx-sharing-meta">
            1000 × 1000 PNG · For your own signs and designs.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="cx-feedback cx-error">
          {error}
          <button
            className="cx-link"
            disabled={busy}
            onClick={() => setRetry((v) => v + 1)}
          >
            Try again
          </button>
        </p>
      )}
      <div
        className={`cx-guest-check ${check?.accessible ? "is-confirmed" : ""}`}
        role="status"
      >
        {check ? (
          <>
            {check.accessible ? <Check size={16} /> : <AlertCircle size={16} />}
            <div>
              <strong>
                {check.accessible ? "Ready for guests" : "Check before sharing"}
              </strong>
              <p>{check.message}</p>
              {checkedTime && <small>Checked at {checkedTime}</small>}
            </div>
          </>
        ) : (
          <>
            <LoaderCircle size={16} className="cx-spin" /> Checking the guest
            link…
          </>
        )}
      </div>
      <button
        className="cx-link cx-guest-recheck"
        disabled={busy || !check}
        onClick={() => setRetry((v) => v + 1)}
      >
        Check guest access again
      </button>
      <p className="cx-menu-stable-note">
        <QrCode size={16} /> Keep your printed cards. The same code opens your
        updated menu after you republish.
      </p>
      <details className="cx-menu-visibility">
        <summary>Menu visibility</summary>
        <p>
          Take your menu offline. The link and QR code will work again when you
          republish.
        </p>
        <button
          className="cx-link"
          disabled={busy}
          onClick={() =>
            act("Taking your menu offline", async () => {
              await api("menu/unpublish", {});
              await refresh();
              notice(
                "Your menu is offline. Your draft and photos are still saved.",
              );
            })
          }
        >
          Take menu offline
        </button>
      </details>
    </div>
  );
}

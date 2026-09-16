"use client";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  LoaderCircle,
  QrCode,
  Share2,
} from "lucide-react";
import { api, downloadBlob, type Row } from "@/lib/client";

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
  const [hide, setHide] = useState(false);
  useEffect(() => {
    let live = true;
    setQr("");
    setCheck(null);
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
            "The QR code couldn’t load. You can still copy your menu link.",
          );
      });
    api("sharing/check", {})
      .then((result) => {
        if (live) setCheck(result);
      })
      .catch(() => {
        if (live)
          setCheck({
            accessible: false,
            message: "Guest access couldn’t be checked. Please try again.",
          });
      });
    return () => {
      live = false;
    };
  }, [restaurant.slug, restaurant.published_at, !!restaurant.published]);
  if (!restaurant.published) return null;
  return (
    <div className="cx-menu-sharing">
      <div className="cx-sharing-heading">
        <span className="cx-pill">
          <Check size={14} /> Published menu
        </span>
        <p>Your edits stay private until you publish again.</p>
      </div>
      <div className="cx-menu-qr-row">
        {qr ? (
          <img
            src={qr}
            alt={`Scan to open ${restaurant.name}’s published menu`}
            width={120}
            height={120}
          />
        ) : (
          <div className="cx-qr-placeholder">
            <QrCode size={40} />
          </div>
        )}
        <div>
          <h3>One link. Every table.</h3>
          <p>The same QR code works after every menu update.</p>
        </div>
      </div>
      <label className="cx-field">
        <span>Your guest link</span>
        <input readOnly value={url} onFocus={(e) => e.target.select()} />
      </label>
      <div className="cx-sharing-buttons">
        <button
          className="cx-btn cx-secondary"
          disabled={busy || !url}
          onClick={() =>
            act("Copying your menu link", async () => {
              await navigator.clipboard.writeText(url);
              notice("Menu link copied. Share it with your guests.");
            })
          }
        >
          <Copy size={16} /> Copy link
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
      <p
        className={`cx-guest-check ${check?.accessible ? "is-confirmed" : ""}`}
        role="status"
      >
        {check ? (
          <>
            {check.accessible ? <Check size={15} /> : <AlertCircle size={15} />}{" "}
            {check.message}
          </>
        ) : (
          <>
            <LoaderCircle size={15} className="cx-spin" /> Checking the guest
            link…
          </>
        )}
      </p>
      {check && !check.accessible && (
        <button
          className="cx-link"
          disabled={busy}
          onClick={() =>
            act("Checking guest access", async () =>
              setCheck(await api("sharing/check", {})),
            )
          }
        >
          Check guest access again
        </button>
      )}
      {error && <p role="alert">{error}</p>}
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
              "QR code saved. Scan it once on your phone before printing.",
            );
          })
        }
      >
        <Download size={17} /> Save QR code
      </button>
      {shareable && (
        <button
          className="cx-link"
          disabled={busy || !url}
          onClick={() => {
            void navigator
              .share({ title: restaurant.name + " — Menu", url })
              .catch((e) => {
                if (e.name !== "AbortError")
                  notice("Use Copy link to share this menu.");
              });
          }}
        >
          <Share2 size={16} /> Share menu link
        </button>
      )}
      <details
        className="cx-menu-visibility"
        onToggle={(e) => setHide(e.currentTarget.open)}
      >
        <summary>Menu visibility</summary>
        <p>
          Take this menu offline. Its link and QR code will work again when you
          republish.
        </p>
        {hide && (
          <button
            className="cx-link"
            disabled={busy}
            onClick={() =>
              act("Taking your menu offline", async () => {
                await api("menu/unpublish", {});
                await refresh();
                notice(
                  "Your menu is offline. Your private draft and photos are still saved.",
                );
              })
            }
          >
            Take menu offline
          </button>
        )}
      </details>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, type Row } from "@/lib/client";
import PlanCards from "./plan-cards";
export default function PlanDialog({
  open,
  close,
  state,
  refresh,
}: {
  open: boolean;
  close: () => void;
  state: Row;
  refresh: () => Promise<void>;
}) {
  const [billing, setBilling] = useState<Row>(state.billing || {}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const sync = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("billing/sync", {});
      setBilling(result);
      setNotice(
        result.plan === "pro"
          ? "Your Pro plan is ready."
          : "Payment is not confirmed yet. Your free allowance remains available.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const value = new URLSearchParams(location.search).get("billing");
    if (value)
      history.replaceState(null, "", location.pathname + location.hash);
    void (async () => {
      try {
        const result = await api("billing/status");
        if (!live) return;
        setBilling(result);
        if (value === "cancel")
          setNotice("Checkout was cancelled. Your plan has not changed.");
        else if (value && result.enabled) await sync();
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, [open, sync]);
  async function visit(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("billing/" + action, {});
      const url = new URL(result.url);
      if (
        url.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
      )
        throw Error(
          "The billing link could not be verified. Please try again.",
        );
      location.assign(url.href);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) close();
      }}
    >
      <DialogContent
        className="pw-plans-dialog"
        closeDisabled={busy}
        fallbackFocus={() =>
          // The original plan trigger can disappear at the phone breakpoint.
          // Keep keyboard users in the visible account navigation on dismissal.
          [
            ...document.querySelectorAll<HTMLElement>(
              ".cx-pilot .cx-link, .cx-mobile-tools > summary",
            ),
          ].find((element) => element.getClientRects().length) || null
        }
      >
        <DialogHeader>
          <DialogTitle>
            {billing.plan === "pro"
              ? "Your Pro plan"
              : "Make room for more great photos."}
          </DialogTitle>
          <DialogDescription>
            {billing.remaining ?? state.remaining} of {billing.allowance ?? 5}{" "}
            generations remaining
            {billing.plan === "pro"
              ? " this billing period"
              : " in your free allowance"}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="pw-plans-body">
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {billing.plan === "pro" ? (
            <section className="pw-plan-current">
              <h2>Pro · $9.99/month</h2>
              <p>
                100 full-quality image generations each paid billing period.
              </p>
              <p>
                {billing.cancelAtPeriodEnd
                  ? "Your subscription ends"
                  : "Your allowance renews"}{" "}
                {billing.renewsAt
                  ? new Date(billing.renewsAt).toLocaleDateString()
                  : "at the end of this billing period"}
                .
              </p>
              <button
                className="cx-btn"
                disabled={busy || !billing.canManage}
                onClick={() => void visit("portal")}
              >
                Manage billing
              </button>
            </section>
          ) : (
            <PlanCards
              enabled={billing.enabled}
              onUpgrade={() => void visit("checkout")}
              onFree={close}
              busy={busy}
            />
          )}
          {billing.canManage && billing.plan !== "pro" && (
            <button
              className="cx-link"
              disabled={busy}
              onClick={() => void visit("portal")}
            >
              Manage existing billing or update payment
            </button>
          )}
          {billing.enabled && (
            <button
              className="cx-link"
              disabled={busy}
              onClick={() => void sync()}
            >
              Refresh payment status
            </button>
          )}
          <p className="fine">
            Prices in USD. Pro renews monthly until cancelled. Unused monthly
            generations do not roll over. Failed generations return to the
            allowance they used. Your saved work remains available when you
            cancel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, type Row } from "@/lib/client";
import PlanCards from "./plan-cards";
import { PRO_PLAN, PRO_PRICE_LABEL } from "@/lib/plans";
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
    [notice, setNotice] = useState(""),
    // While subscriptions are closed: "joined" once the request is recorded,
    // "noted" when this server has no waitlist to record it in.
    [waitlist, setWaitlist] = useState<"" | "sending" | "joined" | "noted">("");
  const waitlistStatus = useRef<HTMLParagraphElement>(null),
    waitlistButton = useRef<HTMLButtonElement>(null);
  const allowance = billing.allowance ?? 5,
    left = billing.remaining ?? state.remaining;
  const sync = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api("billing/sync", {});
      setBilling(result);
      setNotice(
        result.plan === "pro"
          ? "Your Pro plan is ready."
          : "Payment is not confirmed yet. Your free images are still available.",
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
  async function joinWaitlist() {
    if (waitlist) return;
    setWaitlist("sending");
    setError("");
    try {
      await api("plan-waitlist", {});
      setWaitlist("joined");
    } catch (e) {
      if ((e as { status?: number }).status === 404) setWaitlist("noted");
      else {
        setError((e as Error).message);
        setWaitlist("");
        // Back on the button, which was disabled while sending.
        requestAnimationFrame(() => waitlistButton.current?.focus());
        return;
      }
    }
    // The button is gone; keep keyboard focus on the answer.
    requestAnimationFrame(() => waitlistStatus.current?.focus());
  }
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
              : billing.enabled
                ? "Get more images"
                : "Plans"}
          </DialogTitle>
          <DialogDescription>
            {billing.plan === "pro" || billing.enabled
              ? `${left} of ${allowance} images left${billing.plan === "pro" ? " this billing period" : " on the free plan"}.`
              : left > 0
                ? `${left} of ${allowance} free images left. Pro is coming soon.`
                : `You’ve used your ${allowance} free images. Pro is coming soon.`}
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
              <h2>Pro · {PRO_PRICE_LABEL}/month</h2>
              <p>
                {PRO_PLAN.imagesPerPeriod} full-quality images each paid billing
                period.
              </p>
              <p>
                {billing.cancelAtPeriodEnd
                  ? "Your subscription ends"
                  : "Your images renew"}{" "}
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
              comingSoon={
                <>
                  <p
                    className="pw-plan-soon"
                    role="status"
                    ref={waitlistStatus}
                    tabIndex={-1}
                  >
                    {waitlist === "joined"
                      ? "You’re on the list. We’ll let you know when Pro opens."
                      : waitlist === "noted"
                        ? "Thanks. Pro isn’t open yet; we’ll let you know here in Plans when it is."
                        : "Pro is coming soon."}
                  </p>
                  {(waitlist === "" || waitlist === "sending") && (
                    <button
                      ref={waitlistButton}
                      className="cx-btn"
                      disabled={busy || waitlist === "sending"}
                      onClick={() => void joinWaitlist()}
                    >
                      {waitlist === "sending"
                        ? "Adding you…"
                        : "Tell me when Pro opens"}
                    </button>
                  )}
                </>
              }
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
          {billing.enabled ? (
            <p className="fine">
              Prices in USD. Pro renews monthly until cancelled. Unused monthly
              images don’t roll over. Images that fail to create are returned.
              Your saved work remains available when you cancel.
            </p>
          ) : (
            <p className="fine">Images that fail to create are returned.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

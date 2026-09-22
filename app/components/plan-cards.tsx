"use client";
import Link from "next/link";
export default function PlanCards({
  enabled = false,
  onUpgrade,
  onFree,
  busy = false,
}: {
  enabled?: boolean;
  onUpgrade?: () => void;
  onFree?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="pw-plan-grid">
      <article className="pw-plan-card">
        <p className="pw-eyebrow">A GREAT FIRST IMPRESSION</p>
        <h2>Free</h2>
        <p className="pw-plan-price">$0</p>
        <p>
          <strong>5 image generations</strong> to get started.
        </p>
        <ul>
          <li>One-time allowance, no expiry</li>
          <li>Full-quality image generation and exports</li>
          <li>Photos for your existing menu and social channels</li>
          <li>No credit card required</li>
        </ul>
        <div className="pw-plan-action">
          {onFree ? (
            <button className="cx-btn" disabled={busy} onClick={onFree}>
              Continue free
            </button>
          ) : (
            <Link className="cx-btn" href="/#studio">
              Try it free
            </Link>
          )}
        </div>
      </article>
      <article className="pw-plan-card is-pro">
        <p className="pw-eyebrow">KEEP GOOD FOOD IN THE SPOTLIGHT</p>
        <h2>Pro</h2>
        <p className="pw-plan-price">
          $9.99<span>/month</span>
        </p>
        <p>
          <strong>100 image generations</strong> every month.
        </p>
        <ul>
          <li>Fresh allowance each paid billing period</li>
          <li>The same full-quality images and exports</li>
          <li>New dishes, menu refreshes and weekly specials</li>
          <li>Reuse approved photos in matching posts and Stories</li>
          <li>Cancel future renewals through billing</li>
        </ul>
        <div className="pw-plan-action">
          {enabled ? (
            onUpgrade ? (
              <button className="cx-btn" disabled={busy} onClick={onUpgrade}>
                {busy ? "Opening secure checkout…" : "Get Pro — $9.99/month"}
              </button>
            ) : (
              <Link className="cx-btn" href="/?upgrade=1">
                Get Pro — $9.99/month
              </Link>
            )
          ) : (
            <>
              <p className="fine">
                Subscriptions aren’t open yet. Start with 5 free images today.
              </p>
              <button className="cx-btn" disabled>
                Pro is coming soon
              </button>
            </>
          )}
        </div>
      </article>
    </div>
  );
}

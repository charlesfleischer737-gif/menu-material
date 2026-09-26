"use client";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { PRO_PLAN, PRO_PRICE_LABEL } from "@/lib/plans";
/* eslint-disable @next/next/no-html-link-for-pages --
   Plain links on purpose: next/link's client navigation throws in the vinext
   production build ("navigateClientSide is not a function"), so a <Link>
   click there does nothing. These are separate server-rendered pages anyway. */

function Features({ items }: { items: string[] }) {
  return (
    <ul className="pw-plan-features">
      {items.map((item) => (
        <li key={item}>
          <Check size={16} strokeWidth={2.4} aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PlanCards({
  enabled = false,
  onUpgrade,
  onFree,
  busy = false,
  comingSoon,
}: {
  enabled?: boolean;
  onUpgrade?: () => void;
  onFree?: () => void;
  busy?: boolean;
  /** Replaces the Pro card's "open soon" note while billing is off. */
  comingSoon?: ReactNode;
}) {
  return (
    <div className="pw-plan-grid">
      <article className="pw-plan-card">
        <h2>Free</h2>
        <p className="pw-plan-tagline">A great first impression.</p>
        <p className="pw-plan-price">$0</p>
        <p className="pw-plan-allowance">
          <strong>5 images</strong> to get started.
        </p>
        <Features
          items={[
            "Free images never expire",
            "Full-quality images and exports",
            "Photos for your menu and social channels",
            "No credit card required",
          ]}
        />
        <div className="pw-plan-action">
          {onFree ? (
            <button className="cx-btn" disabled={busy} onClick={onFree}>
              Continue free
            </button>
          ) : (
            <a className="cx-btn" href="/#studio">
              Try it free
            </a>
          )}
        </div>
      </article>
      <article className="pw-plan-card is-pro">
        <div className="pw-plan-name">
          <h2>Pro</h2>
          {!enabled && <span className="pw-plan-badge">Coming soon</span>}
        </div>
        <p className="pw-plan-tagline">Keep good food in the spotlight.</p>
        <p className="pw-plan-price">
          {PRO_PRICE_LABEL}
          <span>/month</span>
        </p>
        <p className="pw-plan-allowance">
          <strong>{PRO_PLAN.imagesPerPeriod} images</strong> every month.
        </p>
        <Features
          items={[
            "New images every billing period",
            "The same full-quality images and exports",
            "New dishes, menu refreshes and weekly specials",
            "Matching posts and Stories from approved photos",
            "Cancel future renewals anytime",
          ]}
        />
        <div className="pw-plan-action">
          {enabled ? (
            onUpgrade ? (
              <button className="cx-btn" disabled={busy} onClick={onUpgrade}>
                {busy
                  ? "Opening secure checkout…"
                  : `Get Pro — ${PRO_PRICE_LABEL}/month`}
              </button>
            ) : (
              <a className="cx-btn" href="/?upgrade=1">
                Get Pro — {PRO_PRICE_LABEL}/month
              </a>
            )
          ) : (
            (comingSoon ?? (
              <p className="pw-plan-soon">
                Subscriptions open soon. Start with 5 free images today.
              </p>
            ))
          )}
        </div>
      </article>
    </div>
  );
}

"use client";
import { Check } from "lucide-react";
import { FREE_SIGNUP_IMAGES, PRO_PLAN, PRO_PRICE_LABEL } from "@/lib/plans";
import { useSiteContact } from "./site-contact";
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

/**
 * Renewal and cancellation, shown next to Get Pro before anyone pays. The
 * billing portal is set to cancel at the end of the paid period
 * (docs/FREE_PRO_PLANS.md).
 */
export function PlanTerms() {
  const { termsUrl, refundPolicyUrl } = useSiteContact();
  return (
    <p className="pw-plan-terms">
      Renews monthly until you cancel. Cancel anytime in Plans, under Manage
      billing, and Pro stays until the end of the month you’ve paid for.
      {termsUrl && (
        <>
          {" "}
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms
          </a>
        </>
      )}
      {refundPolicyUrl && (
        <>
          {termsUrl ? " · " : " "}
          <a href={refundPolicyUrl} target="_blank" rel="noreferrer">
            Refund policy
          </a>
        </>
      )}
    </p>
  );
}

export default function PlanCards({
  enabled = false,
  proFirst = false,
  actions = true,
}: {
  enabled?: boolean;
  /** Lead with Pro when the cards stack, for an offer of a Pro feature. */
  proFirst?: boolean;
  /** False leaves out the cards' buttons: the Plans dialog keeps its own in
      view below the cards. */
  actions?: boolean;
}) {
  return (
    <div className={`pw-plan-grid ${proFirst ? "is-pro-first" : ""}`}>
      <article className="pw-plan-card">
        <h2>Free</h2>
        <p className="pw-plan-tagline">A great first impression.</p>
        <p className="pw-plan-price">$0</p>
        <p className="pw-plan-allowance">
          <strong>{FREE_SIGNUP_IMAGES} images</strong> to get started.
        </p>
        <Features
          items={[
            "All realistic photo styles, full quality, no watermark",
            "Every download size, for delivery apps and social",
            "One live menu with its QR code, PDF and table card",
            "Posts and Stories in three designs",
            "Free images never expire. No credit card",
          ]}
        />
        {actions && (
          <div className="pw-plan-action">
            <a className="cx-btn" href="/#studio">
              Try it free
            </a>
          </div>
        )}
      </article>
      <article className="pw-plan-card is-pro">
        <div className="pw-plan-name">
          <h2>Pro</h2>
          {!enabled && <span className="pw-plan-badge">Coming soon</span>}
        </div>
        <p className="pw-plan-tagline">
          Keep your restaurant looking its best, every week.
        </p>
        <p className="pw-plan-price">
          {PRO_PRICE_LABEL}
          <span>/month</span>
        </p>
        <p className="pw-plan-allowance">
          <strong>{PRO_PLAN.imagesPerPeriod} images</strong> every month.
        </p>
        <Features
          items={[
            "Food Fantasy: exaggerated, larger-than-life food art",
            "Your restaurant look on every photo, post and menu",
            "Every post and menu design, plus carousels",
            "Campaigns: a matching post, Story, counter sign and menu special",
            "Up to 30 live menus, with full menu insights",
            "Saved looks, inspiration photos and batches",
            "No “Made with Menu Material” on your menus",
            "Cancel future renewals anytime",
          ]}
        />
        {actions && (
          <div className="pw-plan-action">
            {enabled ? (
              <>
                <a className="cx-btn" href="/?upgrade=1">
                  Get Pro — {PRO_PRICE_LABEL}/month
                </a>
                <PlanTerms />
              </>
            ) : (
              <p className="pw-plan-soon">
                Subscriptions open soon. Start with {FREE_SIGNUP_IMAGES} free
                images today.
              </p>
            )}
          </div>
        )}
      </article>
    </div>
  );
}

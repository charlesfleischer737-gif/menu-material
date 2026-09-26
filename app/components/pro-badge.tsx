"use client";
import { proFeatures, type ProFeature } from "@/lib/plans";
import { requestUpgrade } from "@/lib/upgrade";

/** Marks a Pro control before anyone starts, so no work is lost to a limit. */
export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`pro-badge ${className}`.trim()} title="Part of Pro">
      Pro
    </span>
  );
}

/**
 * A short explanation where a Pro feature would be, with a way to see Pro.
 * `children` replaces the feature's standard sentence.
 */
export function ProNote({
  feature,
  children,
  action = "See Pro",
}: {
  feature: ProFeature;
  children?: React.ReactNode;
  action?: string;
}) {
  return (
    <div className="pro-note" role="note">
      <ProBadge />
      <p>{children ?? proFeatures[feature].blocked}</p>
      <button
        type="button"
        className="cx-link"
        onClick={() => requestUpgrade(feature)}
      >
        {action}
      </button>
    </div>
  );
}

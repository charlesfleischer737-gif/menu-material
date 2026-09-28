import type { Row } from "./client";
import type { ProFeature } from "./plans";

// Any control can ask the workspace to explain a Pro feature and offer Pro.
export const UPGRADE_EVENT = "menu-material:upgrade";
export type UpgradeRequest = { feature: ProFeature; auto: boolean };

/**
 * Open the upgrade sheet for a feature. `auto` marks requests the person
 * didn't make directly (a refused save), which are shown once per session.
 */
export function requestUpgrade(feature: ProFeature, auto = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<UpgradeRequest>(UPGRADE_EVENT, {
      detail: { feature, auto },
    }),
  );
}

/** Whether the workspace's plan includes Pro features right now. */
export const hasProFeatures = (state: Row | null | undefined) =>
  state?.billing?.features?.unlocked !== false;

import { api } from "./client";
import {
  MENU_EXPORTED,
  type MenuExportFormat,
  type VisitorStep,
} from "./funnel";

const visitorKey = "menu-material:visitor",
  sentKey = "menu-material:visitor-steps";
// The server keeps a browser's steps for 90 days, so sending one again
// sooner changes nothing; this only saves the request.
const resendAfter = 30 * 86400000;
// Without storage (blocked or private), a step counts once per page load.
let pageVisitor = "";
const sentThisPage = new Set<VisitorStep>();

/** A random ID for this browser. The server keeps only a one-way hash of it. */
function visitor() {
  try {
    let id = localStorage.getItem(visitorKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(visitorKey, id);
    }
    return id;
  } catch {
    return (pageVisitor ||= crypto.randomUUID());
  }
}
function sentSteps(): Record<string, number> {
  try {
    const sent = JSON.parse(localStorage.getItem(sentKey) || "{}");
    return sent && typeof sent === "object" ? sent : {};
  } catch {
    return {};
  }
}

/**
 * Counts a launch funnel step (lib/funnel.ts) for this browser, once.
 * Crawlers and automated browsers aren't visitors, so they're left out.
 */
export function recordVisitorStep(step: VisitorStep) {
  if (
    typeof window === "undefined" ||
    navigator.webdriver ||
    /bot|crawl|spider|slurp|preview/i.test(navigator.userAgent)
  )
    return;
  if (
    sentThisPage.has(step) ||
    Date.now() - (Number(sentSteps()[step]) || 0) < resendAfter
  )
    return;
  sentThisPage.add(step);
  void api("funnel", { step, visitor: visitor() })
    .then(() => {
      try {
        localStorage.setItem(
          sentKey,
          JSON.stringify({ ...sentSteps(), [step]: Date.now() }),
        );
      } catch {}
    })
    // Refused (such as by the rate limit): the next page load tries again.
    .catch(() => sentThisPage.delete(step));
}

/**
 * Records a menu's PDF, table card or QR image download, for the launch
 * funnel's first export and the "Get your menu live" checklist.
 */
export function recordMenuExport(format: MenuExportFormat, menuId?: string) {
  void api("events", {
    kind: "menu_exported",
    entityId: menuId || undefined,
    format,
  })
    .then(() =>
      window.dispatchEvent(
        new CustomEvent(MENU_EXPORTED, { detail: { format } }),
      ),
    )
    .catch(() => {});
}

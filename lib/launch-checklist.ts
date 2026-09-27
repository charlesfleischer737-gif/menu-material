import { isPlaceholderDishName } from "./restaurant-identity";

// "Get your menu live": a new owner's first steps toward the live QR menu
// that Free includes. Each step is read from what's saved, never ticked by
// hand, and links to where it's done.
export const launchSteps = [
  { id: "dish", label: "Name and price your first dish" },
  { id: "menu", label: "Publish your menu" },
  { id: "tableCard", label: "Print your table card" },
] as const;
export type LaunchStepId = (typeof launchSteps)[number]["id"];

// It's a first-run list: it retires once the account is this many days old,
// so owners from before it existed aren't told to redo what they've done.
export const LAUNCH_CHECKLIST_DAYS = 30;

type Dish = {
  name?: unknown;
  price?: unknown;
  sample?: unknown;
  archived_at?: unknown;
};

/** A dish guests could order: a real name and a price, and not the sample. */
export function readyDish(dish: Dish) {
  return (
    !dish.sample &&
    !dish.archived_at &&
    typeof dish.name === "string" &&
    !!dish.name.trim() &&
    !isPlaceholderDishName(dish.name) &&
    Number(dish.price) > 0
  );
}

/**
 * The steps from saved state: the restaurant's dishes, its live menu
 * (`restaurant.published`) and whether a table card or the menu's QR code
 * was downloaded.
 */
export function launchChecklist({
  dishes = [],
  published = null,
  tableCard = false,
}: {
  dishes?: Dish[];
  published?: { sections?: unknown[] } | null;
  tableCard?: boolean;
}) {
  const done: Record<LaunchStepId, boolean> = {
    dish: dishes.some(readyDish),
    // A special published on its own leaves a page with no sections.
    menu: (published?.sections?.length ?? 0) > 0,
    tableCard,
  };
  const steps = launchSteps.map((step) => ({ ...step, done: done[step.id] }));
  const count = steps.filter((step) => step.done).length;
  return { steps, done: count, complete: count === steps.length };
}

/**
 * Shown until every step is done or the owner hides it (`preference` is
 * "done" or "dismissed" once either happened), and only in the account's
 * first weeks.
 */
export function showLaunchChecklist({
  preference,
  complete,
  createdAt,
  now,
}: {
  preference: string;
  complete: boolean;
  createdAt: unknown;
  now: number;
}) {
  return (
    !complete &&
    !preference &&
    now - Number(createdAt) < LAUNCH_CHECKLIST_DAYS * 86400000
  );
}

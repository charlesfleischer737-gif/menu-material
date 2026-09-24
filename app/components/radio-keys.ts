import type { KeyboardEvent } from "react";

// Arrow keys move between the options of a role="radiogroup" and select the
// one they land on, as native radio buttons do. Only one option is tabbable.
export function radioKeys(event: KeyboardEvent<HTMLElement>) {
  const step: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  if (!(event.key in step) && !["Home", "End"].includes(event.key)) return;
  const radios = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="radio"]:not(:disabled)',
    ),
  ];
  const index = radios.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? radios.length - 1
        : (index + step[event.key] + radios.length) % radios.length;
  radios[next].focus();
  radios[next].click();
}

/** tabIndex for option `index` of a radio group whose checked index is given. */
export const radioTab = (index: number, checked: number) =>
  index === (checked < 0 ? 0 : checked) ? 0 : -1;

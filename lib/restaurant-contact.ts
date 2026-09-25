/**
 * The restaurant details guests act on from a published menu: open now, call,
 * directions, order and reserve. They're read live from the restaurant, so a
 * changed phone number or holiday hours never wait for a republish.
 */
export type DayHours = {
  day: number;
  open: string;
  close: string;
  closed: boolean;
};
export type MenuContact = {
  address: string;
  phone: string;
  reservationUrl: string;
  orderingUrl: string;
  hours: DayHours[];
  timezone: string;
};

const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
function localClock(now: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return { day, minute: (Number(parts.hour) % 24) * 60 + Number(parts.minute) };
}
/** "3 PM" or "3:30 PM" (in English unless a language is given). */
export function formatTime(time: string, language = "en") {
  const [h, m] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(language, {
    hour: "numeric",
    ...(m ? { minute: "2-digit" } : {}),
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 2, h, m));
}
export function dayName(day: number, language = "en") {
  // 2 January 2000 was a Sunday.
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 2 + day));
}

/** "New York time": which clock a restaurant's hours are on. */
export const zoneName = (timeZone: string) =>
  `${timeZone.split("/").pop()!.replace(/_/g, " ")} time`;
/** Whether two timezones read the same day and time at `now`. */
export function sameClock(a: string, b: string, now: number) {
  try {
    const x = localClock(now, a),
      y = localClock(now, b);
    return x.day === y.day && x.minute === y.minute;
  } catch {
    return true;
  }
}

/**
 * Whether the restaurant is open at `now` in its own timezone. A closing time
 * at or before the opening time means the following day (a late bar). The
 * label is English, so its days and times are too ("opens Tuesday at 9 AM",
 * never "opens martes at 9") until guest menus are translated.
 */
export function openingStatus(
  hours: DayHours[] | undefined,
  timeZone: string,
  now: number,
): { open: boolean; label: string } | null {
  if (!hours || hours.length !== 7 || !now) return null;
  let clock: { day: number; minute: number };
  try {
    clock = localClock(now, timeZone);
  } catch {
    return null;
  }
  const byDay = (day: number) => hours.find((h) => h.day === (day + 7) % 7);
  const today = byDay(clock.day),
    yesterday = byDay(clock.day - 1);
  // Still open from last night?
  if (
    yesterday &&
    !yesterday.closed &&
    minutes(yesterday.close) <= minutes(yesterday.open) &&
    clock.minute < minutes(yesterday.close)
  )
    return {
      open: true,
      label: `Open now · until ${formatTime(yesterday.close)}`,
    };
  if (today && !today.closed) {
    const opens = minutes(today.open),
      closes = minutes(today.close),
      overnight = closes <= opens;
    if (clock.minute >= opens && (overnight || clock.minute < closes))
      return {
        open: true,
        label: `Open now · until ${formatTime(today.close)}`,
      };
    if (clock.minute < opens)
      return {
        open: false,
        label: `Closed · opens at ${formatTime(today.open)}`,
      };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const next = byDay(clock.day + ahead);
    if (!next || next.closed) continue;
    const when = ahead === 1 ? "tomorrow" : dayName((clock.day + ahead) % 7);
    return {
      open: false,
      label: `Closed · opens ${when} at ${formatTime(next.open)}`,
    };
  }
  return { open: false, label: "Closed" };
}
export const telephoneHref = (phone: string) =>
  `tel:${phone.replace(/[^\d+]/g, "")}`;
export const directionsHref = (name: string, address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name}, ${address}`,
  )}`;

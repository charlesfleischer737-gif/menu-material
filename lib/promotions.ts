export type Style = {
  primary: string;
  accent: string;
  tone: string;
  photoStyle: string;
  referenceIds: string[];
  typography?: "modern" | "editorial" | "bold";
  autoApply?: boolean;
  photoPreset?: string;
  photoDefaults?: {
    surface: string;
    lighting: string;
    plate: string;
    angle: string;
    composition: string;
  };
};
export const defaultStyle: Style = {
  primary: "#202820",
  accent: "#f0e3c3",
  tone: "Warm and welcoming",
  photoStyle: "Natural daylight",
  referenceIds: [],
  typography: "modern",
  autoApply: false,
  photoPreset: "",
};
export const offerTypes = {
  special: "Tonight’s special",
  lunch: "Lunch combo",
  family: "Family meal",
  catering: "Catering offer",
  happy_hour: "Happy hour",
};
export function localTime(ms: number, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ms)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function localToInstant(
  value: string,
  zone: string,
  occurrence: "earlier" | "later" = "earlier",
) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("Choose a valid date and time.");
  const guess = Date.parse(value + ":00Z");
  if (!Number.isFinite(guess)) throw Error("Choose a valid date and time.");
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 6) {
    const t = guess + h * 3600000;
    offsets.add(Date.parse(localTime(t, zone) + ":00Z") - t);
  }
  const candidates = [...offsets]
    .map((offset) => guess - offset)
    .filter((t) => localTime(t, zone) === value)
    .sort((a, b) => a - b);
  if (!candidates.length)
    throw Error(
      "That local time does not exist because the clocks change. Choose another time.",
    );
  return occurrence === "later"
    ? candidates[candidates.length - 1]
    : candidates[0];
}
export function promotionStatus(
  p: {
    published?: unknown;
    sold_out?: number;
    starts_at?: number;
    ends_at?: number;
  },
  t = Date.now(),
) {
  if (!p.published) return "Draft";
  if (Number(p.ends_at) <= t) return "Expired";
  if (p.sold_out) return "Sold out";
  if (Number(p.starts_at) > t) return "Scheduled";
  return "On your menu";
}
export function scheduleLabel(start: number, end: number, zone: string) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${format.format(start)} – ${format.format(end)}`;
}

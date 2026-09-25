"use client";
import { useId, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, normalizePhoto, type Row } from "@/lib/client";
import { defaultStyle } from "@/lib/promotions";
import RestaurantLookEditor from "./restaurant-look-editor";
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
// Each open day needs both times; the server rejects an empty one.
function hoursProblem(h: Row) {
  if (h.closed || (h.open && h.close)) return "";
  return !h.open && !h.close
    ? "Enter opening and closing times, or mark the day closed."
    : !h.open
      ? "Enter an opening time, or mark the day closed."
      : "Enter a closing time, or mark the day closed.";
}
// The Save check in restaurant-settings.tsx stops at an invalid field and
// shows its validation message, so an empty time carries a plain one.
function requireTime(missing: boolean, day: number, problem: string) {
  return (input: HTMLInputElement | null) =>
    input?.setCustomValidity(missing ? `${dayNames[day]}: ${problem}` : "");
}
export default function RestaurantStyle({
  profile,
  setProfile,
  state,
  refresh,
  busy,
  section = "all",
}: Row) {
  // Style-reference uploads report here, next to the field, so the result
  // is visible inside the settings dialog.
  const [reference, setReference] = useState({
    uploading: false,
    message: "",
    error: "",
  });
  const referenceInput = useRef<HTMLInputElement>(null);
  const id = useId();
  const style = { ...defaultStyle, ...profile.style };
  const change = (k: string, v: unknown) =>
    setProfile({ ...profile, style: { ...style, [k]: v } });
  const hours =
    profile.hours?.length === 7
      ? profile.hours
      : Array.from({ length: 7 }, (_, day) => ({
          day,
          open: "11:00",
          close: "21:00",
          closed: false,
        }));
  return (
    <>
      {section !== "ordering" && (
        <>
          <RestaurantLookEditor {...{ profile, setProfile, style, state }} />
          <div className="field">
            <span id={`${id}-reference`}>
              Your tables, backgrounds or menu photos
            </span>
            <small id={`${id}-reference-help`}>
              Choose up to 3 atmosphere references.
            </small>
            <input
              ref={referenceInput}
              hidden
              type="file"
              accept="image/jpeg,image/png,image/heic,.heic"
              onChange={async (e) => {
                const input = e.currentTarget;
                const f = input.files?.[0];
                if (!f) return;
                setReference({ uploading: true, message: "", error: "" });
                try {
                  const form = new FormData();
                  form.set("file", f);
                  form.set(
                    "normalized",
                    await normalizePhoto(f),
                    "reference.jpg",
                  );
                  form.set("kind", "reference");
                  const a = await api("assets", form);
                  // Other fields may have changed during the upload.
                  setProfile((current: Row) => {
                    const latest = { ...defaultStyle, ...current.style };
                    return {
                      ...current,
                      style: {
                        ...latest,
                        referenceIds: [...latest.referenceIds, a.id].slice(-3),
                      },
                    };
                  });
                  setReference({
                    uploading: false,
                    message:
                      "Reference uploaded. Save your restaurant to apply it.",
                    error: "",
                  });
                  await refresh();
                } catch (reason) {
                  setReference({
                    uploading: false,
                    message: "",
                    error: (reason as Error).message,
                  });
                } finally {
                  // The same file can be chosen again after an error.
                  input.value = "";
                }
              }}
            />
            <button
              type="button"
              className="cx-btn cx-secondary rs-file-button"
              aria-describedby={`${id}-reference ${id}-reference-help`}
              disabled={!!busy || reference.uploading}
              onClick={() => referenceInput.current?.click()}
            >
              <ImagePlus size={16} aria-hidden="true" />
              {reference.uploading ? "Uploading…" : "Add a reference photo"}
            </button>
            {reference.error ? (
              <small role="alert" className="rs-field-error">
                {reference.error}
              </small>
            ) : (
              (reference.uploading || reference.message) && (
                <small role="status">
                  {reference.uploading
                    ? "Uploading your reference…"
                    : reference.message}
                </small>
              )
            )}
          </div>
          <div className="reference-grid">
            {state.assets
              .filter((a: Row) => a.kind === "reference")
              .map((a: Row) => (
                <label key={a.id}>
                  <img src={"/api/assets/" + a.id} alt={a.name} />
                  <span>
                    <input
                      type="checkbox"
                      checked={style.referenceIds.includes(a.id)}
                      onChange={(e) =>
                        change(
                          "referenceIds",
                          e.target.checked
                            ? [...style.referenceIds, a.id].slice(-3)
                            : style.referenceIds.filter(
                                (v: string) => v !== a.id,
                              ),
                        )
                      }
                    />{" "}
                    Use reference
                  </span>
                </label>
              ))}
          </div>
        </>
      )}
      {section !== "look" && (
        <>
          <label className="field">
            Phone
            <input
              type="tel"
              autoComplete="tel"
              maxLength={40}
              pattern="[+\(\)0-9\s.\-]*"
              placeholder="(555) 123-4567"
              value={profile.phone || ""}
              onChange={(e) =>
                setProfile({ ...profile, phone: e.target.value })
              }
            />
            <small>Guests can tap to call from your menu.</small>
          </label>
          <label className="field">
            Street address
            <input
              autoComplete="street-address"
              maxLength={300}
              placeholder="12 Market Street, Springfield"
              value={profile.address || ""}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
            />
            <small>Your menu links to directions.</small>
          </label>
          <label className="field">
            Restaurant timezone
            <input
              name="timezone"
              list="restaurant-timezones"
              placeholder="America/New_York"
              value={profile.timezone ?? ""}
              onChange={(e) =>
                setProfile({ ...profile, timezone: e.target.value })
              }
            />
            <datalist id="restaurant-timezones">
              {[
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Paris",
                "Asia/Tokyo",
                "Australia/Sydney",
                "UTC",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </datalist>
            <small>Specials use this timezone, even when you travel.</small>
          </label>
          <label className="field">
            Existing ordering link
            <input
              type="url"
              placeholder="https://…"
              value={profile.orderingUrl || ""}
              onChange={(e) =>
                setProfile({ ...profile, orderingUrl: e.target.value })
              }
            />
          </label>
          <label className="field">
            Reservation link
            <input
              type="url"
              placeholder="https://…"
              value={profile.reservationUrl || ""}
              onChange={(e) =>
                setProfile({ ...profile, reservationUrl: e.target.value })
              }
            />
            <small>OpenTable, Resy, Tock or your own booking page.</small>
          </label>
          <details className="dish-options">
            <summary>Opening hours</summary>
            <p className="fine">
              Your menu shows whether you’re open now. A closing time before
              opening means the following day.
            </p>
            {hours.map((h: Row, i: number) => {
              const problem = hoursProblem(h);
              const problemId = `${id}-hours-${h.day}`;
              return (
                <div className="hours-row" key={h.day}>
                  <b>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][h.day]}
                  </b>
                  <input
                    ref={requireTime(!!problem && !h.open, h.day, problem)}
                    aria-label={"Opens " + dayNames[h.day]}
                    aria-invalid={(!!problem && !h.open) || undefined}
                    aria-describedby={
                      problem && !h.open ? problemId : undefined
                    }
                    type="time"
                    value={h.open}
                    disabled={h.closed}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        hours: hours.map((x: Row, j: number) =>
                          j === i ? { ...x, open: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <input
                    ref={requireTime(!!problem && !h.close, h.day, problem)}
                    aria-label={"Closes " + dayNames[h.day]}
                    aria-invalid={(!!problem && !h.close) || undefined}
                    aria-describedby={
                      problem && !h.close ? problemId : undefined
                    }
                    type="time"
                    value={h.close}
                    disabled={h.closed}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        hours: hours.map((x: Row, j: number) =>
                          j === i ? { ...x, close: e.target.value } : x,
                        ),
                      })
                    }
                  />
                  <label>
                    <input
                      type="checkbox"
                      aria-label={dayNames[h.day] + " closed"}
                      checked={h.closed}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          // A cleared time would be rejected even on a
                          // closed day, so keep valid times underneath.
                          hours: hours.map((x: Row, j: number) =>
                            j === i
                              ? {
                                  ...x,
                                  closed: e.target.checked,
                                  open: x.open || "11:00",
                                  close: x.close || "21:00",
                                }
                              : x,
                          ),
                        })
                      }
                    />{" "}
                    Closed
                  </label>
                  {problem && (
                    <small className="rs-field-error" id={problemId}>
                      {problem}
                    </small>
                  )}
                </div>
              );
            })}
            {!profile.hours?.length && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setProfile({ ...profile, hours })}
              >
                Use these hours
              </Button>
            )}
          </details>
        </>
      )}
    </>
  );
}

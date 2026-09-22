"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, normalizePhoto, type Row } from "@/lib/client";
import { defaultStyle } from "@/lib/promotions";
import RestaurantLookEditor from "./restaurant-look-editor";
export default function RestaurantStyle({
  profile,
  setProfile,
  state,
  act,
  refresh,
  busy,
  section = "all",
}: Row) {
  const [uploaded, setUploaded] = useState("");
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
          <label className="field">
            Caption tone
            <input
              value={style.tone}
              maxLength={150}
              onChange={(e) => change("tone", e.target.value)}
            />
          </label>
          <label className="field">
            Your tables, backgrounds or menu photos{" "}
            <small>Choose up to 3 atmosphere references.</small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/heic,.heic"
              disabled={!!busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  act("Saving style reference", async () => {
                    const form = new FormData();
                    form.set("file", f);
                    form.set(
                      "normalized",
                      await normalizePhoto(f),
                      "reference.jpg",
                    );
                    form.set("kind", "reference");
                    const a = await api("assets", form);
                    change(
                      "referenceIds",
                      [...style.referenceIds, a.id].slice(-3),
                    );
                    setUploaded(
                      "Reference uploaded. Save your restaurant to apply it.",
                    );
                    await refresh();
                  });
              }}
            />
          </label>
          {uploaded && (
            <p role="status" className="fine">
              {uploaded}
            </p>
          )}
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
            Restaurant timezone
            <input
              name="timezone"
              list="restaurant-timezones"
              value={profile.timezone || "America/New_York"}
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
          <details className="dish-options">
            <summary>Opening hours</summary>
            <p className="fine">
              Set your actual hours for weekly suggestions. A closing time
              before opening means the following day.
            </p>
            {hours.map((h: Row, i: number) => (
              <div className="hours-row" key={h.day}>
                <b>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][h.day]}
                </b>
                <input
                  aria-label={
                    "Opens " +
                    [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ][h.day]
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
                  aria-label={
                    "Closes " +
                    [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ][h.day]
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
                    aria-label={
                      [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ][h.day] + " closed"
                    }
                    checked={h.closed}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        hours: hours.map((x: Row, j: number) =>
                          j === i ? { ...x, closed: e.target.checked } : x,
                        ),
                      })
                    }
                  />{" "}
                  Closed
                </label>
              </div>
            ))}
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

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Brand from "./brand";
import {
  api,
  normalizePhoto,
  photoAccept,
  photoFileError,
  type Row,
} from "@/lib/client";
import { photoAdvice } from "@/lib/photo-advice";
export default function StaffUpload({ token }: { token: string }) {
  const [data, setData] = useState<Row | null>(null),
    [dish, setDish] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [canRetry, setCanRetry] = useState(true);
  const photoInput = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () =>
      api("staff/" + token)
        .then((next) => {
          setData(next);
          setError("");
        })
        .catch((e) => {
          // Only a dropped connection or a service error can pass on a
          // retry; any other refusal means the link itself is unusable.
          const retry =
            !e.status || e.status >= 500 || [408, 429].includes(e.status);
          setCanRetry(retry);
          setError(
            !e.status
              ? "The photo drop couldn’t be opened. Check your connection and try again."
              : retry
                ? e.message
                : "This upload link has expired or isn’t valid.",
          );
        }),
    [token],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main className="staff-upload-page">
      <Brand />
      <section className="panel">
        <p className="staff-context">Staff photos</p>
        <h1>{data?.name || "Dish photos"}</h1>
        <p className="muted">
          Send a photo to the owner for review. Frame the whole dish, use soft
          window light and keep the phone steady.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!data && !error && (
          <div className="staff-loading" role="status">
            Opening the photo drop…
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
        )}
        {!data &&
          error &&
          (canRetry ? (
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                void load();
              }}
            >
              Try opening again
            </Button>
          ) : (
            <p className="fine">Ask the restaurant for a new link.</p>
          ))}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {data && (
          <>
            <label className="field">
              Dish
              <select value={dish} onChange={(e) => setDish(e.target.value)}>
                <option value="">Choose a dish</option>
                {data.dishes.map((d: Row) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Photo
              <input
                ref={photoInput}
                type="file"
                accept={photoAccept}
                onChange={(e) => {
                  const chosen = e.target.files?.[0] || null;
                  setFile(chosen);
                  setNotice("");
                  setError("");
                  // Say straight away if this file can't be sent.
                  if (chosen)
                    void photoFileError(chosen).then((problem) => {
                      const input = photoInput.current;
                      if (!problem || input?.files?.[0] !== chosen) return;
                      setError(problem);
                      setFile(null);
                      input.value = "";
                    });
                }}
              />
            </label>
            <Button
              disabled={busy || !dish || !file}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setError("");
                try {
                  const form = new FormData();
                  form.set("file", file);
                  form.set(
                    "normalized",
                    await normalizePhoto(file),
                    "dish.jpg",
                  );
                  form.set("dishId", dish);
                  const advice = await photoAdvice(file);
                  await api("staff/" + token + "/upload", form);
                  setNotice("Photo sent for owner review. " + advice);
                  setFile(null);
                  if (photoInput.current) photoInput.current.value = "";
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Sending photo…" : "Send to owner"}
            </Button>
            {(!dish || !file) && (
              <p className="fine">
                Choose a dish and a photo to send for review.
              </p>
            )}
            <p className="fine">
              Your photo is private. The owner decides whether to approve or
              publish it.
            </p>
            {!data.dishes.length && (
              <p className="fine">
                Ask the owner to save the dish in the library first.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Brand from "./brand";
import { api, normalizePhoto, type Row } from "@/lib/client";
import { photoAdvice } from "@/lib/photo-advice";
export default function StaffUpload({ token }: { token: string }) {
  const [data, setData] = useState<Row | null>(null),
    [dish, setDish] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const load = useCallback(
    () =>
      api("staff/" + token)
        .then((next) => {
          setData(next);
          setError("");
        })
        .catch((e) => setError(e.message)),
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
        {!data && error && (
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Try opening again
          </Button>
        )}
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
                accept="image/jpeg,image/png,image/heic,.heic"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setNotice("");
                  setError("");
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

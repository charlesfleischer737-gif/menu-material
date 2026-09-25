"use client";
import { useState, type KeyboardEvent } from "react";
import { api } from "@/lib/client";

// Enter must not submit the surrounding restaurant settings form.
const stayHere = (event: KeyboardEvent<HTMLInputElement>) => {
  if (event.key === "Enter") event.preventDefault();
};

/** Settings section: permanently delete the account and its restaurant. */
export default function AccountDeletion() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState("");
  const ready = !!password && confirm.trim().toUpperCase() === "DELETE";
  async function remove() {
    if (!ready || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await api("account/delete", { password, confirm });
      // Signed out: start again from a fresh home page.
      history.replaceState(null, "", "/");
      location.reload();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }
  return (
    <details className="dish-options" style={{ gridColumn: "1 / -1" }}>
      <summary>Delete account</summary>
      <p className="fine">
        This permanently deletes your restaurant and everything in it: dishes,
        photos, menus, specials and posts. Your public menu pages stop working
        and you are signed out everywhere. It can’t be undone, so download
        anything you want to keep first.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={deleting}
            onKeyDown={stayHere}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
          />
        </label>
        <label className="field">
          Type DELETE to confirm
          <input
            autoComplete="off"
            spellCheck={false}
            value={confirm}
            disabled={deleting}
            onKeyDown={stayHere}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError("");
            }}
          />
        </label>
        {error && (
          <p className="rs-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <button
            type="button"
            className="cx-btn cx-danger"
            disabled={!ready || deleting}
            onClick={remove}
          >
            {deleting ? "Deleting…" : "Delete account permanently"}
          </button>
        </div>
      </div>
    </details>
  );
}

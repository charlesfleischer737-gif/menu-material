"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Copy,
  ArrowRight,
  Check,
  Heart,
  Pencil,
  RotateCcw,
  Star,
} from "lucide-react";
import { looks } from "@/lib/studio";
import type { SavedLook } from "@/lib/studio-library";
import type { PhotoStyle } from "@/lib/photo-styles";
import type { useStudioLibrary } from "./use-studio-library";
import { findStyles, searchSavedLooks } from "@/lib/studio-search";
import { studioCreationBlock } from "@/lib/studio-discovery";

export function StudioSavedLooks({
  store,
  restaurantLook,
  select,
  apply,
  guest,
  query,
  onSearchAll,
  onResultCount,
  disabledStyleIds = [],
}: {
  store: ReturnType<typeof useStudioLibrary>;
  restaurantLook?: PhotoStyle;
  select: (id: string, origin?: string) => void;
  apply: (look: SavedLook) => void;
  guest: boolean;
  query: string;
  onSearchAll: () => void;
  onResultCount: (count: number) => void;
  disabledStyleIds?: string[];
}) {
  const [archived, setArchived] = useState(false),
    [renaming, setRenaming] = useState(""),
    [name, setName] = useState("");
  const { library, busy, mutate } = store;
  const saved = useMemo(
    () =>
      searchSavedLooks(
        query,
        library.looks.filter((look) => look.archived === archived),
      ),
    [query, library.looks, archived],
  );
  const favorites = useMemo(
    () =>
      findStyles(
        query,
        "All",
        library.favorites
          .map((id) => looks.find((look) => look.id === id))
          .filter((look): look is PhotoStyle => !!look),
      ),
    [query, library.favorites],
  );
  const recent = useMemo(
    () =>
      findStyles(
        query,
        "All",
        library.recent
          .filter((id) => !library.favorites.includes(id))
          .map((id) => looks.find((look) => look.id === id))
          .filter((look): look is PhotoStyle => !!look),
      ),
    [query, library.recent, library.favorites],
  );
  const legacy =
    !guest &&
    !archived &&
    !library.legacyMigrated &&
    restaurantLook &&
    findStyles(query, "All", [restaurantLook]).length
      ? restaurantLook
      : undefined;
  const resultCount =
    (guest ? 0 : saved.length) +
    (archived ? 0 : favorites.length + recent.length + (legacy ? 1 : 0));
  useEffect(() => onResultCount(resultCount), [resultCount, onResultCount]);
  const unavailable = (look: SavedLook) =>
    !!studioCreationBlock(look.recipe, { disabledStyleIds });
  function archive(look: SavedLook) {
    void mutate((value) => ({
      ...value,
      defaultLookId:
        value.defaultLookId === look.id ? null : value.defaultLookId,
      looks: value.looks.map((item) =>
        item.id === look.id ? { ...item, archived: !item.archived } : item,
      ),
    }));
  }
  function cards(styles: PhotoStyle[], origin: string) {
    return (
      <div className="ps2-saved-grid">
        {styles.map((look) => (
          <div key={look.id} className="ps2-saved-catalog">
            <button
              className="ps2-saved-choice"
              disabled={disabledStyleIds.includes(look.id)}
              onClick={() => select(look.id, origin)}
            >
              <img src={look.image} alt="Style example" loading="lazy" />
              <span>
                <b>{look.name}</b>
                <small>{look.cue}</small>
                {disabledStyleIds.includes(look.id) && (
                  <small>Temporarily unavailable</small>
                )}
              </span>
              <ArrowRight size={17} />
            </button>
            <button
              className="ps2-icon-button"
              aria-label={`${library.favorites.includes(look.id) ? "Remove" : "Add"} ${look.name} ${library.favorites.includes(look.id) ? "from" : "to"} favorites`}
              aria-pressed={library.favorites.includes(look.id)}
              disabled={busy}
              onClick={() => void store.favorite(look.id)}
            >
              <Heart
                size={16}
                fill={
                  library.favorites.includes(look.id) ? "currentColor" : "none"
                }
              />
            </button>
          </div>
        ))}
      </div>
    );
  }
  if (query.trim() && resultCount === 0)
    return (
      <div className="ps2-empty-results">
        <h3 role="status">
          No {archived ? "archived" : "saved"} looks match “{query}”.
        </h3>
        <p>
          Try another name, setting or light, or search the full collection.
        </p>
        <button className="cx-btn" onClick={onSearchAll}>
          Search all looks
          <ArrowRight size={16} />
        </button>
        {!guest && (
          <button className="cx-link" onClick={() => setArchived(!archived)}>
            {archived ? "Search active saved looks" : "Search archived looks"}
          </button>
        )}
      </div>
    );
  return (
    <div className="ps2-saved-panel">
      <p className="ps2-control-help">
        {guest
          ? "Favorites are saved on this device. Sign in to keep a restaurant look across devices."
          : "Your private collection, available wherever you sign in."}
      </p>
      {query.trim() && (
        <p className="ps2-result-count" role="status">
          {resultCount} {resultCount === 1 ? "saved look" : "saved looks"} for “
          {query}”
        </p>
      )}
      {!query.trim() && !resultCount && (
        <button className="cx-link" onClick={onSearchAll}>
          Browse all looks
          <ArrowRight size={16} />
        </button>
      )}
      {!guest && (
        <>
          <div className="ps2-saved-heading">
            <h3>{archived ? "Archived looks" : "Restaurant looks"}</h3>
            <button className="cx-link" onClick={() => setArchived(!archived)}>
              {archived ? "Show active looks" : "Archived"}
            </button>
          </div>
          {saved.length ? (
            saved.map((look) => (
              <article className="ps2-saved-recipe" key={look.id}>
                <div className="ps2-saved-choice">
                  <img
                    src={
                      look.previewAssetId
                        ? `/api/assets/${look.previewAssetId}`
                        : looks.find((style) => style.id === look.recipe.look)
                            ?.image
                    }
                    alt="Saved look example"
                    loading="lazy"
                  />
                  <span>
                    <b>{look.name}</b>
                    <small>
                      {look.recipe.surface === "As shown"
                        ? "Style setting"
                        : look.recipe.surface}{" "}
                      ·{" "}
                      {look.recipe.lighting === "As shown"
                        ? "Style light"
                        : look.recipe.lighting}
                    </small>
                    {unavailable(look) && (
                      <small>
                        Temporarily unavailable · your recipe is saved
                      </small>
                    )}
                    {library.defaultLookId === look.id && (
                      <em>
                        <Star size={11} />
                        Default for new photos
                      </em>
                    )}
                  </span>
                  {!archived && (
                    <button
                      className="ps2-icon-button"
                      aria-label={`Use saved look ${look.name}`}
                      disabled={unavailable(look)}
                      onClick={() => apply(look)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  )}
                </div>
                {renaming === look.id ? (
                  <form
                    className="ps2-rename"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await mutate((value) => ({
                          ...value,
                          looks: value.looks.map((item) =>
                            item.id === look.id
                              ? { ...item, name: name.trim() }
                              : item,
                          ),
                        }))
                      )
                        setRenaming("");
                    }}
                  >
                    <input
                      aria-label="Look name"
                      maxLength={60}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="cx-link"
                      disabled={busy || !name.trim()}
                      type="submit"
                    >
                      <Check size={14} />
                      Save
                    </button>
                    <button
                      className="cx-link"
                      type="button"
                      onClick={() => setRenaming("")}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="ps2-saved-actions">
                    {!archived && (
                      <>
                        <button
                          className="cx-link"
                          disabled={
                            busy ||
                            (unavailable(look) &&
                              library.defaultLookId !== look.id)
                          }
                          onClick={() =>
                            void mutate((value) => ({
                              ...value,
                              defaultLookId:
                                value.defaultLookId === look.id
                                  ? null
                                  : look.id,
                            }))
                          }
                        >
                          <Star size={13} />
                          {library.defaultLookId === look.id
                            ? "Remove default"
                            : "Default for new photos"}
                        </button>
                        <button
                          className="cx-link"
                          onClick={() => {
                            setName(look.name);
                            setRenaming(look.id);
                          }}
                        >
                          <Pencil size={13} />
                          Rename
                        </button>
                        <button
                          className="cx-link"
                          disabled={busy || library.looks.length >= 100}
                          onClick={() =>
                            void mutate((value) => ({
                              ...value,
                              looks: [
                                ...value.looks,
                                {
                                  ...look,
                                  id: crypto.randomUUID(),
                                  name: `${look.name.slice(0, 53)} (copy)`,
                                  version: 1,
                                },
                              ],
                            }))
                          }
                        >
                          <Copy size={13} />
                          Duplicate
                        </button>
                      </>
                    )}
                    <button
                      className="cx-link"
                      disabled={busy}
                      onClick={() => archive(look)}
                    >
                      {archived ? (
                        <RotateCcw size={13} />
                      ) : (
                        <Archive size={13} />
                      )}
                      {archived ? "Restore" : "Archive"}
                    </button>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="ps2-saved-empty">
              {query.trim()
                ? "No restaurant looks match this search."
                : archived
                  ? "No archived looks."
                  : "Save a look from Customize to reuse the same setting and light on your next dish."}
            </p>
          )}
          {legacy && cards([legacy], "saved")}
        </>
      )}
      {!archived && (
        <>
          <h3>Favorites</h3>
          {favorites.length ? (
            cards(favorites, "favorite")
          ) : (
            <p className="ps2-saved-empty">
              {query.trim()
                ? "No favorites match this search."
                : "Tap the heart on any style to keep it here."}
            </p>
          )}
          {recent.length > 0 && (
            <>
              <h3>Recently used</h3>
              {cards(recent, "recent")}
            </>
          )}
        </>
      )}
    </div>
  );
}

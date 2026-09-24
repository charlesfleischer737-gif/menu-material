"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import {
  emptyStudioLibrary,
  studioLibrarySchema,
  type StudioLibrary,
} from "@/lib/studio-library";

export function useStudioLibrary(restaurantId?: string) {
  const [library, setLibrary] = useState<StudioLibrary>(emptyStudioLibrary);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [shownFor, setShownFor] = useState(restaurantId);
  const revision = useRef(0),
    loadSequence = useRef(0),
    current = useRef(library),
    lock = useRef(false),
    scope = useRef(restaurantId);
  // Another restaurant starts from an empty library while its own loads.
  if (shownFor !== restaurantId) {
    setShownFor(restaurantId);
    setReady(false);
    setError("");
    setLibrary(emptyStudioLibrary());
  }
  function load() {
    if (lock.current) return Promise.resolve();
    const sequence = ++loadSequence.current;
    const owner = restaurantId;
    // Owners load their restaurant's library; guests keep favorites here.
    const request = owner
      ? api("studio-library")
      : Promise.resolve().then(() => {
          const saved = localStorage.getItem(
            "menu-material:guest-look-favorites",
          );
          return {
            ...emptyStudioLibrary(),
            favorites: saved ? JSON.parse(saved) : [],
            revision: 0,
          };
        });
    return request
      .then((data) => {
        if (scope.current !== owner || sequence !== loadSequence.current)
          return;
        const valid = studioLibrarySchema.parse(data);
        current.current = valid;
        revision.current = data.revision || 0;
        setLibrary(valid);
        setReady(true);
      })
      .catch(() => {
        if (scope.current === owner)
          setError(
            owner
              ? "Saved looks couldn’t load. Try again."
              : "This browser can’t save favorites. You can still choose any look.",
          );
      });
  }
  function reload() {
    if (lock.current) return Promise.resolve();
    setError("");
    setReady(false);
    return load();
  }
  useEffect(() => {
    scope.current = restaurantId;
    current.current = emptyStudioLibrary();
    void load();
  }, [restaurantId]);
  async function mutate(change: (library: StudioLibrary) => StudioLibrary) {
    if (lock.current || !ready) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    const owner = restaurantId;
    try {
      let next = studioLibrarySchema.parse(change(current.current));
      if (owner) {
        const data = await api(
          "studio-library",
          { revision: revision.current, library: next },
          "PUT",
        );
        if (scope.current !== owner) return false;
        revision.current = data.revision;
        next = studioLibrarySchema.parse(data);
      } else
        localStorage.setItem(
          "menu-material:guest-look-favorites",
          JSON.stringify(next.favorites),
        );
      current.current = next;
      setLibrary(next);
      return true;
    } catch (e) {
      if (scope.current === owner) setError((e as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function favorite(id: string) {
    return mutate((value) => ({
      ...value,
      favorites: value.favorites.includes(id)
        ? value.favorites.filter((item) => item !== id)
        : [...value.favorites, id],
    }));
  }
  return { library, ready, busy, error, reload, mutate, favorite };
}

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
  const revision = useRef(0),
    loadSequence = useRef(0),
    current = useRef(library),
    lock = useRef(false),
    scope = useRef(restaurantId);
  scope.current = restaurantId;
  async function reload() {
    if (lock.current) return;
    const sequence = ++loadSequence.current;
    const owner = restaurantId;
    setError("");
    setReady(false);
    try {
      let data;
      if (owner) data = await api("studio-library");
      else {
        const saved = localStorage.getItem(
          "menu-material:guest-look-favorites",
        );
        data = {
          ...emptyStudioLibrary(),
          favorites: saved ? JSON.parse(saved) : [],
          revision: 0,
        };
      }
      if (scope.current !== owner || sequence !== loadSequence.current) return;
      const valid = studioLibrarySchema.parse(data);
      current.current = valid;
      revision.current = data.revision || 0;
      setLibrary(valid);
      setReady(true);
    } catch {
      if (scope.current === owner)
        setError(
          owner
            ? "Saved looks couldn’t load. Try again."
            : "This browser can’t save favorites. You can still choose any look.",
        );
    }
  }
  useEffect(() => {
    setReady(false);
    current.current = emptyStudioLibrary();
    setLibrary(current.current);
    void reload();
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

"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { InspirationStatus } from "@/lib/studio-reference";

export function useInspirationAvailability(
  restaurantId: string,
  referenceIds: string[],
  enabled: boolean,
) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    status: InspirationStatus;
  }>({ key: "", status: "ready" });
  const ids = JSON.stringify(referenceIds);
  const key = JSON.stringify([restaurantId, ids, attempt]);
  const needed = enabled && !!restaurantId && referenceIds.length > 0;
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!needed) {
      setResult({ key: "", status: "ready" });
      return;
    }
    let current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    void api(
      "studio-references",
      { referenceIds: JSON.parse(ids) },
      undefined,
      controller.signal,
    )
      .then((response) => {
        if (!current) return;
        setResult({
          key,
          status:
            response.available === true
              ? "ready"
              : response.available === false
                ? "unavailable"
                : "error",
        });
      })
      .catch(() => {
        if (current) setResult({ key, status: "error" });
      })
      .finally(() => {
        clearTimeout(timeout);
      });
    return () => {
      current = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [key, ids, needed]);
  useEffect(() => {
    if (!needed) return;
    window.addEventListener("focus", retry);
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("online", retry);
    };
  }, [needed, retry]);
  return {
    status: !needed
      ? ("ready" as const)
      : result.key === key
        ? result.status
        : ("checking" as const),
    retry,
  };
}

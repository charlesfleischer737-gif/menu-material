"use client";
import { useEffect, useEffectEvent, useRef } from "react";

// Browser Back leaves the top sheet/detail without discarding the photo draft.
// Only small navigation markers go in history; photos and recipes stay private.
export function useStudioNavigation(
  stack: string[],
  restore: (stack: string[]) => void,
) {
  const session = useRef(""),
    current = useRef<string[]>([]);
  const onRestore = useEffectEvent(restore);
  const key = JSON.stringify(stack);
  useEffect(() => {
    session.current ||= crypto.randomUUID();
    const pop = (event: PopStateEvent) => {
      const marker = event.state?.photoStudioOverlay;
      const next = marker?.session === session.current ? marker.stack : [];
      current.current = next;
      onRestore(next);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const next = JSON.parse(key) as string[],
      previous = current.current;
    if (JSON.stringify(previous) === key) return;
    const prefix = next.every((value, index) => previous[index] === value);
    const extending = previous.every((value, index) => next[index] === value);
    current.current = next;
    if (prefix && next.length < previous.length) {
      if (history.state?.photoStudioOverlay?.session === session.current)
        history.go(next.length - previous.length);
    } else if (extending) {
      for (let length = previous.length + 1; length <= next.length; length++)
        history.pushState(
          {
            ...history.state,
            photoStudioOverlay: {
              session: session.current,
              stack: next.slice(0, length),
            },
          },
          "",
          location.href,
        );
    } else {
      history.replaceState(
        {
          ...history.state,
          photoStudioOverlay: { session: session.current, stack: next },
        },
        "",
        location.href,
      );
    }
  }, [key]);
}

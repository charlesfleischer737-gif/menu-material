"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { deferredResource } from "@/lib/deferred-resource";

export function deferredWorkspace<Props extends object>(
  name: string,
  loader: () => Promise<{ default: ComponentType<Props> }>,
) {
  const resource = deferredResource(loader);
  return function DeferredWorkspace(props: Props) {
    const [Loaded, setLoaded] = useState(
      () => resource.peek()?.default || null,
    );
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const root = useRef<HTMLDivElement>(null);
    const returnFocus = useRef(false);
    useEffect(() => {
      if (Loaded) return;
      let active = true;
      setFailed(false);
      resource.load().then(
        (module) => {
          if (active) {
            returnFocus.current = !!root.current?.contains(
              document.activeElement,
            );
            setLoaded(() => module.default);
          }
        },
        () => {
          if (active) setFailed(true);
        },
      );
      return () => {
        active = false;
      };
    }, [attempt, Loaded]);
    useLayoutEffect(() => {
      const node = root.current;
      if (!node || node.closest("[hidden]")) return;
      if (!Loaded)
        node.querySelector<HTMLElement>("[data-workspace-status]")?.focus();
    }, [Loaded, attempt]);
    useEffect(() => {
      const node = root.current;
      if (!Loaded || !node || !returnFocus.current) return;
      // A workspace may still be opening its saved draft after its module has
      // loaded. Transfer focus once its heading exists, unless the user moved on.
      const observer = new MutationObserver(focusHeading);
      function focusHeading() {
        if (!node) return;
        if (
          node.closest("[hidden]") ||
          document.activeElement !== document.body
        ) {
          observer.disconnect();
          return;
        }
        const heading = node.querySelector<HTMLElement>("h1");
        if (heading) {
          heading.focus();
          observer.disconnect();
        }
      }
      observer.observe(node, { childList: true, subtree: true });
      focusHeading();
      return () => observer.disconnect();
    }, [Loaded]);
    return (
      <div ref={root}>
        {Loaded ? (
          <Loaded {...props} />
        ) : (
          <div className="cx-feedback">
            <p
              data-workspace-status
              tabIndex={-1}
              role={failed ? "alert" : "status"}
            >
              {failed
                ? `${name} couldn’t open. Check your connection and try again.`
                : `Opening ${name}…`}
            </p>
            {failed && (
              <button
                className="cx-btn cx-secondary"
                onClick={() => {
                  setFailed(false);
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  };
}

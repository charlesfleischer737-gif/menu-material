"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { isChunkLoadError, reloadForNewVersion } from "@/lib/chunk-reload";
import { deferredResource } from "@/lib/deferred-resource";
import WorkspacePlaceholder from "./workspace-placeholder";

export function deferredWorkspace<Props extends object>(
  name: string,
  loader: () => Promise<{ default: ComponentType<Props> }>,
  contentOnly = false,
) {
  const resource = deferredResource(loader);
  return function DeferredWorkspace(props: Props) {
    const [Loaded, setLoaded] = useState(
      () => resource.peek()?.default || null,
    );
    // "update": this screen's file is gone after a deploy, and a reload
    // (which the loader tries once by itself) is what brings it back.
    const [failed, setFailed] = useState<false | "network" | "update">(false);
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
        (error) => {
          if (!active) return;
          const stale = isChunkLoadError(error) && navigator.onLine !== false;
          // While the page reloads, keep showing that the screen is opening.
          if (stale && reloadForNewVersion()) return;
          setFailed(stale ? "update" : "network");
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
          <WorkspacePlaceholder
            title={name}
            contentOnly={contentOnly}
            failed={!!failed}
            message={
              failed === "update"
                ? `A new version of Menu Material is available. Reload the page to open ${name}.`
                : failed
                  ? `${name} couldn’t open. Check your connection and try again.`
                  : `Opening ${name}…`
            }
            failureDetail={
              failed === "update"
                ? "Your saved work is kept. Trying again reloads the page."
                : undefined
            }
            onRetry={() => {
              if (failed === "update") {
                location.reload();
                return;
              }
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          />
        )}
      </div>
    );
  };
}

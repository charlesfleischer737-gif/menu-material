import type { DesignedMenu } from "./menu-document";
import type { MenuPdfResult } from "./menu-pdf-v2";

type Listener = {
  resolve: (result: MenuPdfResult) => void;
  reject: (error: unknown) => void;
  cleanup: () => void;
};
type Job = {
  key: string;
  menu: DesignedMenu;
  controller: AbortController;
  listeners: Set<Listener>;
  priority: number;
  running: boolean;
};

// Share duplicate work without letting one preview cancel another subscriber.
// Full-size proofs take priority over collection thumbnails waiting to start.
export function createMenuProofQueue(
  render: (menu: DesignedMenu, signal: AbortSignal) => Promise<MenuPdfResult>,
  concurrency = 2,
  cacheLimit = 12,
) {
  const jobs = new Map<string, Job>();
  const cache = new Map<string, MenuPdfResult>();
  let running = 0;
  function pump() {
    while (running < concurrency) {
      const job = [...jobs.values()]
        .filter((j) => !j.running && j.listeners.size)
        .sort((a, b) => b.priority - a.priority)[0];
      if (!job) return;
      job.running = true;
      running++;
      void Promise.resolve()
        .then(() => {
          job.controller.signal.throwIfAborted();
          return render(job.menu, job.controller.signal);
        })
        .then(
          (result) => {
            if (job.controller.signal.aborted) return;
            cache.set(job.key, result);
            while (cache.size > cacheLimit)
              cache.delete(cache.keys().next().value!);
            for (const listener of job.listeners) listener.resolve(result);
          },
          (error) => {
            for (const listener of job.listeners) listener.reject(error);
          },
        )
        .finally(() => {
          for (const listener of job.listeners) listener.cleanup();
          // A new subscriber may already have replaced a cancelled job's key.
          if (jobs.get(job.key) === job) jobs.delete(job.key);
          running--;
          pump();
        });
    }
  }
  return function prepare(
    menu: DesignedMenu,
    options: { signal?: AbortSignal; priority?: number } = {},
  ): Promise<MenuPdfResult> {
    const { signal, priority = 1 } = options;
    if (signal?.aborted) return Promise.reject(signal.reason);
    const key = JSON.stringify(menu);
    const cached = cache.get(key);
    if (cached) {
      cache.delete(key);
      cache.set(key, cached);
      return Promise.resolve(cached);
    }
    let job = jobs.get(key);
    if (!job) {
      job = {
        key,
        menu,
        priority,
        controller: new AbortController(),
        listeners: new Set(),
        running: false,
      };
      jobs.set(key, job);
    }
    job.priority = Math.max(job.priority, priority);
    const current = job;
    return new Promise((resolve, reject) => {
      const abort = () => {
        current.listeners.delete(listener);
        listener.cleanup();
        reject(
          signal?.reason || new DOMException("Preview cancelled", "AbortError"),
        );
        if (!current.listeners.size) {
          if (jobs.get(key) === current) jobs.delete(key);
          current.controller.abort();
        }
      };
      const listener: Listener = {
        resolve,
        reject,
        cleanup: () => signal?.removeEventListener("abort", abort),
      };
      current.listeners.add(listener);
      signal?.addEventListener("abort", abort, { once: true });
      pump();
    });
  };
}

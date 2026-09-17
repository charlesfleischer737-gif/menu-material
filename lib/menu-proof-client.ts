import { menuContentIssues, type DesignedMenu } from "./menu-document";
import type { MenuPdfResult } from "./menu-pdf-v2";
import { createMenuProofQueue } from "./menu-proof-queue";

const idleWorkers: Worker[] = [];
let workersUnavailable = false;

async function renderInWorker(
  menu: DesignedMenu,
  signal: AbortSignal,
): Promise<MenuPdfResult> {
  signal.throwIfAborted();
  if (
    workersUnavailable ||
    typeof Worker === "undefined" ||
    typeof OffscreenCanvas === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    const { renderDesignedMenuPdf } = await import("./menu-pdf-v2");
    return renderDesignedMenuPdf(menu, { proof: true, signal });
  }
  let worker: Worker;
  try {
    worker =
      idleWorkers.pop() ||
      new Worker(new URL("./menu-proof.worker.ts", import.meta.url), {
        type: "module",
      });
  } catch {
    workersUnavailable = true;
    return renderInWorker(menu, signal);
  }
  return new Promise<MenuPdfResult>((resolve, reject) => {
    let finished = false;
    const cleanup = (reusable: boolean) => {
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      if (reusable && !workersUnavailable) idleWorkers.push(worker);
      else worker.terminate();
    };
    const abort = () => {
      if (finished) return;
      cleanup(false);
      reject(signal.reason);
    };
    const failed = () => {
      if (finished) return;
      cleanup(false);
      // An unsupported/blocked worker must not prevent ordinary editing/export.
      workersUnavailable = true;
      for (const idle of idleWorkers.splice(0)) idle.terminate();
      renderInWorker(menu, signal).then(resolve, reject);
    };
    const timeout = setTimeout(failed, 30000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{
        result?: MenuPdfResult;
        error?: string;
        unsupported?: boolean;
      }>,
    ) => {
      if (finished) return;
      if (event.data.unsupported) {
        failed();
        return;
      }
      cleanup(true);
      if (event.data.result) resolve(event.data.result);
      else
        reject(
          Error(event.data.error || "The menu preview could not be prepared."),
        );
    };
    worker.onerror = failed;
    worker.onmessageerror = failed;
    try {
      worker.postMessage(menu);
    } catch {
      failed();
    }
  });
}

export const prepareMenuProof = createMenuProofQueue(renderInWorker);

export function exportDesignedMenuPdf(menu: DesignedMenu) {
  const issues = menuContentIssues(menu);
  if (issues.length) return Promise.reject(Error(issues[0].message));
  return prepareMenuProof(menu, { priority: 2 });
}

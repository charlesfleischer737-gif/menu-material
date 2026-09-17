import assert from "node:assert/strict";
import { Worker as NodeWorker } from "node:worker_threads";
import { PDFDocument } from "pdf-lib";
import { newMenuDocument, newMenuEntry } from "../lib/menu-document.ts";
import { renderDesignedMenuPdf } from "../lib/menu-pdf-v2.ts";
import { installWorkerGraphics } from "./menu-worker-graphics.mjs";
installWorkerGraphics();
const workers = [];
let created = 0,
  terminated = 0;
globalThis.Worker = class {
  constructor(url, options) {
    assert(url.pathname.endsWith("/menu-proof.worker.ts"));
    assert.equal(options.type, "module");
    this.thread = new NodeWorker(
      new URL("./menu-worker-bridge.mjs", import.meta.url),
    );
    this.pending = [];
    this.thread.on("message", (data) => {
      if (data.ready) {
        this.ready = true;
        for (const item of this.pending) this.thread.postMessage(item);
        this.pending = [];
      } else this.onmessage?.({ data });
    });
    this.thread.on("error", (error) => this.onerror?.(error));
    workers.push(this);
    created++;
  }
  postMessage(data) {
    if (this.ready) this.thread.postMessage(data);
    else this.pending.push(data);
  }
  terminate() {
    terminated++;
    return this.thread.terminate();
  }
};
const { prepareMenuProof, exportDesignedMenuPdf } =
  await import("../lib/menu-proof-client.ts");
const menu = {
  ...newMenuDocument({
    design: "truck",
    layout: "featured",
    printProfile: "press",
    sections: [
      {
        id: crypto.randomUUID(),
        name: "From the truck",
        description: "",
        pageBreakBefore: false,
        items: Array.from({ length: 30 }, (_, n) =>
          newMenuEntry({
            name: `Taco ${n + 1}`,
            description: "Corn tortilla, slow-cooked filling, fresh salsa",
            price: 500 + n,
            photoId: n === 0 ? crypto.randomUUID() : null,
            featured: n === 0,
          }),
        ),
      },
    ],
  }),
  restaurant: { name: "Taco Local", currency: "USD", style: {} },
};
try {
  const expected = await renderDesignedMenuPdf(menu, { proof: true });
  const result = await prepareMenuProof(menu);
  assert.equal(created, 1, "the PDF was composed in an actual worker thread");
  assert.equal(result.signature, expected.signature);
  assert.deepEqual(
    result.layout,
    expected.layout,
    "worker and ordinary renderers use exactly the same layout",
  );
  assert.deepEqual(result.warnings, expected.warnings);
  const pdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(pdf.getPageCount(), expected.pages);
  assert.equal(
    await exportDesignedMenuPdf(menu),
    result,
    "download reuses the exact prepared PDF",
  );
  const second = await prepareMenuProof({ ...menu, title: "Lunch" });
  assert(second.pages > 0);
  assert.equal(
    created,
    1,
    "a healthy worker retains its font cache across edits",
  );
  const controller = new AbortController();
  const stale = prepareMenuProof(
    { ...menu, title: "Obsolete" },
    { signal: controller.signal },
  );
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(stale, { name: "AbortError" });
  assert.equal(
    terminated,
    1,
    "obsolete CPU work is terminated, not only ignored",
  );
  await prepareMenuProof({ ...menu, title: "Current" });
  assert.equal(created, 2, "the next edit gets a healthy replacement worker");
  await assert.rejects(
    prepareMenuProof({ ...menu, title: "Unsupported 漢" }),
    /cannot display/,
  );
  await prepareMenuProof({ ...menu, title: "Recovered" });
  assert.equal(
    created,
    2,
    "content diagnostics do not destroy a healthy worker",
  );
  const unreviewed = structuredClone(menu);
  unreviewed.sections[0].items[0].sourceReviewed = false;
  await assert.rejects(exportDesignedMenuPdf(unreviewed), /original/i);
  const dispose = new AbortController();
  const disposeProof = prepareMenuProof(
    { ...menu, title: "Dispose idle worker" },
    { signal: dispose.signal },
  );
  await new Promise((resolve) => setImmediate(resolve));
  dispose.abort();
  await assert.rejects(disposeProof, { name: "AbortError" });
  globalThis.Worker = class {
    constructor() {
      throw Error("Workers blocked in this browser");
    }
  };
  const fallback = await prepareMenuProof({ ...menu, title: "Fallback" });
  assert.equal(
    fallback.pages,
    expected.pages,
    "unsupported workers fall back to the same PDF renderer",
  );
  assert.equal(
    created,
    2,
    "fallback does not repeatedly attempt broken workers",
  );
  console.log(
    "Menu worker: real off-thread composition with photos, exact layout/profile parity, PDF export reuse, warm-worker reuse, termination, recovery, and reviewed export gating passed. Canvas uses a test adapter; browser/device latency is not asserted.",
  );
} finally {
  await Promise.all(workers.map((w) => w.thread.terminate()));
}

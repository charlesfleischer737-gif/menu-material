import { parentPort } from "node:worker_threads";
import { installWorkerGraphics } from "./menu-worker-graphics.mjs";
installWorkerGraphics();
globalThis.postMessage = (message) => parentPort.postMessage(message);
await import(
  process.env.MENU_PROOF_WORKER_ENTRY || "../lib/menu-proof.worker.ts"
);
parentPort.on("message", (data) => globalThis.onmessage({ data }));
parentPort.postMessage({ ready: true });

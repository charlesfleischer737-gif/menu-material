import assert from "node:assert/strict";
import { imageBitmap } from "../lib/photo-export.ts";
import { latestFrame } from "../lib/latest-frame.ts";

const queued = new Map();
const painted = [];
let sequence = 0;
const frames = latestFrame(
  (value) => painted.push(value),
  (callback) => {
    queued.set(++sequence, callback);
    return sequence;
  },
  (id) => queued.delete(id),
);
for (let i = 0; i < 100; i++) frames.push(i);
assert.equal(queued.size, 1, "Input bursts schedule a single frame");
queued.get(1)(0);
queued.delete(1);
assert.deepEqual(painted, [99], "Only the newest input is painted");
frames.push(100);
const cancelled = queued.get(2);
frames.clear();
assert.equal(queued.size, 0);
frames.push(101);
cancelled(0);
assert.deepEqual(
  painted,
  [99],
  "Even an obsolete callback cannot paint after source cleanup",
);
queued.get(3)(0);
queued.delete(3);
assert.deepEqual(painted, [99, 101]);
frames.clear();

let fetches = 0,
  decodes = 0;
globalThis.fetch = async () => {
  fetches++;
  return new Response("image");
};
globalThis.createImageBitmap = async () => {
  decodes++;
  return { close() {} };
};
const early = new AbortController();
early.abort();
await assert.rejects(imageBitmap("/private/photo", early.signal), {
  name: "AbortError",
});
assert.equal(fetches, 0, "An already cancelled photo makes no request");

let finishFetch;
const duringFetch = new AbortController();
globalThis.fetch = (_, init) => {
  assert.equal(init.signal, duringFetch.signal);
  return new Promise((resolve) => {
    finishFetch = resolve;
  });
};
const obsoleteFetch = imageBitmap("/private/old", duringFetch.signal);
duringFetch.abort();
finishFetch(new Response("old image"));
await assert.rejects(obsoleteFetch, { name: "AbortError" });
assert.equal(decodes, 0, "A late download is not decoded after cancellation");

let finishDecode, signalDecode;
const decoding = new Promise((resolve) => {
  signalDecode = resolve;
});
let closed = 0;
globalThis.fetch = async () => new Response("image");
globalThis.createImageBitmap = () => {
  signalDecode();
  return new Promise((resolve) => {
    finishDecode = resolve;
  });
};
const duringDecode = new AbortController();
const obsoleteDecode = imageBitmap("/private/old", duringDecode.signal);
await decoding;
duringDecode.abort();
finishDecode({
  close() {
    closed++;
  },
});
await assert.rejects(obsoleteDecode, { name: "AbortError" });
assert.equal(
  closed,
  1,
  "A non-cancellable decode releases its late bitmap exactly once",
);

const current = {
  close() {
    closed++;
  },
};
globalThis.createImageBitmap = async () => current;
assert.equal(await imageBitmap("/private/current"), current);
assert.equal(
  closed,
  1,
  "The owner retains the successful bitmap until cleanup",
);
globalThis.fetch = async () => new Response("unavailable", { status: 503 });
await assert.rejects(
  imageBitmap("/private/current"),
  /This photo could not be opened/,
);
console.log(
  "Photo preview lifecycle: latest-frame coalescing, invalidated callbacks and download/decode cancellation passed.",
);

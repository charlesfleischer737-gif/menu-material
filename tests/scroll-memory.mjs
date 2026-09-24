import assert from "node:assert/strict";
import {
  rememberScroll,
  restoreScroll,
  savedScroll,
  watchScroll,
} from "../lib/scroll-memory.ts";

// A small window: one page of adjustable height, history entries, frames
// run by hand and a clock the test controls.
const listeners = new Map();
const frames = new Map();
let frameId = 0;
let clock = 0;
let saves = 0;
let loadType = "navigate";
const page = { height: 4000 };
class History {
  replaceState(state) {
    saves++;
    this.state = state;
  }
}
const history = new History();
history.state = { router: "kept" };
// The router patches the instance; saving must not go through it.
history.replaceState = () => {
  throw new Error("The router's patched replaceState was used");
};
const dispatch = (type) => {
  for (const listener of [...(listeners.get(type) || [])]) listener();
};
globalThis.window = {
  scrollX: 0,
  scrollY: 0,
  innerHeight: 800,
  history,
  History,
  performance: {
    now: () => clock,
    getEntriesByType: () => [{ type: loadType }],
  },
  scrollTo({ left, top, behavior }) {
    assert.equal(behavior, "instant", "Restoring never animates");
    this.scrollX = left;
    this.scrollY = Math.max(0, Math.min(top, page.height - this.innerHeight));
    dispatch("scroll");
  },
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  },
  removeEventListener(type, listener) {
    listeners.get(type)?.delete(listener);
  },
  requestAnimationFrame(callback) {
    frames.set(++frameId, callback);
    return frameId;
  },
  cancelAnimationFrame(id) {
    frames.delete(id);
  },
};
globalThis.document = {
  documentElement: {
    get scrollHeight() {
      return page.height;
    },
  },
};
const runFrames = (count) => {
  for (let i = 0; i < count; i++) {
    const due = [...frames.values()];
    frames.clear();
    for (const callback of due) callback(clock);
  }
};
const scrollTo = (y) => {
  window.scrollY = y;
};

// Saving keeps the router's own keys and skips unchanged positions.
scrollTo(1200);
rememberScroll();
assert.deepEqual(savedScroll(), { x: 0, y: 1200 });
assert.equal(history.state.router, "kept", "Existing entry state is kept");
const afterFirstSave = saves;
rememberScroll();
assert.equal(saves, afterFirstSave, "An unchanged position is not saved again");
assert.equal(savedScroll(null), null);
assert.equal(savedScroll("text"), null);
assert.equal(savedScroll({ router: "kept" }), null);

// Restoring waits until the page is tall enough, then holds and stops.
page.height = 600;
scrollTo(0);
restoreScroll({ x: 0, y: 2500 });
runFrames(3);
assert.equal(window.scrollY, 0, "Content that is still loading is waited for");
scrollTo(40);
rememberScroll();
assert.equal(
  savedScroll().y,
  1200,
  "Positions passed on the way are not saved while restoring",
);
page.height = 4000;
runFrames(1);
assert.equal(window.scrollY, 2500, "Arrives once the page reaches");
runFrames(3);
assert.equal(frames.size, 0, "Stops after holding the position");
scrollTo(0);
runFrames(2);
assert.equal(window.scrollY, 0, "A finished restore no longer moves the page");

// Something else scrolling on arrival is outlasted.
restoreScroll({ x: 0, y: 1500 });
runFrames(1);
scrollTo(0);
runFrames(1);
assert.equal(window.scrollY, 1500, "The saved position is held");
runFrames(4);

// The owner's own input ends a pending restore at once.
for (const input of ["wheel", "touchstart", "keydown", "pointerdown"]) {
  page.height = 600;
  scrollTo(0);
  restoreScroll({ x: 0, y: 2500 });
  runFrames(1);
  dispatch(input);
  page.height = 4000;
  runFrames(3);
  assert.equal(window.scrollY, 0, `${input} cancels restoring`);
  assert.equal(frames.size, 0);
}

// When the page never becomes tall enough, settle for as far as it reaches.
page.height = 1800;
scrollTo(0);
clock = 0;
restoreScroll({ x: 0, y: 2500 }, 1000);
runFrames(2);
assert.equal(window.scrollY, 0);
clock = 1001;
runFrames(1);
assert.equal(window.scrollY, 1000, "Goes as far as the page reaches");
runFrames(3);
assert.equal(frames.size, 0);
page.height = 4000;

// Watching: saves after scrolling pauses, restores on Back and reload.
scrollTo(0);
history.state = { router: "kept" };
const stop = watchScroll(5);
scrollTo(900);
dispatch("scroll");
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(savedScroll(), { x: 0, y: 900 }, "Saved after a pause");
history.state = { router: "kept", __vinext_scrollX: 0, __vinext_scrollY: 2100 };
dispatch("popstate");
runFrames(4);
assert.equal(window.scrollY, 2100, "Back and Forward restore the entry");
dispatch("pagehide");
assert.equal(savedScroll().y, 2100);
stop();
assert.equal(listeners.get("scroll").size, 0, "Cleanup removes listeners");
assert.equal(listeners.get("popstate").size, 0);

for (const [type, expected] of [
  ["reload", 1700],
  ["back_forward", 1700],
  ["navigate", 0],
]) {
  loadType = type;
  scrollTo(0);
  history.state = { __vinext_scrollY: 1700 };
  const cleanup = watchScroll();
  runFrames(4);
  assert.equal(
    window.scrollY,
    expected,
    `A ${type} load starts at the right place`,
  );
  cleanup();
}

console.log(
  "Scroll memory: saved positions, waiting for content, owner input, timeouts, Back, Forward and reload passed.",
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const dietary = await import("../lib/dietary.ts");
const photoUse = await import("../lib/photo-use.ts");
const { normalizeDietary } = dietary;
let checks = 0;
const ok = (...args) => {
  assert(...args);
  checks++;
};
const same = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};
const rejects = async (promise, expected, message) => {
  await assert.rejects(promise, expected, message);
  checks++;
};

// Dietary notes: legacy values still map exact synonyms; typed text doesn't.
same(normalizeDietary(["V", "gluten free", "Spicy"]), [
  "vegetarian",
  "gluten-free",
  "Spicy",
]);
same(
  normalizeDietary(["V", "GF", "vegan", "Spicy"], { synonyms: false }),
  ["vegan", "V", "GF", "Spicy"],
  "typed synonyms stay notes; tag ids are still tags",
);
same(normalizeDietary('["df"]'), ["dairy-free"], "stored rows still map");

/**
 * Mounts a real component from app/components with a minimal, shallow hooks
 * runtime: enough to render it, fire its handlers and re-render after each
 * event (or settled promise), the way React does. Child components aren't
 * run; `modules` stands in for the component's imports (or builds them from
 * the hooks, for stubs that are hooks themselves).
 */
function mount(file, modules) {
  const source = readFileSync(
    new URL(`../app/components/${file}`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  let slots = [],
    cursor = 0,
    effects = [],
    dirty = false,
    tree = null,
    props = {};
  const hooks = {
    useState(init) {
      const slot = (slots[cursor++] ||= {
        value: typeof init === "function" ? init() : init,
        queue: [],
      });
      // Like React, updates (and updater functions) apply at the next render.
      for (const next of slot.queue.splice(0))
        slot.value = typeof next === "function" ? next(slot.value) : next;
      return [
        slot.value,
        (next) => {
          slot.queue.push(next);
          dirty = true;
        },
      ];
    },
    useRef(init) {
      return (slots[cursor++] ||= { current: init });
    },
    useId() {
      return (slots[cursor++] ||= { id: `:r${cursor}:` }).id;
    },
    useEffect(run, deps) {
      const index = cursor++,
        previous = slots[index];
      if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i])))
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { deps, cleanup: run() };
        });
    },
    useCallback(callback, deps) {
      const index = cursor++,
        previous = slots[index];
      if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i])))
        slots[index] = { deps, callback };
      return slots[index].callback;
    },
  };
  const element = (type, props, key) => ({ type, props, key });
  const imports = {
    react: hooks,
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    ...(typeof modules === "function" ? modules(hooks) : modules),
  };
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (id) => {
      assert(id in imports, `${file} imports ${id}`);
      return imports[id];
    },
    compiled,
    compiled.exports,
  );
  const Component = compiled.exports.default;
  function render(next = props) {
    props = next;
    do {
      dirty = false;
      cursor = 0;
      tree = Component(props);
      const pending = effects;
      effects = [];
      for (const run of pending) run();
    } while (dirty);
  }
  function* walk(node) {
    if (Array.isArray(node)) for (const child of node) yield* walk(child);
    else if (node && typeof node === "object") {
      yield node;
      yield* walk(node.props?.children);
    }
  }
  return {
    render,
    find: (test, within = tree) => [...walk(within)].filter(test),
    fire(handler, event) {
      handler(event);
      render();
    },
    /** Lets pending promises (requests, file checks) settle, then renders. */
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      render();
    },
  };
}
/** Plain text inside an element, as a person reads it. */
const text = (node) =>
  node == null || typeof node === "boolean"
    ? ""
    : typeof node !== "object"
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join("")
        : text(node.props?.children);

/** The real DietaryPicker, with its parent keeping whatever it emits. */
function renderPicker(initial) {
  const picker = mount("dietary-picker.tsx", { "@/lib/dietary": dietary });
  let value = initial;
  const emitted = [];
  const onChange = (next) => {
    value = next;
    emitted.push(next);
    picker.render({ value, onChange });
  };
  picker.render({ value, onChange });
  const { find, fire } = picker;
  const input = () => find((n) => n.type === "input")[0];
  return {
    get value() {
      return value;
    },
    emitted,
    noteText: () => input().props.value,
    pressed: () =>
      find((n) => n.type === "button" && n.props["aria-pressed"]).map(
        (n) => n.props.children,
      ),
    focus: () => fire(input().props.onFocus),
    blur: () => fire(input().props.onBlur),
    click: (label) =>
      fire(
        find((n) => n.type === "button" && n.props.children === label)[0].props
          .onClick,
      ),
    /** Types one character at a time, as a keyboard does. */
    type(typed) {
      for (const character of typed) {
        const next = input().props.value + character;
        fire(input().props.onChange, { target: { value: next } });
      }
    },
    erase(count) {
      for (let n = 0; n < count; n++) {
        const next = input().props.value.slice(0, -1);
        fire(input().props.onChange, { target: { value: next } });
      }
    },
  };
}
const entries = (value) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .sort();
// The audit's notes, typed one character at a time into an untagged dish.
for (const [typed, expected] of [
  ["Veal jus, GF bun on request", ["Veal jus", "GF bun on request"]],
  ["Very spicy", ["Very spicy"]],
  ["Vg option, ask server", ["Vg option", "ask server"]],
  [
    "Contains alcohol, vegan on request",
    ["Contains alcohol", "vegan on request"],
  ],
  ["Dairy-free on request", ["Dairy-free on request"]],
]) {
  const picker = renderPicker([]);
  picker.focus();
  picker.type(typed);
  ok(picker.emitted.length === typed.length, `${typed}: one change per key`);
  picker.emitted.forEach((value, n) =>
    same(
      [...value].sort(),
      entries(typed.slice(0, n + 1)),
      `${typed}: key ${n + 1} stores only what's typed ("V" stays "V")`,
    ),
  );
  same(picker.value, expected, `${typed}: stored exactly as typed`);
  same(picker.pressed(), [], `${typed}: no chip lights up while typing`);
  picker.blur();
  same(picker.value, expected, `${typed}: still exact after leaving the field`);
  same(picker.pressed(), [], `${typed}: no tag after leaving the field`);
  ok(picker.noteText() === expected.join(", "));
}
// Chips chosen before typing stay chosen, and typing doesn't add any.
{
  const picker = renderPicker(["dairy-free", "contains-milk"]);
  picker.focus();
  picker.type("V");
  same(picker.pressed(), ["Dairy-free", "Milk"], "chips hold while typing");
  picker.type("eal jus, gf");
  picker.erase(2);
  picker.type("GF bun");
  picker.blur();
  same(picker.value, ["dairy-free", "contains-milk", "Veal jus", "GF bun"]);
  same(picker.pressed(), ["Dairy-free", "Milk"]);
  picker.click("Vegan");
  same(
    picker.value,
    ["vegan", "dairy-free", "contains-milk", "Veal jus", "GF bun"],
    "a chip keeps the typed notes",
  );
}
// A saved "GF" (written before tags existed) still reads as Gluten-free.
{
  const picker = renderPicker(["GF", "Spicy"]);
  same(picker.pressed(), ["Gluten-free"]);
  ok(picker.noteText() === "Spicy");
  picker.focus();
  picker.type(", hot");
  same(picker.value, ["gluten-free", "Spicy", "hot"]);
}

// Photo types come from the file's bytes, whatever its name or type says.
const { api, normalizePhoto, photoAccept, photoFileError, photoFormat } =
  await import("../lib/client.ts");
const bytes = (...parts) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );
// An ISO media file type box: size, "ftyp", major brand, version, brands.
const ftyp = (major, ...compatible) =>
  bytes(
    [0, 0, 0, 16 + 4 * compatible.length],
    "ftyp",
    major,
    [0, 0, 0, 0],
    ...compatible,
  );
const samples = {
  jpeg: bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF"),
  png: bytes([0x89], "PNG\r\n\x1a\n", [0, 0, 0, 13], "IHDR"),
  webp: bytes("RIFF", [36, 0, 0, 0], "WEBPVP8 "),
  gif: bytes("GIF89a", [1, 0, 1, 0]),
  gif87: bytes("GIF87a", [1, 0, 1, 0]),
  heic: ftyp("heic", "mif1", "heic"),
  heif: ftyp("mif1", "mif1", "heic"),
  avif: ftyp("avif", "avif", "mif1", "miaf", "MA1B"),
  avifAsHeif: ftyp("mif1", "mif1", "miaf", "avif"),
  bmp: bytes("BM", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  text: bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"),
};
for (const [name, expected] of Object.entries({
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
  gif87: "gif",
  heic: "heic",
  heif: "heic",
  avif: "avif",
  avifAsHeif: "avif",
  bmp: null,
  text: null,
}))
  ok(photoFormat(samples[name]) === expected, `${name} reads as ${expected}`);
ok(
  photoFormat(new Uint8Array()) === null && photoFormat(bytes("ftyp")) === null,
);
for (const type of ["image/jpeg", "image/png", "image/webp", ".heic", ".heif"])
  ok(photoAccept.split(",").includes(type), `pickers accept ${type}`);
const file = (name, data, type = "") => new File([data], name, { type });
const choose = "Choose a JPEG, PNG, HEIC or WebP photo.";
for (const name of ["jpeg", "png", "webp", "heic", "heif"])
  ok(
    (await photoFileError(file(name, samples[name]))) === "",
    `${name} is fine`,
  );
ok(
  (await photoFileError(file("photo.jpg", samples.gif, "image/jpeg"))) ===
    `GIF files can’t be uploaded. ${choose}`,
  "a GIF named .jpg is still a GIF",
);
ok(
  (await photoFileError(file("photo.heic", samples.avif, "image/heic"))) ===
    `AVIF files can’t be uploaded. ${choose}`,
  "AVIF isn't mistaken for HEIC",
);
ok(
  (await photoFileError(file("scan.bmp", samples.bmp))) ===
    `This file type can’t be uploaded. ${choose}`,
);
ok(
  (await photoFileError(file("empty.jpg", new Uint8Array()))).includes("empty"),
);
ok(
  (
    await photoFileError(file("huge.jpg", new Uint8Array(20 * 1024 * 1024 + 1)))
  ).includes("smaller than 20 MB"),
);
// normalizePhoto refuses an unsupported file before decoding it, so callers
// (My Dishes, Photo Studio, the guest studio) never create a dish for it.
let decoded = 0;
globalThis.createImageBitmap = async () => {
  decoded++;
  throw Error("no decoder in tests");
};
for (const name of ["gif", "avif", "bmp"])
  await rejects(normalizePhoto(file(`photo.${name}`, samples[name])), {
    message: new RegExp(`can’t be uploaded\\. ${choose}$`),
  });
ok(decoded === 0, "unsupported files are refused before decoding");
await rejects(normalizePhoto(file("photo.webp", samples.webp)), {
  message: `This photo couldn’t be opened. It may be damaged. ${choose}`,
});
ok(decoded === 1, "WebP is decoded like any supported photo");

// Errors: the service's own message wins; a bare 413 from the host means the
// upload was too large.
const replies = [];
globalThis.fetch = async () => {
  const next = replies.shift();
  if (next instanceof Error) throw next;
  return next;
};
const reply = (body, status, type = "text/plain") =>
  replies.push(
    new Response(body, { status, headers: { "Content-Type": type } }),
  );
reply("Payload Too Large", 413);
await rejects(api("assets", new FormData()), {
  message: "This photo is too large to upload. Choose one under 20 MB.",
  status: 413,
});
reply(
  JSON.stringify({ error: "Photos must be 20 MB or smaller." }),
  413,
  "application/json",
);
await rejects(api("assets", new FormData()), {
  message: "Photos must be 20 MB or smaller.",
});
reply("Payload Too Large", 413);
await rejects(
  api("menus", { title: "x" }),
  { message: "The service couldn’t complete that action. Please try again." },
  "only uploads are told the photo is too large",
);
reply("Bad gateway", 502);
await rejects(api("assets", new FormData()), {
  message: "The service couldn’t complete that action. Please try again.",
  status: 502,
});

// The staff photo page: a dead link can't be fixed by opening it again.
const client = await import("../lib/client.ts");
async function staffPage() {
  const page = mount("staff-upload.tsx", {
    "@/components/ui/button": { Button: function Button() {} },
    "./brand": { default: function Brand() {} },
    "@/lib/client": client,
    "@/lib/photo-advice": { photoAdvice: async () => "Nice light." },
  });
  page.render({ token: "t".repeat(43) });
  await page.settle();
  const alert = () => text(page.find((n) => n.props.role === "alert"));
  const retry = () =>
    page.find((n) => text(n) === "Try opening again" && n.props.onClick)[0];
  const said = (words) => page.find((n) => text(n) === words).length > 0;
  return { page, alert, retry, said };
}
reply(
  JSON.stringify({
    error:
      "This upload link has expired or was revoked. Ask the owner for a new link.",
  }),
  404,
  "application/json",
);
{
  const { alert, retry, said } = await staffPage();
  ok(alert() === "This upload link has expired or isn’t valid.", alert());
  ok(!retry(), "no retry for a dead link");
  ok(said("Ask the restaurant for a new link."));
}
replies.push(new TypeError("Failed to fetch"));
{
  const { page, alert, retry, said } = await staffPage();
  ok(
    alert() ===
      "The photo drop couldn’t be opened. Check your connection and try again.",
    alert(),
  );
  ok(retry() && !said("Ask the restaurant for a new link."));
  reply(
    JSON.stringify({
      name: "Corner House",
      dishes: [{ id: "d1", name: "Pie" }],
    }),
    200,
    "application/json",
  );
  page.fire(retry().props.onClick);
  await page.settle();
  ok(!alert() && !retry(), "a retry opens the page once the network is back");
  // A GIF is refused as soon as it's chosen, before anything is sent.
  const input = page.find((n) => n.type === "input")[0];
  const gif = file("party.gif", samples.gif, "image/gif");
  input.props.ref.current = { files: [gif], value: "party.gif" };
  page.fire(input.props.onChange, { target: { files: [gif] } });
  await page.settle();
  ok(alert() === `GIF files can’t be uploaded. ${choose}`, alert());
  ok(input.props.ref.current.value === "", "the refused file is cleared");
  const send = page.find((n) => text(n) === "Send to owner")[0];
  ok(send.props.disabled, "nothing to send");
  ok(replies.length === 0, "no request was made for the GIF");
}
reply(
  JSON.stringify({ error: "Please try again shortly." }),
  503,
  "application/json",
);
{
  const { alert, retry } = await staffPage();
  ok(
    alert() === "Please try again shortly." && retry(),
    "service errors retry",
  );
}

// My Dishes: the real DishLibrary, with the service and its dialogs stubbed.
const dishLibrary = await import("../lib/dish-library.ts");
ok(dishLibrary.dishSection({ category: "  " }) === "Dishes");
ok(dishLibrary.dishSection({ category: " Mains " }) === "Mains");
for (const [typed, price] of [
  ["", 0],
  ["12.5", 12.5],
  [0, 0],
  ["-1", null],
  ["1000001", null],
  ["abc", null],
])
  ok(dishLibrary.typedPrice(typed) === price, `price "${typed}"`);
globalThis.window = { confirm: () => true, dispatchEvent: () => true };
/** useAction from creation-shared: busy, error and notice around a task. */
function useActionStub(hooks) {
  const [busy, setBusy] = hooks.useState(""),
    [error, setError] = hooks.useState(""),
    [notice, setNotice] = hooks.useState("");
  async function act(label, fn) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return { busy, error, notice, setError, setNotice, act };
}
const Stub = () => null,
  FeedbackStub = () => null;
function myDishes(dishes, clientOverrides = {}) {
  const calls = [];
  const page = mount("dish-library.tsx", (hooks) => ({
    "lucide-react": new Proxy({}, { get: () => Stub }),
    "@/lib/client": {
      ...client,
      ...clientOverrides,
      api: async (path, body) => {
        calls.push({ path, body });
        if (path === "dishes") return { id: `dish-${calls.length}` };
        if (path.startsWith("dishes/")) return { revision: 2, menus: [] };
        if (path === "assets") return { id: `asset-${calls.length}` };
        return { usage: [] };
      },
    },
    "@/lib/dish-library": dishLibrary,
    "@/lib/photo-use": photoUse,
    "@/lib/photo-destinations": {
      downloadPhotoItem: () => ({}),
      photoLineage: () => ({ format: "menu", lookId: "" }),
    },
    "@/lib/photo-pack": { lookProfile: () => ({}) },
    "./photo-finish-sheet": { PhotoFinishSheet: Stub },
    "./photo-pack-sheet": { PhotoPackSheet: Stub },
    "./photo-hub-actions": { photoActionLabels: {} },
    "@/lib/workspace-navigation": { workspacePreferenceKey: () => "key" },
    "@/components/ui/sheet": {
      Sheet: Stub,
      SheetContent: Stub,
      SheetTitle: Stub,
    },
    "@/components/ui/dialog": {
      Dialog: Stub,
      DialogContent: Stub,
      DialogTitle: Stub,
    },
    "@/components/ui/dropdown-menu": {
      DropdownMenu: Stub,
      DropdownMenuTrigger: Stub,
      DropdownMenuContent: Stub,
      DropdownMenuItem: Stub,
    },
    "./creation-shared": {
      Feedback: FeedbackStub,
      Field: Stub,
      useAction: () => useActionStub(hooks),
    },
    "./dietary-picker": { default: Stub },
    "./controls": { ConfirmDelete: Stub },
    "./creative-header": { default: Stub },
    "./photo-downloads": { default: Stub },
    "@/lib/upgrade": { hasProFeatures: () => true, requestUpgrade: () => {} },
    "./kitty": { default: Stub },
  }));
  page.render({
    state: {
      dishes,
      assets: [],
      restaurant: { id: "r", currency: "USD", style: {} },
      user: { id: "u" },
    },
    refresh: async () => {},
    onPhoto() {},
    onDestination() {},
    onImports() {},
    onOpenWork() {},
  });
  const feedback = () => page.find((n) => n.type === FeedbackStub)[0].props;
  const button = (words) =>
    page.find((n) => n.type === "button" && text(n) === words)[0];
  const input = (test) =>
    page.find((n) => n.type === "input" && test(n.props))[0]?.props;
  return { page, calls, feedback, button, input };
}
const dish = (id, name, category, price) => ({
  id,
  name,
  description: "",
  category,
  price,
  available: 1,
  created_at: 1,
});
{
  const { page, calls, feedback, button, input } = myDishes([
    dish("d1", "Untitled dish", "", 0),
    dish("d2", "Burger", "Mains", 1250),
  ]);
  const card = (name) =>
    page.find((n) => n.props?.["aria-label"] === `Open ${name}`)[0];
  const cardText = (name, className) =>
    text(page.find((n) => n.props?.className === className, card(name)));
  ok(cardText("Untitled dish", "mm-dish-price") === "No price yet");
  ok(cardText("Burger", "mm-dish-price") === "$12.50");
  ok(
    text(page.find((n) => n.type === "small", card("Untitled dish"))) ===
      "Dishes",
  );
  const sections = page.find((n) => n.type === "select")[0];
  same(
    page.find((n) => n.type === "option", sections).map(text),
    ["All sections", "Dishes", "Mains"],
    "no blank Section filter",
  );
  page.fire(card("Untitled dish").props.onClick);
  const price = input((p) => p.type === "number");
  ok(
    price.value === "" && price.placeholder === "No price yet",
    "0 shows empty",
  );
  page.fire(input((p) => p.value === "Untitled dish").onChange, {
    target: { value: "  " },
  });
  page.fire(button("Save details").props.onClick);
  await page.settle();
  ok(feedback().error === "Give your dish a name.", feedback().error);
  ok(!calls.some((c) => c.path === "dishes/d1"), "nothing saved");
  page.fire(input((p) => p.value === "  ").onChange, {
    target: { value: "Soup" },
  });
  input((p) => p.type === "number").ref.current = {
    validity: { badInput: true },
  };
  page.fire(button("Save details").props.onClick);
  await page.settle();
  ok(
    feedback().error.startsWith("Enter a price"),
    "an unreadable price isn't 0",
  );
  input((p) => p.type === "number").ref.current = { validity: {} };
  page.fire(button("Save details").props.onClick);
  await page.settle();
  const saved = calls.find((c) => c.path === "dishes/d1");
  ok(saved && saved.body.price === 0, "an empty price saves as 0");
  ok(saved.body.category === "Dishes", "a blank section saves as Dishes");
  ok(!feedback().error && feedback().notice === "Dish details saved.");
}
// Uploads: a file that can't be used is flagged at once and never becomes a
// dish; a good one is prepared before its dish is created.
const jpeg = file("soup.jpg", samples.jpeg, "image/jpeg"),
  gif = file("party.gif", samples.gif, "image/gif");
for (const prepared of [false, true]) {
  const { page, calls, feedback, button, input } = myDishes(
    [],
    prepared
      ? {
          normalizePhoto: async () => {
            calls.push({ path: "prepared" });
            return new Blob(["jpeg"]);
          },
        }
      : {},
  );
  page.fire(input((p) => p.type === "file").onChange, {
    target: { files: [gif, jpeg], value: "" },
  });
  await page.settle();
  const statuses = () =>
    page
      .find((n) => n.props?.className === "mm-upload-row")
      .map((row) => text(page.find((n) => n.props?.role === "status", row)));
  same(statuses(), [
    `GIF files can’t be uploaded. ${choose}`,
    "Ready to upload",
  ]);
  page.fire(button("Upload photos").props.onClick);
  await page.settle();
  if (prepared) {
    same(
      calls.map((c) => c.path),
      ["prepared", "dishes", "assets"],
      "the photo is prepared before its dish is created",
    );
    same(statuses(), [
      `GIF files can’t be uploaded. ${choose}`,
      "New photo",
    ]);
    ok(feedback().notice.startsWith("Photos uploaded."));
  } else {
    ok(!calls.length, "no dish is created for a photo that can't be used");
    same(statuses(), [
      `GIF files can’t be uploaded. ${choose}`,
      `This photo couldn’t be opened. It may be damaged. ${choose}`,
    ]);
    ok(!feedback().notice && !feedback().error);
  }
  ok(button("Done"), "the dialog can be closed");
}

// A crop too small for a delivery app is a limit, not a failure: callers
// can leave that photo out and carry on.
const photoExports = await import("../lib/photo-export.ts");
globalThis.fetch = async () =>
  new Response(new Blob([samples.jpeg], { type: "image/jpeg" }));
globalThis.createImageBitmap = async () => ({
  width: 1125,
  height: 750,
  close() {},
});
await rejects(photoExports.photoExport("a1", "doordash"), (error) => {
  assert(photoExports.outsideLimits(error), "tagged as outside the limits");
  assert.match(error.message, /too small for DoorDash item photo/);
  return true;
});
ok(!photoExports.outsideLimits(Error("Network down")));

// Bulk download from My Dishes: the real PhotoDownloads, with exports stubbed.
const fflate = await import("fflate");
const studio = await import("../lib/studio.ts");
const destinations = await import("../lib/photo-destinations.ts");
const channelRules = await import("../lib/channel-rules.ts");
const photoPack = await import("../lib/photo-pack.ts");
const identity = await import("../lib/photo-export-identity.ts");
const natural = photoPack.lookProfile("menu-wood"),
  colorful = photoPack.lookProfile("studio-color");
const bulkPhotos = [
  // 2400 × 1800 real photos fit DoorDash; 1125 × 750 is too small.
  {
    assetId: "a-large",
    dishId: "d1",
    name: "Burger",
    fromPhoto: true,
    style: natural,
    size: [2400, 1800],
  },
  {
    assetId: "a-small",
    dishId: "d2",
    name: "Salad",
    fromPhoto: true,
    style: natural,
    size: [1125, 750],
  },
  {
    assetId: "a-color",
    dishId: "d3",
    name: "Soda",
    fromPhoto: true,
    style: colorful,
    size: [2400, 1800],
  },
];
function bulkDownload(items, initialFormat, failWith) {
  const saved = [],
    events = [],
    exported = [],
    used = [];
  const sizeOf = (id) => items.find((i) => i.assetId === id).size;
  const page = mount("photo-downloads.tsx", (hooks) => ({
    "lucide-react": new Proxy({}, { get: () => Stub }),
    "@/lib/client": {
      downloadBlob: (blob, name) => saved.push({ blob, name }),
    },
    "@/lib/photo-export": {
      ...photoExports,
      openOriginalPhoto: async (id) => {
        const [width, height] = sizeOf(id);
        // Like an ImageBitmap, a closed one reads as 0 × 0.
        return {
          width,
          height,
          close() {
            this.width = this.height = 0;
          },
        };
      },
      photoExport: async (id, format) => {
        exported.push(format);
        if (failWith) throw failWith;
        const [width] = sizeOf(id);
        if (format === "doordash" && width < 1400)
          throw Object.assign(
            Error(
              "This crop is too small for DoorDash item photo. Use a wider, higher-resolution photo; enlarging it will not add detail.",
            ),
            { outsideLimits: true },
          );
        return { blob: new Blob([`jpeg ${id}`]), width: 1920, height: 1080 };
      },
    },
    "@/lib/studio": studio,
    "@/lib/photo-destinations": destinations,
    "@/lib/channel-rules": channelRules,
    "@/lib/photo-pack": photoPack,
    "@/lib/photo-export-identity": identity,
    "@/lib/photo-use": photoUse,
    "./creation-shared": {
      CropControls: Stub,
      Feedback: FeedbackStub,
      PhotoFrame: Stub,
      track: (kind, id, details) => events.push({ kind, id, ...details }),
      useAction: () => useActionStub(hooks),
    },
    fflate,
  }));
  page.render({
    items,
    initialFormat,
    onUse: async (assetId) => {
      used.push(assetId);
    },
  });
  const feedback = () => page.find((n) => n.type === FeedbackStub)[0].props;
  const button = (test) =>
    page.find((n) => n.type === "button" && test(text(n), n.props))[0];
  return { page, saved, events, exported, used, feedback, button };
}
{
  const { page, saved, events, exported, used, feedback, button } =
    bulkDownload(bulkPhotos, "doordash");
  await page.settle();
  ok(
    button((words) => words === "DoorDashItem photo").props["aria-pressed"],
    "opens on the photos' own format",
  );
  ok(
    !page.find((n) => n.type === "input" && n.props.type === "checkbox").length,
    "no confirmation to tick",
  );
  const dishButton = (name) => button((words) => words.endsWith(name));
  ok(text(dishButton("Soda")).startsWith("Check first"), "backdrop warning");
  ok(!text(dishButton("Burger")).startsWith("Check first"));
  page.fire(dishButton("Salad").props.onClick);
  await page.settle();
  const warning = text(page.find((n) => n.props.role === "note"));
  ok(
    warning.includes("smaller than DoorDash’s minimum of 1400 × 800") &&
      warning.includes("DoorDash photo rules"),
    warning,
  );
  ok(text(dishButton("Salad")).startsWith("Check first"), "measured, flagged");
  const download = button((words) => words === "Download 3 photos");
  ok(!download.props.disabled, "nothing to tick before downloading");
  page.fire(download.props.onClick);
  await page.settle();
  same(exported, ["doordash", "doordash", "doordash"]);
  // Downloading chooses each photo for use before it is exported.
  same(used, ["a-large", "a-small", "a-color"]);
  ok(!feedback().error, feedback().error);
  ok(
    feedback().notice ===
      "Download started: 2 of 3 photos and upload instructions are in one file.",
    feedback().notice,
  );
  ok(
    saved.length === 1 && saved[0].name === "menu-material-doordash-photos.zip",
  );
  const zip = fflate.unzipSync(
    new Uint8Array(await saved[0].blob.arrayBuffer()),
  );
  same(Object.keys(zip).sort(), [
    "Burger-a-large-doordash.jpg",
    "Soda-a-color-doordash.jpg",
    "Upload instructions.txt",
  ]);
  const instructions = fflate.strFromU8(zip["Upload instructions.txt"]);
  ok(
    instructions.includes("Not included:\n- Salad: This crop is too small"),
    instructions,
  );
  const listed = text(page.find((n) => n.type === "li"));
  ok(listed.startsWith("Salad: This crop is too small for DoorDash"), listed);
  ok(
    events.filter((e) => e.kind === "export_download_started").length === 2,
    "only downloaded photos count as downloaded",
  );
}
// Every photo too small: nothing to download, and each reason is listed.
{
  const { page, saved, feedback, button } = bulkDownload(
    [bulkPhotos[1], { ...bulkPhotos[1], assetId: "a-small-2", name: "Wrap" }],
    "doordash",
  );
  page.fire(button((words) => words === "Download 2 photos").props.onClick);
  await page.settle();
  ok(
    feedback().error === "None of these photos can be downloaded for DoorDash.",
    feedback().error,
  );
  ok(!saved.length && page.find((n) => n.type === "li").length === 2);
}
// Any other failure still stops the download, naming the photo.
{
  const { page, saved, feedback, button } = bulkDownload(
    bulkPhotos,
    "menu",
    Error("This photo could not be opened. Please try again."),
  );
  ok(
    button((words) => words === "Website or menuSquare photo").props[
      "aria-pressed"
    ],
  );
  page.fire(button((words) => words === "Download 3 photos").props.onClick);
  await page.settle();
  ok(
    feedback().error ===
      "Burger: This photo could not be opened. Please try again.",
  );
  ok(!saved.length);
}
// Instagram's 3:4 post, reported to activity events as an Instagram post.
{
  const { page, saved, events, exported, button } = bulkDownload(
    [bulkPhotos[0]],
    "feed",
  );
  page.fire(button((words) => words === "Post 3:4").props.onClick);
  page.fire(
    button((words) => words === "Download for Instagram 3:4 post").props
      .onClick,
  );
  await page.settle();
  same(exported, ["feed-3x4"]);
  ok(saved[0].name === "Burger-a-large-feed-3x4.jpg", saved[0].name);
  ok(
    events.every((e) => e.destination === "feed"),
    JSON.stringify(events),
  );
}

// Looks aim to keep the food as served; AI results can still change it (the
// guidelines and "Report a food change" say so), so no screen promises it.
for (const name of ["explore-gallery.tsx", "studio-style-library.tsx"]) {
  const source = readFileSync(
    new URL(`../app/components/${name}`, import.meta.url),
    "utf8",
  ).replace(/\s+/g, " ");
  for (const promise of ["never your food", "stay the same", "stays your food"])
    ok(!source.includes(promise), `${name} doesn't promise "${promise}"`);
  ok(source.includes("check each result before sharing"));
}

console.log(
  `PASS: ${checks} dish and upload checks: dietary notes typed one character at a time, photo types refused before anything is created, upload errors, and looks described as intent.`,
);

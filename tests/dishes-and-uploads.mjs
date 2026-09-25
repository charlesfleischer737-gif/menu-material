import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const dietary = await import("../lib/dietary.ts");
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
 * Runs the real DietaryPicker (app/components/dietary-picker.tsx) with a
 * minimal hooks runtime: enough to render one component, fire its handlers
 * and re-render with the parent's new value, the way React does per event.
 */
function renderPicker(initial) {
  const source = readFileSync(
    new URL("../app/components/dietary-picker.tsx", import.meta.url),
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
    tree = null;
  const hooks = {
    useState(init) {
      const slot = (slots[cursor++] ||= {
        value: typeof init === "function" ? init() : init,
      });
      return [
        slot.value,
        (next) => {
          const value = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(value, slot.value)) {
            slot.value = value;
            dirty = true;
          }
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
  };
  const element = (type, props, key) => ({ type, props, key });
  const modules = {
    react: hooks,
    "react/jsx-runtime": { jsx: element, jsxs: element, Fragment: "fragment" },
    "@/lib/dietary": dietary,
  };
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (id) => modules[id],
    compiled,
    compiled.exports,
  );
  const Picker = compiled.exports.default;
  let value = initial;
  const emitted = [];
  const onChange = (next) => {
    value = next;
    emitted.push(next);
  };
  function render() {
    do {
      dirty = false;
      cursor = 0;
      tree = Picker({ value, onChange });
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
  const find = (test) => [...walk(tree)].filter(test);
  const input = () => find((n) => n.type === "input")[0];
  const fire = (handler, event) => {
    handler(event);
    render();
  };
  render();
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
    type(text) {
      for (const character of text) {
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
const entries = (text) =>
  text
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
globalThis.fetch = async () => replies.shift();
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

console.log(
  `PASS: ${checks} dish and upload checks: dietary notes typed one character at a time, photo types refused before anything is created, and upload errors.`,
);

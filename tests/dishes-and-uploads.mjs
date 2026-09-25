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

console.log(
  `PASS: ${checks} dish and upload checks: dietary notes typed one character at a time.`,
);

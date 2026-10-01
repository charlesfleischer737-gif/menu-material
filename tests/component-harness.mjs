import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
/**
 * Mounts a real component from app/components with a minimal, shallow hooks
 * runtime: enough to render it, fire its handlers and re-render after each
 * event (or settled promise), the way React does. Child components aren't
 * run; `modules` stands in for the component's imports (or builds them from
 * the hooks, for stubs that are hooks themselves).
 */
export function mount(file, modules, exportName) {
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
      if (
        !previous ||
        !deps ||
        deps.some((d, i) => !Object.is(d, previous.deps?.[i]))
      )
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
  hooks.useLayoutEffect = hooks.useEffect;
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
  const Component =
    (exportName && compiled.exports[exportName]) ||
    compiled.exports.default ||
    compiled.exports[Object.keys(compiled.exports)[0]];
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
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
    },
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
export const text = (node) =>
  node == null || typeof node === "boolean"
    ? ""
    : typeof node !== "object"
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join("")
        : text(node.props?.children);

import assert from "node:assert/strict";
import { mount, text } from "./component-harness.mjs";
import { canShareImages, isIPhone } from "../lib/image-save.ts";

for (const agent of [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CriOS/130 Mobile/15E148",
])
  assert.equal(isIPhone(agent), true);
for (const agent of [
  "Macintosh; Intel Mac OS X",
  "Windows NT 10.0",
  "Linux; Android",
  "iPad; CPU OS 18_0",
  "",
])
  assert.equal(isIPhone(agent), false);

const files = [
  new File(["full-size-image"], "dish.jpg", { type: "image/jpeg" }),
];
const setNavigator = (value) =>
  Object.defineProperty(globalThis, "navigator", { configurable: true, value });
setNavigator({});
assert.equal(canShareImages(files), false);
setNavigator({
  share() {},
  canShare() {
    throw Error("blocked");
  },
});
assert.equal(canShareImages(files), false);
setNavigator({ share() {}, canShare: () => true });
assert.equal(canShareImages([]), false);
assert.equal(canShareImages(files), true);

const icons = new Proxy({}, { get: (_, name) => name });
const dialogs = {
  Dialog: "Dialog",
  DialogContent: "DialogContent",
  DialogTitle: "DialogTitle",
  DialogDescription: "DialogDescription",
};
let downloaded = [],
  revoked = [],
  created = [],
  results = [],
  closed = 0,
  shared = [];
const originalCreate = URL.createObjectURL,
  originalRevoke = URL.revokeObjectURL;
URL.createObjectURL = (file) => {
  created.push(file);
  return `blob:image-${created.length}`;
};
URL.revokeObjectURL = (url) => revoked.push(url);
const dialog = () => {
  const component = mount("image-save.tsx", {
    "lucide-react": icons,
    "@/components/ui/dialog": dialogs,
    "@/lib/client": { downloadBlob: (...args) => downloaded.push(args) },
    "@/lib/image-save": { canShareImages, isIPhone },
  });
  component.render({
    files,
    onResult: (result) => results.push(result),
    onClose: () => closed++,
  });
  return component;
};
const button = (component, label) => {
  const found = component.find(
    (node) => node.type === "button" && text(node).trim() === label,
  );
  assert.equal(found.length, 1, `One ${label} button`);
  return found[0];
};

let completeShare;
setNavigator({
  canShare: () => true,
  share: (data) => {
    shared.push(data);
    return new Promise((resolve) => (completeShare = resolve));
  },
});
let component = dialog();
assert.equal(
  created[0],
  files[0],
  "The preview uses the exported file, not a thumbnail",
);
const save = button(component, "Save image");
component.fire(save.props.onClick);
assert.deepEqual(
  shared,
  [{ files }],
  "The tap calls native sharing before any asynchronous work",
);
component.fire(save.props.onClick);
assert.equal(shared.length, 1, "Rapid taps open only one share sheet");
component.fire(
  component.find((node) => node.type === "Dialog")[0].props.onOpenChange,
  false,
);
assert.equal(closed, 0, "Keep the file alive while sharing");
assert.equal(downloaded.length, 0);
completeShare();
await component.settle();
assert.deepEqual(results, ["shared"]);
assert.match(
  text(component.find((node) => node.props?.role === "status")[0]),
  /If you chose Save Image/,
);
component.fire(button(component, "Download").props.onClick);
assert.deepEqual(downloaded, [[files[0], "dish.jpg"]]);
assert.deepEqual(results, ["shared", "downloaded"]);
component.unmount();
assert.deepEqual(revoked, ["blob:image-1"]);

setNavigator({
  canShare: () => true,
  share: async () => {
    throw new DOMException("cancel", "AbortError");
  },
});
component = dialog();
component.fire(button(component, "Save image").props.onClick);
await component.settle();
assert.equal(results.at(-1), "cancelled");
assert.equal(downloaded.length, 1, "Cancellation never triggers a download");
assert.equal(button(component, "Save image").props.disabled, false);
component.unmount();

setNavigator({
  canShare: () => true,
  share() {
    throw new DOMException("blocked", "NotAllowedError");
  },
});
component = dialog();
component.fire(button(component, "Save image").props.onClick);
await component.settle();
assert.match(
  text(component.find((node) => node.type === "DialogDescription")[0]),
  /Touch and hold/,
);
assert.equal(component.find((node) => node.type === "img").length, 1);
assert.equal(
  downloaded.length,
  1,
  "A sharing failure offers a Photos fallback without forcing a download",
);
component.unmount();
setNavigator({});
component = dialog();
assert.match(
  text(component.find((node) => node.type === "DialogDescription")[0]),
  /Save to Photos/,
);
assert.equal(button(component, "Download").props.disabled, false);
component.unmount();
assert.equal(revoked.length, created.length, "Every preview URL is released");
URL.createObjectURL = originalCreate;
URL.revokeObjectURL = originalRevoke;

// Exercise the actual photo finish handlers, including async approval and export.
globalThis.Image = class {
  set src(value) {}
};
for (const iphone of [true, false]) {
  let downloads = [],
    uses = [],
    crop;
  let shareCalls = 0;
  setNavigator({
    userAgent: iphone ? "iPhone" : "Macintosh",
    canShare: () => true,
    share: async () => {
      shareCalls++;
    },
  });
  const component = mount(
    "photo-finish-sheet.tsx",
    {
      "lucide-react": icons,
      "@/components/ui/dialog": dialogs,
      "@/components/ui/collapsible": {
        Collapsible: "Collapsible",
        CollapsibleContent: "CollapsibleContent",
        CollapsibleTrigger: "CollapsibleTrigger",
      },
      "@/lib/image-save": { canShareImages },
      "@/lib/client": { downloadBlob: (...args) => downloads.push(args) },
      "@/lib/photo-export": {
        downloadFormats: {
          menu: { ratio: 1, width: 1080, height: 1080, label: "Menu" },
        },
        eventDestination: (v) => v,
        photoExport: async (_id, _destination, edits) => {
          crop = edits;
          return { blob: files[0], width: 1080, height: 1080 };
        },
      },
      "@/lib/photo-export-identity": {
        photoExportEventKey: async () => "export-key",
      },
      "@/lib/studio": { emptyAdjustments: { zoom: 1 } },
      "@/lib/photo-destinations": {
        isCatalogDestination: () => false,
        photoFilename: () => "dish-menu.jpg",
      },
      "@/lib/channel-rules": { destinationChannel: () => null },
      "@/lib/photo-pack": { downloadWarnings: () => [] },
      "./creation-shared": {
        CropControls: "CropControls",
        Field: "Field",
        PhotoFrame: "PhotoFrame",
        track() {},
      },
      "./pro-badge": { ProBadge: "ProBadge" },
      "./image-save": { useIPhone: () => iphone },
    },
    "PhotoFinishSheet",
  );
  component.render({
    open: true,
    assetId: "asset",
    dishId: "dish",
    name: "Pasta",
    initialFormat: "menu",
    fromPhoto: true,
    approved: true,
    style: {},
    onUse: async (use) => uses.push(use),
  });
  const status = () =>
    text(component.find((node) => node.type === "DialogDescription")[0]);
  assert.equal(status(), "Saved in My Dishes.");
  assert.equal(
    component.find((node) => node.type === "DialogDescription").length,
    1,
  );
  assert.equal(
    component.find((node) => node.type === "PhotoFrame")[0].props.showCaption,
    false,
  );
  assert.equal(
    component.find((node) => node.type === "Collapsible")[0].props.open,
    false,
  );
  if (iphone) {
    component.fire(button(component, "Continue").props.onClick);
    await component.settle();
    assert.deepEqual(uses, ["share"]);
    assert.equal(downloads.length, 0, "Preparing for Photos does not download");
    assert.equal(component.find((node) => node.type === "img").length, 1);
    assert.equal(
      component.find((node) => node.type === "Dialog").length,
      1,
      "No second preview dialog",
    );
    assert.equal(status(), "Choose “Save Image” in the share sheet.");
    const save = button(component, "Save to Photos");
    component.fire(save.props.onClick);
    assert.equal(
      shareCalls,
      1,
      "Native sharing starts synchronously from the tap",
    );
    await component.settle();
    assert.equal(status(), "Share sheet closed.");
    assert(button(component, "Done"));

    // Changing the crop invalidates the prepared file and completion state.
    component.fire(
      component.find((node) => node.type === "select")[0].props.onChange,
      { target: { value: "menu" } },
    );
    assert.equal(status(), "Saved in My Dishes.");
    component.fire(button(component, "Continue").props.onClick);
    await component.settle();
    navigator.share = async () => {
      throw Object.assign(new Error("Cancelled"), { name: "AbortError" });
    };
    component.fire(button(component, "Save to Photos").props.onClick);
    await component.settle();
    assert.match(status(), /cancelled/);
    assert.equal(button(component, "Save to Photos").props.disabled, false);
    navigator.share = async () => {
      throw new Error("Unavailable");
    };
    component.fire(button(component, "Save to Photos").props.onClick);
    await component.settle();
    assert.match(status(), /Touch and hold/);
    assert.equal(
      downloads.length,
      0,
      "Sharing failure never forces a download",
    );
  }
  component.fire(button(component, "Download").props.onClick);
  await component.settle();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0][1], "dish-menu.jpg");
  assert.equal(await downloads[0][0].text(), await files[0].text());
  assert.equal(status(), "Download started.");
  assert(button(component, "Done"));
  assert.equal(crop.fit, true, "Saving uses the selected export crop");
  component.unmount();
}
console.log(
  "iPhone image saving: device routing, native share timing, cancellation, fallback, URL cleanup and desktop downloads passed.",
);

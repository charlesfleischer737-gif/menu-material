import assert from "node:assert/strict";
import {
  downloadPhotoItem,
  photoDestination,
  photoFilename,
  photoHistories,
  photoLineage,
  statePhotoHistory,
} from "../lib/photo-destinations.ts";
const original = { id: "source", kind: "source", dish_id: "dish" };
const generated = { id: "generated", kind: "generated", dish_id: "dish" };
const imagined = { id: "imagined", kind: "generated", dish_id: "dish" };
const adjusted = { id: "adjusted", kind: "edited", dish_id: "dish" };
const state = {
  assets: [original, generated, imagined, adjusted],
  outputs: [
    { job_id: "photo-job", asset_id: generated.id },
    { job_id: "description-job", asset_id: imagined.id },
  ],
  jobs: [
    { id: "photo-job", source_id: original.id },
    { id: "description-job", source_id: null },
  ],
  assetEdits: [
    { asset_id: adjusted.id, parent_id: imagined.id, source_id: imagined.id },
  ],
};
assert.equal(downloadPhotoItem(state, generated, "Dish").fromPhoto, true);
assert.equal(
  downloadPhotoItem(state, imagined, "Dish").fromPhoto,
  false,
  "An unrelated upload cannot turn an imagined image into a real-dish photo",
);
assert.equal(
  downloadPhotoItem(state, adjusted, "Dish").fromPhoto,
  false,
  "Cropping a description-only image does not change its origin",
);
state.assetEdits[0].source_id = generated.id;
assert.equal(downloadPhotoItem(state, adjusted, "Dish").fromPhoto, true);
state.assetEdits[0].source_id = adjusted.id;
assert.equal(
  downloadPhotoItem(state, adjusted, "Dish").fromPhoto,
  false,
  "Bad lineage cannot recurse forever",
);
// The server works out every photo's history from its whole lineage: all
// requests (not only the recent ones sent to the page) and removed originals.
const removedOriginal = { id: "removed", kind: "source", dish_id: "dish" };
const histories = photoHistories(
  [removedOriginal, generated, imagined, adjusted],
  [
    {
      asset_id: adjusted.id,
      parent_id: generated.id,
      source_id: removedOriginal.id,
      edits: JSON.stringify({ format: "story", zoom: 1 }),
    },
  ],
  [
    {
      asset_id: generated.id,
      source_id: removedOriginal.id,
      format: "door",
      preset_id: "menu-wood",
      photo_style: null,
    },
    {
      asset_id: imagined.id,
      source_id: null,
      format: "feed",
      preset_id: null,
      photo_style: "no such prompt",
    },
  ],
);
assert.deepEqual(histories.get(generated.id), {
  fromPhoto: true,
  format: "doordash",
  lookId: "menu-wood",
});
assert.deepEqual(
  histories.get(adjusted.id),
  { fromPhoto: true, format: "story", lookId: "menu-wood" },
  "An adjustment keeps its own size, its original and its look",
);
assert.deepEqual(histories.get(imagined.id), {
  fromPhoto: false,
  format: "feed",
  lookId: "",
});
assert.deepEqual(histories.get(removedOriginal.id), {
  fromPhoto: true,
  format: "menu",
  lookId: "keep",
});
// Once a restaurant has more requests than the page receives, the photo's
// own history still says it is a real photo made for DoorDash.
const truncated = {
  assets: [
    {
      ...generated,
      from_photo: true,
      photo_format: "doordash",
      look_id: "menu-wood",
    },
  ],
  jobs: [],
  outputs: [],
  assetEdits: [],
};
assert.equal(
  downloadPhotoItem(truncated, truncated.assets[0], "Dish").fromPhoto,
  true,
);
assert.deepEqual(photoLineage(truncated, truncated.assets[0]), {
  format: "doordash",
  lookId: "menu-wood",
});
assert.equal(
  statePhotoHistory(truncated, { ...generated, from_photo: false }).fromPhoto,
  false,
  "An illustration's history keeps it out of delivery apps",
);
assert.equal(photoDestination("toast"), "toast");
assert.equal(photoDestination("story"), "story");
assert.equal(photoDestination("corrupt saved preference"), "menu");
const filename = photoFilename(
  {
    assetId: "12345678-abcd",
    name: "../../Crème brûlée",
    dishId: "dish",
    fromPhoto: true,
  },
  "toast",
);
assert.equal(filename, "Crème-brûlée-12345678-toast.jpg");
console.log(
  "PASS: destination preferences, safe file names, and actual-photo lineage across generated and edited versions.",
);

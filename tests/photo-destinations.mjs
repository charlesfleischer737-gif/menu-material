import assert from "node:assert/strict";
import {
  downloadPhotoItem,
  photoDestination,
  photoFilename,
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

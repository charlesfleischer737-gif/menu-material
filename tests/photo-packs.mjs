import assert from "node:assert/strict";
const {
  channelRules,
  destinationChannel,
  sizeCheck,
  aspectCheck,
  fileCheck,
  styleProfile,
  styleWarning,
} = await import("../lib/channel-rules.ts");
const { photoStyles, photoBackdrops } = await import("../lib/photo-styles.ts");
const { looks, formats, catalogProfiles } = await import("../lib/studio.ts");
const { exportDimensions } = await import("../lib/photo-export.ts");
const { photoLineage } = await import("../lib/photo-destinations.ts");
const {
  packEntries,
  packFit,
  planPhotoPack,
  verifyPackFile,
  packReadme,
  packZipName,
  lookProfile,
  downloadWarnings,
} = await import("../lib/photo-pack.ts");
let checks = 0;
const ok = (...args) => {
  assert(...args);
  checks++;
};
const MB = 1024 * 1024;

// Channel rules: one source, with sources and a verified date.
for (const rule of Object.values(channelRules)) {
  ok(
    /^\d{4}-\d{2}-\d{2}$/.test(rule.verified),
    `${rule.id} has a verified date`,
  );
  ok(
    rule.sources.length && rule.sources.every((s) => s.startsWith("https://")),
  );
  ok(rule.rules.length && rule.upload.length > 20);
}
ok(
  channelRules.doordash.minWidth === 1400 &&
    channelRules.doordash.minHeight === 800,
);
ok(
  channelRules.uber.aspect.min === 1.25 && channelRules.uber.aspect.max === 1.5,
);
ok(
  channelRules.uber.maxBytes === 10 * MB &&
    channelRules.uber.maxHeight === 10000,
);
ok(
  channelRules.google.minBytes === 10 * 1024 &&
    channelRules.google.maxBytes === 5 * MB,
);
ok(
  channelRules.google.minWidth === 250 &&
    channelRules.google.recommended.width === 720,
);
ok(
  channelRules.instagram.sizes.some(
    (s) => s.width === 1080 && s.height === 1440,
  ),
  "Instagram's 3:4 post size is recorded",
);
// Catalog export limits are derived from the rules, not duplicated.
for (const id of ["doordash", "uber", "toast"]) {
  ok(catalogProfiles[id].minWidth === channelRules[id].minWidth);
  ok(catalogProfiles[id].minHeight === channelRules[id].minHeight);
  ok(catalogProfiles[id].maxBytes === channelRules[id].maxBytes);
  ok(channelRules[id].sources.includes(catalogProfiles[id].source));
}
// Uber's saved format sits inside its accepted range, at its best-quality size.
ok(formats.uber.width === 2880 && formats.uber.height === 2304);
ok(
  aspectCheck(channelRules.uber, formats.uber.width, formats.uber.height)
    .status === "pass",
);
ok(
  aspectCheck(channelRules.uber, 1500, 1000).status === "pass",
  "3:2 is the edge, still accepted",
);
ok(
  aspectCheck(channelRules.uber, 1501, 999).status === "fail",
  "just past 6:4 is not",
);
ok(
  aspectCheck(channelRules.uber, 1001, 801).status === "fail",
  "just under 5:4 is not",
);
ok(
  aspectCheck(channelRules.doordash, 1080, 1080).status === "fail",
  "DoorDash needs landscape",
);
ok(sizeCheck(channelRules.doordash, 1399, 900).status === "fail");
ok(sizeCheck(channelRules.doordash, 1424, 801).status === "pass");
ok(sizeCheck(channelRules.uber, 550, 439).status === "fail");
ok(
  sizeCheck(channelRules.uber, 12000, 10001).status === "fail",
  "Uber caps height",
);
ok(
  sizeCheck(channelRules.google, 600, 600).status === "warn",
  "below Google's 720 recommendation",
);
ok(sizeCheck(channelRules.google, 249, 400).status === "fail");
ok(
  fileCheck(channelRules.google, 9 * 1024).status === "fail",
  "Google needs at least 10 KB",
);
ok(
  fileCheck(channelRules.google, 6 * MB).status === "fail",
  "Google allows up to 5 MB",
);
ok(fileCheck(channelRules.google, 1.2 * MB).status === "pass");
ok(fileCheck(channelRules.uber, 11 * MB).status === "fail");
ok(destinationChannel("feed") === channelRules.instagram);
ok(destinationChannel("story") === channelRules.instagram);
ok(
  destinationChannel("menu") === null && destinationChannel("master") === null,
);

// Every photo style's backdrop is classified; representative styles are right.
ok(photoStyles.length >= 56);
for (const style of photoStyles)
  ok(photoBackdrops.includes(style.backdrop), `${style.id} has a backdrop`);
const backdrop = (id) => looks.find((look) => look.id === id);
const expected = {
  "studio-color": "colorful", // cobalt seamless
  "delivery-white": "white", // white seamless
  "menu-wood": "natural", // warm oak
  "studio-dark": "dark", // charcoal sweep
  "studio-pastel": "colorful",
  "studio-ivory": "white",
  "fine-obsidian": "dark",
  "delivery-daylight": "natural",
  "bakery-rustic": "natural",
  "beverage-poolside": "colorful",
  keep: "natural", // Polish my original keeps the real setting
  white: "white",
  color: "colorful",
  cafe: "natural",
  dark: "dark",
};
for (const [id, value] of Object.entries(expected))
  ok(backdrop(id).backdrop === value, `${id} is ${value}`);
for (const id of [
  "fine-presented",
  "menu-handheld",
  "bakery-hands",
  "studio-levitate",
])
  ok(backdrop(id).staged === true, `${id} is staged`);
ok(!backdrop("menu-wood").staged && !backdrop("studio-color").staged);
// Saved and unknown looks count as natural; "My restaurant look" follows its preset.
ok(
  styleProfile(null).backdrop === "natural" &&
    styleProfile(null).known === false,
);
ok(lookProfile("captured-look").backdrop === "natural");
ok(
  lookProfile("restaurant", { photoPreset: "studio-color" }).backdrop ===
    "colorful",
);
ok(lookProfile("restaurant", {}).backdrop === "natural");

// Warnings: DoorDash rejects colorful and white studio backdrops.
const colorful = lookProfile("studio-color");
const doordashWarning = styleWarning(channelRules.doordash, colorful);
ok(
  doordashWarning.includes(
    "DoorDash often rejects colorful or plain white studio backdrops.",
  ),
);
ok(
  doordashWarning.includes("Neighborhood table") &&
    doordashWarning.includes("Polish my original"),
);
ok(doordashWarning.startsWith("Color-pop campaign"));
ok(
  styleWarning(channelRules.doordash, lookProfile("delivery-white")).includes(
    "plain white",
  ),
);
ok(styleWarning(channelRules.doordash, lookProfile("menu-wood")) === null);
ok(styleWarning(channelRules.doordash, lookProfile("keep")) === null);
ok(
  styleWarning(channelRules.instagram, colorful) === null,
  "Instagram is fine with color",
);
ok(styleWarning(channelRules.uber, colorful) === null);
ok(
  styleWarning(channelRules.uber, lookProfile("menu-handheld")).includes(
    "one centered item",
  ),
);
ok(styleWarning(channelRules.google, colorful).includes("represent reality"));
ok(
  downloadWarnings("doordash", {
    style: colorful,
    source: { width: 2400, height: 1800 },
  }).length === 1,
);
ok(
  downloadWarnings("feed", {
    style: colorful,
    source: { width: 2400, height: 1800 },
  }).length === 0,
);
const tooSmall = downloadWarnings("doordash", {
  style: lookProfile("keep"),
  source: { width: 1125, height: 750 },
});
ok(
  tooSmall.length === 1 && tooSmall[0].includes("1400 × 800"),
  "small sources are warned about",
);
ok(
  downloadWarnings("doordash", {
    style: lookProfile("keep"),
    source: { width: 2400, height: 1800 },
    edits: { zoom: 2 },
  }).length === 1,
  "zooming in can make a crop too small",
);

// Export sizing: exact ratios, never larger than the target or the source.
for (const [w, h] of [
  [2400, 1800],
  [1125, 750],
  [1024, 1536],
  [2048, 1152],
  [1536, 1536],
  [999, 1777],
  [4032, 3024],
]) {
  for (const target of Object.values(formats)) {
    for (const fit of [false, true]) {
      const size = exportDimensions(target, { width: w, height: h }, { fit });
      ok(
        size.width * target.height === size.height * target.width,
        "exact ratio",
      );
      ok(
        size.width <= target.width && size.height <= target.height,
        "never past the target",
      );
      if (fit) ok(size.width <= w && size.height <= h, "fit never enlarges");
      else
        ok(
          size.width <= Math.ceil(size.cropWidth) &&
            size.height <= Math.ceil(size.cropHeight),
          "fill never enlarges its crop",
        );
    }
  }
}
ok(
  exportDimensions(formats.doordash, { width: 2400, height: 1800 }).width ===
    1920,
);
ok(
  exportDimensions(formats.uber, { width: 2048, height: 1152 }).width === 1440,
);

// Pack planning.
ok(
  packEntries.map((e) => e.id).join() ===
    "doordash,uber,google,instagram-post,instagram-story,website",
);
ok(
  packFit(
    { width: 1080, height: 1920, fill: "auto" },
    { width: 1536, height: 1536 },
  ) === true,
  "a square photo is padded for a Story",
);
ok(
  packFit(
    { width: 1080, height: 1920, fill: "auto" },
    { width: 1024, height: 1536 },
  ) === false,
  "a portrait photo fills a Story",
);
ok(
  packFit(
    { width: 1920, height: 1080, fill: "cover" },
    { width: 1024, height: 1536 },
  ) === false,
  "delivery always fills",
);
const source = {
  name: "Corner House Smash Burger",
  width: 2400,
  height: 1800,
  fromPhoto: true,
  style: lookProfile("menu-wood"),
};
const plan = planPhotoPack(source);
const item = (id, p = plan) => p.find((i) => i.entry.id === id);
ok(
  plan.every((i) => i.included),
  "a large natural photo passes everywhere",
);
ok(plan.every((i) => i.checks.every((c) => c.status === "pass")));
ok(item("doordash").width === 1920 && item("doordash").height === 1080);
ok(
  item("uber").width === 2250 && item("uber").height === 1800,
  "Uber 5:4 stops at what the photo supports",
);
ok(item("google").width === 1200 && item("google").height === 1200);
ok(
  item("instagram-post").width === 1080 &&
    item("instagram-post").height === 1350,
);
ok(
  !item("doordash").fit && !item("uber").fit && !item("google").fit,
  "no letterboxing for delivery or Google",
);
for (const i of plan) {
  ok(
    /^corner-house-smash-burger-(doordash|uber-eats|google|instagram-post|instagram-story|website)-\d+x\d+\.jpg$/.test(
      i.filename,
    ),
    i.filename,
  );
  ok(i.filename.endsWith(`-${i.width}x${i.height}.jpg`));
  ok(
    i.width * i.entry.height === i.height * i.entry.width,
    `${i.entry.id} keeps its exact ratio`,
  );
  ok(i.width <= source.width && i.height <= source.height);
}
ok(
  item("doordash").filename ===
    "corner-house-smash-burger-doordash-1920x1080.jpg",
);
ok(
  packZipName("Corner House Smash Burger") ===
    "corner-house-smash-burger-photo-pack.zip",
);
ok(item("uber").checks.find((c) => c.id === "aspect").status === "pass");
ok(
  item("google").checks.some((c) => c.id === "file"),
  "file size is checked where limited",
);

// A colorful style warns (advisory) on DoorDash and Google, but is still included.
const colorPlan = planPhotoPack({ ...source, style: colorful });
ok(item("doordash", colorPlan).included);
ok(
  item("doordash", colorPlan).checks.find((c) => c.id === "backdrop").status ===
    "warn",
);
ok(
  item("google", colorPlan).checks.find((c) => c.id === "backdrop").status ===
    "warn",
);
ok(
  item("uber", colorPlan).checks.find((c) => c.id === "backdrop").status ===
    "pass",
);
ok(item("instagram-post", colorPlan).checks.every((c) => c.id !== "backdrop"));

// Too small for DoorDash: left out with a reason; Uber and Google still fit.
const smallPlan = planPhotoPack({ ...source, width: 1125, height: 750 });
ok(!item("doordash", smallPlan).included);
ok(item("doordash", smallPlan).skipped.includes("1,400 × 800"));
ok(item("uber", smallPlan).included && item("uber", smallPlan).width === 935);
ok(
  item("google", smallPlan).included && item("google", smallPlan).width === 750,
);

// Description-only illustrations stay out of delivery apps and Google.
const illustration = planPhotoPack({ ...source, fromPhoto: false });
for (const id of ["doordash", "uber", "google"]) {
  ok(!item(id, illustration).included);
  ok(item(id, illustration).skipped.includes("created from a description"));
}
for (const id of ["instagram-post", "instagram-story", "website"])
  ok(item(id, illustration).included);
const readme = packReadme(
  source.name,
  illustration,
  new Date("2026-09-24T12:00:00Z"),
);
ok(readme.includes("NOT INCLUDED") && readme.includes("Uber Eats: "));
ok(readme.includes(item("website", illustration).filename));
ok(!readme.includes(item("doordash", illustration).filename));
const fullReadme = packReadme(source.name, colorPlan);
ok(
  fullReadme.includes("Rules checked 2026-09-24") &&
    fullReadme.includes("Check first: Color-pop campaign"),
);
for (const i of colorPlan) ok(fullReadme.includes(i.filename));

// Encoded files are checked against the real byte size.
const heavy = verifyPackFile(item("google"), 6 * MB);
ok(!heavy.included && heavy.skipped.includes("5 MB"));
ok(verifyPackFile(item("google"), 800 * 1024).included);
ok(
  verifyPackFile(item("website"), 50 * MB).included,
  "no limit for the website file",
);

// A photo opens its download on the format it was made for.
const lineageState = {
  assets: [
    { id: "src", kind: "source" },
    { id: "gen", kind: "generated" },
    { id: "edit", kind: "edited" },
  ],
  outputs: [{ job_id: "job", asset_id: "gen" }],
  jobs: [
    {
      id: "job",
      details: JSON.stringify({
        controls: { format: "doordash" },
        lookContext: { presetId: "studio-color" },
      }),
    },
  ],
  assetEdits: [
    {
      asset_id: "edit",
      parent_id: "gen",
      edits: JSON.stringify({ format: "feed" }),
    },
  ],
};
ok(
  JSON.stringify(photoLineage(lineageState, lineageState.assets[1])) ===
    '{"format":"doordash","lookId":"studio-color"}',
);
ok(
  JSON.stringify(photoLineage(lineageState, lineageState.assets[2])) ===
    '{"format":"feed","lookId":"studio-color"}',
);
ok(
  JSON.stringify(photoLineage(lineageState, lineageState.assets[0])) ===
    '{"format":"menu","lookId":"keep"}',
);
lineageState.assetEdits[0].parent_id = "edit";
ok(
  photoLineage(lineageState, lineageState.assets[2]).format === "feed",
  "bad lineage cannot loop",
);

console.log(
  `PASS: ${checks} photo pack checks: channel rules and sources, every style's backdrop, delivery warnings, exact no-upscale sizing, skipped channels, README and file limits.`,
);

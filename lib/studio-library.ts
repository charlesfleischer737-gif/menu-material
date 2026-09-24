import { z } from "zod";
import { looks, styleFor } from "./studio";
import { lookControls } from "./studio-discovery";
import type { Row } from "./client";

export const lookRecipeSchema = z.object({
  look: z
    .string()
    .refine(
      (id) => looks.some((look) => look.id === id),
      "Choose an available look.",
    ),
  photoStyleSnapshot: z.string().max(300),
  photoReferenceIds: z.array(z.string().uuid()).max(3),
  surface: z.enum(["As shown", "Warm wood", "Pale stone", "White seamless"]),
  lighting: z.enum(["As shown", "Soft daylight", "Warm & cozy"]),
  plate: z.enum(["keep", "style", "white"]),
  angle: z.enum(["keep", "overhead", "three-quarter"]),
  composition: z.enum([
    "Full dish",
    "Close-up detail",
    "Room around the plate",
    "Space above for a headline",
  ]),
  studioOverrides: z.array(z.enum(lookControls)).max(5).default([]),
  note: z.string().max(500).default(""),
  occasionId: z
    .enum(["", "christmas", "game-day", "valentines", "summer-drinks"])
    .default(""),
});
const savedLookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  recipe: lookRecipeSchema,
  previewAssetId: z.string().uuid().nullable().default(null),
  archived: z.boolean().default(false),
  version: z.number().int().min(1).default(1),
  compatibleSubjects: z
    .array(z.enum(["food", "drinks"]))
    .min(1)
    .max(2)
    .default(["food", "drinks"]),
});
export const studioLibrarySchema = z
  .object({
    legacyMigrated: z.boolean().default(false),
    favorites: z
      .array(z.string().refine((id) => looks.some((look) => look.id === id)))
      .max(100)
      .default([]),
    recent: z
      .array(z.string().refine((id) => looks.some((look) => look.id === id)))
      .max(12)
      .default([]),
    looks: z.array(savedLookSchema).max(100).default([]),
    defaultLookId: z.string().uuid().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.looks.map((look) => look.id)).size !== value.looks.length)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Saved look identifiers must be unique.",
      });
    if (
      value.defaultLookId &&
      !value.looks.some(
        (look) => look.id === value.defaultLookId && !look.archived,
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose an available saved look as your default.",
      });
  });
export type StudioLibrary = z.infer<typeof studioLibrarySchema>;
export type SavedLook = z.infer<typeof savedLookSchema>;
export const emptyStudioLibrary = (): StudioLibrary => ({
  legacyMigrated: false,
  favorites: [],
  recent: [],
  looks: [],
  defaultLookId: null,
});
export function recipeFromDraft(draft: Row, restaurant: Row) {
  const style = styleFor(draft, restaurant);
  return lookRecipeSchema.parse({
    ...draft,
    photoStyleSnapshot: style.photoStyle || "",
    photoReferenceIds: style.referenceIds || [],
    note: "",
  });
}
export function applySavedLook(look: SavedLook) {
  return {
    ...look.recipe,
    savedLookId: look.id,
    savedLookName: look.name,
    savedLookVersion: look.version,
    styleChosen: true,
    referenceId: look.recipe.photoReferenceIds[0] || "",
  };
}

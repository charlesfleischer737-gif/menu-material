import { z } from "zod";
import { AppError, bucket } from "./core";
import { styleReferenceAsset } from "./promotions";

export const studioReferenceRequest = z
  .object({
    referenceIds: z.array(z.string().uuid()).max(3),
  })
  .strict();

export class UnavailableStudioReference extends AppError {
  constructor() {
    super(
      400,
      "An inspiration photo is unavailable. Replace your inspiration or choose another look.",
    );
  }
}

export async function requireStudioReferences(
  restaurantId: string,
  ids: string[],
) {
  if (!(await studioReferenceAvailability(restaurantId, ids)).available)
    throw new UnavailableStudioReference();
}

// Check metadata only: opening a draft must not download every reference.
// Missing and foreign references share a response and expose no storage keys.
export async function studioReferenceAvailability(
  restaurantId: string,
  ids: string[],
) {
  try {
    const checks = await Promise.all(
      [...new Set(ids)].map(async (id) => {
        const asset = await styleReferenceAsset(restaurantId, id);
        if (!asset) return { id, available: false };
        const object = await bucket().head(asset.working_key || asset.key);
        return {
          id,
          available:
            !!object && object.size > 0 && object.size <= 8 * 1024 * 1024,
        };
      }),
    );
    return { available: checks.every((check) => check.available), checks };
  } catch {
    throw new AppError(
      503,
      "Your inspiration couldn’t be checked. Please try again.",
    );
  }
}

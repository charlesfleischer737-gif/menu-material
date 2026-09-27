/** Persistence status is separate from approval and publication. */
export const draftStatus = {
  saving: "Saving draft…",
  saved: "Draft saved",
  failed: "Draft not saved · try again",
  // Changes the plan can't save, such as to a post with Pro options on Free.
  unsaved: "Changes not saved",
} as const;

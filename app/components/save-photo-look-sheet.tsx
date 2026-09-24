"use client";
import { useId, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { recipeFromDraft } from "@/lib/studio-library";
import type { Row } from "@/lib/client";
import { useStudioLibrary } from "./use-studio-library";
export function SavePhotoLookSheet({
  state,
  draft,
  assetId,
  onClose,
  onCloseAutoFocus,
}: {
  state: Row;
  draft: Row;
  assetId: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const formId = useId();
  const store = useStudioLibrary(state.restaurant.id),
    [name, setName] = useState(draft.savedLookName || "Our restaurant look"),
    [savedId, setSavedId] = useState("");
  async function save() {
    const recipe = recipeFromDraft(draft, state.restaurant),
      id = crypto.randomUUID();
    if (
      await store.mutate((library) => ({
        ...library,
        looks: [
          ...library.looks,
          {
            id,
            name: name.trim(),
            recipe,
            previewAssetId: assetId,
            archived: false,
            version: 1,
            compatibleSubjects:
              recipe.plate === "keep" ? ["food", "drinks"] : ["food"],
          },
        ],
      }))
    )
      setSavedId(id);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !store.busy) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="cx-workspace-popover ps2-dialog ps2-save-dialog"
        showCloseButton={false}
      >
        <header className="ps2-dialog-header">
          <div>
            <DialogTitle>
              {savedId ? "Look saved" : "Save this look"}
            </DialogTitle>
            <DialogDescription>
              Reuse the setting and light with another dish. Your approved photo
              becomes the example.
            </DialogDescription>
          </div>
          <button
            className="ps2-icon-button"
            disabled={store.busy}
            aria-label="Close saved look"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="ps2-save-form ps2-dialog-scroll">
          <img
            className="ps2-saved-preview"
            src={`/api/assets/${assetId}`}
            alt="Approved example for this saved look"
          />
          {store.error && (
            <p role="alert">
              {store.error}
              <button className="cx-link" onClick={() => void store.reload()}>
                Reload saved looks
              </button>
            </p>
          )}
          {savedId ? (
            <>
              <p>Available in Browse all looks → Saved.</p>
              <button
                className="cx-btn cx-secondary"
                disabled={store.busy || store.library.defaultLookId === savedId}
                onClick={() =>
                  void store.mutate((value) => ({
                    ...value,
                    defaultLookId: savedId,
                  }))
                }
              >
                {store.library.defaultLookId === savedId
                  ? "Default for new photos"
                  : "Make my default for new photos"}
              </button>
              <p className="ps2-control-help">
                Applies to new Photo Studio drafts only. Existing photos, menus
                and posts keep their settings.
              </p>
            </>
          ) : (
            <form
              id={formId}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="field">
                Look name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  autoFocus
                />
              </label>
              <p className="ps2-control-help">
                Saving a look keeps it in your collection. It does not change
                your default.
              </p>
              {store.library.looks.length >= 100 && (
                <p role="status">
                  Your collection has reached its 100-look limit.
                </p>
              )}
            </form>
          )}
        </div>
        <footer className="ps2-dialog-footer">
          <span>Only your restaurant can use this look</span>
          {savedId ? (
            <button className="cx-btn" disabled={store.busy} onClick={onClose}>
              Done
            </button>
          ) : (
            <button
              className="cx-btn"
              type="submit"
              form={formId}
              disabled={
                !store.ready ||
                store.busy ||
                !name.trim() ||
                store.library.looks.length >= 100
              }
            >
              {store.busy ? "Saving…" : "Save look"}
            </button>
          )}
        </footer>
      </DialogContent>
    </Dialog>
  );
}

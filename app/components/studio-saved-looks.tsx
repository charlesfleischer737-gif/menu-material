"use client";
import { useState, type ReactNode } from "react";
import {
  Archive,
  Copy,
  Ellipsis,
  Pencil,
  RotateCcw,
  Star,
  StarOff,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { looks } from "@/lib/studio";
import type { SavedLook } from "@/lib/studio-library";
import type { PhotoStyle } from "@/lib/photo-styles";
import { studioCreationBlock } from "@/lib/studio-discovery";
import type { useStudioLibrary } from "./use-studio-library";
import { StyleTile } from "./studio-style-tile";
import { ProBadge, ProNote } from "./pro-badge";

/** Favorites, recent looks and named restaurant looks, as one collection. */
export function StudioSavedLooks({
  store,
  restaurantLook,
  selectedKey,
  guest,
  pro = true,
  disabledStyleIds = [],
  tile,
  onApply,
}: {
  store: ReturnType<typeof useStudioLibrary>;
  restaurantLook?: PhotoStyle;
  selectedKey: string;
  guest: boolean;
  pro?: boolean;
  disabledStyleIds?: string[];
  tile: (
    style: PhotoStyle,
    origin: "favorite" | "recent" | "saved",
  ) => ReactNode;
  onApply: (look: SavedLook) => void;
}) {
  const { library, busy, mutate } = store;
  const [archivedOpen, setArchivedOpen] = useState(false),
    [renaming, setRenaming] = useState<SavedLook | null>(null),
    [name, setName] = useState("");
  // An inspiration look means nothing without its photo, so it isn't listed.
  const catalog = (ids: string[]) =>
    ids
      .filter((id) => id !== "reference")
      .map((id) => looks.find((look) => look.id === id))
      .filter((look): look is PhotoStyle => !!look);
  const favorites = catalog(library.favorites);
  const recent = catalog(
    library.recent.filter((id) => !library.favorites.includes(id)),
  );
  const named = library.looks.filter((look) => !look.archived);
  const archived = library.looks.filter((look) => look.archived);
  const legacy = !guest && !library.legacyMigrated ? restaurantLook : undefined;
  const unavailable = (look: SavedLook) =>
    !!studioCreationBlock(look.recipe, { disabledStyleIds });
  const image = (look: SavedLook) =>
    look.previewAssetId
      ? `/api/assets/${look.previewAssetId}`
      : looks.find((style) => style.id === look.recipe.look)?.image;

  if (!store.ready)
    return (
      <div className="st-library-empty" role="status" aria-busy={!store.error}>
        <h3>
          {store.error ? "Saved looks are unavailable" : "Loading saved looks…"}
        </h3>
        <p>
          {store.error ||
            "Getting your restaurant looks, favorites and recent styles."}
        </p>
        {store.error && (
          <button
            className="st-pill"
            disabled={busy}
            onClick={() => void store.reload()}
          >
            Try again
          </button>
        )}
      </div>
    );

  function namedTile(look: SavedLook, restore = false) {
    const isDefault = library.defaultLookId === look.id;
    return (
      <StyleTile
        key={look.id}
        label={look.name}
        description={
          restore
            ? "Archived"
            : unavailable(look)
              ? "Temporarily unavailable. Your recipe is saved."
              : isDefault
                ? "Default for new photos"
                : "Restaurant look"
        }
        image={image(look)}
        selected={!restore && selectedKey === look.id}
        disabled={restore || unavailable(look)}
        badge={
          isDefault && (
            <span className="st-tile-badge" aria-hidden="true">
              <Star size={11} fill="currentColor" />
              Default
            </span>
          )
        }
        onSelect={() => onApply(look)}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="st-tile-action"
                aria-label={`More for ${look.name}`}
                disabled={busy}
              >
                <Ellipsis size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="cx-workspace-popover st-menu"
              align="end"
            >
              {restore ? (
                <DropdownMenuItem
                  onSelect={() =>
                    void mutate((value) => ({
                      ...value,
                      looks: value.looks.map((item) =>
                        item.id === look.id
                          ? { ...item, archived: false }
                          : item,
                      ),
                    }))
                  }
                >
                  <RotateCcw size={16} />
                  Restore
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem
                    disabled={unavailable(look) && !isDefault}
                    onSelect={() =>
                      void mutate((value) => ({
                        ...value,
                        defaultLookId: isDefault ? null : look.id,
                      }))
                    }
                  >
                    {isDefault ? <StarOff size={16} /> : <Star size={16} />}
                    {isDefault ? "Remove as default" : "Default for new photos"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setName(look.name);
                      setRenaming(look);
                    }}
                  >
                    <Pencil size={16} />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={library.looks.length >= 100}
                    onSelect={() =>
                      void mutate((value) => ({
                        ...value,
                        looks: [
                          ...value.looks,
                          {
                            ...look,
                            id: crypto.randomUUID(),
                            name: `${look.name.slice(0, 53)} (copy)`,
                            version: 1,
                          },
                        ],
                      }))
                    }
                  >
                    <Copy size={16} />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      void mutate((value) => ({
                        ...value,
                        defaultLookId:
                          value.defaultLookId === look.id
                            ? null
                            : value.defaultLookId,
                        looks: value.looks.map((item) =>
                          item.id === look.id
                            ? { ...item, archived: true }
                            : item,
                        ),
                      }))
                    }
                  >
                    <Archive size={16} />
                    Archive
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    );
  }

  return (
    <div className="st-saved">
      {!guest && (
        <section aria-labelledby="st-saved-looks">
          <h3 id="st-saved-looks" className="st-library-heading">
            Restaurant looks {!pro && <ProBadge />}
          </h3>
          {!pro && (
            <ProNote feature="savedLooks">
              Saved looks are part of Pro. Any you saved are kept.
            </ProNote>
          )}
          {named.length || legacy ? (
            <div className="st-library-grid">
              {legacy && tile(legacy, "saved")}
              {named.map((look) => namedTile(look))}
            </div>
          ) : (
            <p className="st-library-hint">
              Save a look from Customize to reuse the same setting and light on
              every dish.
            </p>
          )}
        </section>
      )}
      <section aria-labelledby="st-saved-favorites">
        <h3 id="st-saved-favorites" className="st-library-heading">
          Favorites
        </h3>
        {favorites.length ? (
          <div className="st-library-grid">
            {favorites.map((style) => tile(style, "favorite"))}
          </div>
        ) : (
          <p className="st-library-hint">
            Favorite a style with its heart to keep it here
            {guest ? " on this device." : "."}
          </p>
        )}
      </section>
      {recent.length > 0 && (
        <section aria-labelledby="st-saved-recent">
          <h3 id="st-saved-recent" className="st-library-heading">
            Recently used
          </h3>
          <div className="st-library-grid">
            {recent.map((style) => tile(style, "recent"))}
          </div>
        </section>
      )}
      {archived.length > 0 && (
        <section aria-label="Archived looks">
          <button
            className="st-text-button"
            aria-expanded={archivedOpen}
            onClick={() => setArchivedOpen(!archivedOpen)}
          >
            {archivedOpen
              ? "Hide archived looks"
              : `Archived looks (${archived.length})`}
          </button>
          {archivedOpen && (
            <div className="st-library-grid">
              {archived.map((look) => namedTile(look, true))}
            </div>
          )}
        </section>
      )}
      <Dialog
        open={!!renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent
          className="cx-workspace-popover st-sheet st-rename"
          showCloseButton={false}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!renaming) return;
              if (
                await mutate((value) => ({
                  ...value,
                  looks: value.looks.map((item) =>
                    item.id === renaming.id
                      ? { ...item, name: name.trim() }
                      : item,
                  ),
                }))
              )
                setRenaming(null);
            }}
          >
            <DialogTitle>Rename look</DialogTitle>
            <DialogDescription>
              Existing photos keep their settings.
            </DialogDescription>
            <input
              className="st-input"
              aria-label="Look name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            {store.error && (
              <p className="st-inline-error" role="alert">
                {store.error}
              </p>
            )}
            <footer>
              <button
                type="button"
                className="st-pill st-pill-quiet"
                onClick={() => setRenaming(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="st-pill st-pill-primary"
                disabled={busy || !name.trim()}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </footer>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

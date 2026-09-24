"use client";
import type { ReactNode, Ref, SyntheticEvent } from "react";
import { styleThumbnail } from "@/lib/photo-styles";

// Ends the placeholder shimmer once the example has arrived (or failed).
function reveal(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.parentElement?.setAttribute("data-loaded", "");
}

/** A square example with its name. Selecting it never creates an image. */
export function StyleTile({
  label,
  description,
  image,
  media,
  badge,
  actions,
  selected = false,
  disabled = false,
  eager = false,
  kind = "toggle",
  onSelect,
  buttonRef,
  styleKey,
  className = "",
}: {
  label: string;
  description?: string;
  image?: string;
  media?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  eager?: boolean;
  // "toggle" chooses a look; "dialog" opens a sheet; "action" does one thing.
  kind?: "toggle" | "dialog" | "action";
  onSelect: (button: HTMLButtonElement) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  styleKey?: string;
  className?: string;
}) {
  return (
    <div
      className={`st-tile ${className}`.trim()}
      data-selected={selected || undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        className="st-tile-button"
        aria-pressed={kind === "toggle" ? selected : undefined}
        aria-haspopup={kind === "dialog" ? "dialog" : undefined}
        disabled={disabled}
        data-style-key={styleKey}
        onClick={(event) => onSelect(event.currentTarget)}
      >
        <span
          className="st-tile-media"
          data-loaded={media || !image ? "" : undefined}
        >
          {media ||
            (image && (
              <img
                ref={(img) => {
                  if (img?.complete)
                    img.parentElement?.setAttribute("data-loaded", "");
                }}
                src={styleThumbnail(image)}
                alt=""
                width={400}
                height={400}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                onLoad={reveal}
                onError={reveal}
              />
            ))}
          {badge}
        </span>
        <span className="st-tile-name">{label}</span>
        {description && <span className="sr-only">. {description}</span>}
      </button>
      {actions && <div className="st-tile-actions">{actions}</div>}
    </div>
  );
}

/** A compact 2 × 2 preview of more looks, used to open the full library. */
export function StyleMosaic({ images }: { images: string[] }) {
  return (
    <span className="st-mosaic" aria-hidden="true">
      {images.slice(0, 4).map((image) => (
        <img
          key={image}
          src={styleThumbnail(image)}
          alt=""
          width={400}
          height={400}
          loading="lazy"
          decoding="async"
        />
      ))}
    </span>
  );
}

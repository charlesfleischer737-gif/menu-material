import { menuCrop } from "@/lib/menu-design";
import type { Row } from "@/lib/client";
/** CSS object positioning and PDF drawPhoto use the same normalized frame. */
export default function MenuPhoto({
  photoId,
  crop,
  featured = false,
  slug,
  alt = "",
  priority = false,
}: {
  photoId: string;
  crop?: Row;
  featured?: boolean;
  slug?: string;
  alt?: string;
  priority?: boolean;
}) {
  const frame = menuCrop(crop),
    src = slug
      ? `/api/public/${slug}/assets/${photoId}`
      : `/api/assets/${photoId}`;
  return (
    <div className={`mm-menu-photo ${featured ? "is-featured" : ""}`}>
      {frame.fit && (
        // The whole photograph shows; a soft copy of it fills the rest of
        // the frame instead of grey bars.
        <img
          className="mm-menu-photo-backdrop"
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        style={{
          objectFit: frame.fit ? "contain" : "cover",
          objectPosition: `${frame.x}% ${frame.y}%`,
          transform: `scale(${frame.zoom})`,
          transformOrigin: `${frame.x}% ${frame.y}%`,
        }}
      />
    </div>
  );
}

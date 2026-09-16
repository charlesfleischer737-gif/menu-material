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
  const frame = menuCrop(crop);
  return (
    <div className={`mm-menu-photo ${featured ? "is-featured" : ""}`}>
      <img
        src={
          slug
            ? `/api/public/${slug}/assets/${photoId}`
            : `/api/assets/${photoId}`
        }
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

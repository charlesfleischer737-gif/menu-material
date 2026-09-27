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
      : `/api/assets/${photoId}`,
    // Guests' phones pick a smaller copy; the full photo stands in for any
    // copy that doesn't exist yet.
    sized = slug
      ? {
          srcSet: `${src}?w=480 480w, ${src}?w=960 960w, ${src}?w=1440 1440w, ${src} 2048w`,
          sizes:
            featured || priority
              ? "(max-width: 760px) 100vw, 760px"
              : "(max-width: 760px) 45vw, 360px",
        }
      : {};
  return (
    <div className={`mm-menu-photo ${featured ? "is-featured" : ""}`}>
      {frame.fit && (
        // The whole photograph shows; a soft copy of it fills the rest of
        // the frame instead of grey bars.
        <img
          className="mm-menu-photo-backdrop"
          src={slug ? `${src}?w=480` : src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
      <img
        src={src}
        {...sized}
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

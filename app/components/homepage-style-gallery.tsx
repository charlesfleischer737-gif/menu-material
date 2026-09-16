"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Check, Expand } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const styles = [
  {
    id: "color",
    asset: "color",
    name: "New backdrop",
    short: "Color",
    detail: "Change the setting.",
    alt: "The same strawberry cheesecake on a vivid cobalt-blue studio backdrop",
  },
  {
    id: "angle",
    asset: "angle",
    name: "From above",
    short: "Angle",
    detail: "Find a new perspective.",
    alt: "The same strawberry cheesecake photographed from a higher angle on a charcoal table",
  },
  {
    id: "served",
    asset: "hand",
    name: "Served by hand",
    short: "In hand",
    detail: "Add a human touch.",
    alt: "One graceful hand presenting the same strawberry cheesecake on a white plate against a dark studio background",
  },
  {
    id: "closeup",
    asset: "closeup",
    name: "Close-up",
    short: "Detail",
    detail: "Let the textures shine.",
    alt: "A low-angle close-up of the same strawberry cheesecake showing its creamy filling and glossy berries",
  },
];

type GalleryStyle = (typeof styles)[number];
type PhotoRefs = RefObject<Map<string, HTMLImageElement>>;
const originalPhoto: GalleryStyle = {
  id: "original",
  asset: "original",
  name: "Original photo",
  short: "Original",
  detail: "The starting photo, before styling.",
  alt: "Original strawberry cheesecake photograph on a white plate on a wooden restaurant table",
};
const galleryPhotos = [originalPhoto, ...styles];
const defaultPhoto = galleryPhotos[1];

function StylePicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const id = useId();
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className={`pw-style-picker${compact ? " is-compact" : ""}`}
      aria-label="Choose an original or styled photo"
    >
      {galleryPhotos.map((style) => (
        <label
          key={style.id}
          htmlFor={`${id}-${style.id}`}
          className="pw-style-option"
          data-selected={value === style.id}
        >
          <RadioGroupItem
            id={`${id}-${style.id}`}
            value={style.id}
            className="pw-style-radio"
            aria-label={style.name}
          />
          <img
            src={
              style.id === "original"
                ? "/homepage/styles/cheesecake-original-320.webp"
                : `/homepage/styles/cheesecake-${style.asset}-160.webp`
            }
            srcSet={
              style.id === "original"
                ? undefined
                : `/homepage/styles/cheesecake-${style.asset}-160.webp 160w, /homepage/styles/cheesecake-${style.asset}-320.webp 320w`
            }
            sizes={
              compact
                ? "40px"
                : "(max-width: 700px) 44px, (max-width: 900px) 48px, 60px"
            }
            alt=""
            width={style.id === "original" ? 320 : 160}
            height={style.id === "original" ? 240 : 160}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          <span className="pw-style-option-copy">
            <strong className="pw-style-name-full">{style.name}</strong>
            <strong className="pw-style-name-short">{style.short}</strong>
            <span>{style.detail}</span>
          </span>
          <Check
            className="pw-style-selected-mark"
            size={15}
            aria-hidden="true"
          />
        </label>
      ))}
    </RadioGroup>
  );
}

function StyledPhoto({
  style,
  enlarged = false,
  preload = false,
  imageRefs,
}: {
  style: GalleryStyle;
  enlarged?: boolean;
  preload?: boolean;
  imageRefs: PhotoRefs;
}) {
  return (
    <span className="pw-style-photo-stack">
      {galleryPhotos.map((photo) => (
        <img
          key={photo.id}
          ref={(image) => {
            if (image) imageRefs.current.set(photo.id, image);
            else imageRefs.current.delete(photo.id);
          }}
          data-active={photo.id === style.id}
          src={`/homepage/styles/cheesecake-${photo.asset}-640.webp`}
          srcSet={
            photo.id === "original"
              ? "/homepage/styles/cheesecake-original-320.webp 320w, /homepage/styles/cheesecake-original-640.webp 640w, /homepage/styles/cheesecake-original-960.webp 960w"
              : `/homepage/styles/cheesecake-${photo.asset}-320.webp 320w, /homepage/styles/cheesecake-${photo.asset}-480.webp 480w, /homepage/styles/cheesecake-${photo.asset}-640.webp 640w, /homepage/styles/cheesecake-${photo.asset}-960.webp 960w, /homepage/styles/cheesecake-${photo.asset}.webp 1254w`
          }
          sizes={
            enlarged
              ? "(max-width: 700px) min(calc(100vw - 58px), 66vh), min(698px, 66vh)"
              : "(max-width: 700px) calc(100vw - 58px), (max-width: 856px) calc(54vw - 31px), 430px"
          }
          alt={
            photo.id === style.id
              ? photo.id === "original"
                ? photo.alt
                : `Illustrative AI edit: ${photo.alt}`
              : ""
          }
          aria-hidden={photo.id !== style.id}
          width={photo.id === "original" ? 640 : 1254}
          height={photo.id === "original" ? 480 : 1254}
          loading={preload && photo.id !== "original" ? "eager" : "lazy"}
          decoding="async"
          fetchPriority="low"
          onLoad={(event) => {
            void event.currentTarget.decode().catch(() => {});
          }}
        />
      ))}
    </span>
  );
}

export default function HomepageStyleGallery() {
  const [selected, setSelected] = useState(defaultPhoto.id);
  const [preload, setPreload] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const photoRefs = useRef(new Map<string, HTMLImageElement>());
  const enlargedRefs = useRef(new Map<string, HTMLImageElement>());
  const selectionRequest = useRef(0);
  const active =
    galleryPhotos.find((photo) => photo.id === selected) ?? defaultPhoto;

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setPreload(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPreload(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      selectionRequest.current += 1;
    },
    [],
  );

  async function selectStyle(value: string) {
    const request = ++selectionRequest.current;
    setPreload(true);
    setPending(value);
    setLoadError("");
    try {
      const images = [
        photoRefs.current.get(value),
        enlargedRefs.current.get(value),
      ].filter((image): image is HTMLImageElement => Boolean(image));
      if (!images.length) throw new Error("Photo unavailable");
      await Promise.all(
        images.map((image) => {
          image.loading = "eager";
          image.fetchPriority = "auto";
          return image.decode();
        }),
      );
      if (request === selectionRequest.current) {
        setSelected(value);
      }
    } catch {
      if (request === selectionRequest.current) {
        setLoadError("That photo couldn’t load. Please try another style.");
      }
    } finally {
      if (request === selectionRequest.current) setPending(null);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="pw-style-gallery"
      aria-labelledby="style-gallery-title"
    >
      <div className="pw-section-heading pw-style-heading">
        <div>
          <h2 id="style-gallery-title">One photo. Endless possibilities.</h2>
          <p>The same dish, reimagined. Find your favorite look.</p>
        </div>
      </div>
      <Dialog
        onOpenChange={() => {
          selectionRequest.current += 1;
          setPending(null);
          setLoadError("");
        }}
      >
        <div className="pw-style-workbench">
          <figure className="pw-style-result" aria-busy={pending !== null}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="pw-style-result-button"
                aria-label={`Enlarge ${active.name}`}
              >
                <StyledPhoto
                  style={active}
                  preload={preload}
                  imageRefs={photoRefs}
                />
                {pending && (
                  <span className="pw-style-loading" role="status">
                    Loading photo…
                  </span>
                )}
                <span className="pw-style-expand">
                  <Expand size={14} /> Enlarge
                </span>
              </button>
            </DialogTrigger>
            <figcaption aria-live="polite" aria-atomic="true">
              <strong>{active.name}</strong>
            </figcaption>
          </figure>
          <div className="pw-style-choices">
            <p className="pw-style-picker-label">Choose a style</p>
            <StylePicker value={pending ?? selected} onChange={selectStyle} />
          </div>
        </div>
        <DialogContent className="pw-style-dialog">
          <DialogHeader>
            <DialogTitle>{active.name}</DialogTitle>
            <DialogDescription>{active.detail}</DialogDescription>
          </DialogHeader>
          <figure
            className="pw-style-enlarged-photo"
            aria-busy={pending !== null}
          >
            <StyledPhoto
              style={active}
              enlarged
              preload
              imageRefs={enlargedRefs}
            />
            {pending && (
              <span className="pw-style-loading" role="status">
                Loading photo…
              </span>
            )}
          </figure>
          <StylePicker
            value={pending ?? selected}
            onChange={selectStyle}
            compact
          />
          {loadError && (
            <p className="pw-style-disclosure" role="status">
              {loadError}
            </p>
          )}
          <p className="pw-style-disclosure">
            {selected === "original"
              ? "Original photograph, shown without AI edits."
              : "Illustrative AI edits. Review your results before sharing."}
          </p>
        </DialogContent>
      </Dialog>
      {loadError && (
        <p className="pw-style-disclosure" role="status">
          {loadError}
        </p>
      )}
      <p className="pw-style-disclosure">
        AI-styled examples of the same dish.
      </p>
    </section>
  );
}

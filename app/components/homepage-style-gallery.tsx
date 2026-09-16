"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowRight, Check, Expand } from "lucide-react";
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
    short: "Backdrop",
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
    short: "Close-up",
    detail: "Let the textures shine.",
    alt: "A low-angle close-up of the same strawberry cheesecake showing its creamy filling and glossy berries",
  },
];

type GalleryStyle = (typeof styles)[number];
type PhotoRefs = RefObject<Map<string, HTMLImageElement>>;

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
      aria-label="Choose a photo style"
    >
      {styles.map((style) => (
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
            src={`/homepage/styles/cheesecake-${style.asset}-160.webp`}
            srcSet={`/homepage/styles/cheesecake-${style.asset}-160.webp 160w, /homepage/styles/cheesecake-${style.asset}-320.webp 320w`}
            sizes={
              compact
                ? "(max-width: 700px) 72px, 40px"
                : "(max-width: 700px) 40px, 52px"
            }
            alt=""
            width={160}
            height={160}
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

function OriginalPhoto({ enlarged = false }: { enlarged?: boolean }) {
  return (
    <img
      src="/homepage/styles/cheesecake-original-640.webp"
      srcSet="/homepage/styles/cheesecake-original-320.webp 320w, /homepage/styles/cheesecake-original-640.webp 640w, /homepage/styles/cheesecake-original-960.webp 960w, /homepage/styles/cheesecake-original.jpg 2592w"
      sizes={
        enlarged
          ? "(max-width: 560px) 88px, (max-width: 860px) 42vw, 394px"
          : "(max-width: 700px) 50px, (max-width: 1000px) 25vw, 290px"
      }
      alt="Original strawberry cheesecake photograph before styling"
      width={2592}
      height={1944}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
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
      {styles.map((photo) => (
        <img
          key={photo.id}
          ref={(image) => {
            if (image) imageRefs.current.set(photo.id, image);
            else imageRefs.current.delete(photo.id);
          }}
          data-active={photo.id === style.id}
          src={`/homepage/styles/cheesecake-${photo.asset}-640.webp`}
          srcSet={`/homepage/styles/cheesecake-${photo.asset}-320.webp 320w, /homepage/styles/cheesecake-${photo.asset}-480.webp 480w, /homepage/styles/cheesecake-${photo.asset}-640.webp 640w, /homepage/styles/cheesecake-${photo.asset}-960.webp 960w, /homepage/styles/cheesecake-${photo.asset}.webp 1254w`}
          sizes={
            enlarged
              ? "(max-width: 560px) 86vw, (max-width: 860px) 42vw, 394px"
              : "(max-width: 700px) calc(100vw - 134px), (max-width: 1000px) 28vw, 320px"
          }
          alt={
            photo.id === style.id ? `Illustrative AI edit: ${photo.alt}` : ""
          }
          aria-hidden={photo.id !== style.id}
          width={1254}
          height={1254}
          loading={preload ? "eager" : "lazy"}
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
  const [selected, setSelected] = useState("served");
  const [preload, setPreload] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const photoRefs = useRef(new Map<string, HTMLImageElement>());
  const enlargedRefs = useRef(new Map<string, HTMLImageElement>());
  const selectionRequest = useRef(0);
  const active = styles.find((style) => style.id === selected) ?? styles[2];

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setPreload(true);
      return;
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
      const photo = photoRefs.current.get(value);
      if (!photo) throw new Error("Photo unavailable");
      const images = [photo, enlargedRefs.current.get(value)].filter(
        (image): image is HTMLImageElement => Boolean(image),
      );
      await Promise.all(
        images.map((image) => {
          image.loading = "eager";
          image.fetchPriority = "auto";
          return image.decode();
        }),
      );
      if (request === selectionRequest.current) setSelected(value);
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
          <p>New angles, settings, and ways to show off your dish.</p>
        </div>
        <span className="pw-style-heading-note">Pick a look to explore.</span>
      </div>
      <Dialog>
        <div className="pw-style-workbench">
          <div className="pw-style-stage">
            <figure className="pw-style-source">
              <div className="pw-style-source-frame">
                <OriginalPhoto />
              </div>
              <figcaption>
                <strong>Your starting photo</strong>
              </figcaption>
            </figure>
            <span className="pw-style-direction" aria-hidden="true">
              <ArrowRight size={20} />
            </span>
            <figure className="pw-style-result" aria-busy={pending !== null}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="pw-style-result-button"
                  aria-label={`Enlarge ${active.name} and compare with the original`}
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
          </div>
          <div className="pw-style-choices">
            <p className="pw-style-picker-label">FIND YOUR LOOK</p>
            <StylePicker value={pending ?? selected} onChange={selectStyle} />
          </div>
        </div>
        <DialogContent className="pw-style-dialog">
          <DialogHeader>
            <DialogTitle>{active.name}</DialogTitle>
            <DialogDescription>{active.detail}</DialogDescription>
          </DialogHeader>
          <div className="pw-style-comparison">
            <figure className="pw-style-comparison-original">
              <OriginalPhoto enlarged />
              <figcaption>Original photo</figcaption>
            </figure>
            <figure>
              <StyledPhoto
                style={active}
                enlarged
                preload
                imageRefs={enlargedRefs}
              />
              <figcaption>{active.name}</figcaption>
            </figure>
          </div>
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
            Illustrative AI edits. Review your results before sharing.
          </p>
        </DialogContent>
      </Dialog>
      {loadError && (
        <p className="pw-style-disclosure" role="status">
          {loadError}
        </p>
      )}
      <p className="pw-style-disclosure">
        Illustrative AI edits from one original photo. Review every result
        before sharing.
      </p>
    </section>
  );
}

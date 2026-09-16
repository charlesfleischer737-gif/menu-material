"use client";

import { useId, useState } from "react";
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
    id: "dark",
    name: "Dark & dramatic",
    short: "Dark",
    detail: "Rich shadows. All the focus.",
  },
  {
    id: "color",
    name: "Bold color",
    short: "Bold",
    detail: "A little more personality.",
  },
  {
    id: "rustic",
    name: "Rustic table",
    short: "Rustic",
    detail: "Warm, welcoming, familiar.",
  },
  {
    id: "daylight",
    name: "Daylight café",
    short: "Daylight",
    detail: "Fresh light. A softer mood.",
  },
];

type GalleryStyle = (typeof styles)[number];

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
            src={`/homepage/styles/cheesecake-${style.id}-160.webp`}
            srcSet={`/homepage/styles/cheesecake-${style.id}-160.webp 160w, /homepage/styles/cheesecake-${style.id}-320.webp 320w`}
            sizes="(max-width: 700px) 72px, 52px"
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
          : "(max-width: 700px) 80px, (max-width: 1000px) 21vw, 250px"
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
}: {
  style: GalleryStyle;
  enlarged?: boolean;
}) {
  return (
    <span className="pw-style-photo-stack">
      <img
        className="pw-style-photo-placeholder"
        src={`/homepage/styles/cheesecake-${style.id}-160.webp`}
        alt=""
        width={160}
        height={160}
        loading="lazy"
        decoding="async"
        aria-hidden="true"
      />
      <img
        key={style.id}
        src={`/homepage/styles/cheesecake-${style.id}-640.webp`}
        srcSet={`/homepage/styles/cheesecake-${style.id}-320.webp 320w, /homepage/styles/cheesecake-${style.id}-480.webp 480w, /homepage/styles/cheesecake-${style.id}-640.webp 640w, /homepage/styles/cheesecake-${style.id}.webp 1254w`}
        sizes={
          enlarged
            ? "(max-width: 560px) 86vw, (max-width: 860px) 42vw, 394px"
            : "(max-width: 700px) 80vw, (max-width: 1000px) 28vw, 320px"
        }
        alt={`Illustrative AI edit of the same strawberry cheesecake in the ${style.name.toLowerCase()} style`}
        width={1254}
        height={1254}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </span>
  );
}

export default function HomepageStyleGallery() {
  const [selected, setSelected] = useState("color");
  const active = styles.find((style) => style.id === selected) ?? styles[1];

  return (
    <section className="pw-style-gallery" aria-labelledby="style-gallery-title">
      <div className="pw-section-heading pw-style-heading">
        <div>
          <h2 id="style-gallery-title">One photo. Endless possibilities.</h2>
          <p>The same dish. A whole different mood.</p>
        </div>
        <span className="pw-style-heading-note">
          Choose a look. See the transformation.
        </span>
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
                <span>One upload is all it takes.</span>
              </figcaption>
            </figure>
            <span className="pw-style-direction" aria-hidden="true">
              <ArrowRight size={20} />
            </span>
            <figure className="pw-style-result">
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="pw-style-result-button"
                  aria-label={`Enlarge ${active.name} and compare with the original`}
                >
                  <StyledPhoto style={active} />
                  <span className="pw-style-expand">
                    <Expand size={14} /> Enlarge
                  </span>
                </button>
              </DialogTrigger>
              <figcaption aria-live="polite" aria-atomic="true">
                <strong>{active.name}</strong>
                <span>Styled with Plateworthy</span>
              </figcaption>
            </figure>
          </div>
          <div className="pw-style-choices">
            <p className="pw-style-picker-label">FIND YOUR LOOK</p>
            <StylePicker value={selected} onChange={setSelected} />
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
              <StyledPhoto style={active} enlarged />
              <figcaption>{active.name}</figcaption>
            </figure>
          </div>
          <StylePicker value={selected} onChange={setSelected} compact />
          <p className="pw-style-disclosure">
            Illustrative AI edits. Review your results before sharing.
          </p>
        </DialogContent>
      </Dialog>
      <p className="pw-style-disclosure">
        Illustrative AI edits from one original photo. Review every result
        before sharing.
      </p>
    </section>
  );
}

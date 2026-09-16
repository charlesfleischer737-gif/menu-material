"use client";
import { useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
  Upload,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  looks,
  photoStyles,
  styleCategories,
  formats,
  foodFamilies,
  type PhotoFormat,
} from "@/lib/studio";
import { recommendationsForPhoto, drinkKinds } from "@/lib/studio-onboarding";
import type { PhotoStyle } from "@/lib/photo-styles";
import type { Row } from "@/lib/client";
import { CropControls, Field, PhotoFrame } from "./creation-shared";

export function StudioWorkbench({
  draft: b,
  state,
  selected,
  styleImage,
  source,
  busy,
  advice,
  update,
  chooseLook,
  uploadPhoto,
  uploadReference,
  create,
  quickEdit,
  openMenu,
}: {
  draft: Row;
  state: Row;
  selected: PhotoStyle;
  styleImage: string;
  source: string;
  busy: string;
  advice: string;
  update: (patch: Row) => void;
  chooseLook: (id: string) => void;
  uploadPhoto: (file: File) => void;
  uploadReference: (file: File) => void;
  create: () => void;
  quickEdit: () => void;
  openMenu: () => void;
}) {
  const [collection, setCollection] = useState("all");
  const [dragging, setDragging] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const reference = useRef<HTMLInputElement>(null);
  const hasStyle = !!b.styleChosen;
  const suggested = recommendationsForPhoto(b);
  const activeCollection =
    collection === "recommended" && !suggested.length ? "all" : collection;
  const category = styleCategories.find((c) => c.id === activeCollection);
  const cards =
    activeCollection === "recommended"
      ? suggested
      : photoStyles.filter(
          (s) => activeCollection === "all" || s.category === activeCollection,
        );
  const format = formats[b.format as PhotoFormat] || formats.menu;
  const photoReady =
    b.mode === "photo" ? !!source : !!b.name.trim() && !!b.description.trim();
  const canCreate =
    hasStyle &&
    photoReady &&
    !busy &&
    state.aiConnected &&
    state.remaining > 0 &&
    (b.look !== "reference" || !!b.referenceId) &&
    !b.menuDocument;
  const analyzing = !!source && b.analysisStatus === "analyzing";
  function scrollToPhoto() {
    panel.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    panel.current
      ?.querySelector<HTMLElement>("h2")
      ?.focus({ preventScroll: true });
  }
  function select(id: string) {
    chooseLook(id);
    if (window.matchMedia("(max-width: 850px)").matches)
      requestAnimationFrame(scrollToPhoto);
  }
  function identify(family: string) {
    update({
      family,
      recommendationFamily: family,
      recommendationDrink: "other",
      analysisStatus: "manual",
      analysisSourceId: b.sourceId,
      analysisSubject: "",
      menuDocument: false,
    });
  }
  return (
    <div className="ps-workbench">
      <div className="ps-library">
        <div className="ps-library-heading">
          <div>
            <span className="ps-number">01</span>
            <h2>Find your look</h2>
          </div>
          <span>28 curated styles</span>
        </div>
        <div
          className="ps-collections"
          role="group"
          aria-label="Filter photo styles by category"
        >
          <button
            aria-pressed={activeCollection === "all"}
            onClick={() => setCollection("all")}
          >
            All styles
          </button>
          {suggested.length > 0 && (
            <button
              className="ps-for-you"
              aria-pressed={activeCollection === "recommended"}
              onClick={() => setCollection("recommended")}
            >
              <Sparkles size={14} /> For your photo
            </button>
          )}
          {styleCategories.map((c) => (
            <button
              key={c.id}
              aria-pressed={activeCollection === c.id}
              onClick={() => setCollection(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {source && !b.menuDocument && (
          <div className="ps-photo-guidance">
            {analyzing ? (
              <p role="status">
                <LoaderCircle size={16} className="cx-spin" /> Looking at your
                photo for styles that fit. You can keep creating.
              </p>
            ) : suggested.length > 0 ? (
              <div className="ps-matched">
                <p>
                  <Sparkles size={16} />
                  <span>
                    {b.analysisSubject
                      ? `Looks like ${b.analysisSubject.charAt(0).toLowerCase() + b.analysisSubject.slice(1)}.`
                      : `Styles for ${b.recommendationFamily.toLowerCase()}.`}{" "}
                    <b>{suggested.length} looks to try.</b>
                  </span>
                </p>
                <button
                  className="cx-link"
                  onClick={() =>
                    setCollection(
                      activeCollection === "recommended"
                        ? "all"
                        : "recommended",
                    )
                  }
                >
                  {activeCollection === "recommended"
                    ? "Show all styles"
                    : "See suggestions"}
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <p>
                Choose any look, or tell us what’s in your photo for more
                relevant suggestions.
              </p>
            )}
            <Collapsible className="ps-correction">
              <CollapsibleTrigger className="cx-link">
                {suggested.length ? "Not quite right?" : "Identify my photo"}
                <ChevronDown size={14} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Field label="What’s in this photo?">
                  <select
                    value={
                      b.analysisStatus === "manual" || suggested.length
                        ? b.family
                        : ""
                    }
                    onChange={(e) => identify(e.target.value)}
                  >
                    <option value="" disabled>
                      Choose a subject
                    </option>
                    {foodFamilies.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
                {b.family === "Drinks" && (
                  <Field label="Type of drink">
                    <select
                      value={b.recommendationDrink || "other"}
                      onChange={(e) =>
                        update({
                          recommendationDrink: e.target.value,
                          analysisStatus: "manual",
                          analysisSourceId: b.sourceId,
                          recommendationFamily: "Drinks",
                        })
                      }
                    >
                      {drinkKinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind === "other"
                            ? "Another drink"
                            : kind.charAt(0).toUpperCase() + kind.slice(1)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        <div className="ps-collection-note">
          <span>
            {activeCollection === "recommended"
              ? "Chosen for the subject in your photo"
              : category?.description ||
                "A new setting. Beautiful light. Still your food."}
          </span>
          <small>{cards.length} styles</small>
        </div>
        <div
          className="ps-gallery"
          role="group"
          aria-label="Choose a photo style"
        >
          {cards.map((style) => (
            <button
              key={style.id}
              className="ps-style-card"
              aria-pressed={hasStyle && b.look === style.id}
              disabled={!!busy}
              onClick={() => select(style.id)}
            >
              <div className="ps-style-photo">
                <img
                  src={style.image}
                  alt={`${style.name} — ${style.cue}`}
                  loading="lazy"
                  width={512}
                  height={512}
                />
                <span className="ps-style-select">
                  {hasStyle && b.look === style.id ? (
                    <Check size={17} />
                  ) : (
                    <span />
                  )}
                </span>
                {activeCollection === "all" && (
                  <span className="ps-style-category">{style.group}</span>
                )}
              </div>
              <div className="ps-style-copy">
                <b>{style.name}</b>
                <span>{style.cue}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="ps-personal">
          <span>Make it familiar</span>
          <div>
            {["keep", "restaurant", "reference"].map((id) => (
              <button
                key={id}
                disabled={!!busy}
                aria-pressed={hasStyle && b.look === id}
                onClick={() => select(id)}
              >
                {looks.find((l) => l.id === id)!.name}
                {hasStyle && b.look === id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
        <p className="ps-example-note">
          Style examples show the atmosphere. Your uploaded photo supplies the
          food.
        </p>
      </div>
      <aside
        ref={panel}
        className="ps-session"
        aria-label="Your photo and settings"
      >
        <div className="ps-session-heading">
          <span className="ps-number">02</span>
          <h2 tabIndex={-1}>Make it yours</h2>
        </div>
        {hasStyle ? (
          <div className="ps-chosen-style">
            <img src={styleImage} alt="Selected style example" />
            <div>
              <span>YOUR STYLE</span>
              <b>{selected.name}</b>
              <p>{selected.cue}</p>
            </div>
            <Check size={17} />
          </div>
        ) : (
          <div className="ps-choose-first">
            <Sparkles size={25} />
            <h3>First, a little inspiration.</h3>
            <p>Choose a style, then add your photo here.</p>
          </div>
        )}
        {hasStyle && (
          <>
            {b.look === "reference" && (
              <div className="ps-reference-upload">
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => reference.current?.click()}
                >
                  <ImagePlus size={18} />
                  {b.referenceId
                    ? "Replace style reference"
                    : "Add a style reference"}
                </button>
                <input
                  ref={reference}
                  hidden
                  disabled={!!busy}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadReference(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            <div
              className={`ps-upload ${source && b.mode === "photo" ? "has-photo" : ""} ${dragging ? "is-dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (!busy && e.dataTransfer.files[0])
                  uploadPhoto(e.dataTransfer.files[0]);
              }}
            >
              {source && b.mode === "photo" ? (
                <>
                  <img src={source} alt="Your original uploaded photo" />
                  <span className="ps-original-label">Your original</span>
                  <button
                    disabled={!!busy}
                    className="ps-replace"
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={14} /> Replace
                  </button>
                </>
              ) : b.mode === "description" ? (
                <div className="ps-description">
                  <Field label="Dish name">
                    <input
                      value={b.name}
                      maxLength={100}
                      onChange={(e) => update({ name: e.target.value })}
                      placeholder="Roasted tomato pasta"
                    />
                  </Field>
                  <Field label="Ingredients, portion and presentation">
                    <textarea
                      value={b.description}
                      maxLength={2000}
                      onChange={(e) => update({ description: e.target.value })}
                      placeholder="Describe the dish you actually serve."
                    />
                  </Field>
                  <p>
                    Creates an illustration from your description. Review it
                    against your real dish.
                  </p>
                </div>
              ) : (
                <>
                  <span className="ps-upload-icon">
                    <ImagePlus size={26} />
                  </span>
                  <h3>Bring your dish into the picture.</h3>
                  <p>Drop a photo here, or choose one below.</p>
                  <button
                    className="cx-btn"
                    disabled={!!busy}
                    onClick={() => upload.current?.click()}
                  >
                    <Upload size={16} /> Upload your photo
                  </button>
                  <small>JPG, PNG or HEIC · up to 20 MB</small>
                  <div className="ps-camera">
                    <button
                      className="cx-link"
                      disabled={!!busy}
                      onClick={() => camera.current?.click()}
                    >
                      <Camera size={15} />
                      Take a photo
                    </button>
                    <input
                      ref={camera}
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={!!busy}
                      onChange={(e) => {
                        if (e.target.files?.[0]) uploadPhoto(e.target.files[0]);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </>
              )}
            </div>
            <input
              ref={upload}
              hidden
              disabled={!!busy}
              type="file"
              accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) uploadPhoto(e.target.files[0]);
                e.target.value = "";
              }}
            />
            {(advice || b.analysisAdvice) && (
              <p className="ps-advice">{b.analysisAdvice || advice}</p>
            )}
            {b.menuDocument && (
              <div className="ps-menu-detected">
                <BookOpen size={18} />
                <p>
                  This looks like a menu page.
                  <button
                    className="cx-link"
                    disabled={!!busy}
                    onClick={openMenu}
                  >
                    Open Menu Builder <ArrowRight size={14} />
                  </button>
                </p>
              </div>
            )}
            {!source && (
              <button
                className="cx-link ps-no-photo"
                disabled={!!busy}
                onClick={() =>
                  update({ mode: b.mode === "photo" ? "description" : "photo" })
                }
              >
                {b.mode === "photo"
                  ? "I don’t have a photo"
                  : "Upload a photo instead"}
              </button>
            )}
            <fieldset className="ps-settings" disabled={!!busy}>
              <Field label="Photo format">
                <select
                  value={b.format}
                  onChange={(e) =>
                    update({
                      format: e.target.value,
                      destination: ["doordash", "uber"].includes(e.target.value)
                        ? "delivery"
                        : ["feed", "story"].includes(e.target.value)
                          ? "social"
                          : e.target.value === "print"
                            ? "print"
                            : "menu",
                    })
                  }
                >
                  {Object.entries(formats).map(([id, f]) => (
                    <option key={id} value={id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Collapsible className="ps-adjustments">
                <CollapsibleTrigger className="ps-options-toggle">
                  <SlidersHorizontal size={17} />
                  <span>Adjust the look</span>
                  <ChevronDown size={16} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ps-settings-fields">
                    <Field label="Lighting">
                      <select
                        value={b.lighting}
                        onChange={(e) => update({ lighting: e.target.value })}
                      >
                        {["As shown", "Soft daylight", "Warm & cozy"].map(
                          (s) => (
                            <option value={s} key={s}>
                              {s === "As shown" ? "Match the style" : s}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field label="Surface">
                      <select
                        value={b.surface}
                        onChange={(e) => update({ surface: e.target.value })}
                      >
                        {[
                          "As shown",
                          "Warm wood",
                          "Pale stone",
                          "White seamless",
                        ].map((s) => (
                          <option value={s} key={s}>
                            {s === "As shown" ? "Match the style" : s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Plate"
                      hint="Drinks always keep their glass and visible branding."
                    >
                      <select
                        value={b.plate}
                        onChange={(e) => update({ plate: e.target.value })}
                      >
                        <option value="style">Match the style</option>
                        <option value="keep">Keep my plate</option>
                        <option value="white">Simple white plate</option>
                      </select>
                    </Field>
                    <Field label="Camera angle">
                      <select
                        value={b.angle}
                        onChange={(e) => update({ angle: e.target.value })}
                      >
                        <option value="keep">Keep my angle</option>
                        <option value="overhead">Look straight down</option>
                        <option value="three-quarter">
                          View from the side
                        </option>
                      </select>
                    </Field>
                    {b.angle !== "keep" && (
                      <p className="ps-advice">
                        This angle reveals new parts of the food. Review those
                        details in your result.
                      </p>
                    )}
                    <Field label="Composition">
                      <select
                        value={b.composition}
                        onChange={(e) =>
                          update({ composition: e.target.value })
                        }
                      >
                        <option>Full dish</option>
                        <option>Room around the plate</option>
                        <option>Space above for a headline</option>
                      </select>
                    </Field>
                    <Field label="Anything else? (optional)">
                      <textarea
                        value={b.note}
                        maxLength={1000}
                        onChange={(e) => update({ note: e.target.value })}
                        placeholder="Remove the napkin in the background."
                      />
                    </Field>
                    {source && (
                      <Collapsible className="ps-framing">
                        <CollapsibleTrigger className="cx-link">
                          Adjust framing
                          <ChevronDown size={14} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <PhotoFrame
                            src={source}
                            ratio={format.ratio}
                            edits={b.adjustments}
                            onChange={(adjustments) => update({ adjustments })}
                            label="Framing preview"
                          />
                          <CropControls
                            value={b.adjustments}
                            onChange={(adjustments) => update({ adjustments })}
                          />
                          <p className="ps-advice">
                            This previews the crop. Your selected look is
                            applied when you create.
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </fieldset>
            <div className="ps-create-action">
              <button className="cx-btn" disabled={!canCreate} onClick={create}>
                {busy === "Creating your photo" ? (
                  <LoaderCircle size={17} className="cx-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                {busy === "Creating your photo"
                  ? "Starting your photo…"
                  : "Create my photo"}
                <ArrowRight size={17} />
              </button>
              <p>
                {!state.aiConnected
                  ? "Image creation isn’t connected yet. Your choices are saved."
                  : state.remaining < 1
                    ? "Your image allowance is used up. Free touch-up tools are still available."
                    : !photoReady
                      ? "Add your photo to create this look."
                      : b.look === "reference" && !b.referenceId
                        ? "Add your style reference to continue."
                        : `1 image · ${state.remaining} remaining`}
              </p>
            </div>
            {source && (
              <button
                className="cx-link ps-quick-edit"
                disabled={!!busy}
                onClick={quickEdit}
              >
                Only need a crop or touch-up?
              </button>
            )}
            <p className="ps-preservation">
              <Check size={15} />
              Your original is saved. Your food stays yours.
            </p>
          </>
        )}
      </aside>
      {hasStyle && (
        <div className="ps-mobile-next">
          <span>
            {selected.name}
            <small>
              {photoReady
                ? "Your photo is ready to create"
                : "Add your photo next"}
            </small>
          </span>
          <button
            className="cx-btn"
            onClick={photoReady && canCreate ? create : scrollToPhoto}
            disabled={!!busy}
          >
            {photoReady && canCreate ? "Create photo" : "Your photo"}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

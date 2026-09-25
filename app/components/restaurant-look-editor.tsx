"use client";
import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw, Sparkles } from "lucide-react";
import {
  brandTypefaces,
  brandTypeface,
  brandPostFields,
  restaurantLooks,
  restaurantLookFields,
  photoPresetFields,
  normalizeBrandColor,
} from "@/lib/restaurant-look";
import { photoStyles, styleCategories } from "@/lib/photo-styles";
import { emptyAdjustments } from "@/lib/studio";
import type { Row } from "@/lib/client";
import { PostCanvas } from "./post-maker";
import MenuView from "./menu-view";

function BrandColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState("");
  useEffect(() => {
    setText(value);
    setError("");
  }, [value]);
  return (
    <div className="cx-look-color-field">
      <span>{label}</span>
      <div className="cx-look-color-input">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={`${label} hex code`}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
            const color = normalizeBrandColor(e.target.value);
            if (color && e.target.value.replace("#", "").length === 6)
              onChange(color);
          }}
          onBlur={() => {
            const color = normalizeBrandColor(text);
            if (color) {
              onChange(color);
              setText(color);
            } else {
              setText(value);
              setError(
                `Kept ${value.toUpperCase()}. Use a color code such as #244638.`,
              );
            }
          }}
        />
      </div>
      {error && <small role="status">{error}</small>}
    </div>
  );
}

export default function RestaurantLookEditor({
  profile,
  setProfile,
  style,
  state,
}: {
  profile: Row;
  setProfile: (p: Row) => void;
  style: Row;
  state: Row;
}) {
  const [preview, setPreview] = useState("photo");
  const [category, setCategory] = useState(
    photoStyles.find((p) => p.id === style.photoPreset)?.category || "menu",
  );
  const [previous, setPrevious] = useState<Row | null>(null);
  const [message, setMessage] = useState("");
  const change = (patch: Row) =>
    setProfile({ ...profile, style: { ...style, ...patch } });
  const preset = photoStyles.find((p) => p.id === style.photoPreset);
  const image = style.referenceIds?.[0]
    ? `/api/assets/${style.referenceIds[0]}`
    : preset?.image || "/studio/styles/menu-wood.webp";
  const font = brandTypeface(style);
  const activeLook = restaurantLooks.find(
    (l) =>
      l.photoPreset === style.photoPreset &&
      l.primary === style.primary &&
      l.accent === style.accent &&
      l.typography === style.typography &&
      !style.referenceIds?.length,
  );
  const approved = state.assets?.find(
    (a: Row) => a.approved_at && a.dish_id && !a.deleted_at,
  );
  const dish = state.dishes?.find((d: Row) => d.id === approved?.dish_id);
  const previewRestaurant = {
    ...profile,
    style,
    logo_id: state.restaurant?.logo_id,
  };
  const sampleItems = state.dishes?.length
    ? state.dishes
        .slice(0, 2)
        .map((d: Row) => ({ ...d, available: !!d.available }))
    : [
        {
          id: "sample-1",
          name: "Your signature dish",
          description: "A short description of what makes it special.",
          price: 1800,
          available: true,
        },
        {
          id: "sample-2",
          name: "A seasonal favorite",
          description: "Fresh ingredients, made your way.",
          price: 1400,
          available: true,
        },
      ];
  const post = {
    ...brandPostFields(style),
    compositionVersion: 2,
    template: "chef",
    title: dish?.name || "From our kitchen",
    description: "",
    textMode: "minimal",
    showBrand: true,
    items: [
      {
        name: dish?.name || "Style example",
        photoId: approved?.id,
        ...(approved ? {} : { photoUrl: image }),
        quantity: 1,
      },
    ],
    layouts: { feed: { ...emptyAdjustments, fit: false } },
  };
  return (
    <section className="cx-brand-editor cx-look-studio">
      <div className="cx-brand-heading">
        <Palette size={22} />
        <div>
          <h3>Restaurant look</h3>
          <p>Start with a complete look, then make it your own.</p>
        </div>
      </div>
      <div
        className="cx-look-presets"
        role="group"
        aria-label="Complete restaurant looks"
      >
        {restaurantLooks.map((look) => {
          const photo = photoStyles.find((p) => p.id === look.photoPreset)!;
          return (
            <button
              type="button"
              key={look.id}
              aria-pressed={activeLook?.id === look.id}
              onClick={() => {
                setPrevious({ ...style });
                change(restaurantLookFields(look.id));
                setCategory(photo.category || "menu");
                setMessage(
                  `${look.name} applied to your preview. Save your restaurant when you’re happy.`,
                );
              }}
            >
              <div className="cx-look-preset-photo">
                <img src={photo.image} alt="" loading="lazy" />
                <span className="cx-look-swatches" aria-hidden="true">
                  <i style={{ background: look.primary }} />
                  <i style={{ background: look.accent }} />
                </span>
                {activeLook?.id === look.id && (
                  <span className="cx-look-selected">
                    <Check size={16} />
                  </span>
                )}
              </div>
              <strong>{look.name}</strong>
              <small>{look.note}</small>
            </button>
          );
        })}
      </div>
      {message && (
        <div className="cx-look-notice" role="status">
          <span>{message}</span>
          {previous && (
            <button
              type="button"
              className="cx-link"
              onClick={() => {
                setProfile({ ...profile, style: previous });
                setPrevious(null);
                setMessage("Your previous look is restored.");
              }}
            >
              <RotateCcw size={14} /> Undo
            </button>
          )}
        </div>
      )}
      <div className="cx-look-live">
        <div className="cx-look-live-heading">
          <div>
            <span className="eyebrow">YOUR LOOK, IN CONTEXT</span>
            <h4>{profile.name || "Your restaurant"}</h4>
          </div>
          <span className="cx-look-preview-tag">Preview</span>
        </div>
        <div
          className="cx-look-preview-tabs"
          role="group"
          aria-label="Preview restaurant branding"
        >
          {[
            ["photo", "Photo style"],
            ["menu", "Menu"],
            ["post", "Instagram"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={preview === id}
              onClick={() => setPreview(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="cx-look-preview-stage">
          {preview === "photo" && (
            <figure className="cx-look-photo-preview">
              <img
                src={image}
                alt={
                  style.referenceIds?.length
                    ? "Your saved photographic reference"
                    : `${preset?.name || "Neighborhood table"} photo style example`
                }
              />
              <figcaption>
                <strong>
                  {style.referenceIds?.length
                    ? "Your saved photo reference"
                    : preset?.name || "Neighborhood table"}
                </strong>
                <span>
                  {style.referenceIds?.length
                    ? "Lighting and atmosphere for your next photo."
                    : "Style inspiration. Your dishes keep their own ingredients."}
                </span>
              </figcaption>
            </figure>
          )}
          {preview === "menu" && (
            <div className="cx-look-menu-preview">
              <MenuView
                preview
                menu={{
                  restaurant: {
                    ...previewRestaurant,
                    logoId: state.restaurant?.logo_id,
                  },
                  sections: [
                    {
                      id: "preview",
                      name: "From our kitchen",
                      items: sampleItems,
                    },
                  ],
                  layout: "classic",
                }}
              />
            </div>
          )}
          {preview === "post" && (
            <div className="cx-look-social-preview">
              <PostCanvas
                draft={post}
                restaurant={previewRestaurant}
                example={!approved}
              />
              <p>
                {approved
                  ? "Your approved photo, in an example post."
                  : "Example photo with your colors and typography."}
              </p>
            </div>
          )}
        </div>
        <p className="cx-look-live-note">
          {preview === "menu"
            ? `${state.dishes?.length ? "Your dishes" : "Sample dishes"} · Your published menu changes only when you republish.`
            : preview === "post"
              ? "The same design tools used in Post Maker. No images used."
              : "New photos use this look. Each image is yours to review before sharing."}
        </p>
      </div>
      <details className="cx-look-customize">
        <summary>
          Fine-tune colors, type, photography & voice <span>Optional</span>
        </summary>
        <div className="cx-look-color-grid">
          <BrandColor
            label="Brand color"
            value={style.primary}
            onChange={(primary) => change({ primary })}
          />
          <BrandColor
            label="Accent color"
            value={style.accent}
            onChange={(accent) => change({ accent })}
          />
        </div>
        <label className="mm-voice-setting">
          Writing voice
          <input
            value={style.tone ?? ""}
            placeholder="Warm and welcoming"
            maxLength={150}
            onChange={(e) => change({ tone: e.target.value })}
          />
          <small>
            Used for new social captions. For example: friendly, concise, and
            quietly confident.
          </small>
        </label>
        <fieldset className="cx-brand-fonts">
          <legend>Your typography</legend>
          <div>
            {brandTypefaces.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={font.id === f.id}
                onClick={() => change({ typography: f.id })}
              >
                <span>
                  {f.name}
                  {font.id === f.id && <Check size={14} />}
                </span>
                <strong style={{ fontFamily: `"${f.family}"` }}>
                  {f.sample}
                </strong>
              </button>
            ))}
          </div>
        </fieldset>
        <h4>Your photography</h4>
        <p className="cx-look-help">
          Choose a style to replace the current photographic reference. Your
          uploaded references stay saved.
        </p>
        <div
          className="cx-look-categories"
          role="group"
          aria-label="Photo style categories"
        >
          {styleCategories.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="cx-look-photo-options">
          {photoStyles
            .filter((p) => p.category === category)
            .map((p) => (
              <button
                type="button"
                key={p.id}
                aria-pressed={
                  style.photoPreset === p.id && !style.referenceIds?.length
                }
                onClick={() => {
                  setPrevious({ ...style });
                  change(photoPresetFields(p.id));
                  setMessage(
                    `${p.name} selected. Your colors and typography stay the same.`,
                  );
                  setPreview("photo");
                }}
              >
                <img src={p.image} alt="" loading="lazy" />
                <span>
                  {p.name}
                  {style.photoPreset === p.id &&
                    !style.referenceIds?.length && <Check size={14} />}
                </span>
              </button>
            ))}
        </div>
      </details>
      <label className="cx-brand-auto">
        <input
          type="checkbox"
          checked={!!style.autoApply}
          onChange={(e) => change({ autoApply: e.target.checked })}
        />
        <span>
          <strong>Start new creations with this look</strong>
          <small>
            Photos and posts start here. You can change the look for any
            individual creation.
          </small>
        </span>
      </label>
      <p className="cx-look-help">
        <Sparkles size={14} /> Save your restaurant to keep these choices.
        Existing posts keep their saved design.
      </p>
    </section>
  );
}

"use client";
import { Check, Palette, Sparkles } from "lucide-react";
import { brandTypefaces, brandTypeface } from "@/lib/restaurant-look";
import { photoStyles, styleCategories } from "@/lib/photo-styles";
import type { Row } from "@/lib/client";

export default function RestaurantLookEditor({
  profile,
  setProfile,
  style,
}: {
  profile: Row;
  setProfile: (p: Row) => void;
  style: Row;
}) {
  const change = (patch: Row) =>
    setProfile({ ...profile, style: { ...style, ...patch } });
  const preset = photoStyles.find((p) => p.id === style.photoPreset);
  const image = style.referenceIds?.[0]
    ? `/api/assets/${style.referenceIds[0]}`
    : preset?.image || "/studio/styles/menu-wood.webp";
  const font = brandTypeface(style);
  return (
    <section className="cx-brand-editor">
      <div className="cx-brand-heading">
        <Palette size={21} />
        <div>
          <h3>My restaurant look</h3>
          <p>Set it once. Make every photo, menu and post feel like you.</p>
        </div>
      </div>
      <label className="cx-brand-auto">
        <input
          type="checkbox"
          checked={!!style.autoApply}
          onChange={(e) => change({ autoApply: e.target.checked })}
        />
        <span>
          <strong>Use my look automatically</strong>
          <small>
            Start new photos and posts with these choices. Existing posts keep
            their saved design.
          </small>
        </span>
      </label>
      <div
        className="cx-brand-preview"
        aria-label="Restaurant look preview"
        style={
          {
            "--brand-primary": style.primary,
            "--brand-accent": style.accent,
            "--brand-font": `"${font.family}"`,
          } as React.CSSProperties
        }
      >
        <figure>
          <img src={image} alt="Photo style reference" />
          <figcaption>Photo inspiration</figcaption>
        </figure>
        <div className="cx-brand-menu-example">
          <span>THE MENU</span>
          <strong>{profile.name || "Your restaurant"}</strong>
          <i />
          <b>From our kitchen</b>
          <p>Seasonal favorites, made with care.</p>
          <small>Menu preview</small>
        </div>
        <div className="cx-brand-post-example">
          <img src={image} alt="Example post background" />
          <strong>{profile.name || "Your restaurant"}</strong>
          <small>Post preview</small>
        </div>
      </div>
      <div className="two-fields">
        {[
          ["primary", "Brand color"],
          ["accent", "Accent color"],
        ].map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <div className="cx-brand-color">
              <input
                type="color"
                value={style[key]}
                onChange={(e) => change({ [key]: e.target.value })}
              />
              <span>{style[key].toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>
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
      <label className="field">
        Your photo style
        <select
          value={style.photoPreset || "custom"}
          onChange={(e) => {
            const p = photoStyles.find((s) => s.id === e.target.value);
            if (p)
              change({
                photoPreset: p.id,
                photoStyle: p.prompt,
                referenceIds: [],
                photoDefaults: {
                  surface: "As shown",
                  lighting: "As shown",
                  plate: "keep",
                  angle: "keep",
                  composition: "Full dish",
                },
              });
          }}
        >
          <option value="custom" disabled>
            Saved lighting & references
          </option>
          {styleCategories.map((category) => (
            <optgroup key={category.id} label={category.name}>
              {photoStyles
                .filter((p) => p.category === category.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <small>
          <Sparkles size={13} /> You can also save a finished Photo Studio
          result as your look.
        </small>
      </label>
    </section>
  );
}

"use client";
import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api, type Row } from "@/lib/client";
import {
  menuPurposeIds,
  menuPurposeLabel,
  type MenuDocument,
  type MenuEntry,
  type MenuSection,
} from "@/lib/menu-document";
import { menuDesignSpec } from "@/lib/menu-design-system";
export const MenuActionContext = createContext({ busy: "", error: "" });

export function MenuDialog({
  title,
  description,
  children,
  close,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const action = useContext(MenuActionContext);
  const ref = useRef<HTMLDialogElement>(null),
    heading = useId(),
    detail = useId();
  useEffect(() => {
    const el = ref.current!;
    const before = document.activeElement as HTMLElement;
    el.showModal();
    return () => {
      el.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`md-dialog ${wide ? "md-dialog-wide" : ""}`}
      aria-labelledby={heading}
      aria-describedby={description ? detail : undefined}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="md-dialog-heading">
        <div>
          <h2 id={heading}>{title}</h2>
          {description && <p id={detail}>{description}</p>}
        </div>
        <button className="md-icon" aria-label="Close dialog" onClick={close}>
          <X size={20} />
        </button>
      </div>
      {children}
      {action.error && (
        <p className="md-inline-error" role="alert">
          {action.error}
        </p>
      )}
      {action.busy && (
        <p className="md-import-progress" role="status">
          {action.busy}…
        </p>
      )}
    </dialog>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId(),
    detail = useId();
  return (
    <div className="md-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              id: string;
              "aria-describedby"?: string;
            }>,
            { id, "aria-describedby": hint ? detail : undefined },
          )
        : children}
      {hint && <small id={detail}>{hint}</small>}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="md-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
export function MoneyInput({
  value,
  onChange,
  label,
  ...inputProps
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [raw, setRaw] = useState(value == null ? "" : (value / 100).toFixed(2)),
    focus = useRef(false);
  useEffect(() => {
    if (!focus.current) setRaw(value == null ? "" : (value / 100).toFixed(2));
  }, [value]);
  return (
    <input
      {...inputProps}
      aria-label={label}
      inputMode="decimal"
      placeholder="0.00"
      value={raw}
      onFocus={() => {
        focus.current = true;
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^\d{0,7}([.,]\d{0,2})?$/.test(next)) return;
        setRaw(next);
        const n = Number(next.replace(",", "."));
        onChange(
          next && Number.isFinite(n)
            ? Math.min(100000000, Math.round(n * 100))
            : null,
        );
      }}
      onBlur={() => {
        focus.current = false;
        setRaw(value == null ? "" : (value / 100).toFixed(2));
      }}
    />
  );
}
function PriceOptions({
  kind,
  values,
  change,
}: {
  kind: "variants" | "additions";
  values: MenuEntry["variants"];
  change: (values: MenuEntry["variants"]) => void;
}) {
  return (
    <div className="md-price-options">
      <span className="md-field-caption">
        {kind === "variants" ? "Sizes & prices" : "Add-ons"}
      </span>
      {values.map((v, index) => (
        <div className="md-option-row" key={v.id}>
          <input
            aria-label={`${kind === "variants" ? "Option" : "Add-on"} ${index + 1} name`}
            placeholder={
              kind === "variants" ? "Glass / bottle / large" : "Extra avocado"
            }
            maxLength={120}
            value={v.label}
            onChange={(e) =>
              change(
                values.map((o) =>
                  o.id === v.id ? { ...o, label: e.target.value } : o,
                ),
              )
            }
          />
          <MoneyInput
            label={`${v.label || "Option"} price`}
            value={v.price}
            onChange={(n) =>
              change(
                values.map((o) =>
                  o.id === v.id ? { ...o, price: n || 0 } : o,
                ),
              )
            }
          />
          <button
            className="md-icon"
            aria-label={`Remove ${kind === "variants" ? "option" : "add-on"} ${index + 1}${v.label ? `: ${v.label}` : ""}`}
            onClick={() => change(values.filter((o) => o.id !== v.id))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="md-text-button"
        disabled={values.length >= 12}
        onClick={() =>
          change([...values, { id: crypto.randomUUID(), label: "", price: 0 }])
        }
      >
        <Plus size={14} />
        {kind === "variants" ? "Add a size or option" : "Add an extra"}
      </button>
    </div>
  );
}
export function MenuItemInspector({
  item,
  section,
  sections,
  assets,
  change,
  move,
  remove,
  reorder,
  onPhoto,
  onLibrary,
  menuId,
}: {
  item: MenuEntry;
  section: MenuSection;
  sections: MenuSection[];
  assets: Row[];
  change: (patch: Partial<MenuEntry>) => void;
  move: (sectionId: string) => void;
  remove: () => void;
  reorder: (direction: number) => void;
  onPhoto: () => void;
  onLibrary: () => void;
  menuId: string;
}) {
  const [dietaryText, setDietaryText] = useState(item.dietary.join(", "));
  const dietaryFocus = useRef(false);
  const dietaryValue = item.dietary.join(", ");
  useEffect(() => {
    if (!dietaryFocus.current) setDietaryText(dietaryValue);
  }, [dietaryValue]);
  const [suggestion, setSuggestion] = useState<{
      original: string;
      text: string;
    } | null>(null),
    [aiBusy, setAiBusy] = useState(false),
    [error, setError] = useState("");
  const photos = assets.filter(
      (a) => a.dish_id === item.dishId && a.approved_at && !a.deleted_at,
    ),
    index = section.items.findIndex((i) => i.id === item.id);
  return (
    <div className="md-inspector-content">
      <div className="md-inspector-label">
        <h2 className="md-selected-item-heading">
          {item.name || "Untitled dish"}
        </h2>
        <div>
          <button
            className="md-icon"
            aria-label={`Move ${item.name || "untitled dish"} earlier`}
            disabled={index === 0}
            onClick={() => reorder(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="md-icon"
            aria-label={`Move ${item.name || "untitled dish"} later`}
            disabled={index === section.items.length - 1}
            onClick={() => reorder(1)}
          >
            <ArrowDown size={15} />
          </button>
        </div>
      </div>
      {!item.sourceReviewed && (
        <div className="md-review-callout">
          <strong>Check against your original</strong>
          <p>Confirm the wording and price, then mark this dish reviewed.</p>
          {!!item.sourceUncertain.length && (
            <p>Needs a closer look: {item.sourceUncertain.join(", ")}.</p>
          )}
          <button
            className="md-button md-small"
            onClick={() => change({ sourceReviewed: true })}
          >
            <Check size={14} /> Mark reviewed
          </button>
        </div>
      )}
      <Field label="Dish name">
        <input
          value={item.name}
          maxLength={120}
          onChange={(e) => change({ name: e.target.value })}
          placeholder="Roast chicken"
        />
      </Field>
      <Field label="Description">
        <textarea
          rows={4}
          value={item.description}
          maxLength={2000}
          onChange={(e) => {
            change({ description: e.target.value });
            setSuggestion(null);
          }}
          placeholder="Charred leeks, potato purée, chicken jus"
        />
      </Field>
      {item.description.trim().length > 35 && (
        <button
          className="md-text-button"
          disabled={aiBusy}
          onClick={async () => {
            setAiBusy(true);
            setError("");
            try {
              const r = await api(`menus/${menuId}/shorten`, {
                name: item.name,
                description: item.description,
              });
              setSuggestion({
                original: item.description,
                text: r.description,
              });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setAiBusy(false);
            }
          }}
        >
          <Sparkles size={14} />
          {aiBusy ? "Considering the wording…" : "Suggest shorter wording"}
        </button>
      )}
      {suggestion && (
        <div className="md-suggestion">
          <span>
            {suggestion.text === suggestion.original
              ? "Your description is already concise."
              : "Suggested wording · review the facts"}
          </span>
          <p>{suggestion.text}</p>
          <div>
            {suggestion.text !== suggestion.original && (
              <button
                className="md-button md-small"
                disabled={suggestion.original !== item.description}
                onClick={() => {
                  change({ description: suggestion.text });
                  setSuggestion(null);
                }}
              >
                Use wording
              </button>
            )}
            <button
              className="md-text-button"
              onClick={() => setSuggestion(null)}
            >
              Keep original
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="md-inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="md-field-pair">
        <Field label="Price style">
          <select
            value={item.priceMode}
            onChange={(e) =>
              change({
                priceMode: e.target.value as MenuEntry["priceMode"],
                ...(e.target.value === "label" && !item.priceLabel
                  ? { priceLabel: "Market price" }
                  : {}),
              })
            }
          >
            <option value="single">One price</option>
            <option value="variants">Sizes / options</option>
            <option value="label">Price label</option>
            <option value="included">Included</option>
          </select>
        </Field>
        {item.priceMode === "single" && (
          <Field label="Price">
            <MoneyInput
              value={item.price}
              onChange={(price) => change({ price })}
            />
          </Field>
        )}
      </div>
      {item.priceMode === "label" && (
        <Field label="Price label">
          <input
            value={item.priceLabel}
            maxLength={60}
            placeholder="Market price"
            onChange={(e) => change({ priceLabel: e.target.value })}
          />
        </Field>
      )}
      {item.priceMode === "variants" && (
        <PriceOptions
          kind="variants"
          values={item.variants}
          change={(variants) => change({ variants })}
        />
      )}
      <details
        className="md-details"
        open={item.additions.length > 0 || undefined}
      >
        <summary>Add-ons & dietary notes</summary>
        <PriceOptions
          kind="additions"
          values={item.additions}
          change={(additions) => change({ additions })}
        />
        <Field
          label="Verified dietary notes"
          hint="Separate with commas. Only add claims you can confirm."
        >
          <input
            value={dietaryText}
            onFocus={() => {
              dietaryFocus.current = true;
            }}
            onBlur={() => {
              dietaryFocus.current = false;
              setDietaryText(dietaryValue);
            }}
            maxLength={320}
            placeholder="Vegetarian, contains nuts"
            onChange={(e) => {
              setDietaryText(e.target.value);
              change({
                dietary: e.target.value
                  .split(",")
                  .slice(0, 8)
                  .map((v) => v.trim().slice(0, 40))
                  .filter(Boolean),
              });
            }}
          />
        </Field>
      </details>
      <Field label="Section">
        <select value={section.id} onChange={(e) => move(e.target.value)}>
          {sections.map((s) => (
            <option value={s.id} key={s.id}>
              {s.name || "Untitled section"}
            </option>
          ))}
        </select>
      </Field>
      <div className="md-toggle-group">
        <Toggle
          label="Show on this menu"
          checked={item.visible}
          onChange={(visible) => change({ visible })}
        />
        <Toggle
          label="Available to order"
          checked={item.available}
          onChange={(available) => change({ available })}
        />
      </div>
      <details className="md-details" open={!!item.photoId || undefined}>
        <summary>Dish photography</summary>
        {photos.length ? (
          <>
            <div className="md-photo-choices">
              <button
                aria-label="No photo"
                aria-pressed={!item.photoId}
                onClick={() => change({ photoId: null, featured: false })}
              >
                No photo
              </button>
              {photos.map((a) => (
                <button
                  key={a.id}
                  aria-label={`Use approved photo of ${item.name}`}
                  aria-pressed={item.photoId === a.id}
                  onClick={() => change({ photoId: a.id })}
                >
                  <img src={`/api/assets/${a.id}`} alt="" />
                </button>
              ))}
            </div>
            {item.photoId && (
              <>
                <Toggle
                  label="Feature this dish"
                  checked={item.featured}
                  onChange={(featured) => change({ featured })}
                />
                <Toggle
                  label="Show the whole photograph"
                  checked={item.crop.fit}
                  onChange={(fit) => change({ crop: { ...item.crop, fit } })}
                />
                {!item.crop.fit && (
                  <>
                    <Field label="Horizontal framing">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.crop.x}
                        onChange={(e) =>
                          change({
                            crop: { ...item.crop, x: Number(e.target.value) },
                          })
                        }
                      />
                    </Field>
                    <Field label="Vertical framing">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={item.crop.y}
                        onChange={(e) =>
                          change({
                            crop: { ...item.crop, y: Number(e.target.value) },
                          })
                        }
                      />
                    </Field>
                    <Field label="Photo zoom">
                      <input
                        type="range"
                        min="1"
                        max="2"
                        step="0.01"
                        value={item.crop.zoom}
                        onChange={(e) =>
                          change({
                            crop: {
                              ...item.crop,
                              zoom: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </Field>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          <p className="md-help">
            A menu can look beautiful with typography alone. Add an approved
            dish photo from your library when you want one.
          </p>
        )}
        {item.dishId && (
          <button className="md-text-button" onClick={onPhoto}>
            <Sparkles size={14} /> Open in Photo Studio
          </button>
        )}
      </details>
      <div className="md-inspector-actions">
        <button className="md-text-button" onClick={onLibrary}>
          {item.dishId ? "Update My Dishes…" : "Save to My Dishes…"}
        </button>
        <button className="md-text-button md-danger" onClick={remove}>
          <Trash2 size={14} /> Remove dish
        </button>
      </div>
      <p className="md-help">
        Changes apply to this menu. Your dish library keeps its own details.
      </p>
    </div>
  );
}
export function MenuSectionInspector({
  section,
  change,
  add,
  remove,
  reorder,
  index,
  count,
}: {
  section: MenuSection;
  change: (v: Partial<MenuSection>) => void;
  add: () => void;
  remove: () => void;
  reorder: (direction: number) => void;
  index: number;
  count: number;
}) {
  return (
    <div className="md-inspector-content">
      <div className="md-inspector-label">
        <span>Section details</span>
        <div>
          <button
            className="md-icon"
            aria-label={`Move ${section.name || "untitled section"} earlier`}
            disabled={!index}
            onClick={() => reorder(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="md-icon"
            aria-label={`Move ${section.name || "untitled section"} later`}
            disabled={index === count - 1}
            onClick={() => reorder(1)}
          >
            <ArrowDown size={15} />
          </button>
        </div>
      </div>
      <Field label="Section name">
        <input
          value={section.name}
          maxLength={120}
          onChange={(e) => change({ name: e.target.value })}
          placeholder="From the kitchen"
        />
      </Field>
      <Field label="Section introduction">
        <textarea
          rows={3}
          value={section.description}
          maxLength={600}
          onChange={(e) => change({ description: e.target.value })}
          placeholder="A few words about these dishes"
        />
      </Field>
      <Toggle
        label="Begin on a new page"
        checked={section.pageBreakBefore}
        onChange={(pageBreakBefore) => change({ pageBreakBefore })}
      />
      <div className="md-inspector-actions">
        <button className="md-button" onClick={add}>
          <Plus size={15} /> Add a dish
        </button>
        <button className="md-text-button md-danger" onClick={remove}>
          <Trash2 size={14} /> Remove section & dishes
        </button>
      </div>
      <p className="md-help">You can undo a removal from the toolbar.</p>
    </div>
  );
}
export function MenuDesignInspector({
  menu,
  change,
  choose,
}: {
  menu: MenuDocument;
  change: (patch: Partial<MenuDocument>) => void;
  choose: () => void;
}) {
  const spec = menuDesignSpec(menu.design);
  return (
    <div className="md-inspector-content">
      <div className="md-selected-design" style={{ borderColor: spec.color }}>
        <span>{spec.category}</span>
        <h3>{spec.name}</h3>
        <p>{spec.description}</p>
        <button className="md-button md-secondary" onClick={choose}>
          Explore designs
        </button>
      </div>
      <Field label="Palette">
        <select
          value={menu.colorMode}
          onChange={(e) =>
            change({ colorMode: e.target.value as MenuDocument["colorMode"] })
          }
        >
          <option value="restaurant">My restaurant colors</option>
          <option value="signature">Designer palette</option>
          <option value="custom">Custom color</option>
        </select>
      </Field>
      {menu.colorMode === "custom" && (
        <Field label="Accent color">
          <input
            type="color"
            value={menu.color}
            onChange={(e) => change({ color: e.target.value })}
          />
        </Field>
      )}
      <Field label="Appearance">
        <select
          value={menu.appearance}
          onChange={(e) =>
            change({ appearance: e.target.value as MenuDocument["appearance"] })
          }
        >
          <option value="light">Light paper</option>
          <option value="dark">Dark paper</option>
        </select>
      </Field>
      <Field label="Photography">
        <select
          value={menu.layout}
          onChange={(e) =>
            change({ layout: e.target.value as MenuDocument["layout"] })
          }
        >
          <option value="classic">Typography only</option>
          <option value="featured">Featured dishes</option>
          <option value="grid">Every selected photo</option>
        </select>
      </Field>
      <div className="md-field-pair">
        <Field label="Spacing">
          <select
            value={menu.density}
            onChange={(e) =>
              change({ density: e.target.value as MenuDocument["density"] })
            }
          >
            <option value="comfortable">Balanced</option>
            <option value="spacious">Airy</option>
            <option value="compact">Compact</option>
          </select>
        </Field>
        <Field label="Columns">
          <select
            value={menu.columns}
            onChange={(e) => change({ columns: Number(e.target.value) })}
          >
            <option value={0}>Automatic</option>
            <option value={1}>One</option>
            <option value={2}>Two</option>
          </select>
        </Field>
      </div>
      <div className="md-field-pair">
        <Field label="Page size">
          <select
            value={menu.paper}
            onChange={(e) =>
              change({ paper: e.target.value as MenuDocument["paper"] })
            }
          >
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </Field>
        <Field label="Page preference">
          <select
            value={menu.pageTarget}
            onChange={(e) => change({ pageTarget: Number(e.target.value) })}
          >
            <option value={0}>Best fit</option>
            <option value={1}>One page</option>
            <option value={2}>Two pages</option>
          </select>
        </Field>
      </div>
      <p className="md-help">
        Content flows into complete pages. A page preference adjusts spacing
        while keeping text readable.
      </p>
      <Field label="Price display">
        <select
          value={menu.priceFormat}
          onChange={(e) =>
            change({
              priceFormat: e.target.value as MenuDocument["priceFormat"],
            })
          }
        >
          <option value="currency">$18.00 · currency symbol</option>
          <option value="numbers">18.00 · numbers only</option>
          <option value="whole">18 · omit .00</option>
        </select>
      </Field>
      <Toggle
        label="Show restaurant logo"
        checked={menu.showLogo}
        onChange={(showLogo) => change({ showLogo })}
      />
      <Toggle
        label="Include unavailable dishes"
        checked={menu.showUnavailable}
        onChange={(showUnavailable) => change({ showUnavailable })}
      />
    </div>
  );
}
export function MenuDetailsInspector({
  menu,
  change,
}: {
  menu: MenuDocument;
  change: (patch: Partial<MenuDocument>) => void;
}) {
  return (
    <div className="md-inspector-content">
      <div className="md-inspector-label">Menu details</div>
      <Field label="Saved menu name" hint="Only you see this name.">
        <input
          value={menu.name}
          maxLength={120}
          onChange={(e) => change({ name: e.target.value })}
        />
      </Field>
      <Field label="Menu title">
        <input
          value={menu.title}
          maxLength={120}
          placeholder="Dinner"
          onChange={(e) => change({ title: e.target.value })}
        />
      </Field>
      <Field label="Menu type">
        <select
          value={menu.purpose}
          onChange={(e) =>
            change({ purpose: e.target.value as MenuDocument["purpose"] })
          }
        >
          {menuPurposeIds.map((p) => (
            <option value={p} key={p}>
              {menuPurposeLabel(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Introduction">
        <textarea
          rows={3}
          maxLength={240}
          value={menu.subtitle}
          onChange={(e) => change({ subtitle: e.target.value })}
          placeholder="A season at the table"
        />
      </Field>
      <div className="md-field-pair">
        <Field label="Set menu price" hint="Leave empty for à la carte.">
          <MoneyInput
            value={menu.fixedPrice}
            onChange={(fixedPrice) => change({ fixedPrice })}
          />
        </Field>
        {menu.fixedPrice != null && (
          <Field label="Price note">
            <input
              value={menu.fixedPriceLabel}
              maxLength={100}
              onChange={(e) => change({ fixedPriceLabel: e.target.value })}
            />
          </Field>
        )}
      </div>
      <Field
        label="Footer & guest notes"
        hint="Allergy information, service charges, sourcing, or opening hours."
      >
        <textarea
          rows={5}
          value={menu.footer}
          maxLength={1500}
          onChange={(e) => change({ footer: e.target.value })}
          placeholder="Please tell your server about any allergies."
        />
      </Field>
      <Field label="Menu language">
        <select
          value={menu.language}
          onChange={(e) => change({ language: e.target.value })}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="it">Italiano</option>
          <option value="de">Deutsch</option>
          <option value="pt">Português</option>
        </select>
      </Field>
    </div>
  );
}

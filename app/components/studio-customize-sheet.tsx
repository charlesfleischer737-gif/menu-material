"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronDown,
  ImagePlus,
  ShieldCheck,
  Undo2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { photoStyles, styleThumbnail } from "@/lib/photo-styles";
import { lookSummary } from "@/lib/studio-discovery";
import type { Row } from "@/lib/client";
import { CropControls, PhotoFrame } from "./creation-shared";
import { radioKeys, radioTab } from "./radio-keys";

const surfaces = [
  { value: "As shown", title: "Follow this look", image: "" },
  { value: "Warm wood", title: "Warm wood", image: "menu-wood" },
  { value: "Pale stone", title: "Pale stone", image: "menu-stone" },
  { value: "White seamless", title: "Clean white", image: "delivery-white" },
];
const lights = [
  { value: "As shown", title: "Follow this look", image: "" },
  {
    value: "Soft daylight",
    title: "Soft daylight",
    image: "delivery-daylight",
  },
  { value: "Warm & cozy", title: "Warm & cozy", image: "bar-speakeasy" },
];
const wares = [
  { value: "keep", name: "Keep mine", help: "Your original serving dish" },
  { value: "style", name: "Follow this look", help: "May replace your dish" },
  { value: "white", name: "Simple white", help: "White serving ware" },
];
const imageFor = (id: string) =>
  styleThumbnail(
    photoStyles.find((style) => style.id === id)?.image || photoStyles[0].image,
  );

/**
 * Setting, serving dish, light and framing as visual choices. Edits apply on
 * Done; Cancel, Escape and Back leave the photo's look as it was.
 */
export function StudioCustomizeSheet({
  open,
  onOpenChange,
  draft: b,
  controls,
  setControls,
  section,
  setSection,
  focusSection,
  lookName,
  lookImage,
  source,
  ratio,
  guest,
  canSave,
  hasReference,
  busy,
  onDone,
  onReset,
  onInspiration,
  onSaveLook,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Row;
  controls: Row;
  setControls: Dispatch<SetStateAction<Row>>;
  section: string;
  setSection: (section: string) => void;
  // A section to focus on open, when Customize is opened for one choice.
  focusSection: string;
  lookName: string;
  lookImage: string;
  source: string;
  ratio: number;
  guest: boolean;
  canSave: boolean;
  hasReference: boolean;
  busy: boolean;
  onDone: () => void;
  onReset: () => void;
  onInspiration: (trigger: HTMLButtonElement) => void;
  onSaveLook: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const drink = b.family === "Drinks";
  function control(key: string, value: string) {
    setControls((current) => ({
      ...current,
      [key]: value,
      studioOverrides: [...new Set([...(current.studioOverrides || []), key])],
    }));
  }
  const groups = [
    { key: "surface", name: "Setting", value: controls.surface },
    {
      key: "plate",
      name: drink ? "Glass" : "Serving dish",
      value:
        drink || controls.plate === "keep"
          ? "Keep mine"
          : controls.plate === "white"
            ? "Simple white"
            : "Follow this look",
    },
    { key: "lighting", name: "Light", value: controls.lighting },
    { key: "framing", name: "Framing", value: controls.composition },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={sheet}
        className="cx-workspace-popover st-sheet st-customize"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          if (!focusSection) return;
          const target = [
            ...(sheet.current?.querySelectorAll<HTMLButtonElement>(
              "[data-control-section]",
            ) || []),
          ].find((button) => button.dataset.controlSection === focusSection);
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <header className="st-sheet-header">
          <div>
            <span className="st-sheet-kicker">{lookName}</span>
            <DialogTitle>Customize this look</DialogTitle>
            <DialogDescription>
              A few thoughtful choices. No prompt needed.
            </DialogDescription>
          </div>
          <button
            className="st-icon-button"
            aria-label="Cancel customization"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} />
          </button>
        </header>
        <div className="st-sheet-scroll">
          <div className="st-recipe">
            {lookImage ? (
              <img src={lookImage} alt="" />
            ) : (
              <span className="st-recipe-empty" aria-hidden="true" />
            )}
            <p>{lookSummary({ ...b, ...controls }).join(" · ")}</p>
          </div>
          {groups.map((item) => (
            <Collapsible
              key={item.key}
              className="st-control"
              open={section === item.key}
              onOpenChange={(isOpen) => setSection(isOpen ? item.key : "")}
            >
              <CollapsibleTrigger
                className="st-control-heading"
                data-control-section={item.key}
              >
                <b>{item.name}</b>
                <span>
                  {item.value === "As shown" ? "Follow this look" : item.value}
                </span>
                <ChevronDown size={16} aria-hidden="true" />
              </CollapsibleTrigger>
              <CollapsibleContent className="st-control-body">
                {(item.key === "surface" || item.key === "lighting") && (
                  <div
                    className="st-swatches"
                    role="radiogroup"
                    aria-label={item.name}
                    onKeyDown={radioKeys}
                  >
                    {(item.key === "surface" ? surfaces : lights).map(
                      (option, index, options) => (
                        <button
                          key={option.value}
                          role="radio"
                          aria-checked={controls[item.key] === option.value}
                          tabIndex={radioTab(
                            index,
                            options.findIndex(
                              (entry) => entry.value === controls[item.key],
                            ),
                          )}
                          onClick={() => control(item.key, option.value)}
                        >
                          <span className="st-swatch-media">
                            {option.image || lookImage ? (
                              <img
                                src={
                                  option.image
                                    ? imageFor(option.image)
                                    : lookImage
                                }
                                alt=""
                                loading="lazy"
                              />
                            ) : null}
                            {controls[item.key] === option.value && (
                              <Check size={14} strokeWidth={3} />
                            )}
                          </span>
                          <span>{option.title}</span>
                        </button>
                      ),
                    )}
                  </div>
                )}
                {item.key === "plate" &&
                  (drink ? (
                    <p className="st-control-help">
                      We keep your glass, ice, garnish and liquid level true to
                      the drink you serve.
                    </p>
                  ) : (
                    <>
                      <div
                        className="st-wares"
                        role="radiogroup"
                        aria-label="Serving dish"
                        onKeyDown={radioKeys}
                      >
                        {wares.map((option, index) => (
                          <button
                            key={option.value}
                            role="radio"
                            aria-checked={controls.plate === option.value}
                            tabIndex={radioTab(
                              index,
                              wares.findIndex(
                                (entry) => entry.value === controls.plate,
                              ),
                            )}
                            onClick={() => control("plate", option.value)}
                          >
                            <span className={`st-ware st-ware-${option.value}`}>
                              {option.value === "keep" && (
                                <ShieldCheck size={18} />
                              )}
                            </span>
                            <b>{option.name}</b>
                            <small>{option.help}</small>
                          </button>
                        ))}
                      </div>
                      {controls.plate !== "keep" && (
                        <p className="st-control-help">
                          This changes the serving dish. Ingredients, portions
                          and meaningful branding stay the same.
                        </p>
                      )}
                    </>
                  ))}
                {item.key === "framing" && (
                  <div className="st-framing">
                    <label className="st-field">
                      <span>Composition</span>
                      <select
                        className="st-select"
                        value={controls.composition || "Full dish"}
                        onChange={(event) =>
                          control("composition", event.target.value)
                        }
                      >
                        <option>Full dish</option>
                        <option>Close-up detail</option>
                        <option>Space above for a headline</option>
                        <option>Room around the plate</option>
                      </select>
                    </label>
                    <label className="st-field">
                      <span>Camera angle</span>
                      <select
                        className="st-select"
                        value={controls.angle || "keep"}
                        onChange={(event) =>
                          control("angle", event.target.value)
                        }
                      >
                        <option value="keep">Keep my photo’s angle</option>
                        <option value="overhead">From above</option>
                        <option value="three-quarter">At an angle</option>
                      </select>
                    </label>
                    {controls.angle !== "keep" && (
                      <p className="st-control-help">
                        A new angle may reveal details the original photo
                        doesn’t show. Check the result carefully.
                      </p>
                    )}
                    {source && (
                      <Collapsible className="st-crop">
                        <CollapsibleTrigger className="st-text-button">
                          Adjust crop
                          <ChevronDown size={14} aria-hidden="true" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <PhotoFrame
                            src={source}
                            ratio={ratio}
                            edits={controls.adjustments}
                          />
                          <CropControls
                            value={controls.adjustments}
                            onChange={(adjustments) =>
                              setControls((current) => ({
                                ...current,
                                adjustments,
                              }))
                            }
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
          <div className="st-sheet-links">
            <button
              className="st-text-button"
              disabled={busy}
              onClick={(event) => onInspiration(event.currentTarget)}
            >
              <ImagePlus size={16} />
              {hasReference
                ? "Edit inspiration photo"
                : "Match a photo you love"}
              <ArrowRight size={14} />
            </button>
            {!guest && (
              <button
                className="st-text-button"
                disabled={!canSave}
                onClick={onSaveLook}
              >
                <BookmarkPlus size={16} />
                Save as a restaurant look
              </button>
            )}
            <button className="st-text-button" onClick={onReset}>
              <Undo2 size={16} />
              Reset to this look
            </button>
          </div>
        </div>
        <footer className="st-sheet-footer">
          <button
            className="st-pill st-pill-quiet"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button className="st-pill st-pill-primary" onClick={onDone}>
            Done
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

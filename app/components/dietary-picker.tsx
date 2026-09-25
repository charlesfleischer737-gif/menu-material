"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  allergenTags,
  dietTags,
  dietaryTag,
  normalizeDietary,
} from "@/lib/dietary";

// The major allergens most menus list; the rest sit under "More allergens".
const common = new Set([
  "contains-gluten",
  "contains-milk",
  "contains-egg",
  "contains-peanuts",
  "contains-tree-nuts",
  "contains-soy",
  "contains-sesame",
  "contains-fish",
  "contains-shellfish",
]);

/** Owner-confirmed dietary and allergen tags for one dish. */
export default function DietaryPicker({
  value,
  onChange,
  disabled = false,
  fieldClass = "ui-dietary-note",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** The host's text-field class, so "Other notes" matches its other fields. */
  fieldClass?: string;
}) {
  // Saved values read as the menu reads them: a whole note that is exactly
  // "V" or "gluten free" (written before tags existed) is that tag.
  const current = normalizeDietary(value),
    notes = current.filter((v) => !dietaryTag(v)),
    saved = current.filter((v) => dietaryTag(v));
  // While "Other notes" has focus, the chips keep the tags they had when
  // typing began and the note is stored exactly as typed, so a note starting
  // "V", "GF" or "vegan" never selects a tag.
  const [typingTags, setTypingTags] = useState<string[] | null>(null);
  const tags = typingTags ?? saved;
  const [noteText, setNoteText] = useState(notes.join(", "));
  const editing = useRef(false),
    noteId = useId();
  const noteValue = notes.join(", ");
  useEffect(() => {
    if (!editing.current) setNoteText(noteValue);
  }, [noteValue]);
  const toggle = (id: string) =>
    onChange(
      normalizeDietary([
        ...(tags.includes(id) ? tags.filter((v) => v !== id) : [...tags, id]),
        ...notes,
      ]),
    );
  const chip = (tag: { id: string; label: string }) => (
    <button
      type="button"
      key={tag.id}
      aria-pressed={tags.includes(tag.id)}
      disabled={disabled}
      onClick={() => toggle(tag.id)}
    >
      {tag.label}
    </button>
  );
  return (
    <div className="ui-dietary">
      <fieldset>
        <legend>Suitable for</legend>
        <div className="ui-chips">{dietTags.map(chip)}</div>
      </fieldset>
      <fieldset>
        <legend>Contains</legend>
        <div className="ui-chips">
          {allergenTags.filter((t) => common.has(t.id)).map(chip)}
        </div>
        <details
          open={
            allergenTags.some(
              (t) => !common.has(t.id) && tags.includes(t.id),
            ) || undefined
          }
        >
          <summary>More allergens</summary>
          <div className="ui-chips">
            {allergenTags.filter((t) => !common.has(t.id)).map(chip)}
          </div>
        </details>
      </fieldset>
      <label className={fieldClass} htmlFor={noteId}>
        <span>Other notes</span>
        <input
          id={noteId}
          value={noteText}
          maxLength={200}
          disabled={disabled}
          placeholder="Contains alcohol, spicy"
          onFocus={() => {
            editing.current = true;
            setTypingTags(saved);
          }}
          onBlur={() => {
            editing.current = false;
            setTypingTags(null);
            setNoteText(noteValue);
          }}
          onChange={(e) => {
            setNoteText(e.target.value);
            onChange(
              normalizeDietary(
                [
                  ...tags,
                  ...e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                ],
                { synonyms: false },
              ),
            );
          }}
        />
      </label>
      <small>
        Only add what you can confirm. Guests can filter by “Suitable for”.
      </small>
    </div>
  );
}

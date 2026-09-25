"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { showcaseRows, type ShowcaseStyle } from "@/lib/homepage-showcase";

// Tiles are 22vw, between 172 and 300 CSS px. The style library's 400 px
// previews cover 1x screens and 2x phones; the 640 px copies from
// scripts/prepare-web-images.mjs cover 2x desktops and 3x phones.
const tileSizes = "(max-width: 781px) 172px, (max-width: 1363px) 22vw, 300px";
const preview = (id: string) => `/studio/styles/thumbs/${id}.webp`;
const photoSrcSet = (id: string) =>
  `${preview(id)} 400w, /homepage/showcase/${id}-640.webp 640w`;
const showPhoto = (image: HTMLImageElement) =>
  image.closest("li")?.setAttribute("data-loaded", "");

function Tile({ style, copy }: { style: ShowcaseStyle; copy?: boolean }) {
  return (
    <li className="pw-showcase-tile">
      <figure>
        <img
          src={preview(style.id)}
          srcSet={photoSrcSet(style.id)}
          sizes={tileSizes}
          alt={copy ? "" : `Illustrative AI example: ${style.alt}`}
          width="640"
          height="640"
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          draggable={false}
          onLoad={(event) => showPhoto(event.currentTarget)}
        />
        <figcaption>{style.name}</figcaption>
      </figure>
    </li>
  );
}

// A slow, full-width wall of style examples in two rows drifting in opposite
// directions. A row eases to a stop under the pointer so a photo can be
// studied, the wall rests while it is off screen, and the button pauses it
// for good. With reduced motion the rows hold still and scroll sideways.
export default function HomepageShowcase() {
  const wall = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  const settle = useRef<(() => void) | null>(null);

  useEffect(() => {
    const root = wall.current;
    if (!root) return;
    // Photos that arrived before hydration are shown straight away; later
    // ones fade in as they load.
    for (const image of root.querySelectorAll("img"))
      if (image.complete && image.naturalWidth) showPhoto(image);
    root.setAttribute("data-enhanced", "");

    // With reduced motion the rows have no drift, so every change below is a
    // no-op until the setting is turned off.
    const rows = [
      ...root.querySelectorAll<HTMLElement>(".pw-showcase-row"),
    ].map((element) => ({ element, hovered: false, frame: 0 }));
    // Rows that scroll sideways can be focused, so they can be scrolled from
    // the keyboard.
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const scrollable = () => {
      for (const [index, { element }] of rows.entries())
        if (still.matches) {
          element.tabIndex = 0;
          element.setAttribute("role", "region");
          element.setAttribute("aria-label", `Style examples ${index + 1}`);
        } else
          for (const name of ["tabindex", "role", "aria-label"])
            element.removeAttribute(name);
    };
    scrollable();
    still.addEventListener("change", scrollable);
    let visible = true;
    // Speed changes glide rather than jump. updatePlaybackRate keeps the
    // compositor's copy of the drift in step, so the photos never skip.
    const glide = (row: (typeof rows)[number], to: number, duration = 700) => {
      const drift = row.element
        .querySelector(".pw-showcase-track")
        ?.getAnimations()[0];
      cancelAnimationFrame(row.frame);
      if (!drift || drift.playbackRate === to) return;
      const from = drift.playbackRate,
        start = performance.now();
      const step = (now: number) => {
        const t = duration ? Math.min(1, (now - start) / duration) : 1;
        drift.updatePlaybackRate(from + (to - from) * (1 - (1 - t) ** 3));
        if (t < 1) row.frame = requestAnimationFrame(step);
      };
      step(start);
    };
    settle.current = () => {
      for (const row of rows)
        glide(row, visible && !pausedRef.current && !row.hovered ? 1 : 0);
    };
    const listeners = rows.flatMap((row) => {
      const hover = (hovered: boolean) => (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        row.hovered = hovered;
        settle.current?.();
      };
      const enter = hover(true),
        leave = hover(false);
      row.element.addEventListener("pointerenter", enter);
      row.element.addEventListener("pointerleave", leave);
      return () => {
        row.element.removeEventListener("pointerenter", enter);
        row.element.removeEventListener("pointerleave", leave);
      };
    });
    // Off screen the wall stops outright; it picks up speed again on return.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) settle.current?.();
      else for (const row of rows) glide(row, 0, 0);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      still.removeEventListener("change", scrollable);
      for (const remove of listeners) remove();
      for (const row of rows) cancelAnimationFrame(row.frame);
      settle.current = null;
    };
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    settle.current?.();
  }, [paused]);

  return (
    <section className="pw-showcase" aria-labelledby="showcase-title">
      <div className="pw-section-heading">
        <h2 id="showcase-title">Studio quality photos for every occasion.</h2>
      </div>
      <div className="pw-showcase-wall" ref={wall}>
        {showcaseRows.map((row, index) => (
          <div className="pw-showcase-row" key={index}>
            <div className="pw-showcase-track">
              <ul className="pw-showcase-set">
                {row.map((style) => (
                  <Tile key={style.id} style={style} />
                ))}
              </ul>
              {/* The same photos again, so the drift loops without a seam. */}
              <ul className="pw-showcase-set" aria-hidden="true">
                {row.map((style) => (
                  <Tile key={style.id} style={style} copy />
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="pw-showcase-controls">
        <button
          type="button"
          className="pw-showcase-toggle"
          aria-label={paused ? "Play the gallery" : "Pause the gallery"}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? (
            <Play size={14} fill="currentColor" aria-hidden="true" />
          ) : (
            <Pause size={14} fill="currentColor" aria-hidden="true" />
          )}
        </button>
      </div>
    </section>
  );
}

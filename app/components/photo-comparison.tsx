"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronsLeftRight } from "lucide-react";

type Photo = { src: string; srcSet: string; alt: string };
type Style = Photo & { id: string; name: string; thumb: string };
type Dish = { id: string; name: string; before: Photo; styles: Style[] };

const cheesecake = (name: string) =>
  [480, 640, 960]
    .map((w) => `/homepage/styles/cheesecake-${name}-${w}.webp ${w}w`)
    .join(", ");

const dishes: Dish[] = [
  {
    id: "burger",
    name: "Burger",
    before: {
      src: "/homepage/optimized/burger-before-960.webp",
      srcSet:
        "/homepage/optimized/burger-before-960.webp 960w, /homepage/optimized/burger-before-1536.webp 1536w",
      alt: "Original phone photo of a burger on a white plate",
    },
    styles: [
      {
        id: "studio",
        name: "Studio",
        src: "/homepage/optimized/burger-after-960.webp",
        srcSet:
          "/homepage/optimized/burger-after-640.webp 640w, /homepage/optimized/burger-after-960.webp 960w, /homepage/optimized/burger-after-1536.webp 1536w",
        thumb: "/homepage/optimized/burger-after-160.webp",
        alt: "Illustrative AI edit of the burger with studio lighting and a clean background",
      },
    ],
  },
  {
    id: "cheesecake",
    name: "Cheesecake",
    before: {
      src: "/homepage/styles/cheesecake-original-960.webp",
      srcSet:
        "/homepage/styles/cheesecake-original-640.webp 640w, /homepage/styles/cheesecake-original-960.webp 960w",
      alt: "Original phone photo of a strawberry cheesecake slice",
    },
    styles: [
      ["color", "New backdrop", "on a bold blue backdrop"],
      ["angle", "From above", "photographed from above"],
      ["hand", "Served by hand", "served by hand"],
      ["closeup", "Close-up", "in close-up"],
    ].map(([id, name, detail]) => ({
      id,
      name,
      src: `/homepage/styles/cheesecake-${id}-960.webp`,
      srcSet: cheesecake(id),
      thumb: `/homepage/styles/cheesecake-${id}-160.webp`,
      alt: `Illustrative AI edit of the cheesecake ${detail}`,
    })),
  },
];

const sizes = "(max-width: 760px) 100vw, 1080px";

// Arrow keys move between radio options and select them, like native radios.
function radioKeys(
  event: KeyboardEvent<HTMLDivElement>,
  pick: (i: number) => void,
) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
    event.key
  ];
  if (!step) return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]"),
  ];
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  event.preventDefault();
  const next = (index + step + items.length) % items.length;
  items[next].focus();
  pick(next);
}

export default function PhotoComparison() {
  const [dishId, setDishId] = useState(dishes[0].id);
  const [styleId, setStyleId] = useState(dishes[0].styles[0].id);
  const [swapped, setSwapped] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const position = useRef(100);
  const intro = useRef<number | null>(null);
  const dragging = useRef(false);
  const dish = dishes.find((d) => d.id === dishId)!;
  const style = dish.styles.find((s) => s.id === styleId) || dish.styles[0];

  const place = (value: number) => {
    position.current = Math.max(0, Math.min(100, value));
    frame.current?.style.setProperty("--pos", `${position.current}%`);
    handle.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(position.current)),
    );
  };
  const cancelIntro = () => {
    if (intro.current) cancelAnimationFrame(intro.current);
    intro.current = null;
  };
  const fromPointer = (x: number) => {
    const box = frame.current!.getBoundingClientRect();
    place(((x - box.left) / box.width) * 100);
  };

  // One intro moment: start on the phone photo, then sweep to reveal the result.
  useEffect(() => {
    const el = frame.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(50);
      return;
    }
    place(100);
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        const start = performance.now() + 500,
          duration = 1400;
        const tick = (now: number) => {
          const t = Math.min(1, Math.max(0, (now - start) / duration));
          place(100 - 50 * (1 - Math.pow(1 - t, 3)));
          intro.current = t < 1 ? requestAnimationFrame(tick) : null;
        };
        intro.current = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelIntro();
    };
  }, []);

  const chooseDish = (next: Dish) => {
    if (next.id === dishId) return;
    setDishId(next.id);
    setStyleId(next.styles[0].id);
    setSwapped(true);
  };
  const chooseStyle = (next: Style) => {
    if (next.id === style.id) return;
    setStyleId(next.id);
    setSwapped(true);
  };

  return (
    <div className="pw-compare-block" id="the-difference">
      <div
        className="pw-compare"
        ref={frame}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          cancelIntro();
          fromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <img
          key={`${dish.id}-${style.id}`}
          className={`pw-compare-after${swapped ? " is-swapped" : ""}`}
          src={style.src}
          srcSet={style.srcSet}
          sizes={sizes}
          alt={style.alt}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <img
          key={`${dish.id}-before`}
          className="pw-compare-before"
          src={dish.before.src}
          srcSet={dish.before.srcSet}
          sizes={sizes}
          alt={dish.before.alt}
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <span className="pw-compare-tag is-left">Phone photo</span>
        <span className="pw-compare-tag is-right" aria-live="polite">
          {style.name}
        </span>
        <div
          className="pw-compare-handle"
          ref={handle}
          role="slider"
          tabIndex={0}
          aria-label="Compare the phone photo with the Menu Material version"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={100}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            const moves: Record<string, number> = {
              ArrowLeft: position.current - step,
              ArrowRight: position.current + step,
              Home: 0,
              End: 100,
            };
            if (!(e.key in moves)) return;
            e.preventDefault();
            cancelIntro();
            place(moves[e.key]);
          }}
        >
          <span className="pw-compare-knob">
            <ChevronsLeftRight size={22} aria-hidden="true" />
          </span>
        </div>
      </div>
      <div className="pw-compare-bar">
        <div
          className="pw-compare-dishes"
          role="radiogroup"
          aria-label="Dish"
          onKeyDown={(e) => radioKeys(e, (i) => chooseDish(dishes[i]))}
        >
          {dishes.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={d.id === dish.id}
              tabIndex={d.id === dish.id ? 0 : -1}
              onClick={() => chooseDish(d)}
            >
              {d.name}
            </button>
          ))}
        </div>
        <div
          className="pw-compare-swatches"
          role="radiogroup"
          aria-label="Style"
          onKeyDown={(e) => radioKeys(e, (i) => chooseStyle(dish.styles[i]))}
        >
          {dish.styles.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              className="pw-compare-swatch"
              aria-checked={s.id === style.id}
              aria-label={s.name}
              title={s.name}
              tabIndex={s.id === style.id ? 0 : -1}
              onClick={() => chooseStyle(s)}
            >
              <img
                src={s.thumb}
                alt=""
                width={30}
                height={30}
                decoding="async"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { ChevronsLeftRight } from "lucide-react";

const sizes = "(max-width: 760px) 100vw, 1080px";

export default function PhotoComparison() {
  const frame = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const position = useRef(100);
  const intro = useRef<number | null>(null);
  const dragging = useRef(false);

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
          src="/homepage/optimized/burger-after-960.webp"
          srcSet="/homepage/optimized/burger-after-640.webp 640w, /homepage/optimized/burger-after-960.webp 960w, /homepage/optimized/burger-after-1536.webp 1536w"
          sizes={sizes}
          alt="Illustrative AI edit of the burger with studio lighting and a clean background"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <img
          className="pw-compare-before"
          src="/homepage/optimized/burger-before-960.webp"
          srcSet="/homepage/optimized/burger-before-960.webp 960w, /homepage/optimized/burger-before-1536.webp 1536w"
          sizes={sizes}
          alt="Original phone photo of a burger on a white plate"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
        <span className="pw-compare-tag is-left">Phone photo</span>
        <span className="pw-compare-tag is-right">Studio</span>
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
    </div>
  );
}

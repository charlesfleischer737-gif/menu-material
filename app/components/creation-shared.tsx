"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { api, type Row } from "@/lib/client";
import { drawPhoto, imageBitmap } from "@/lib/creation-export";
import { emptyAdjustments, type Adjustments } from "@/lib/studio";
export function track(kind: string, entityId?: string, details: Row = {}) {
  void api("creation-events", {
    kind,
    entityId: entityId || undefined,
    details,
  }).catch(() => {});
}
export function useAction() {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function act(label: string, fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      lock.current = false;
    }
  }
  return { busy, error, notice, setError, setNotice, act };
}
export function useCreationDraft(kind: string, initial: Row) {
  const [draft, setDraft] = useState<Row>(initial),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("Opening saved work…");
  const meta = useRef({ id: "", revision: 0 }),
    latest = useRef(draft),
    saved = useRef(""),
    saving = useRef<Promise<void> | null>(null),
    live = useRef(true);
  const initialRef = useRef(initial);
  useEffect(() => {
    live.current = true;
    api("creation-drafts")
      .then((data) => {
        if (!live.current) return;
        const row = data.drafts.find((d: Row) => d.kind === kind);
        const value = row
          ? { ...initialRef.current, ...row.draft }
          : initialRef.current;
        meta.current = {
          id: row?.id || crypto.randomUUID(),
          revision: row?.revision || 0,
        };
        latest.current = value;
        saved.current = JSON.stringify(value);
        setDraft(value);
        setReady(true);
        setStatus(row ? "All changes saved" : "Ready when you are");
      })
      .catch((e) => setStatus(e.message));
    return () => {
      live.current = false;
    };
  }, [kind]);
  const save = useCallback(async () => {
    if (saving.current) return saving.current;
    const run = async () => {
      while (
        meta.current.id &&
        JSON.stringify(latest.current) !== saved.current
      ) {
        const content = JSON.stringify(latest.current);
        const data = await api("creation-drafts", {
          ...meta.current,
          kind,
          draft: JSON.parse(content),
        });
        meta.current.revision = data.revision;
        saved.current = content;
      }
      setStatus("All changes saved");
    };
    const p = run();
    saving.current = p;
    try {
      await p;
    } catch (e) {
      setStatus("Couldn’t save. " + (e as Error).message);
      throw e;
    } finally {
      if (saving.current === p) saving.current = null;
    }
  }, [kind]);
  function change(patch: Row) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    setStatus("Saving…");
  }
  useEffect(() => {
    if (!ready || JSON.stringify(draft) === saved.current) return;
    const timer = setTimeout(() => void save().catch(() => {}), 500);
    return () => clearTimeout(timer);
  }, [draft, ready, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  async function start(value: Row, row?: Row) {
    await save();
    meta.current = {
      id: row?.id || crypto.randomUUID(),
      revision: row?.revision || 0,
    };
    latest.current = value;
    saved.current = row ? JSON.stringify(value) : "";
    setDraft(value);
    setStatus("Saving…");
    await save();
  }
  return { draft, change, save, start, ready, status, id: meta.current.id };
}
export function Steps({
  labels,
  step,
  onBack,
}: {
  labels: string[];
  step: number;
  onBack?: (n: number) => void;
}) {
  return (
    <ol className="cx-steps" aria-label="Your progress">
      {labels.map((label, i) => (
        <li
          key={label}
          className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
        >
          <button
            disabled={!onBack || i + 1 >= step}
            onClick={() => onBack?.(i + 1)}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            {label}
          </button>
        </li>
      ))}
    </ol>
  );
}
export function Heading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="cx-heading">
      <p className="cx-eyebrow">{eyebrow}</p>
      <h1 tabIndex={-1}>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function Feedback({
  busy,
  error,
  notice,
}: {
  busy: string;
  error: string;
  notice?: string;
}) {
  return (
    <>
      {busy && (
        <p className="cx-feedback" role="status">
          <LoaderCircle className="cx-spin" size={17} />
          {busy}
        </p>
      )}
      {error && (
        <p className="cx-feedback cx-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="cx-feedback" role="status">
          <Check size={17} />
          {notice}
        </p>
      )}
    </>
  );
}
export function Footer({
  back,
  next,
  label,
  busy,
  disabled,
  note,
}: {
  back?: () => void;
  next: () => void;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="cx-flow-footer">
      {back ? (
        <button className="cx-btn cx-secondary" disabled={busy} onClick={back}>
          <ArrowLeft size={17} />
          Back
        </button>
      ) : (
        <span />
      )}
      <div>
        <span className="cx-footnote">{note}</span>
        <button className="cx-btn" disabled={busy || disabled} onClick={next}>
          {busy ? <LoaderCircle className="cx-spin" size={17} /> : null}
          {label}
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="cx-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function PhotoFrame({
  src,
  ratio = 1,
  edits = emptyAdjustments,
  onChange,
  label = "Your photo · layout preview",
}: {
  src: string;
  ratio?: number;
  edits?: Adjustments;
  onChange?: (e: Adjustments) => void;
  label?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    im = useRef<ImageBitmap | null>(null),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(0),
    drag = useRef<{ x: number; y: number; ex: number; ey: number } | null>(
      null,
    );
  useEffect(() => {
    let active = true;
    setError("");
    imageBitmap(src)
      .then((b) => {
        if (!active) {
          b.close();
          return;
        }
        im.current = b;
        setLoaded((v) => v + 1);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
      im.current?.close();
      im.current = null;
    };
  }, [src]);
  useEffect(() => {
    if (canvas.current && im.current)
      drawPhoto(
        canvas.current,
        im.current,
        800,
        Math.round(800 / ratio),
        edits,
      );
  }, [loaded, edits, ratio]);
  return (
    <figure className="cx-photo-frame">
      <div
        className={onChange ? "cx-draggable" : ""}
        style={{ aspectRatio: ratio }}
        onPointerDown={(e) => {
          if (!onChange) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            ex: edits.x,
            ey: edits.y,
          };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !onChange) return;
          const bounds = e.currentTarget.getBoundingClientRect();
          onChange({
            ...edits,
            x: Math.max(
              0,
              Math.min(
                100,
                drag.current.ex -
                  ((e.clientX - drag.current.x) / bounds.width) * 100,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                100,
                drag.current.ey -
                  ((e.clientY - drag.current.y) / bounds.height) * 100,
              ),
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <canvas ref={canvas} aria-label={label} role="img" />
        {error && <p role="alert">{error}</p>}
      </div>
      <figcaption>
        {label}
        {onChange && <span>Drag to position</span>}
      </figcaption>
    </figure>
  );
}
export function CropControls({
  value,
  onChange,
  quick = false,
  allowFit = true,
}: {
  value: Adjustments;
  onChange: (e: Adjustments) => void;
  quick?: boolean;
  allowFit?: boolean;
}) {
  const e = { ...emptyAdjustments, ...value };
  return (
    <div className="cx-crop-controls">
      {allowFit && (
        <div className="cx-segment" aria-label="Photo fit">
          <button
            aria-pressed={e.fit}
            onClick={() => onChange({ ...e, fit: true, zoom: 1 })}
          >
            Fit whole dish
          </button>
          <button
            aria-pressed={!e.fit}
            onClick={() => onChange({ ...e, fit: false })}
          >
            Fill frame
          </button>
        </div>
      )}
      {[
        ["Horizontal position", "x", 0, 100, 1],
        ["Vertical position", "y", 0, 100, 1],
        ["Zoom", "zoom", 1, 2, 0.01],
        ...(quick
          ? [
              ["Brightness", "brightness", 80, 120, 1],
              ["Contrast", "contrast", 80, 120, 1],
              ["Warmth", "warmth", -30, 30, 1],
            ]
          : []),
      ].map(([label, key, min, max, step]) => (
        <label className="cx-range" key={String(key)}>
          <span>{label}</span>
          <input
            type="range"
            min={Number(min)}
            max={Number(max)}
            step={Number(step)}
            value={e[key as keyof Adjustments] as number}
            onChange={(ev) =>
              onChange({ ...e, [key]: Number(ev.target.value) })
            }
          />
        </label>
      ))}
      {quick && (
        <button
          className="cx-link"
          onClick={() => onChange({ ...e, rotate: (e.rotate + 90) % 360 })}
        >
          <RotateCw size={16} />
          Rotate 90°
        </button>
      )}
    </div>
  );
}

export function useStepFocus(step: number, ready: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ready) return;
    const frame = requestAnimationFrame(() => {
      if (ref.current?.getClientRects().length) {
        ref.current
          .querySelector<HTMLElement>("h1")
          ?.focus({ preventScroll: true });
        ref.current.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step, ready]);
  return ref;
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { api, normalizePhoto, type Row } from "@/lib/client";
import { looks, photoBrief, photoStyles } from "@/lib/studio";
import {
  transferGuestPhoto,
  type GuestPhoto,
  type GuestTransfer,
} from "@/lib/guest-studio";
import Brand from "./brand";
import { StudioWorkbench } from "./studio-workbench";
export default function GuestStudio({
  state,
  onSignIn,
  onSignup,
  onFinish,
  onBack,
}: {
  state: Row;
  onSignIn: () => void;
  onSignup: () => void;
  onFinish: () => Promise<void>;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<Row>(() => photoBrief());
  const [photo, setPhoto] = useState<GuestPhoto | null>(null),
    [reference, setReference] = useState<GuestPhoto | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [requested, setRequested] = useState(false);
  const lock = useRef(false),
    urls = useRef<string[]>([]);
  const transfer = useRef<GuestTransfer | null>(null);
  const latest = useRef({ draft, photo, reference });
  useEffect(() => {
    latest.current = { draft, photo, reference };
  }, [draft, photo, reference]);
  const autoStarted = useRef("");
  const [savedSome, setSavedSome] = useState(false);
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (latest.current.photo && !transfer.current?.jobId) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const continueCreation = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy("Creating your photo");
    setError("");
    try {
      transfer.current ||= {
        id: crypto.randomUUID(),
        revision: 0,
        requestKey: crypto.randomUUID(),
      };
      await transferGuestPhoto(
        latest.current.draft,
        latest.current.photo,
        latest.current.reference,
        state,
        transfer.current,
      );
      void api("jobs/tick", {}).catch(() => {});
      await onFinish();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
      setSavedSome(!!transfer.current?.dishId);
    }
  }, [state, onFinish]);
  useEffect(() => {
    if (state.user && requested && autoStarted.current !== state.user.id) {
      autoStarted.current = state.user.id;
      queueMicrotask(() => void continueCreation());
    }
  }, [state.user, requested, continueCreation]);
  function update(patch: Row) {
    setDraft((d) => ({ ...d, ...patch, styleChosen: true }));
    transfer.current = null;
  }
  async function upload(file: File, isReference = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy("Preparing your photo");
    setError("");
    try {
      const normalized = await normalizePhoto(file),
        url = URL.createObjectURL(normalized);
      urls.current.push(url);
      const next = { file, normalized, url };
      if (isReference) {
        setReference(next);
        update({ referenceId: "guest-reference" });
      } else {
        setPhoto(next);
        update({
          sourceId: "guest-photo",
          mode: "photo",
          analysisStatus: "manual",
          analysisSourceId: "guest-photo",
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  function create() {
    setRequested(true);
    if (!state.user) onSignup();
    else void continueCreation();
  }
  const selected = looks.find((l) => l.id === draft.look) || photoStyles[0];
  return (
    <div className="cx-guest">
      <header className="pw-header">
        <button
          className="cx-brand"
          onClick={onBack}
          disabled={!!busy}
          aria-label="Plateworthy home"
        >
          <Brand />
        </button>
        <nav aria-label="Studio navigation">
          <a href="/pricing" target="_blank" rel="noreferrer">
            Plans
          </a>
          {!state.user && <button onClick={onSignIn}>Log in</button>}
          <span className="cx-guest-free">
            <Sparkles size={15} />5 free images
          </span>
        </nav>
      </header>
      <main id="creation-main" className="cx-main cx-feature-main">
        <section className="cx-tool cx-feature-page cx-guided-studio">
          <div className="cx-guest-heading">
            <div>
              <p className="cx-eyebrow">YOUR FIRST GREAT FOOD PHOTO</p>
              <h1>Photo Studio</h1>
              <p>
                Choose a look and add your dish. Create a free account when
                you’re ready to generate.
              </p>
            </div>
            <button className="cx-link" onClick={onBack} disabled={!!busy}>
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
          {error && (
            <div className="cx-feedback error" role="alert">
              {error}
              {state.user && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => void continueCreation()}
                >
                  Retry creating my image
                </button>
              )}
              {state.user && savedSome && (
                <button
                  className="cx-link"
                  disabled={!!busy}
                  onClick={() => void onFinish()}
                >
                  Open my saved workspace
                </button>
              )}
            </div>
          )}
          {busy && (
            <p role="status" className="cx-feedback">
              {busy}…
            </p>
          )}
          <StudioWorkbench
            draft={draft}
            state={{ ...state, guest: true, remaining: 5, aiConnected: true }}
            selected={selected}
            source={photo?.url || ""}
            styleImage={
              draft.look === "reference"
                ? reference?.url || selected.image
                : draft.look === "keep"
                  ? photo?.url || selected.image
                  : selected.image
            }
            busy={busy}
            advice=""
            update={update}
            chooseLook={(look) => {
              const style = looks.find((l) => l.id === look);
              update({
                look,
                styleChosen: true,
                surface: "As shown",
                lighting: "As shown",
                plate: look === "keep" ? "keep" : "style",
                angle: style?.angle || "keep",
                composition: "Full dish",
              });
            }}
            matchRestaurant={() => {}}
            uploadPhoto={(file) => void upload(file)}
            uploadReference={(file) => void upload(file, true)}
            create={create}
            quickEdit={() => {}}
            openMenu={() => {}}
          />
        </section>
      </main>
    </div>
  );
}

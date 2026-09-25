"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { api, normalizePhoto, type Row } from "@/lib/client";
import {
  emptyAdjustments,
  photoBrief,
  resolvePhotoLook,
  samplePhoto,
  unavailablePhotoLook,
} from "@/lib/studio";
import {
  clearGuestDraft,
  loadGuestDrafts,
  restoreGuestPhoto,
  saveGuestDraft,
  type GuestDraftRecord,
} from "@/lib/guest-studio-storage";
import { studioLookPatch } from "@/lib/studio-discovery";
import { activeInspirationId, inspirationPatch } from "@/lib/studio-reference";
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
    [referenceBusy, setReferenceBusy] = useState(false),
    [error, setError] = useState(""),
    [requested, setRequested] = useState(false);
  const lock = useRef(false),
    urls = useRef<string[]>([]);
  const transfer = useRef<GuestTransfer | null>(null);
  const latest = useRef({ draft, photo, reference });
  const localId = useRef(""),
    persisted = useRef(false),
    transferring = useRef(false);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const [storageReady, setStorageReady] = useState(false),
    [storageNotice, setStorageNotice] = useState(""),
    [recoverable, setRecoverable] = useState<GuestDraftRecord[]>([]);
  useEffect(() => {
    let active = true;
    localId.current = crypto.randomUUID();
    void loadGuestDrafts()
      .then((records) => {
        if (active)
          setRecoverable(
            records.filter(
              (record) => record.photo || record.draft.mode === "description",
            ),
          );
      })
      .catch(() => {
        if (active)
          setStorageNotice(
            "This browser can’t keep your draft after you leave. Keep this tab open until your photo is saved to your account.",
          );
      })
      .finally(() => {
        if (active) setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function persistLocal(nextRequested = requested) {
    const recordId = localId.current;
    const value = {
      ...latest.current,
      transfer: transfer.current ? { ...transfer.current } : null,
      requested: nextRequested,
    };
    const pending = saving.current
      .catch(() => {})
      .then(() => saveGuestDraft(recordId, value));
    saving.current = pending;
    await pending;
    persisted.current = true;
  }
  useEffect(() => {
    if (
      !storageReady ||
      transferring.current ||
      (!photo && !draft.styleIntent && draft.mode !== "description")
    )
      return;
    persisted.current = false;
    const timer = setTimeout(() => {
      if (transferring.current) return;
      void persistLocal().catch(() =>
        setStorageNotice(
          "This browser couldn’t save your draft. Keep this tab open, or try again.",
        ),
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [draft, photo, reference, requested, storageReady]);
  function resume(record: GuestDraftRecord) {
    localId.current = record.id;
    transfer.current = record.transfer;
    const restoredPhoto = restoreGuestPhoto(record.photo),
      restoredReference = restoreGuestPhoto(record.reference);
    for (const photo of [restoredPhoto, restoredReference])
      if (photo) urls.current.push(photo.url);
    setDraft(record.draft);
    setPhoto(restoredPhoto);
    setReference(restoredReference);
    setRecoverable([]);
    latest.current = {
      draft: record.draft,
      photo: restoredPhoto,
      reference: restoredReference,
    };
    // Resuming restores work; creation always requires the owner's action.
    setRequested(false);
    persisted.current = true;
    setSavedSome(!!record.transfer?.dishId);
    setStorageNotice(
      "Draft restored. Check your choices, then create when you’re ready.",
    );
  }
  useEffect(() => {
    latest.current = { draft, photo, reference };
  }, [draft, photo, reference]);
  useEffect(() => {
    const retained = new Set([photo?.url, reference?.url]);
    urls.current = urls.current.filter((url) => {
      if (retained.has(url)) return true;
      URL.revokeObjectURL(url);
      return false;
    });
  }, [photo, reference]);
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
      if (
        latest.current.photo &&
        !persisted.current &&
        !transfer.current?.jobId
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const continueCreation = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    transferring.current = true;
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
        async () => {
          await persistLocal(true).catch(() => {
            setStorageNotice(
              "Keep this tab open while your photo is saved to your account.",
            );
          });
        },
      );
      await saving.current.catch(() => {});
      await clearGuestDraft(localId.current).catch(() => {});
      void api("jobs/tick", {}).catch(() => {});
      await onFinish();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      transferring.current = false;
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
    if (!transfer.current?.dishId) transfer.current = null;
    else {
      transfer.current = {
        ...transfer.current,
        requestKey: crypto.randomUUID(),
        ...(transfer.current.jobId
          ? {
              id: crypto.randomUUID(),
              revision: 0,
              jobId: undefined,
              startedAt: undefined,
            }
          : {}),
      };
      if ("sourceId" in patch) {
        transfer.current.sourceId = undefined;
        transfer.current.sourceRequestKey = undefined;
      }
      if ("referenceId" in patch) {
        transfer.current.referenceId = undefined;
        transfer.current.referenceRequestKey = undefined;
      }
    }
  }
  async function upload(file: File, options: { sample?: boolean } = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy("Preparing your photo");
    setError("");
    try {
      const normalized = await normalizePhoto(file),
        url = URL.createObjectURL(normalized);
      urls.current.push(url);
      const next = { file, normalized, url };
      // A dish saved by an earlier attempt keeps its sample status, so a
      // sample and a real photo never share one: start a new dish.
      if ((options.sample || draft.sample) && transfer.current?.dishId)
        transfer.current = null;
      setPhoto(next);
      update({
        ...(options.sample || draft.sample
          ? { name: options.sample ? samplePhoto.name : "", description: "" }
          : {}),
        sample: !!options.sample,
        sourceId: "guest-photo",
        mode: "photo",
        analysisStatus: "manual",
        analysisSourceId: "guest-photo",
        adjustments: { ...emptyAdjustments },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function create() {
    try {
      await persistLocal(true);
    } catch {
      setStorageNotice(
        "Your browser couldn’t save a local copy. Keep this tab open through sign-up.",
      );
    }
    setRequested(true);
    if (!state.user) onSignup();
    else void continueCreation();
  }
  const selected = resolvePhotoLook(draft) || unavailablePhotoLook;
  return (
    <div className="cx-guest">
      <header className="pw-header">
        <div className="pw-header-inner">
          <button
            className="cx-brand pw-brand"
            onClick={onBack}
            disabled={!!busy}
            aria-label="Menu Material home"
          >
            <Brand />
          </button>
          <nav className="pw-nav" aria-label="Studio navigation">
            <a href="/pricing" target="_blank" rel="noreferrer">
              Plans
            </a>
            {!state.user && (
              <button className="pw-login" onClick={onSignIn}>
                Log in
              </button>
            )}
            <span className="cx-guest-free">
              <Sparkles size={15} />5 free images
            </span>
          </nav>
        </div>
      </header>
      <main id="creation-main" className="cx-main cx-feature-main">
        {/* data-action-layout: on phones the fixed Create bar reserves its
            height, so it never covers Details or Format. */}
        <section
          className="cx-tool cx-feature-page cx-guided-studio"
          data-action-layout
        >
          <header className="st-header">
            <div className="st-header-copy">
              <h1>Photo Studio</h1>
              <p>Add your photo. Find your look. Make it menu material.</p>
            </div>
            <div className="st-header-tools">
              <button
                className="st-text-button"
                onClick={onBack}
                disabled={!!busy}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            </div>
          </header>
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
          {recoverable.length > 0 && !photo && (
            <div className="ps2-guest-recovery">
              <div>
                <b>Your photo is waiting.</b>
                <p>Saved on this device for 24 hours after your last change.</p>
              </div>
              <button
                className="cx-btn cx-secondary"
                onClick={() => resume(recoverable[0])}
              >
                Resume photo
              </button>
              <button className="cx-link" onClick={() => setRecoverable([])}>
                Start new
              </button>
            </div>
          )}
          {storageNotice && (
            <p className="ps2-inline-note" role="status">
              {storageNotice}
            </p>
          )}
          {busy && (
            <p role="status" className="cx-feedback">
              {busy}…
            </p>
          )}
          <StudioWorkbench
            draft={draft}
            state={{
              ...state,
              guest: !state.user,
              remaining: state.user ? state.remaining : 5,
              aiConnected: state.user ? state.aiConnected : true,
            }}
            selected={selected}
            source={photo?.url || ""}
            styleImage={
              draft.look === "reference"
                ? reference?.url || ""
                : draft.look === "keep"
                  ? photo?.url || selected.image
                  : selected.image
            }
            busy={busy || (referenceBusy ? "Preparing inspiration" : "")}
            advice=""
            update={update}
            chooseLook={(look) => {
              update(studioLookPatch(draft, look));
            }}
            uploadPhoto={(file, options) => void upload(file, options)}
            referencePhoto={
              activeInspirationId(draft) && reference
                ? { id: "guest-reference", url: reference.url }
                : null
            }
            onReferenceBusyChange={setReferenceBusy}
            applyInspiration={async (selection, base, signal) => {
              if (signal.aborted) return;
              if (selection?.kind === "file") {
                const url = URL.createObjectURL(selection.normalized);
                urls.current.push(url);
                setReference({
                  file: selection.file,
                  normalized: selection.normalized,
                  url,
                });
              } else if (!selection) setReference(null);
              update(
                inspirationPatch(
                  base,
                  selection ? "guest-reference" : null,
                  selection?.kind === "existing",
                ),
              );
            }}
            create={create}
            quickEdit={() => {}}
            openMenu={() => {}}
          />
        </section>
      </main>
    </div>
  );
}

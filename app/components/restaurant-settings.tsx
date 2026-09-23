"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, normalizePhoto, type Row } from "@/lib/client";
import RestaurantStyle from "./restaurant-style";

type Group = "details" | "look" | "ordering";
type Props = {
  open: boolean;
  close: () => void;
  state: Row;
  act: (label: string, action: () => Promise<void>) => unknown;
  refresh: () => Promise<void>;
  busy: unknown;
};
function restaurantProfile(restaurant: Row): Row {
  return {
    name: restaurant.name || "",
    cuisine: restaurant.cuisine || "",
    brand: restaurant.brand || "",
    currency: restaurant.currency || "USD",
    style: restaurant.style,
    timezone: restaurant.timezone || "America/New_York",
    orderingUrl: restaurant.ordering_url || "",
    hours: restaurant.hours,
  };
}
export default function RestaurantSettings({
  open,
  close,
  state,
  act,
  refresh,
  busy,
}: Props) {
  const [profile, setProfile] = useState<Row>(() =>
    restaurantProfile(state.restaurant),
  );
  const [baseline, setBaseline] = useState(() => JSON.stringify(profile));
  const [group, setGroup] = useState<Group>("details");
  const [discard, setDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const previouslyOpen = useRef(false);
  const saveLock = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const formId = useId();
  const dirty = JSON.stringify(profile) !== baseline;
  const working = saving || !!busy;
  useEffect(() => {
    if (open && !previouslyOpen.current) {
      const next = restaurantProfile(state.restaurant);
      setProfile(next);
      setBaseline(JSON.stringify(next));
      setGroup("details");
      setError("");
      setSaved(false);
      setDiscard(false);
    }
    previouslyOpen.current = open;
  }, [open, state.restaurant]);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);
  function requestClose() {
    if (working) return;
    if (dirty) setDiscard(true);
    else close();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLock.current || working) return;
    const invalid = Array.from(event.currentTarget.elements).find(
      (element) =>
        element instanceof HTMLInputElement && !element.validity.valid,
    ) as HTMLInputElement | undefined;
    if (invalid) {
      const nextGroup = invalid.closest<HTMLElement>("[data-settings-group]")
        ?.dataset.settingsGroup;
      if (nextGroup) setGroup(nextGroup as Group);
      setError(invalid.validationMessage);
      requestAnimationFrame(() => invalid.focus());
      return;
    }
    if (!String(profile.name).trim()) {
      setGroup("details");
      setError("Enter your restaurant name.");
      requestAnimationFrame(() =>
        document.getElementById(formId + "-name")?.focus(),
      );
      return;
    }
    try {
      new Intl.DateTimeFormat("en", { timeZone: profile.timezone }).format();
    } catch {
      setGroup("ordering");
      setError("Choose a valid restaurant timezone, such as America/New_York.");
      const timezoneInput = event.currentTarget.elements.namedItem("timezone");
      if (timezoneInput instanceof HTMLElement) {
        requestAnimationFrame(() => timezoneInput.focus());
      }
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setError("");
    try {
      await api("restaurant", profile);
      setBaseline(JSON.stringify(profile));
      setSaved(true);
      await refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) requestClose();
        }}
      >
        <DialogContent
          className="cx-workspace-popover restaurant-dialog rs-dialog"
          showCloseButton={false}
        >
          <header className="rs-header">
            <div>
              <DialogTitle>Your restaurant</DialogTitle>
              <DialogDescription>
                The details behind everything you make.
              </DialogDescription>
            </div>
            <button
              className="cx-icon"
              aria-label="Close restaurant settings"
              disabled={working}
              onClick={requestClose}
            >
              <X size={20} />
            </button>
          </header>
          <Tabs
            value={group}
            onValueChange={(value) => setGroup(value as Group)}
            className="rs-tabs"
          >
            <TabsList
              variant="line"
              className="rs-tab-list"
              aria-label="Restaurant settings"
            >
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="look">Restaurant look</TabsTrigger>
              <TabsTrigger value="ordering">Ordering & hours</TabsTrigger>
            </TabsList>
            <form id={formId} className="rs-body" noValidate onSubmit={save}>
              <fieldset className="rs-fields" disabled={working}>
                <TabsContent
                  forceMount
                  hidden={group !== "details"}
                  value="details"
                  data-settings-group="details"
                  className="rs-panel"
                >
                  {["name", "cuisine", "brand"].map((key) => (
                    <label className="field" key={key}>
                      {key === "name"
                        ? "Restaurant name"
                        : key === "cuisine"
                          ? "Cuisine"
                          : "Brand preferences"}
                      <input
                        id={key === "name" ? formId + "-name" : undefined}
                        required={key === "name"}
                        value={profile[key]}
                        disabled={working}
                        onChange={(event) =>
                          setProfile({ ...profile, [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="field">
                    Menu currency
                    <select
                      value={profile.currency}
                      disabled={working}
                      onChange={(event) =>
                        setProfile({ ...profile, currency: event.target.value })
                      }
                    >
                      {["USD", "GBP", "EUR", "JPY", "CAD", "AUD"].map(
                        (currency) => (
                          <option key={currency}>{currency}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field">
                    Logo (optional)
                    {state.restaurant.logo_id && (
                      <img
                        className="rs-logo"
                        src={`/api/assets/${state.restaurant.logo_id}`}
                        alt="Current restaurant logo"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/heic,.heic"
                      disabled={working}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file)
                          act("Saving logo", async () => {
                            const form = new FormData();
                            form.set("file", file);
                            form.set(
                              "normalized",
                              await normalizePhoto(file),
                              "logo.jpg",
                            );
                            form.set("kind", "logo");
                            await api("assets", form);
                            await refresh();
                          });
                      }}
                    />
                    <small>Logo uploads save immediately.</small>
                  </label>
                </TabsContent>
                <TabsContent
                  forceMount
                  hidden={group !== "look"}
                  value="look"
                  data-settings-group="look"
                  className="rs-panel"
                >
                  <RestaurantStyle
                    {...{ profile, setProfile, state, act, refresh }}
                    busy={working}
                    section="look"
                  />
                </TabsContent>
                <TabsContent
                  forceMount
                  hidden={group !== "ordering"}
                  value="ordering"
                  data-settings-group="ordering"
                  className="rs-panel"
                >
                  <RestaurantStyle
                    {...{ profile, setProfile, state, act, refresh }}
                    busy={working}
                    section="ordering"
                  />
                </TabsContent>
              </fieldset>
            </form>
          </Tabs>
          <footer className="rs-footer">
            {error && (
              <p className="rs-error" role="alert">
                {error}
              </p>
            )}
            <div className="rs-save-row">
              <span role="status">
                {saving ? (
                  "Saving…"
                ) : dirty ? (
                  "Unsaved changes"
                ) : saved ? (
                  <>
                    <Check size={16} /> Saved. Publish your menu to show guests.
                  </>
                ) : (
                  "Menu changes go live when you publish."
                )}
              </span>
              <button
                ref={closeButtonRef}
                className="cx-btn"
                type="submit"
                form={formId}
                disabled={working || !dirty}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent
          className="cx-workspace-popover"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved restaurant details will be lost. You can keep editing
              and save them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscard(false);
                close();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

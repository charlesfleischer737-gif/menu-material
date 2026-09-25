"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Check, ImagePlus, X } from "lucide-react";
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
import { menuAddressProblem } from "@/lib/restaurant-identity";
import RestaurantStyle from "./restaurant-style";
import AccountDeletion from "./account-deletion";

/** Change the address guests' links and QR codes use; old ones keep working. */
function MenuAddressField({
  restaurant,
  refresh,
}: {
  restaurant: Row;
  refresh: () => Promise<void>;
}) {
  const [address, setAddress] = useState<string>(restaurant.slug),
    [status, setStatus] = useState<
      "" | "checking" | "available" | "taken" | "saving" | "saved"
    >(""),
    [error, setError] = useState("");
  const changed = address !== restaurant.slug,
    problem = changed ? menuAddressProblem(address) : "";
  useEffect(() => {
    if (!changed || problem) return;
    let active = true;
    const timer = setTimeout(() => {
      setStatus("checking");
      api(`restaurant/address?check=${encodeURIComponent(address)}`)
        .then((result) => {
          if (active) setStatus(result.available ? "available" : "taken");
        })
        .catch(() => {
          if (active) setStatus("");
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, changed, problem]);
  const origin = typeof window === "undefined" ? "" : window.location.host;
  return (
    <div className="field rs-address">
      <span id="rs-address-label">Menu address</span>
      <div className="rs-address-row">
        <span className="rs-address-prefix" aria-hidden="true">
          {origin}/m/
        </span>
        <input
          aria-labelledby="rs-address-label"
          aria-describedby="rs-address-help"
          value={address}
          maxLength={60}
          disabled={status === "saving"}
          onChange={(event) => {
            setAddress(event.target.value.toLowerCase().replace(/\s+/g, "-"));
            setStatus("");
            setError("");
          }}
        />
        <button
          type="button"
          className="cx-btn cx-secondary"
          disabled={
            !changed ||
            !!problem ||
            status === "taken" ||
            status === "checking" ||
            status === "saving"
          }
          onClick={async () => {
            setStatus("saving");
            setError("");
            try {
              await api("restaurant/address", { address });
              await refresh();
              setStatus("saved");
            } catch (e) {
              setError((e as Error).message);
              setStatus("");
            }
          }}
        >
          {status === "saving" ? "Saving…" : "Change address"}
        </button>
      </div>
      <small id="rs-address-help" role={error ? "alert" : undefined}>
        {error ||
          problem ||
          (status === "taken"
            ? "That address is taken. Try another."
            : status === "saved"
              ? "Address changed. Your old address still opens your menu."
              : restaurant.published
                ? "If you change it, your old address keeps working, so printed QR codes still open your menu."
                : "Your menu link and QR code use this address.")}
      </small>
    </div>
  );
}

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
    reservationUrl: restaurant.reservation_url || "",
    address: restaurant.address || "",
    phone: restaurant.phone || "",
    hours: restaurant.hours,
  };
}
export default function RestaurantSettings({
  open,
  close,
  state,
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
  // Logo uploads save on their own; their progress and errors show here, in
  // the dialog, rather than in the page's banner behind it.
  const [logo, setLogo] = useState({ saving: false, saved: false, error: "" });
  const previouslyOpen = useRef(false);
  const saveLock = useRef(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const formId = useId();
  const dirty = JSON.stringify(profile) !== baseline;
  const working = saving || logo.saving || !!busy;
  useEffect(() => {
    if (open && !previouslyOpen.current) {
      const next = restaurantProfile(state.restaurant);
      setProfile(next);
      setBaseline(JSON.stringify(next));
      setGroup("details");
      setError("");
      setSaved(false);
      setLogo({ saving: false, saved: false, error: "" });
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
  // Focus a field that needs attention, opening the section it is folded in.
  function reveal(field: HTMLElement) {
    const section = field.closest("details");
    if (section) section.open = true;
    requestAnimationFrame(() => field.focus());
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
      reveal(invalid);
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
              <TabsTrigger value="ordering">Contact & hours</TabsTrigger>
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
                  <div className="field">
                    <span id={`${formId}-logo`}>Logo (optional)</span>
                    {state.restaurant.logo_id && (
                      <img
                        className="rs-logo"
                        src={`/api/assets/${state.restaurant.logo_id}`}
                        alt="Current restaurant logo"
                      />
                    )}
                    <input
                      ref={logoInput}
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/heic,.heic"
                      onChange={async (event) => {
                        const input = event.currentTarget;
                        const file = input.files?.[0];
                        if (!file) return;
                        setLogo({ saving: true, saved: false, error: "" });
                        try {
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
                          setLogo({ saving: false, saved: true, error: "" });
                        } catch (reason) {
                          setLogo({
                            saving: false,
                            saved: false,
                            error: (reason as Error).message,
                          });
                        } finally {
                          // The same file can be chosen again after an error.
                          input.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="cx-btn cx-secondary rs-file-button"
                      aria-describedby={`${formId}-logo ${formId}-logo-status`}
                      disabled={working}
                      onClick={() => logoInput.current?.click()}
                    >
                      <ImagePlus size={16} aria-hidden="true" />
                      {logo.saving
                        ? "Uploading…"
                        : state.restaurant.logo_id
                          ? "Replace logo"
                          : "Choose a logo"}
                    </button>
                    {logo.error ? (
                      <small
                        id={`${formId}-logo-status`}
                        className="rs-field-error"
                        role="alert"
                      >
                        {logo.error}
                      </small>
                    ) : (
                      <small id={`${formId}-logo-status`} role="status">
                        {logo.saving
                          ? "Uploading your logo…"
                          : logo.saved
                            ? "Logo saved."
                            : "JPG, PNG or HEIC. Logo uploads save immediately."}
                      </small>
                    )}
                  </div>
                  <MenuAddressField
                    restaurant={state.restaurant}
                    refresh={refresh}
                  />
                  <AccountDeletion />
                </TabsContent>
                <TabsContent
                  forceMount
                  hidden={group !== "look"}
                  value="look"
                  data-settings-group="look"
                  className="rs-panel"
                >
                  <RestaurantStyle
                    {...{ profile, setProfile, state, refresh }}
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
                    {...{ profile, setProfile, state, refresh }}
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
                    <Check size={16} />
                    {group === "ordering"
                      ? "Saved. Guests see these details right away."
                      : "Saved. Publish your menu to show guests."}
                  </>
                ) : group === "ordering" ? (
                  "Contact details and hours show on your live menus."
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

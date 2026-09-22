"use client";
import { useState } from "react";
import { api, type Row } from "@/lib/client";
import { looks, PIPELINE_VERSION } from "@/lib/studio";
import { Button } from "@/components/ui/button";
import {
  AdminOperationStatus,
  type useAdminOperation,
} from "./admin-operation";

export function StudioReleasePanel({
  data,
  busy,
  done,
  operation,
}: {
  data: Row;
  busy: string;
  done: () => Promise<void>;
  operation: ReturnType<typeof useAdminOperation>;
}) {
  const [controls, setControls] = useState<Row>(data.studioRelease);
  const [search, setSearch] = useState("");
  const toggle = (field: string, value: string) => {
    operation.changed();
    setControls((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((entry: string) => entry !== value)
        : [...current[field], value],
    }));
  };
  const pipelines = [
    ...new Set<string>([
      PIPELINE_VERSION,
      ...(data.studioPipelines || []).map((row: Row) => row.version),
      ...controls.disabledPipelines,
    ]),
  ];
  const matchingLooks = looks.filter((look) =>
    (look.name + " " + look.cue).toLowerCase().includes(search.toLowerCase()),
  );
  const dirty =
    controls.mode !== data.studioRelease.mode ||
    ["pilotRestaurantIds", "disabledStyleIds", "disabledPipelines"].some(
      (field) =>
        controls[field].length !== data.studioRelease[field].length ||
        controls[field].some(
          (value: string) => !data.studioRelease[field].includes(value),
        ),
    );
  return (
    <section className="cx-panel">
      <h2>Photo Studio availability</h2>
      {data.studioRelease.configurationError && (
        <p role="alert">
          The saved availability settings could not be read. New creation is
          paused. Review and save the settings below to restore them; existing
          photos remain available.
        </p>
      )}
      <p>
        Control who can create photos and pause individual looks when a quality
        problem is found. Saved photos, approvals and downloads remain
        available.
      </p>
      <fieldset disabled={!!busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <label className="field">
          New photo creation
          <select
            value={controls.mode}
            onChange={(event) => {
              setControls({ ...controls, mode: event.target.value });
              operation.changed();
            }}
          >
            <option value="open">Available to all restaurants</option>
            <option value="pilot">Pilot restaurants only</option>
            <option value="paused">Pause new photos</option>
          </select>
        </label>
        {controls.mode === "pilot" && (
          <div className="ps2-release-options">
            <p>Select the restaurants included in the pilot.</p>
            {data.restaurants.map((restaurant: Row) => (
              <label className="check-label" key={restaurant.id}>
                <input
                  type="checkbox"
                  checked={controls.pilotRestaurantIds.includes(restaurant.id)}
                  onChange={() => toggle("pilotRestaurantIds", restaurant.id)}
                />
                {restaurant.name}
              </label>
            ))}
            {!controls.pilotRestaurantIds.length && (
              <p>
                No restaurants selected. Creation will be paused for everyone.
              </p>
            )}
          </div>
        )}
        <details className="ps2-release-options">
          <summary>
            Pause specific looks · {controls.disabledStyleIds.length} paused
          </summary>
          <label className="field">
            Find a look
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
            />
          </label>
          <div className="ps2-release-grid">
            {matchingLooks.map((look) => (
              <label className="check-label" key={look.id}>
                <input
                  type="checkbox"
                  checked={controls.disabledStyleIds.includes(look.id)}
                  onChange={() => toggle("disabledStyleIds", look.id)}
                />
                Pause {look.name}
              </label>
            ))}
          </div>
          {!matchingLooks.length && (
            <p className="admin-empty-note">
              No looks match “{search}”. Try another name or clear the search.
            </p>
          )}
        </details>
        <details className="ps2-release-options">
          <summary>
            Generation versions · {controls.disabledPipelines.length} paused
          </summary>
          <p>
            Use this when a generation change needs to be withdrawn. Jobs
            already submitted to the image service can finish; queued jobs that
            have not been submitted stop and release their reserved allowance.
          </p>
          {pipelines.map((version) => (
            <label className="check-label" key={version}>
              <input
                type="checkbox"
                checked={controls.disabledPipelines.includes(version)}
                onChange={() => toggle("disabledPipelines", version)}
              />
              Pause {version}
              {version === PIPELINE_VERSION ? " (current)" : ""}
            </label>
          ))}
        </details>
        <Button
          onClick={() =>
            operation.run(
              "Saving Photo Studio availability",
              "Photo Studio availability saved.",
              async () => {
                await api("admin/studio-release", {
                  revision: controls.revision,
                  mode: controls.mode,
                  pilotRestaurantIds: controls.pilotRestaurantIds,
                  disabledStyleIds: controls.disabledStyleIds,
                  disabledPipelines: controls.disabledPipelines,
                });
                await done();
              },
            )
          }
        >
          Save Photo Studio availability
        </Button>
        <AdminOperationStatus feedback={operation.feedback} dirty={dirty} />
      </fieldset>
    </section>
  );
}

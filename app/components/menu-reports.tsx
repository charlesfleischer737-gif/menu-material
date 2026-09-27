"use client";
import { Button } from "@/components/ui/button";
import { api, type Row } from "@/lib/client";
import {
  AdminOperationStatus,
  useAdminOperation,
  type AdminAction,
} from "./admin-operation";

const reasonLabels: Record<string, string> = {
  impersonation: "Pretends to be another business",
  misleading: "Misleading or a scam",
  offensive: "Offensive or harmful",
  copyright: "Uses someone’s photos or content",
  other: "Something else",
};

/**
 * Reports guests sent from "Report this page" on guest menus. Taking a
 * restaurant's pages offline hides its menus and specials until restored;
 * nothing is deleted.
 */
export function MenuReports({
  reports,
  busy,
  act,
  done,
}: {
  reports: Row[];
  busy: string;
  act: AdminAction;
  done: () => Promise<void>;
}) {
  const operation = useAdminOperation(act, busy);
  return (
    <section className="cx-panel">
      <h2>Guest reports</h2>
      <p>
        Pages guests reported from a menu. Open the page, then take the
        restaurant’s public pages offline if it breaks the usage guidelines.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="Guest reports"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Restaurant</th>
              <th>Reason</th>
              <th>Details</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const details = parseDetails(report.details);
              return (
                <tr key={report.id}>
                  <td>{new Date(report.created_at).toLocaleString()}</td>
                  <td>
                    <a
                      href={`/m/${details.address || report.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {report.name}
                    </a>
                    {report.public_suspended ? " · offline" : ""}
                  </td>
                  <td>{reasonLabels[details.reason] || details.reason}</td>
                  <td>{details.details || "—"}</td>
                  <td>
                    {!report.public_suspended && (
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        aria-label={`Take the public pages for ${report.name} offline`}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Take ${report.name}’s menus and specials offline? You can restore them later.`,
                            )
                          )
                            return;
                          operation.run(
                            "Taking pages offline",
                            "The restaurant’s public pages are offline.",
                            async () => {
                              await api("admin/takedown", {
                                id: report.restaurant_id,
                                offline: true,
                              });
                              await done();
                            },
                          );
                        }}
                      >
                        Take offline
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <AdminOperationStatus feedback={operation.feedback} />
    </section>
  );
}
function parseDetails(raw: unknown): Row {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : (raw as Row) || {};
  } catch {
    return {};
  }
}

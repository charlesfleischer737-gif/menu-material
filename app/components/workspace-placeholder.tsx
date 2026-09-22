"use client";

export default function WorkspacePlaceholder({
  title,
  message = "Opening saved work…",
  failed = false,
  onRetry,
  contentOnly = false,
  layout = "media",
  failureDetail = "Your saved work is kept. Try opening this view again.",
}: {
  title: string;
  message?: string;
  failed?: boolean;
  onRetry?: () => void;
  contentOnly?: boolean;
  layout?: "media" | "operations";
  failureDetail?: string;
}) {
  return (
    <section
      className="workspace-placeholder"
      aria-busy={!failed}
      aria-label={contentOnly ? title : undefined}
    >
      {!contentOnly && (
        <header className="mm-header">
          <div className="mm-heading">
            <h1 tabIndex={-1}>{title}</h1>
            <span
              data-workspace-status
              tabIndex={-1}
              role={failed ? "alert" : "status"}
            >
              {message}
            </span>
          </div>
        </header>
      )}
      {contentOnly && (
        <p
          data-workspace-status
          tabIndex={-1}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {failed ? (
        <div className="workspace-load-error">
          <p>{failureDetail}</p>
          {onRetry && (
            <button className="cx-btn cx-secondary" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : layout === "operations" ? (
        <div className="workspace-operations-skeleton" aria-hidden="true">
          {[0, 1].map((panel) => (
            <div key={panel}>
              <span />
              <span />
              <div>
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="workspace-skeleton" aria-hidden="true">
          <div className="workspace-skeleton-media" />
          <div className="workspace-skeleton-fields">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </section>
  );
}

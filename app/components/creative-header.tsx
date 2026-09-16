"use client";
import type { ReactNode } from "react";
export default function CreativeHeader({
  title,
  status,
  children,
  action,
}: {
  title: string;
  status?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mm-header">
      <div className="mm-heading">
        <h1 tabIndex={-1}>{title}</h1>
        {status && (
          <span role="status" aria-live="polite">
            {status}
          </span>
        )}
      </div>
      <div className="mm-header-tools">
        {children}
        {action}
      </div>
    </header>
  );
}

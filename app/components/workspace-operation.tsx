"use client";
import { useRef, useState } from "react";

export type WorkspaceAction = (
  label: string,
  task: () => Promise<void>,
) => Promise<void>;

/** Keep an operation's result beside its controls while the page-wide lock
 * continues to prevent concurrent workspace mutations. */
export function useWorkspaceOperation(act: WorkspaceAction, busy: string) {
  const lock = useRef(false);
  const [feedback, setFeedback] = useState({ kind: "idle", message: "" });
  async function run(
    pending: string,
    success: string,
    task: () => Promise<void>,
  ) {
    if (lock.current || busy) return;
    lock.current = true;
    try {
      await act(pending, async () => {
        setFeedback({ kind: "pending", message: pending + "…" });
        try {
          await task();
          setFeedback({ kind: "success", message: success });
        } catch (error) {
          setFeedback({ kind: "error", message: (error as Error).message });
        }
      });
    } finally {
      lock.current = false;
    }
  }
  return {
    run,
    feedback,
    changed: (message = "Unsaved changes") =>
      setFeedback({ kind: "idle", message }),
  };
}

export function WorkspaceOperationStatus({
  feedback,
}: {
  feedback: { kind: string; message: string };
}) {
  return (
    <p
      className="workspace-operation-status"
      data-state={feedback.kind}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.message}
    </p>
  );
}

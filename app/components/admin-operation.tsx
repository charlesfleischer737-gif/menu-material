"use client";
export {
  useWorkspaceOperation as useAdminOperation,
  type WorkspaceAction as AdminAction,
} from "./workspace-operation";

export function AdminOperationStatus({
  feedback,
  dirty,
}: {
  feedback: { kind: string; message: string };
  dirty?: boolean;
}) {
  return (
    <p
      className="admin-operation-status"
      data-state={feedback.kind}
      role={feedback.kind === "error" ? "alert" : "status"}
    >
      {feedback.kind === "idle" && dirty !== undefined
        ? dirty
          ? "Unsaved changes"
          : ""
        : feedback.message}
    </p>
  );
}

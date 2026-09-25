"use client";
import { useEffect } from "react";
import { recoverFromUpdates } from "@/lib/update-recovery";

/** Reloads once when a deploy has replaced files this tab still needs. */
export default function UpdateRecovery() {
  useEffect(() => recoverFromUpdates(), []);
  return null;
}

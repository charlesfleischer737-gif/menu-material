"use client";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/**
 * Notes where a visitor came from on the page they land on, since the
 * referring site and a link's campaign tags are gone after the next click.
 * It's kept in the browser and sent only with signup (lib/attribution.ts).
 */
export default function VisitSource() {
  useEffect(() => captureAttribution(), []);
  return null;
}

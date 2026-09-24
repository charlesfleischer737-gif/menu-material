"use client";
import { useEffect } from "react";
import { watchScroll } from "@/lib/scroll-memory";

/** Returns each page to where it was scrolled on Back, Forward and reload. */
export default function ScrollMemory() {
  useEffect(() => watchScroll(), []);
  return null;
}

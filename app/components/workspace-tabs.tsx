"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Substantial editing views share the same roving-focus tab pattern. */
export default function WorkspaceTabs({
  value,
  onValueChange,
  label,
  options,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  options: { value: string; label: string; disabled?: boolean }[];
  children: ReactNode;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      className="workspace-tabs"
    >
      <TabsList
        variant="line"
        className="workspace-tab-list"
        aria-label={label}
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value={value} className="workspace-tab-panel">
        {children}
      </TabsContent>
    </Tabs>
  );
}

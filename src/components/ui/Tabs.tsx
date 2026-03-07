"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tab components must be used within a Tabs provider");
  return ctx;
}

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border-b border-border",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Tab({ value, children, className, disabled }: TabProps) {
  const { value: activeValue, onChange } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        "relative px-3 py-2 text-sm transition-colors duration-150 outline-none cursor-pointer",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:pointer-events-none",
        isActive
          ? "text-accent font-medium"
          : "text-text-secondary hover:text-text-primary",
        isActive &&
          "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent after:rounded-full",
        className
      )}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className }: TabPanelProps) {
  const { value: activeValue } = useTabsContext();
  if (activeValue !== value) return null;

  return (
    <div role="tabpanel" className={cn("pt-4", className)}>
      {children}
    </div>
  );
}

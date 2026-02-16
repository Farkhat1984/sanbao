"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, FileText, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelStore } from "@/stores/panelStore";
import type { PanelTab } from "@/stores/panelStore";

const TAB_ICONS: Record<string, typeof FileText> = {
  artifact: FileText,
  article: BookOpen,
};

export function PanelTabBar() {
  const { tabs, activeTabId, switchTab, closeTab } = usePanelStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const activeEl = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeTabId]);

  if (tabs.length <= 1) return null;

  return (
    <div
      ref={scrollRef}
      className="flex items-center gap-0.5 px-2 py-1 border-b border-border overflow-x-auto scrollbar-none shrink-0"
    >
      {tabs.map((tab: PanelTab) => {
        const Icon = TAB_ICONS[tab.kind] || FileText;
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            className="relative flex items-center shrink-0"
          >
            <button
              onClick={() => switchTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer max-w-[160px]",
                isActive
                  ? "text-text-primary bg-surface-alt"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-alt/50"
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="h-4 w-4 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-alt transition-colors cursor-pointer ml-0.5 shrink-0"
            >
              <X className="h-2.5 w-2.5" />
            </button>
            {isActive && (
              <motion.div
                layoutId="panel-tab-underline"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

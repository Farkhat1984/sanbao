"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapseOverlayProps {
  /** "user" renders gradient from accent; "assistant" from surface-alt/bg */
  variant: "user" | "assistant";
  /** Whether the content uses rich markdown styling (bordered surface-alt container) */
  isRichMd?: boolean;
  /** Callback to toggle expand/collapse */
  onToggle: () => void;
  /** Whether the content is currently expanded */
  isExpanded: boolean;
}

/**
 * Gradient overlay with expand/collapse button.
 * When collapsed, renders a gradient at the bottom of the message.
 * When expanded, renders a standalone "collapse" button below the message.
 */
export function CollapseOverlay({ variant, isRichMd, onToggle, isExpanded }: CollapseOverlayProps) {
  if (isExpanded) {
    return (
      <div className={cn("flex mt-2", variant === "user" ? "justify-end" : "justify-center")}>
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-surface border border-border shadow-sm text-text-primary hover:border-accent hover:text-accent transition-colors cursor-pointer"
        >
          <ChevronDown className="h-3 w-3 rotate-180" />
          Свернуть
        </button>
      </div>
    );
  }

  // Collapsed: gradient overlay inside the bubble
  if (variant === "user") {
    return (
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-accent via-accent/90 to-transparent flex items-end justify-center pb-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-white/20 border border-white/30 shadow-sm text-white hover:bg-white/30 transition-colors cursor-pointer"
        >
          <ChevronDown className="h-3 w-3" />
          Показать полностью
        </button>
      </div>
    );
  }

  // Collapsed: assistant variant
  return (
    <div className={cn(
      "absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center pb-2",
      isRichMd
        ? "bg-gradient-to-t from-surface-alt via-surface-alt/90 to-transparent"
        : "bg-gradient-to-t from-bg via-bg/90 to-transparent"
    )}>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-surface border border-border shadow-sm text-text-primary hover:border-accent hover:text-accent transition-colors cursor-pointer"
      >
        <ChevronDown className="h-3 w-3" />
        Показать полностью
      </button>
    </div>
  );
}

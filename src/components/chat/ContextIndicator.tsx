"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContextIndicatorProps {
  usagePercent: number;
  isCompacting: boolean;
}

export function ContextIndicator({ usagePercent, isCompacting }: ContextIndicatorProps) {
  if (usagePercent < 30 && !isCompacting) return null;

  const isHigh = usagePercent >= 70;
  const isCritical = usagePercent >= 90;

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <div className="flex-1 h-1 rounded-full bg-surface-alt overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isCritical ? "bg-error" : isHigh ? "bg-amber-500" : "bg-accent"
          )}
          style={{ width: `${Math.min(100, usagePercent)}%` }}
        />
      </div>
      <span className="text-[10px] text-text-muted whitespace-nowrap">
        {isCompacting ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Сжатие контекста
          </span>
        ) : (
          `Контекст: ${usagePercent}%`
        )}
      </span>
    </div>
  );
}

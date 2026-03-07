"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CompassIcon } from "@/components/icons/CompassIcon";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  const DisplayIcon = Icon || CompassIcon;

  return (
    <div className={cn(
      "relative flex flex-col items-center justify-center text-center overflow-hidden",
      compact ? "py-8 px-4" : "py-16 px-4",
      className
    )}>
      {/* Dot grid background */}
      {!compact && <div className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />}

      <div className="relative">
        <div className={cn(
          "flex items-center justify-center rounded-2xl bg-surface-alt mb-4 mx-auto",
          compact ? "w-11 h-11" : "w-14 h-14"
        )}>
          <DisplayIcon
            className={cn("text-text-muted/50", compact ? "h-5 w-5" : "h-7 w-7")}
            aria-hidden="true"
          />
        </div>
        <h3 className={cn(
          "font-semibold text-text-primary mb-1",
          compact ? "text-sm" : "text-base"
        )}>
          {title}
        </h3>
        {description && (
          <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

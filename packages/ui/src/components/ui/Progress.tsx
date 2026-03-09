"use client";

import { cn } from "@/lib/utils";

type ProgressSize = "sm" | "md" | "lg";

interface ProgressProps {
  value: number;
  label?: string;
  size?: ProgressSize;
  className?: string;
}

const trackSizes: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function Progress({ value, label, size = "md", className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{label}</span>
          <span className="text-sm font-medium text-text-primary tabular-nums">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-full bg-surface-alt overflow-hidden",
          trackSizes[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

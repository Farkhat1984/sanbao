"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { TaskStep } from "@/types/task";

interface TaskStepListProps {
  steps: TaskStep[];
  onToggle: (index: number) => void;
}

export function TaskStepList({ steps, onToggle }: TaskStepListProps) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <button
          key={i}
          onClick={() => onToggle(i)}
          className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-alt transition-colors text-left cursor-pointer group"
        >
          <div
            className={cn(
              "h-4 w-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all",
              step.done
                ? "bg-accent border-accent"
                : "border-border group-hover:border-accent/50"
            )}
          >
            {step.done && <Check className="h-3 w-3 text-white" />}
          </div>
          <span
            className={cn(
              "text-xs leading-relaxed",
              step.done
                ? "text-text-muted line-through"
                : "text-text-primary"
            )}
          >
            {step.text}
          </span>
        </button>
      ))}
    </div>
  );
}

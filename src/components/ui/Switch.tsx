"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type SwitchSize = "sm" | "md";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: SwitchSize;
  disabled?: boolean;
  label?: string;
  className?: string;
  id?: string;
}

const trackSizes: Record<SwitchSize, string> = {
  sm: "w-8 h-[18px]",
  md: "w-10 h-[22px]",
};

const thumbSizes: Record<SwitchSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-[18px] w-[18px]",
};

const thumbTranslate: Record<SwitchSize, string> = {
  sm: "translate-x-[14px]",
  md: "translate-x-[18px]",
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onChange, size = "md", disabled, label, className, id }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <button
          ref={ref}
          id={switchId}
          role="switch"
          type="button"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors duration-150 outline-none cursor-pointer",
            "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
            "disabled:opacity-50 disabled:pointer-events-none",
            checked ? "bg-accent border-accent" : "bg-surface-alt border-border",
            trackSizes[size]
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform duration-150",
              thumbSizes[size],
              checked ? thumbTranslate[size] : "translate-x-0.5"
            )}
          />
        </button>
        {label && (
          <label
            htmlFor={switchId}
            className="text-sm text-text-primary cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";

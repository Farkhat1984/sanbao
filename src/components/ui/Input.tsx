"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 px-4 rounded-xl bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted",
            "transition-all duration-150 outline-none",
            "focus:border-accent focus:shadow-[var(--shadow-input-focus)]",
            error && "border-error focus:border-error",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
        {hint && !error && <p className="text-xs text-text-secondary">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

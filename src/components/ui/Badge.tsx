"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "legal" | "gold" | "success" | "warning" | "error";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-surface-alt text-text-secondary border-border",
  accent: "bg-accent-light text-accent border-accent/20",
  legal: "bg-legal-ref-bg text-legal-ref border-legal-ref/20",
  gold: "bg-legal-ref-bg text-legal-ref border-legal-ref/20",
  success: "bg-success-light text-success border-success/20",
  warning: "bg-warning-light text-warning border-warning/20",
  error: "bg-error-light text-error border-error/20",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

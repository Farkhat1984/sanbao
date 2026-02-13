import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: string;
}

export function StatsCard({
  icon: Icon,
  label,
  value,
  color = "text-accent",
}: StatsCardProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center bg-surface-alt",
            color
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

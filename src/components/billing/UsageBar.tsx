import { cn } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  current: number;
  max: number;
  color?: string;
}

export function UsageBar({
  label,
  current,
  max,
  color = "bg-accent",
}: UsageBarProps) {
  const isUnlimited = max === 0;
  const percentage = isUnlimited ? 0 : Math.min(100, (current / max) * 100);
  const isNearLimit = !isUnlimited && percentage >= 80;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-text-secondary">{label}</span>
        <span
          className={cn(
            "text-sm font-medium",
            isNearLimit ? "text-error" : "text-text-primary"
          )}
        >
          {current.toLocaleString("ru-RU")}
          {isUnlimited ? " / ∞" : ` / ${max.toLocaleString("ru-RU")}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-alt overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isNearLimit ? "bg-error" : color
          )}
          style={{ width: isUnlimited ? "0%" : `${percentage}%` }}
        />
      </div>
    </div>
  );
}

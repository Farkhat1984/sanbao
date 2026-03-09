import { cn } from "@/lib/utils";

interface TabFilterOption {
  value: string;
  label: string;
}

interface TabFilterProps {
  /** Available filter options */
  options: readonly TabFilterOption[];
  /** Currently selected value (empty string = "all") */
  value: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** Label for the "all" option (default: "Все") */
  allLabel?: string;
}

/**
 * Reusable pill-style tab filter for admin list pages.
 * Renders a horizontally-scrollable row of filter buttons
 * with an "all" option prepended.
 */
export function TabFilter({
  options,
  value,
  onChange,
  allLabel = "Все",
}: TabFilterProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      <button
        onClick={() => onChange("")}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer",
          !value
            ? "bg-accent text-white"
            : "text-text-secondary hover:bg-surface-alt",
        )}
      >
        {allLabel}
      </button>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer",
            value === opt.value
              ? "bg-accent text-white"
              : "text-text-secondary hover:bg-surface-alt",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

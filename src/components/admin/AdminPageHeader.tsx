import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  /** Page title */
  title: string;
  /** Subtitle with optional count interpolation */
  subtitle: string;
  /** Optional count to display in subtitle parentheses */
  count?: number;
  /** Action button(s) rendered on the right side */
  action?: ReactNode;
}

/**
 * Shared page header for admin pages.
 * Renders title, subtitle with optional count, and an action slot.
 */
export function AdminPageHeader({
  title,
  subtitle,
  count,
  action,
}: AdminPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary font-[family-name:var(--font-display)]">
          {title}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {subtitle}
          {count !== undefined && ` (${count})`}
        </p>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

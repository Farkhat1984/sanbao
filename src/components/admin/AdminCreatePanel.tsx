import type { ReactNode } from "react";

interface AdminCreatePanelProps {
  /** Whether the panel is expanded */
  isOpen: boolean;
  /** Panel title (e.g. "Новый провайдер") */
  title?: string;
  /** Panel contents (form fields, buttons) */
  children: ReactNode;
}

/**
 * Collapsible wrapper for "add new" forms in admin pages.
 * Renders with accent border and consistent spacing when open.
 */
export function AdminCreatePanel({
  isOpen,
  title,
  children,
}: AdminCreatePanelProps) {
  if (!isOpen) return null;

  return (
    <div className="bg-surface border border-accent/30 rounded-2xl p-5 mb-4">
      {title && (
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

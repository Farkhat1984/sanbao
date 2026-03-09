import { Trash2 } from "lucide-react";

interface AdminDeleteButtonProps {
  /** Click handler — should include confirmation logic */
  onClick: () => void;
  /** Accessible label (default: "Удалить") */
  ariaLabel?: string;
}

/**
 * Standardized trash-icon delete button used across admin list pages.
 * 8x8 rounded-lg with error hover state.
 */
export function AdminDeleteButton({
  onClick,
  ariaLabel = "Удалить",
}: AdminDeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="h-8 w-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

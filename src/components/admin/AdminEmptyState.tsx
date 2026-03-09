interface AdminEmptyStateProps {
  /** Message to display when the list is empty */
  message: string;
}

/**
 * Shared empty state for admin list pages.
 * Renders a centered text message in the standard admin style.
 */
export function AdminEmptyState({ message }: AdminEmptyStateProps) {
  return (
    <p className="text-sm text-text-secondary text-center py-8">{message}</p>
  );
}

interface AdminListSkeletonProps {
  /** Number of skeleton rows to render (default: 3) */
  rows?: number;
  /** Height class for each skeleton row (default: "h-20") */
  height?: string;
}

/**
 * Shared loading skeleton for admin list pages.
 * Renders animated placeholder cards matching the admin card style.
 */
export function AdminListSkeleton({
  rows = 3,
  height = "h-20",
}: AdminListSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`bg-surface border border-border rounded-2xl p-5 animate-pulse ${height}`}
        />
      ))}
    </div>
  );
}

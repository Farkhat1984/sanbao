"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Ship's lantern icon for notifications and alerts. */
export function LanternIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Handle/bail */}
      <path d="M9 3 C9 1.5, 15 1.5, 15 3" />
      <line x1="9" y1="3" x2="9" y2="5" />
      <line x1="15" y1="3" x2="15" y2="5" />

      {/* Top cap */}
      <rect x="8" y="5" width="8" height="2" rx="0.5" />

      {/* Lantern body (glass) */}
      <path d="M8 7 L7 18 C7 18.5, 7.5 19, 8 19 L16 19 C16.5 19, 17 18.5, 17 18 L16 7" />

      {/* Light glow (inner) */}
      <ellipse cx="12" cy="13" rx="2.5" ry="4" opacity={0.3} fill="currentColor" stroke="none" />

      {/* Flame/wick */}
      <path d="M12 10 C11 12, 11.5 14, 12 15 C12.5 14, 13 12, 12 10 Z" fill="currentColor" stroke="none" />

      {/* Bottom base */}
      <rect x="8" y="19" width="8" height="2" rx="0.5" />

      {/* Cross bars (decorative) */}
      <line x1="7.5" y1="12" x2="16.5" y2="12" opacity={0.4} />
    </svg>
  );
}

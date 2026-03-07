"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Three horizontal wave lines for section dividers and decorative elements. */
export function WaveIcon({ size = 24, className = "" }: IconProps) {
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
      {/* Top wave */}
      <path d="M2 7 C4 5, 6 5, 8 7 S12 9, 14 7 S18 5, 20 7 L22 7" />
      {/* Middle wave */}
      <path d="M2 12 C4 10, 6 10, 8 12 S12 14, 14 12 S18 10, 20 12 L22 12" />
      {/* Bottom wave */}
      <path d="M2 17 C4 15, 6 15, 8 17 S12 19, 14 17 S18 15, 20 17 L22 17" />
    </svg>
  );
}

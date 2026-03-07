"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Concentric rings emanating from center for status and loading indicators. */
export function SonarIcon({ size = 24, className = "" }: IconProps) {
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
      {/* Outer ring */}
      <circle cx="12" cy="12" r="10" opacity={0.2} />
      {/* Middle ring */}
      <circle cx="12" cy="12" r="6.5" opacity={0.5} />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="3.5" opacity={0.8} />
      {/* Center dot */}
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

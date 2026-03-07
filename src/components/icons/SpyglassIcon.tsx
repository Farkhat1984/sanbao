"use client";

interface IconProps {
  size?: number;
  className?: string;
}

/** Spyglass/telescope icon for search functionality. */
export function SpyglassIcon({ size = 24, className = "" }: IconProps) {
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
      {/* Lens circle */}
      <circle cx="8" cy="8" r="5" />
      {/* Lens rim highlight */}
      <circle cx="8" cy="8" r="3.5" opacity={0.4} />
      {/* Tube body (tapered rectangle) */}
      <line x1="11.8" y1="11.8" x2="21" y2="21" strokeWidth={3} />
      {/* Tube outline for definition */}
      <line x1="11.8" y1="11.8" x2="21" y2="21" strokeWidth={4} opacity={0.3} />
      {/* Tube cap */}
      <line x1="19.5" y1="22.5" x2="22.5" y2="19.5" strokeWidth={1.5} />
    </svg>
  );
}
